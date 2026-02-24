-- ============================================================
-- IOPHIN User Table Fix Script
-- Run this SQL to fix missing columns and set up admin access
-- ============================================================

-- Add missing columns to users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER DEFAULT 3 REFERENCES roles(id);

-- Set is_active to TRUE for all existing users
UPDATE users SET is_active = TRUE WHERE is_active IS NULL;

-- Ensure roles exist
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
    ('super_admin', 'Super Administrator', 'Full system access with user management capabilities', TRUE),
    ('admin', 'Administrator', 'Administrative access to manage data and view reports', TRUE),
    ('user', 'User', 'Standard user access to view and analyze data', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Ensure permissions exist
INSERT INTO permissions (name, display_name, description, module) VALUES
    ('users.view', 'View Users', 'View user list and details', 'users'),
    ('users.create', 'Create Users', 'Create new user accounts', 'users'),
    ('users.edit', 'Edit Users', 'Edit user details and roles', 'users'),
    ('users.delete', 'Delete Users', 'Delete or revoke user access', 'users'),
    ('data.view', 'View Data', 'View poverty hotspot data', 'data'),
    ('data.edit', 'Edit Data', 'Create, update, delete data records', 'data'),
    ('data.export', 'Export Data', 'Export data to files', 'data'),
    ('reports.view', 'View Reports', 'View generated reports', 'reports'),
    ('reports.create', 'Create Reports', 'Generate new reports', 'reports'),
    ('alerts.view', 'View Alerts', 'View system alerts', 'alerts'),
    ('alerts.manage', 'Manage Alerts', 'Configure and manage alerts', 'alerts'),
    ('interventions.view', 'View Interventions', 'View intervention programs', 'interventions'),
    ('interventions.manage', 'Manage Interventions', 'Create and edit interventions', 'interventions'),
    ('settings.view', 'View Settings', 'View system settings', 'settings'),
    ('settings.edit', 'Edit Settings', 'Modify system settings', 'settings')
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to super_admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- Assign permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN (
    'data.view', 'data.edit', 'data.export',
    'reports.view', 'reports.create',
    'alerts.view', 'alerts.manage',
    'interventions.view', 'interventions.manage',
    'settings.view'
) ON CONFLICT DO NOTHING;

-- Assign permissions to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
    'data.view', 'data.export',
    'reports.view',
    'alerts.view',
    'interventions.view'
) ON CONFLICT DO NOTHING;

-- ============================================================
-- IMPORTANT: Set your user as super_admin
-- Replace 'mikeerap14@gmail.com' with your actual email if different
-- ============================================================

-- Set the user as super_admin (role_id = 1) and active
UPDATE users 
SET role_id = 1, is_active = TRUE 
WHERE email = 'mikeerap14@gmail.com';

-- If the user doesn't exist, show a message
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'mikeerap14@gmail.com') THEN
        RAISE NOTICE 'User with email mikeerap14@gmail.com not found. Please register first or update the email in this script.';
    END IF;
END $$;

-- Verify the fix
SELECT 
    u.id, 
    u.email, 
    u.full_name, 
    u.is_active, 
    r.name as role_name,
    r.display_name as role_display_name
FROM users u
LEFT JOIN roles r ON u.role_id = r.id
ORDER BY u.id;
