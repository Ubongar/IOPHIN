/**
 * RBAC (Role-Based Access Control) Module for IOPHIN
 * Handles user management, role assignment, and permissions
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Nigerian States for geographic scope
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi',
  'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun',
  'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

// ── Role Management ────────────────────────────────────────────────────────

export async function getRoles() {
  try {
    const result = await pool.query(
      'SELECT id, name, display_name, description, is_system_role, created_at FROM roles ORDER BY id'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching roles:', error);
    return null;
  }
}

export async function getRoleByName(name) {
  try {
    const result = await pool.query(
      'SELECT * FROM roles WHERE name = $1', [name]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching role:', error);
    return null;
  }
}

// ── Permission Management ──────────────────────────────────────────────────

export async function getPermissions() {
  try {
    const result = await pool.query(
      'SELECT id, name, display_name, description, module FROM permissions ORDER BY module, name'
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return null;
  }
}

export async function getRolePermissions(roleId) {
  try {
    const result = await pool.query(`
      SELECT p.id, p.name, p.display_name, p.description, p.module
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.name
    `, [roleId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return null;
  }
}

export async function getUserPermissions(userId) {
  try {
    const result = await pool.query(`
      SELECT DISTINCT p.id, p.name, p.display_name, p.module
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN users u ON u.role_id = rp.role_id
      WHERE u.id = $1
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }
}

export async function userHasPermission(userId, permissionName) {
  try {
    const result = await pool.query(`
      SELECT 1 FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN users u ON u.role_id = rp.role_id
      WHERE u.id = $1 AND p.name = $2
    `, [userId, permissionName]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

// ── User Management ────────────────────────────────────────────────────────

export async function getUsers(options = {}) {
  try {
    const { page = 1, limit = 10, search = '', role = '', state = '' } = options;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['1=1'];
    let params = [];
    let paramIdx = 1;

    if (search) {
      whereConditions.push(`(u.full_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR u.username ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (role) {
      whereConditions.push(`r.name = $${paramIdx}`);
      params.push(role);
      paramIdx++;
    }

    if (state) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM user_geographic_scopes ugs 
        WHERE ugs.user_id = u.id AND ugs.state = $${paramIdx}
      )`);
      params.push(state);
      paramIdx++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT u.id) as total
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereClause}
    `, params);

    // Get users with pagination
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.organization, u.is_active,
        u.last_active, u.last_login, u.created_at,
        r.id as role_id, r.name as role_name, r.display_name as role_display_name,
        (
          SELECT ARRAY_AGG(DISTINCT ugs.state)
          FROM user_geographic_scopes ugs
          WHERE ugs.user_id = u.id
        ) as assigned_states
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    return {
      users: result.rows,
      total: parseInt(countResult.rows[0].total),
      page,
      totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
    };
  } catch (error) {
    console.error('Error fetching users:', error);
    return null;
  }
}

export async function getUserById(userId) {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.email, u.full_name, u.organization, u.is_active,
        u.last_active, u.last_login, u.created_at, u.created_by,
        r.id as role_id, r.name as role_name, r.display_name as role_display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) return null;

    const user = result.rows[0];

    // Get geographic scopes
    const scopesResult = await pool.query(`
      SELECT state, lga_name
      FROM user_geographic_scopes
      WHERE user_id = $1
      ORDER BY state, lga_name
    `, [userId]);

    user.geographic_scopes = scopesResult.rows;

    // Get permissions
    user.permissions = await getUserPermissions(userId);

    return user;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function createUser(data, createdByUserId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { username, email, passwordHash, fullName, roleId, organization, geographicScopes = [] } = data;

    // Insert user
    const userResult = await client.query(`
      INSERT INTO users (username, email, password_hash, full_name, role_id, organization, created_by, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
      RETURNING id, username, email, full_name, organization, created_at
    `, [username || null, email.toLowerCase(), passwordHash, fullName, roleId, organization, createdByUserId]);

    const newUser = userResult.rows[0];

    // Insert geographic scopes
    if (geographicScopes.length > 0) {
      for (const scope of geographicScopes) {
        await client.query(`
          INSERT INTO user_geographic_scopes (user_id, state, lga_name)
          VALUES ($1, $2, $3)
        `, [newUser.id, scope.state, scope.lga_name || null]);
      }
    }

    // Log action
    await client.query(`
      INSERT INTO user_audit_log (user_id, action, target_user_id, details)
      VALUES ($1, 'user_created', $2, $3)
    `, [createdByUserId, newUser.id, JSON.stringify({ email, fullName, roleId })]);

    await client.query('COMMIT');
    return { user: newUser };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      if (error.constraint?.includes('email')) throw new Error('Email already registered');
      if (error.constraint?.includes('username')) throw new Error('Username already taken');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateUser(userId, data, updatedByUserId = null) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { username, email, fullName, roleId, organization, isActive, geographicScopes } = data;

    // Update user
    const updateFields = [];
    const updateValues = [];
    let paramIdx = 1;

    if (username !== undefined) {
      updateFields.push(`username = $${paramIdx++}`);
      updateValues.push(username);
    }
    if (email !== undefined) {
      updateFields.push(`email = $${paramIdx++}`);
      updateValues.push(email.toLowerCase());
    }
    if (fullName !== undefined) {
      updateFields.push(`full_name = $${paramIdx++}`);
      updateValues.push(fullName);
    }
    if (roleId !== undefined) {
      updateFields.push(`role_id = $${paramIdx++}`);
      updateValues.push(roleId);
    }
    if (organization !== undefined) {
      updateFields.push(`organization = $${paramIdx++}`);
      updateValues.push(organization);
    }
    if (isActive !== undefined) {
      updateFields.push(`is_active = $${paramIdx++}`);
      updateValues.push(isActive);
    }

    if (updateFields.length > 0) {
      updateValues.push(userId);
      await client.query(`
        UPDATE users SET ${updateFields.join(', ')}
        WHERE id = $${paramIdx}
      `, updateValues);
    }

    // Update geographic scopes if provided
    if (geographicScopes !== undefined) {
      // Delete existing scopes
      await client.query('DELETE FROM user_geographic_scopes WHERE user_id = $1', [userId]);

      // Insert new scopes
      for (const scope of geographicScopes) {
        await client.query(`
          INSERT INTO user_geographic_scopes (user_id, state, lga_name)
          VALUES ($1, $2, $3)
        `, [userId, scope.state, scope.lga_name || null]);
      }
    }

    // Log action
    await client.query(`
      INSERT INTO user_audit_log (user_id, action, target_user_id, details)
      VALUES ($1, 'user_updated', $2, $3)
    `, [updatedByUserId, userId, JSON.stringify(data)]);

    await client.query('COMMIT');
    return await getUserById(userId);
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      if (error.constraint?.includes('email')) throw new Error('Email already registered');
      if (error.constraint?.includes('username')) throw new Error('Username already taken');
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeUserAccess(userId, revokedByUserId = null) {
  try {
    const result = await pool.query(`
      UPDATE users SET is_active = FALSE
      WHERE id = $1
      RETURNING id, email, full_name
    `, [userId]);

    if (result.rows.length === 0) return null;

    // Log action
    await pool.query(`
      INSERT INTO user_audit_log (user_id, action, target_user_id, details)
      VALUES ($1, 'access_revoked', $2, '{}')
    `, [revokedByUserId, userId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error revoking user access:', error);
    return null;
  }
}

export async function restoreUserAccess(userId, restoredByUserId = null) {
  try {
    const result = await pool.query(`
      UPDATE users SET is_active = TRUE
      WHERE id = $1
      RETURNING id, email, full_name
    `, [userId]);

    if (result.rows.length === 0) return null;

    // Log action
    await pool.query(`
      INSERT INTO user_audit_log (user_id, action, target_user_id, details)
      VALUES ($1, 'access_restored', $2, '{}')
    `, [restoredByUserId, userId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error restoring user access:', error);
    return null;
  }
}

export async function deleteUser(userId, deletedByUserId = null) {
  try {
    // Log action before deletion
    await pool.query(`
      INSERT INTO user_audit_log (user_id, action, target_user_id, details)
      VALUES ($1, 'user_deleted', $2, '{}')
    `, [deletedByUserId, userId]);

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error deleting user:', error);
    return false;
  }
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export async function getAuditLog(options = {}) {
  try {
    const { page = 1, limit = 50, userId = null, action = null } = options;
    const offset = (page - 1) * limit;
    
    let whereConditions = ['1=1'];
    let params = [];
    let paramIdx = 1;

    if (userId) {
      whereConditions.push(`(al.user_id = $${paramIdx} OR al.target_user_id = $${paramIdx})`);
      params.push(userId);
      paramIdx++;
    }

    if (action) {
      whereConditions.push(`al.action = $${paramIdx}`);
      params.push(action);
      paramIdx++;
    }

    const whereClause = whereConditions.join(' AND ');

    const result = await pool.query(`
      SELECT 
        al.id, al.action, al.details, al.ip_address, al.created_at,
        u.email as performed_by_email, u.full_name as performed_by_name,
        tu.email as target_email, tu.full_name as target_name
      FROM user_audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN users tu ON al.target_user_id = tu.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `, [...params, limit, offset]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return null;
  }
}

// ── Geographic Scope Helpers ───────────────────────────────────────────────

export async function getUserGeographicScopes(userId) {
  try {
    const result = await pool.query(`
      SELECT state, lga_name
      FROM user_geographic_scopes
      WHERE user_id = $1
      ORDER BY state, lga_name
    `, [userId]);
    return result.rows;
  } catch (error) {
    console.error('Error fetching geographic scopes:', error);
    return [];
  }
}

export async function getStatesWithLGA() {
  try {
    const result = await pool.query(`
      SELECT DISTINCT state, lga_name
      FROM poverty_hotspots
      WHERE state IS NOT NULL
      ORDER BY state, lga_name
    `);
    
    // Group by state
    const stateMap = {};
    result.rows.forEach(row => {
      if (!stateMap[row.state]) {
        stateMap[row.state] = [];
      }
      if (row.lga_name && !stateMap[row.state].includes(row.lga_name)) {
        stateMap[row.state].push(row.lga_name);
      }
    });
    
    return stateMap;
  } catch (error) {
    console.error('Error fetching states with LGAs:', error);
    return {};
  }
}

// ── Middleware for RBAC ────────────────────────────────────────────────────

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const hasPermission = await userHasPermission(req.user.id, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden - Insufficient permissions' });
    }
    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden - Super Admin access required' });
  }
  next();
}

export default {
  getRoles,
  getRoleByName,
  getPermissions,
  getRolePermissions,
  getUserPermissions,
  userHasPermission,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  revokeUserAccess,
  restoreUserAccess,
  deleteUser,
  getAuditLog,
  getUserGeographicScopes,
  getStatesWithLGA,
  requirePermission,
  requireSuperAdmin,
  NIGERIAN_STATES
};
