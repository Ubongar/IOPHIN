-- ============================================================
-- IOPHIN PostgreSQL Initialization Script
-- Runs on first DB startup via Docker or manually
-- ============================================================

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add geometry column to poverty_hotspots if not exists
-- (The existing table stores geometry as TEXT; we add a proper PostGIS column)
ALTER TABLE poverty_hotspots ADD COLUMN IF NOT EXISTS geom geometry(MultiPolygon, 4326);

-- Create spatial index
CREATE INDEX IF NOT EXISTS idx_hotspots_geom ON poverty_hotspots USING GIST (geom);

-- ── Change Log / Audit Table ───────────────────────────────
CREATE TABLE IF NOT EXISTS risk_change_log (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    old_risk_level VARCHAR(50),
    new_risk_level VARCHAR(50),
    old_composite_score FLOAT,
    new_composite_score FLOAT,
    delta_composite FLOAT,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    change_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_change_log_date ON risk_change_log (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_lga ON risk_change_log (lga_name);

-- ── Anomaly Detection Log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS anomaly_alerts (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    anomaly_type VARCHAR(100),
    severity VARCHAR(50),
    description TEXT,
    metric_name VARCHAR(100),
    expected_value FLOAT,
    actual_value FLOAT,
    deviation_pct FLOAT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged BOOLEAN DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_anomaly_lga ON anomaly_alerts (lga_name);
CREATE INDEX IF NOT EXISTS idx_anomaly_date ON anomaly_alerts (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_unacknowledged ON anomaly_alerts (detected_at DESC) WHERE acknowledged = false;

-- ── Predictive Forecasts Table ──────────────────────────────
CREATE TABLE IF NOT EXISTS risk_forecasts (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    forecast_date DATE NOT NULL,
    current_risk_level VARCHAR(50),
    predicted_risk_level VARCHAR(50),
    confidence FLOAT,
    predicted_composite_score FLOAT,
    conflict_trend_score FLOAT,
    rainfall_trend_score FLOAT,
    displacement_trend_score FLOAT,
    forecast_horizon_months INTEGER DEFAULT 3,
    model_version VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_forecasts_lga_date ON risk_forecasts (lga_name, forecast_date DESC);

-- ── Interventions Tracker Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS interventions (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR(255) NOT NULL,
    state VARCHAR(100),
    program_name VARCHAR(500) NOT NULL,
    organization VARCHAR(255),
    intervention_type VARCHAR(100),
    start_date DATE,
    end_date DATE,
    budget_usd FLOAT,
    beneficiaries INTEGER,
    status VARCHAR(50) DEFAULT 'active',
    mpi_before FLOAT,
    mpi_after FLOAT,
    impact_score FLOAT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_interventions_lga ON interventions (lga_name);
CREATE INDEX IF NOT EXISTS idx_interventions_state ON interventions (state);

-- ── RBAC: Roles Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
    ('super_admin', 'Super Administrator', 'Full system access with user management capabilities', TRUE),
    ('admin', 'Administrator', 'Administrative access to manage data and view reports', TRUE),
    ('user', 'User', 'Standard user access to view and analyze data', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── RBAC: Permissions Table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    module VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default permissions
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

-- ── RBAC: Role-Permission Mapping ───────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Assign permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.name IN (
    'data.view', 'data.edit', 'data.export',
    'reports.view', 'reports.create',
    'alerts.view', 'alerts.manage',
    'interventions.view', 'interventions.manage',
    'settings.view'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'user' AND p.name IN (
    'data.view', 'data.export',
    'reports.view',
    'alerts.view',
    'interventions.view'
) ON CONFLICT DO NOTHING;

-- ── User Accounts & RBAC ───────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role_id INTEGER DEFAULT 3 REFERENCES roles(id),
    organization VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_active TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    created_by INTEGER REFERENCES users(id)
);

-- Add role_id column to existing users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INTEGER DEFAULT 3 REFERENCES roles(id);

-- Add is_active column to existing users table if it doesn't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add other missing columns to existing users table if they don't exist
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization VARCHAR(255);

-- ── User Geographic Scopes ──────────────────────────────────
CREATE TABLE IF NOT EXISTS user_geographic_scopes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    state VARCHAR(100) NOT NULL,
    lga_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, state, lga_name)
);
CREATE INDEX IF NOT EXISTS idx_user_geo_user ON user_geographic_scopes (user_id);
CREATE INDEX IF NOT EXISTS idx_user_geo_state ON user_geographic_scopes (state);

-- ── Audit Log for User Actions ──────────────────────────────
CREATE TABLE IF NOT EXISTS user_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON user_audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON user_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_date ON user_audit_log (created_at DESC);

-- ── Alert Subscriptions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    lga_name VARCHAR(255),
    state VARCHAR(100),
    alert_type VARCHAR(50) DEFAULT 'risk_change',
    notify_email BOOLEAN DEFAULT TRUE,
    notify_webhook BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_subs_user ON alert_subscriptions (user_id);

-- ── Saved Views / Bookmarks ────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    view_config JSONB NOT NULL,
    share_token VARCHAR(64) UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_saved_views_token ON saved_views (share_token);
CREATE INDEX IF NOT EXISTS idx_saved_views_user ON saved_views (user_id);

-- ── Materialized Views for Performance ─────────────────────

-- State-level aggregation (refreshed by cron)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_state_aggregation AS
SELECT
    state,
    COUNT(*) AS lga_count,
    ROUND(AVG(mpi)::numeric, 4) AS avg_mpi,
    ROUND(AVG(mean_nightlight_intensity)::numeric, 4) AS avg_nightlight,
    ROUND(AVG(composite_poverty_score)::numeric, 4) AS avg_composite,
    COUNT(*) FILTER (WHERE risk_level IN ('Critical', 'High')) AS high_risk_count,
    ROUND(AVG(population_density)::numeric, 2) AS avg_population_density,
    COALESCE(SUM(health_facility_count), 0) AS total_health_facilities,
    COALESCE(SUM(school_count), 0) AS total_schools
FROM poverty_hotspots
GROUP BY state
ORDER BY avg_composite DESC;

-- National risk distribution
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_risk_distribution AS
SELECT
    risk_level,
    COUNT(*) AS count,
    ROUND(AVG(composite_poverty_score)::numeric, 4) AS avg_score,
    ROUND(AVG(mpi)::numeric, 4) AS avg_mpi
FROM poverty_hotspots
GROUP BY risk_level;

-- Rankings (worst LGAs)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_rankings AS
SELECT
    ROW_NUMBER() OVER (ORDER BY composite_poverty_score DESC) AS rank,
    lga_name,
    state,
    mpi,
    mean_nightlight_intensity AS nightlight,
    composite_poverty_score,
    risk_level,
    cluster_label,
    population_density,
    health_facility_count,
    school_count
FROM poverty_hotspots
ORDER BY composite_poverty_score DESC;

-- Unique indexes required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS mv_state_aggregation_state_idx ON mv_state_aggregation (state);
CREATE UNIQUE INDEX IF NOT EXISTS mv_risk_distribution_risk_idx ON mv_risk_distribution (risk_level);
CREATE UNIQUE INDEX IF NOT EXISTS mv_rankings_rank_idx ON mv_rankings (rank);

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_state_aggregation;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_risk_distribution;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rankings;
END;
$$ LANGUAGE plpgsql;
