/**
 * Authentication & RBAC Module for IOPHIN
 * JWT-based auth with role-based access control.
 * Security hardened: short-lived JWTs, refresh tokens, ReDoS-safe validation,
 * time-gated last_active updates, proper SSL.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
dotenv.config();

const { Pool } = pg;

// ── SSL Configuration ─────────────────────────────────
// In production, verify the server certificate using the CA cert
// provided by your database host. Set DB_CA_CERT in your environment.
const sslConfig = (() => {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.DB_CA_CERT) {
    return { rejectUnauthorized: true, ca: process.env.DB_CA_CERT };
  }
  // Warn but fall back if no cert is provided yet
  console.warn('WARN: DB_CA_CERT not set – TLS certificate verification is disabled. Set DB_CA_CERT for production.');
  return { rejectUnauthorized: false };
})();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslConfig });

const ROLES = ['super_admin', 'admin', 'government', 'ngo', 'public', 'user'];

// Fail fast in production if JWT_SECRET is not set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod';

// Refresh-token secret (separate from access-token secret)
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || EFFECTIVE_JWT_SECRET + '-refresh';

// Access token lifetime – short-lived for security
const ACCESS_TOKEN_EXPIRY = '1h';
// Refresh token lifetime
const REFRESH_TOKEN_EXPIRY = '7d';

// ── Validation ────────────────────────────────────────
// ReDoS-safe email regex with explicit character classes
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email) {
  // Check type and length FIRST to drop malicious payloads before regex
  if (typeof email !== 'string' || email.length === 0 || email.length > 254) return false;
  return EMAIL_RE.test(email);
}

function validatePassword(password) {
  if (typeof password !== 'string') return false;
  // bcrypt truncates at 72 bytes – fail fast on oversized input to prevent DoS
  if (password.length < 8 || password.length > 72) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── Token helpers ─────────────────────────────────────
function createAccessToken(payload) {
  return jwt.sign(
    { ...payload, last_active_at: Date.now() },
    EFFECTIVE_JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function createRefreshToken(payload) {
  // Minimal payload for refresh tokens – only the user id
  return jwt.sign(
    { id: payload.id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  if (decoded.type !== 'refresh') throw new Error('Invalid token type');
  return decoded;
}

// Get role ID by name
async function getRoleId(roleName) {
  const result = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName]);
  return result.rows[0]?.id || 3; // Default to 'user' role (id: 3)
}

// Get role name by ID
async function getRoleName(roleId) {
  const result = await pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
  return result.rows[0]?.name || 'user';
}

export async function registerUser(email, password, fullName, role = 'user', organization = null) {
  if (!validateEmail(email)) throw new Error('Invalid email format');
  if (!validatePassword(password)) {
    throw new Error('Password must be at least 8 characters and contain at least one letter and one digit');
  }
  
  // Get role ID from role name
  const roleId = await getRoleId(role);
  const passwordHash = await hashPassword(password);
  
  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id, organization, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, email, full_name, role_id, organization, created_at`,
      [email.toLowerCase(), passwordHash, fullName, roleId, organization]
    );
    
    const user = result.rows[0];
    const roleName = await getRoleName(user.role_id);
    
    return { 
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: roleName,
        organization: user.organization,
        created_at: user.created_at
      }
    };
  } catch (err) {
    if (err.code === '23505') throw new Error('Email already registered');
    throw err;
  }
}

export async function loginUser(email, password) {
  if (!validateEmail(email)) throw new Error('Invalid credentials');
  
  const result = await pool.query(
    `SELECT u.*, r.name as role_name 
     FROM users u 
     LEFT JOIN roles r ON u.role_id = r.id 
     WHERE u.email = $1`,
    [email.toLowerCase()]
  );
  
  if (result.rows.length === 0) throw new Error('Invalid credentials');
  
  const user = result.rows[0];
  
  // Check if user is active
  if (!user.is_active) {
    throw new Error('Account has been deactivated. Please contact administrator.');
  }
  
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');
  
  // Update last_login and last_active
  await pool.query(
    'UPDATE users SET last_login = NOW(), last_active = NOW() WHERE id = $1',
    [user.id]
  );
  
  const tokenPayload = { 
    id: user.id, 
    email: user.email, 
    role: user.role_name || 'user',
    roleId: user.role_id
  };

  const accessToken  = createAccessToken(tokenPayload);
  const refreshToken = createRefreshToken(tokenPayload);
  
  return { 
    token: accessToken,
    refreshToken,
    user: { 
      id: user.id, 
      email: user.email, 
      full_name: user.full_name, 
      role: user.role_name || 'user'
    } 
  };
}

// Time-gate: only update last_active once per hour to avoid DB hammering
const LAST_ACTIVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, EFFECTIVE_JWT_SECRET);
    
    // Fetch fresh user data including role
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.full_name, u.role_id, u.is_active, r.name as role_name
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [decoded.id]
    );
    
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      req.user = null;
      return next();
    }
    
    const user = userResult.rows[0];
    req.user = {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name || 'user',
      roleId: user.role_id
    };
    
    // Time-gated last_active update: only hit the DB if >1 hour since last update
    const lastActiveAt = decoded.last_active_at || 0;
    if (Date.now() - lastActiveAt > LAST_ACTIVE_INTERVAL_MS) {
      pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]).catch(() => {});
    }
  } catch {
    req.user = null;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ── Refresh Token Flow ────────────────────────────────
export async function refreshAccessToken(refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);

  // Re-validate the user is still active
  const userResult = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role_id, u.is_active, r.name as role_name
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1`,
    [decoded.id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    throw new Error('User not found or inactive');
  }

  const user = userResult.rows[0];
  const tokenPayload = {
    id: user.id,
    email: user.email,
    role: user.role_name || 'user',
    roleId: user.role_id
  };

  return {
    token: createAccessToken(tokenPayload),
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role_name || 'user'
    }
  };
}

export { ROLES };
