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

const ROLES = ['admin', 'government', 'ngo', 'public'];

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
  return jwt.sign(payload, process.env.JWT_SECRET || 'fallback-secret', { expiresIn: '7d' });
}

export async function registerUser(email, password, fullName, role = 'public', organization = null) {
  if (!ROLES.includes(role)) role = 'public';
  const passwordHash = await hashPassword(password);
  try {
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, organization)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role, organization, created_at`,
      [email.toLowerCase(), passwordHash, fullName, role, organization]
    );
    return { user: result.rows[0] };
  } catch (err) {
    if (err.code === '23505') throw new Error('Email already registered');
    throw err;
  }
}

export async function loginUser(email, password) {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]
  );
  if (result.rows.length === 0) throw new Error('Invalid credentials');
  const user = result.rows[0];
  const valid = await comparePassword(password, user.password_hash);
  if (!valid) throw new Error('Invalid credentials');
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
  const token = await createToken({ id: user.id, email: user.email, role: user.role });
  return { token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } };
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
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
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
