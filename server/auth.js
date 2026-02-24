/**
 * Authentication & RBAC Module for IOPHIN
 * JWT-based auth with role-based access control.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

const ROLES = ['super_admin', 'admin', 'government', 'ngo', 'public', 'user'];

// Fail fast in production if JWT_SECRET is not set
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('FATAL: JWT_SECRET environment variable is required in production');
  process.exit(1);
}
const EFFECTIVE_JWT_SECRET = JWT_SECRET || 'fallback-dev-secret-do-not-use-in-prod';

// Email validation regex (RFC 5322 simplified)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return typeof email === 'string' && EMAIL_RE.test(email) && email.length <= 254;
}

function validatePassword(password) {
  // Minimum 8 chars, at least one letter and one digit
  if (typeof password !== 'string') return false;
  if (password.length < 8) return false;
  if (!/[A-Za-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

async function hashPassword(password) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.hash(password, 12);
}

async function comparePassword(password, hash) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.compare(password, hash);
}

async function createToken(payload) {
  const jwt = (await import('jsonwebtoken')).default;
  return jwt.sign(payload, EFFECTIVE_JWT_SECRET, { expiresIn: '7d' });
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
  
  const token = await createToken({ 
    id: user.id, 
    email: user.email, 
    role: user.role_name || 'user',
    roleId: user.role_id
  });
  
  return { 
    token, 
    user: { 
      id: user.id, 
      email: user.email, 
      full_name: user.full_name, 
      role: user.role_name || 'user'
    } 
  };
}

export async function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const jwt = (await import('jsonwebtoken')).default;
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
    
    // Update last_active
    pool.query('UPDATE users SET last_active = NOW() WHERE id = $1', [user.id]).catch(() => {});
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

export { ROLES };
