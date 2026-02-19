# IOPHIN 10x Upgrade — Complete Implementation Prompt for GitHub Copilot

---

## Table of Contents

- [Critical Context](#critical-context-read-this-entire-prompt-before-writing-any-code)
- [Current Directory Structure](#directory-structure-current)
- [Existing Database Schema](#existing-database-schema)
- [Existing API Endpoints](#existing-api-endpoints-serverindexjs)
- [Existing Tech Stack](#existing-tech-stack)
- [Phase 1: Environment & Infrastructure Setup](#phase-1-environment--infrastructure-setup)
- [Phase 2: Model / Intelligence Engine Upgrade (Python)](#phase-2-model--intelligence-engine-upgrade-python)
- [Phase 3: Backend Upgrade (Node.js + PostgreSQL)](#phase-3-backend-upgrade-nodejs--postgresql)
- [Phase 4: Frontend Upgrade (React/TypeScript)](#phase-4-frontend-upgrade-reacttypescript)
- [Phase 5: Data Quality & Enrichment](#phase-5-data-quality--enrichment)
- [Phase 6: Architecture Polish](#phase-6-architecture-polish)
- [Phase 7: Testing & Validation](#phase-7-testing--validation)
- [Implementation Order](#implementation-order-suggested)
- [API Keys Required](#api-keys-required-summary-for-user)
- [Important Implementation Notes](#important-implementation-notes)

---

## CRITICAL CONTEXT: Read this entire prompt before writing any code.

You are upgrading an existing project called **IOPHIN (Intelligent Poverty Hotspot Identification for Nigeria)**. It is a full-stack application with:

- **Python ML pipeline** (`src/`) — PCA + K-Means/HDBSCAN clustering, GEE integration, external data fetchers, PostgreSQL persistence via SQLAlchemy
- **Node.js/Express API** (`server/`) — REST endpoints serving GeoJSON, stats, rankings from PostgreSQL with GeoJSON file fallback
- **React/TypeScript frontend** (`client/`) — Leaflet map, Recharts, TailwindCSS, sidebar analytics

The upgrade takes it from descriptive analytics to **predictive + prescriptive analytics** with live data, real-time alerts, 3D visualizations, and new modules.

---

## DIRECTORY STRUCTURE (current)

```
IOPHIN/
├── client/                    # React + Vite + TypeScript frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   │   ├── MapComponent.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── RankingsTable.tsx
│   │   │   ├── StateOverview.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── Legend.tsx
│   │   └── contexts/
│   │       └── ThemeContext.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── server/                    # Node.js/Express API
│   ├── index.js               # Express app with 7 endpoints
│   ├── database.js            # PostgreSQL connection + queries
│   ├── package.json
│   └── .env                   # DB credentials (see below)
├── src/                       # Python ML pipeline
│   ├── main.py                # 5-phase pipeline orchestrator
│   ├── config.py              # All configuration + paths
│   ├── model_engine.py        # PCA, K-Means, HDBSCAN, composite scoring
│   ├── data_loader.py         # Shapefile + MPI CSV loaders
│   ├── feature_extraction.py  # VIIRS raster + all external API fetchers (1476 lines)
│   ├── db_config.py           # SQLAlchemy ORM models
│   ├── db_utils.py            # Upsert, GeoJSON export, history snapshot
│   ├── migrate_to_db.py       # One-shot GeoJSON→DB migration
│   └── scheduler_service.py   # 6 scheduled tasks (ACLED, VIIRS, NDVI, etc.)
├── data/
│   ├── raw/                   # Shapefiles, MPI CSVs, GEE key
│   └── processed/             # Generated CSV + GeoJSON
├── gee/                       # Google Earth Engine service account key
├── requirements.txt           # Python dependencies (34 packages)
└── docker-compose.yml         # TO BE CREATED
```

---

## EXISTING DATABASE SCHEMA

PostgreSQL database `iophin_db` with tables:
- `poverty_hotspots` — ~30 columns (lga_name, state, lat/lon, MPI, nightlight, composite_poverty_score, risk_level, cluster_label, health_facility_count, school_count, road_density_km, ndvi_mean, rainfall_mm, idp_count, food_price_index, conflict_flag, geometry as Text, etc.)
- `hotspot_history` — time-series snapshots with composite index on (lga_name, snapshot_date)

Both managed by SQLAlchemy ORM in `src/db_config.py`.

---

## EXISTING .env (server/.env)

```
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
PORT=5000
```

---

## EXISTING API ENDPOINTS (server/index.js)

- `GET /api/health` — health check
- `GET /api/hotspots?state=&risk=` — GeoJSON with filters
- `GET /api/stats` — national statistics
- `GET /api/lga/:name` — single LGA detail
- `GET /api/states` — state-level aggregation
- `GET /api/history/:lga` — historical snapshots
- `GET /api/rankings` — sorted rankings

---

## EXISTING COMPOSITE SCORE FORMULA

```python
COMPOSITE_WEIGHTS = {
    'mpi': 0.30,
    'inverse_nightlight': 0.25,
    'health_access': 0.15,
    'education_access': 0.15,
    'infrastructure': 0.15,
}
```

---

## EXISTING TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React 19.2, TypeScript 5.9, Vite 7.3, Leaflet 1.9, react-leaflet 5.0, Recharts 3.7, Axios 1.13, TailwindCSS 4.1 |
| Backend | Node.js, Express 5.1, pg 8.16, compression, cors, express-rate-limit |
| ML Pipeline | Python 3.11+, scikit-learn, hdbscan, geopandas, rasterio, earthengine-api, pandas, numpy, scipy |
| Database | PostgreSQL 16 with pg driver |
| External APIs | ACLED (conflict), GEE (VIIRS/NDVI/CHIRPS), HDX (health/schools/IDP), WFP (food prices), OSM Overpass (roads) |

---

# ============================================================
# PHASE 1: ENVIRONMENT & INFRASTRUCTURE SETUP
# ============================================================

## 1.1 Create `.env.example` at project root

Create a single `.env.example` file at the project root (`IOPHIN/.env.example`) that both the server and python pipeline will read. Include ALL API keys needed with clear comments. The user will fill in their own values.

```env
# ============================================================
# IOPHIN — Environment Variables
# Copy this file to .env and fill in your API keys
# ============================================================

# ── PostgreSQL Database ──────────────────────────────────────
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
USE_DATABASE=true

# ── Redis Cache ──────────────────────────────────────────────
# Install Redis: https://redis.io/download or use Docker
REDIS_URL=redis://localhost:6379

# ── Server ───────────────────────────────────────────────────
PORT=5000
NODE_ENV=development
JWT_SECRET=your-jwt-secret-change-this-in-production

# ── ACLED Conflict Data API ──────────────────────────────────
# Register at https://developer.acleddata.com/
# You get an email + key after registration
ACLED_EMAIL=your-email@example.com
ACLED_API_KEY=your-acled-api-key

# ── Google Earth Engine ──────────────────────────────────────
# Create a service account at https://console.cloud.google.com
# Enable Earth Engine API, download JSON key
GEE_PROJECT=your-gee-project-id
GEE_SERVICE_ACCOUNT=your-service-account@your-project.iam.gserviceaccount.com
GEE_KEY_FILE=./gee/your-key-file.json

# ── IOM DTM (Displacement Tracking) ─────────────────────────
# Register at https://dtmapi.iom.int/ for API access
DTM_API_KEY=your-dtm-api-key

# ── NASA LAADS (VIIRS Nightlight Tiles) ─────────────────────
# Register at https://ladsweb.modaps.eosdis.nasa.gov/
# Go to Profile → App Keys → Generate Token
NASA_LAADS_TOKEN=your-nasa-laads-token

# ── OpenWeather API (optional, backup rainfall) ──────────────
# Register at https://openweathermap.org/api
OPENWEATHER_API_KEY=your-openweather-api-key

# ── Email Alerts (SMTP) ─────────────────────────────────────
# Gmail: enable App Passwords at https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# ── Webhook Alerts ───────────────────────────────────────────
WEBHOOK_SECRET=your-webhook-signing-secret

# ── Scheduler Intervals (hours) ─────────────────────────────
SCHEDULER_CONFLICT_INTERVAL=1
SCHEDULER_VIIRS_INTERVAL=24
SCHEDULER_INFRASTRUCTURE_INTERVAL=6
SCHEDULER_ML_RETRAIN_INTERVAL=12
SCHEDULER_GRID3_INTERVAL=168
SCHEDULER_NDVI_INTERVAL=24
SCHEDULER_RAINFALL_INTERVAL=24
SCHEDULER_POPULATION_INTERVAL=720
SCHEDULER_IDP_INTERVAL=168
SCHEDULER_FOOD_PRICE_INTERVAL=168
SCHEDULER_EXTERNAL_ENRICHMENT_INTERVAL=24
SCHEDULER_GEE_ENVIRONMENTAL_INTERVAL=24
SCHEDULER_ANOMALY_DETECTION_INTERVAL=6
SCHEDULER_PREDICTIVE_MODEL_INTERVAL=24
```

## 1.2 Create `docker-compose.yml` at project root

```yaml
version: '3.8'
services:
  postgres:
    image: postgis/postgis:16-3.4
    environment:
      POSTGRES_DB: iophin_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./server/init.sql:/docker-entrypoint-initdb.d/init.sql

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  server:
    build: ./server
    ports:
      - "${PORT:-5000}:5000"
    environment:
      - DATABASE_URL=postgresql://postgres:${DB_PASSWORD}@postgres:5432/iophin_db
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  client:
    build: ./client
    ports:
      - "5173:5173"
    depends_on:
      - server

volumes:
  pgdata:
```

## 1.3 Create `server/init.sql` — PostGIS initialization

Enable PostGIS extensions and create all new tables/materialized views. This SQL script runs on first DB startup.

```sql
-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add geometry column to poverty_hotspots if not exists
-- (The existing table stores geometry as TEXT; we need a proper PostGIS column)
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

-- ── User Accounts & RBAC ───────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'public',
    organization VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- ── Alert Subscriptions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    lga_name VARCHAR(255),
    state VARCHAR(100),
    alert_type VARCHAR(50) DEFAULT 'risk_change',
    notify_email BOOLEAN DEFAULT TRUE,
    notify_webhook BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── Saved Views / Bookmarks ────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    view_config JSONB NOT NULL,
    share_token VARCHAR(64) UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

-- Refresh function
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_state_aggregation;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_risk_distribution;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_rankings;
END;
$$ LANGUAGE plpgsql;
```

## 1.4 Install new Python dependencies

Add these to `requirements.txt`:

```
# Predictive & Advanced ML
xgboost>=2.0.0
lightgbm>=4.0.0
prophet>=1.1.0
shap>=0.43.0

# Spatial Statistics
libpysal>=4.7.0
esda>=2.4.0
mgwr>=2.2.0
splot>=1.1.0

# Anomaly Detection
pyod>=1.1.0

# Redis caching (Python side)
redis>=5.0.0

# PDF Report Generation
reportlab>=4.0.0
fpdf2>=2.7.0

# API Documentation
flask-swagger-ui>=4.11.0
```

Add these to `server/package.json` dependencies:

```json
{
  "ioredis": "^5.3.0",
  "socket.io": "^4.7.0",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "nodemailer": "^6.9.0",
  "swagger-ui-express": "^5.0.0",
  "yaml": "^2.3.0",
  "pdfkit": "^0.14.0",
  "uuid": "^9.0.0",
  "helmet": "^7.1.0",
  "morgan": "^1.10.0"
}
```

Add these to `client/package.json` dependencies:

```json
{
  "@deck.gl/core": "^9.0.0",
  "@deck.gl/layers": "^9.0.0",
  "@deck.gl/geo-layers": "^9.0.0",
  "@deck.gl/react": "^9.0.0",
  "@luma.gl/core": "^9.0.0",
  "maplibre-gl": "^4.0.0",
  "react-map-gl": "^7.1.0",
  "@turf/turf": "^7.0.0",
  "d3": "^7.9.0",
  "@types/d3": "^7.4.0",
  "jspdf": "^2.5.0",
  "jspdf-autotable": "^3.8.0",
  "html2canvas": "^1.4.0",
  "date-fns": "^3.6.0",
  "zustand": "^4.5.0",
  "react-compare-slider": "^3.1.0",
  "framer-motion": "^11.0.0",
  "react-hot-toast": "^2.4.0"
}
```

---

# ============================================================
# PHASE 2: MODEL / INTELLIGENCE ENGINE UPGRADE (Python)
# ============================================================

## 2.1 Create `src/advanced_model.py` — XGBoost/LightGBM Dynamic Composite Model

Replace the static weighted composite score with a trained ML model. The model should:

1. **Load ground-truth survey data** (the existing MPI CSV at `data/raw/nga_mpi(3).csv` and `data/raw/Nigeria MPI by Senatorial District.csv`) as training labels
2. **Use features**: VIIRS nightlight, NDVI, rainfall, conflict event count (from ACLED), displacement count (IOM DTM), health facility count, school count, road density, population density, food price index
3. **Train an XGBoost model** with hyperparameter tuning (Optuna or GridSearchCV)
4. **Output**: A predicted poverty score per LGA that replaces the static weighted composite
5. **Save the model** to `models/xgboost_poverty_model.pkl` for reuse
6. **Add SHAP explanations** — for each LGA, output which features contributed most to its risk score
7. **Fallback**: If insufficient training data, keep the existing weighted composite as fallback

Key function signatures:
```python
def train_dynamic_model(df: pd.DataFrame) -> Tuple[xgb.XGBRegressor, dict]:
    """Train XGBoost on ground-truth MPI. Returns (model, metrics)."""

def predict_poverty_scores(model, df: pd.DataFrame) -> pd.Series:
    """Predict poverty scores for all LGAs using trained model."""

def get_shap_explanations(model, df: pd.DataFrame) -> pd.DataFrame:
    """Return per-LGA SHAP values for feature importance."""
```

## 2.2 Create `src/temporal_analysis.py` — MPI Trajectory Analysis

Use the existing `hotspot_history` table data:

1. **Query 6–24 months of history** from `hotspot_history` table
2. **Compute MPI trajectory** per LGA — linear trend slope, acceleration, volatility
3. **Classify trajectories**: "Deteriorating Fast", "Deteriorating", "Stable", "Improving", "Improving Fast" based on slope thresholds
4. **Flag LGAs** that crossed a risk tier boundary in the last 30 days
5. **Return** a DataFrame with columns: `lga_name, state, trend_slope, trend_class, months_at_current_tier, tier_crossings_6m`

Key function signatures:
```python
def compute_temporal_trends(history_df: pd.DataFrame) -> pd.DataFrame:
    """Compute MPI slope, acceleration, and classify trajectories."""

def detect_tier_crossings(history_df: pd.DataFrame, window_days: int = 30) -> pd.DataFrame:
    """Flag LGAs that changed risk tier recently."""
```

## 2.3 Create `src/predictive_model.py` — Risk Tier Forecasting

1. **Build a time-series forecasting model** using Prophet or LSTM per LGA
2. **Features for forecasting**: conflict trend (rolling 90-day ACLED events), seasonal rainfall forecast (CHIRPS), displacement flow direction (DTM)
3. **Forecast horizon**: 3 months and 6 months
4. **Output**: For each LGA, predict `future_risk_level` and `confidence_score`
5. **Store predictions in `risk_forecasts` table** (defined in init.sql above)
6. **Identify "risk escalation candidates"** — LGAs predicted to jump ≥1 tier in next 3 months

Key function signatures:
```python
def build_forecast_model(lga_name: str, history_df: pd.DataFrame) -> dict:
    """Build Prophet model for one LGA. Returns forecast dict."""

def forecast_all_lgas(session) -> pd.DataFrame:
    """Forecast risk for all LGAs. Returns predictions DataFrame."""

def identify_escalation_candidates(forecasts_df: pd.DataFrame) -> pd.DataFrame:
    """Filter LGAs predicted to worsen by ≥1 tier."""
```

## 2.4 Create `src/anomaly_detection.py` — Nightlight Drop Detection

1. **Compare current nightlight** vs 30-day rolling average per LGA
2. **Flag anomalies** where nightlight dropped >20% (proxy for sudden crisis — e.g., conflict, power grid failure)
3. **Use PyOD's Isolation Forest** for multivariate anomaly detection across all features
4. **Store anomalies in `anomaly_alerts` table** (defined in init.sql above)
5. **Trigger WebSocket push** to frontend when critical anomaly detected

Key function signatures:
```python
def detect_nightlight_anomalies(current_df: pd.DataFrame, history_df: pd.DataFrame, threshold: float = 0.20) -> pd.DataFrame:
    """Flag LGAs with nightlight drop > threshold vs 30-day avg."""

def detect_multivariate_anomalies(df: pd.DataFrame) -> pd.DataFrame:
    """Use Isolation Forest to flag outliers across all dimensions."""
```

## 2.5 Create `src/spatial_statistics.py` — Spatial Autocorrelation & GWR

1. **Compute Moran's I** globally — test whether poverty is spatially clustered
2. **Compute Getis-Ord Gi* per LGA** — identify statistically significant hot/cold spots
3. **Run Geographically Weighted Regression (GWR)** — model how nightlight-poverty relationship varies by location
4. **Output**: Per-LGA columns for `gi_star_z_score`, `gi_star_p_value`, `is_spatial_hotspot`, `gwr_r_squared_local`

Key function signatures:
```python
def compute_morans_i(gdf: gpd.GeoDataFrame, column: str) -> dict:
    """Compute global Moran's I for spatial autocorrelation."""

def compute_getis_ord(gdf: gpd.GeoDataFrame, column: str) -> gpd.GeoDataFrame:
    """Add Gi* z-scores and p-values to GeoDataFrame."""

def run_gwr(gdf: gpd.GeoDataFrame, target: str, features: list) -> gpd.GeoDataFrame:
    """Run GWR and add local R² and coefficients."""
```

## 2.6 Update `src/model_engine.py`

Modify `build_analytical_model()` to:
1. First attempt the XGBoost dynamic model from `advanced_model.py`
2. Fall back to existing weighted composite if XGBoost fails
3. After clustering, run `compute_getis_ord()` and add spatial stats columns
4. Run `compute_temporal_trends()` and add trend columns
5. Run `detect_nightlight_anomalies()` and flag anomalous LGAs
6. Run `forecast_all_lgas()` and merge predictions

## 2.7 Update `src/scheduler_service.py`

Add new scheduled tasks:
1. **`run_anomaly_detection()`** — every 6 hours, check for nightlight drops
2. **`run_predictive_model()`** — every 24 hours, rerun 3/6-month forecasts
3. **`run_temporal_analysis()`** — every 12 hours, update trajectory classifications
4. Ensure each task stores results in the new DB tables and triggers WebSocket alerts for critical findings

## 2.8 Update `src/config.py`

Add new configuration:
```python
# Advanced Model
USE_XGBOOST = True
XGBOOST_PARAMS = {
    'max_depth': 6, 'learning_rate': 0.1, 'n_estimators': 200,
    'objective': 'reg:squarederror', 'eval_metric': 'rmse'
}
MODEL_SAVE_DIR = BASE_DIR / "models"
MODEL_SAVE_DIR.mkdir(parents=True, exist_ok=True)

# Anomaly Detection
NIGHTLIGHT_DROP_THRESHOLD = 0.20
ANOMALY_CONTAMINATION = 0.05

# Forecasting
FORECAST_HORIZONS = [3, 6]  # months

# Population weighting
USE_POPULATION_WEIGHTED_MPI = True

# ACLED API credentials
ACLED_EMAIL = os.getenv('ACLED_EMAIL', '')
ACLED_API_KEY = os.getenv('ACLED_API_KEY', '')

# NASA LAADS
NASA_LAADS_TOKEN = os.getenv('NASA_LAADS_TOKEN', '')

# Redis
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379')
```

---

# ============================================================
# PHASE 3: BACKEND UPGRADE (Node.js + PostgreSQL)
# ============================================================

## 3.1 Create `server/redis.js` — Redis Cache Layer

```javascript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const CACHE_TTLS = {
    hotspots: 300,       // 5 minutes
    stats: 120,          // 2 minutes
    rankings: 300,
    states: 300,
    lga: 180,
    geojson_tiles: 600,
};

export async function getCached(key) { ... }
export async function setCache(key, data, ttl) { ... }
export async function invalidatePattern(pattern) { ... }
export default redis;
```

Integrate caching into every database query function in `server/database.js`. Check Redis first, return cached if available, otherwise query DB and cache the result. Invalidate when data changes.

## 3.2 Create `server/websocket.js` — Real-Time Alerts via Socket.IO

```javascript
import { Server } from 'socket.io';

export function initWebSocket(httpServer) {
    const io = new Server(httpServer, { cors: { origin: '*' } });

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        socket.on('subscribe-lga', (lgaName) => socket.join(`lga:${lgaName}`));
        socket.on('subscribe-state', (state) => socket.join(`state:${state}`));
        socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
    });

    return io;
}

// Call this from backend when risk tier changes or anomaly detected
export function emitAlert(io, type, payload) {
    io.emit('alert', { type, ...payload, timestamp: new Date().toISOString() });
    if (payload.lga_name) io.to(`lga:${payload.lga_name}`).emit('lga-update', payload);
    if (payload.state) io.to(`state:${payload.state}`).emit('state-update', payload);
}
```

Integrate into `server/index.js`: wrap the Express server with `http.createServer()`, pass to `initWebSocket()`, store `io` globally.

## 3.3 Create `server/auth.js` — RBAC with JWT

Implement:
1. `POST /api/auth/register` — create user with email, password, role (default: 'public')
2. `POST /api/auth/login` — returns JWT token
3. `authMiddleware(req, res, next)` — verify JWT, attach `req.user`
4. `roleMiddleware(...roles)` — check user role against allowed roles
5. Roles: `admin`, `government`, `ngo`, `public`
6. Different data resolution per role:
   - `admin` / `government`: Full data, all fields, export all formats
   - `ngo`: Full data, limited export
   - `public`: Aggregated data only (no individual LGA coordinates for security)

Use `bcryptjs` for password hashing, `jsonwebtoken` for JWT tokens.

## 3.4 Create `server/alerts.js` — Email/Webhook Alert System

1. `POST /api/alerts/subscribe` — subscribe to LGA or state risk changes
2. `DELETE /api/alerts/unsubscribe/:id` — remove subscription
3. `GET /api/alerts/my` — list my subscriptions
4. When risk tier changes (detected by comparing before/after in DB), trigger:
   - Email via `nodemailer` to subscribed users
   - Webhook POST to subscribed URLs
   - WebSocket push via Socket.IO

## 3.5 Update `server/database.js` — New Endpoints & PostGIS Queries

Add these functions and expose them as new API endpoints in `server/index.js`:

```javascript
// PostGIS spatial queries
async function getLGAsWithinRadius(lat, lon, radiusKm) { /* ST_DWithin */ }
async function getLGAsInConflictProximity(radiusKm = 50) { /* conflict zones + ST_DWithin */ }
async function getCustomAreaStats(geojsonPolygon) { /* ST_Intersects with user-drawn polygon */ }

// Change log
async function getRecentChanges(days = 7) { /* Query risk_change_log */ }

// Anomalies
async function getActiveAnomalies() { /* Query anomaly_alerts WHERE acknowledged = false */ }

// Forecasts
async function getForecasts(lgaName) { /* Query risk_forecasts */ }
async function getEscalationCandidates() { /* Predicted to worsen ≥1 tier */ }

// Interventions
async function getInterventions(filters) { /* Filter by state, status, org */ }
async function createIntervention(data) { /* INSERT into interventions */ }
async function updateIntervention(id, data) { /* UPDATE interventions */ }

// Materialized view refresh
async function refreshMaterializedViews() { /* SELECT refresh_materialized_views() */ }

// Temporal trends
async function getTemporalTrends(lgaName) { /* trend slope, trajectory class */ }

// Correlation data
async function getCorrelationData(metric1, metric2) { /* For scatter plots */ }
```

## 3.6 Update `server/index.js` — Full API Expansion

Add all new endpoints. Organize with Express Router:

```
GET    /api/v1/hotspots                      — GeoJSON tiles (cached)
GET    /api/v1/hotspots/within-radius         — PostGIS radius query
GET    /api/v1/hotspots/conflict-proximity    — LGAs near conflict
POST   /api/v1/hotspots/custom-area           — Stats for drawn polygon
GET    /api/v1/stats                          — National stats (cached)
GET    /api/v1/lga/:name                      — LGA detail
GET    /api/v1/lga/:name/trends               — Temporal trends
GET    /api/v1/lga/:name/forecast             — Risk forecast
GET    /api/v1/lga/:name/anomalies            — Anomalies
GET    /api/v1/states                         — State aggregation (materialized view)
GET    /api/v1/rankings                       — Rankings (materialized view)
GET    /api/v1/changes                        — Recent risk tier changes
GET    /api/v1/anomalies                      — Active anomalies
GET    /api/v1/forecasts                      — All forecasts
GET    /api/v1/forecasts/escalations          — Escalation candidates
GET    /api/v1/correlation/:metric1/:metric2  — Correlation data
GET    /api/v1/interventions                  — List interventions
POST   /api/v1/interventions                  — Create intervention
PUT    /api/v1/interventions/:id              — Update intervention
POST   /api/v1/auth/register                  — Register
POST   /api/v1/auth/login                     — Login
GET    /api/v1/alerts/my                      — My subscriptions
POST   /api/v1/alerts/subscribe               — Subscribe
DELETE /api/v1/alerts/:id                     — Unsubscribe
GET    /api/v1/saved-views                    — List saved views
POST   /api/v1/saved-views                    — Create saved view
GET    /api/v1/saved-views/:token             — Load shared view
POST   /api/v1/reports/generate               — Generate PDF report
GET    /api/docs                              — Swagger UI
```

Keep backward compatibility: The old `/api/hotspots`, `/api/stats`, etc. should still work (redirect to `/api/v1/` versions).

## 3.7 Create `server/swagger.yaml` — OpenAPI Documentation

Full Swagger/OpenAPI 3.0 spec documenting all endpoints above. Serve via `swagger-ui-express` at `/api/docs`.

## 3.8 Create `server/reports.js` — PDF Report Generator

Using `pdfkit`, generate professional PDF reports with:
1. National summary report (risk distribution, top 10 worst LGAs, trend analysis)
2. State-level report (all LGAs in a state, comparison charts)
3. Custom LGA selection report (user picks LGAs, metrics)
4. Include data tables, simple bar charts rendered to PDF

---

# ============================================================
# PHASE 4: FRONTEND UPGRADE (React/TypeScript)
# ============================================================

## 4.1 State Management — Switch to Zustand

Create `client/src/store/` with stores:
- `useDataStore` — hotspots, stats, rankings, states data + loading/error states
- `useFilterStore` — state filter, risk filter, search query, active view, date range
- `useAuthStore` — user, token, role, login/logout
- `useAlertStore` — WebSocket alerts, notifications, toasts
- `useMapStore` — selected LGA, map mode (choropleth/satellite/3d), active layer, time slider position

This replaces the monolithic useState approach in App.tsx.

## 4.2 Update `client/src/types.ts` — Add New Types

```typescript
// Add to existing types.ts:

export type ChoroplethMode = 'composite' | 'mpi' | 'nightlight' | 'conflict' | 'rainfall' | 'ndvi';
export type BasemapStyle = 'dark' | 'light' | 'satellite';

export interface TemporalTrend {
    lga_name: string;
    state: string;
    trend_slope: number;
    trend_class: 'Deteriorating Fast' | 'Deteriorating' | 'Stable' | 'Improving' | 'Improving Fast';
    months_at_current_tier: number;
    tier_crossings_6m: number;
}

export interface RiskForecast {
    lga_name: string;
    state: string;
    forecast_date: string;
    current_risk_level: RiskLevel;
    predicted_risk_level: RiskLevel;
    confidence: number;
    forecast_horizon_months: number;
}

export interface AnomalyAlert {
    id: number;
    lga_name: string;
    state: string;
    anomaly_type: string;
    severity: string;
    description: string;
    metric_name: string;
    deviation_pct: number;
    detected_at: string;
    acknowledged: boolean;
}

export interface Intervention {
    id: number;
    lga_name: string;
    state: string;
    program_name: string;
    organization: string;
    intervention_type: string;
    start_date: string;
    end_date?: string;
    budget_usd?: number;
    beneficiaries?: number;
    status: 'active' | 'completed' | 'planned';
    mpi_before?: number;
    mpi_after?: number;
    impact_score?: number;
}

export interface CorrelationPoint {
    lga_name: string;
    state: string;
    x: number;
    y: number;
    risk_level: RiskLevel;
}

export interface SavedView {
    id: number;
    name: string;
    view_config: object;
    share_token: string;
    is_public: boolean;
    created_at: string;
}

export interface ChangeLogEntry {
    lga_name: string;
    state: string;
    old_risk_level: RiskLevel;
    new_risk_level: RiskLevel;
    delta_composite: number;
    changed_at: string;
}

export interface SeasonalVulnerability {
    month: number;
    month_name: string;
    food_insecurity_risk: number;
    flood_risk: number;
    drought_risk: number;
    overall_vulnerability: number;
}

// User / Auth types
export interface User {
    id: number;
    email: string;
    full_name: string;
    role: 'admin' | 'government' | 'ngo' | 'public';
    organization?: string;
}
```

## 4.3 Upgrade Map — Deck.gl with 3D Extrusion + Choropleth Modes

Create `client/src/components/MapView.tsx` (replaces MapComponent.tsx):

1. **Use deck.gl's `GeoJsonLayer`** instead of react-leaflet. Render LGA polygons with:
   - 3D extrusion: Height proportional to composite poverty score (higher = worse)
   - Color by selected choropleth mode (MPI, Nightlight, Composite, Conflict, Rainfall, NDVI)
2. **Basemap toggle**: Dark (CARTO Dark Matter), Light (CARTO Positron), Satellite (Mapbox Satellite) — use `react-map-gl` as basemap under deck.gl
3. **Proportional circle overlay**: Show IDP counts or conflict events as scaled circles on top of polygons using deck.gl's `ScatterplotLayer`
4. **Time slider**: Scrub through monthly snapshots. Query `/api/v1/lga/:name/trends` to get historical values, interpolate colors between months
5. **LGA click**: Opens detailed side panel (already exists, enhance it)
6. **Draw tool**: Use deck.gl's `EditableGeoJsonLayer` or `@nebula.gl/layers` to let users draw a polygon, then POST to `/api/v1/hotspots/custom-area` for aggregated stats
7. **"Crisis corridor" layer**: Highlight LGAs in worst quartile across 3+ dimensions with a distinct pattern overlay (hatching or glow)

Keep the existing Leaflet MapComponent.tsx as a fallback for low-end devices (toggle in settings).

## 4.4 Create `client/src/components/TimeSlider.tsx`

A horizontal slider component:
- Range: earliest date in history → current
- Step: 1 month
- Shows month/year label
- On change: filters map data to that month's snapshot
- Play button: auto-animates through months (500ms per step)

## 4.5 Create `client/src/components/ChoroplethToggle.tsx`

A quick-toggle bar:
- Buttons: MPI | Nightlight | Composite | Conflict | Rainfall | NDVI
- Active button highlighted
- Changes `mapMode` in store, which MapView reads to color polygons

## 4.6 Update `client/src/components/Sidebar.tsx` — Enhanced LGA Profile

When an LGA is selected, the sidebar should show:
1. **Risk badge + trend arrow** (↑ deteriorating, ↓ improving, → stable)
2. **MPI breakdown indicators** (existing, keep)
3. **Nightlight trend sparkline** — 12-month mini line chart using Recharts `<LineChart>` with width=200, height=50
4. **Conflict events in last 90 days** — count + severity mini bar chart
5. **Nearest health facilities** — list top 3 with distance
6. **Risk forecast** — "Predicted: [High] in 3 months (75% confidence)" with progress bar
7. **Anomaly alerts** — any active anomalies for this LGA
8. **Intervention programs** — active NGO/government programs in this LGA
9. **SHAP feature importance** — horizontal bar chart showing which factors drive this LGA's score
10. **Comparative analysis** — existing bars comparing to national average

## 4.7 Create `client/src/components/TrendChart.tsx` — Stacked Bar Trend

Replace the static donut chart in the national view:
- Stacked bar chart showing risk distribution over time (monthly)
- X-axis: months, Y-axis: count of LGAs
- 5 color bands: Critical (purple), High (red), Medium (amber), Low (green), Minimal (blue)
- Shows how national risk profile has shifted

## 4.8 Create `client/src/components/Leaderboard.tsx`

Two-column layout:
- **Most Deteriorated** (left, red accent): Top 10 LGAs with largest negative composite score change in last 30 days
- **Most Improved** (right, green accent): Top 10 LGAs with largest positive composite score change
- Each row: LGA name, state, delta value, sparkline

## 4.9 Create `client/src/components/CorrelationScatter.tsx`

- Interactive scatter plot (Recharts `<ScatterChart>`)
- Dropdown selectors for X and Y axis: MPI, Nightlight, Health Facility Density, School Density, Road Density, Conflict Count, Rainfall, NDVI
- Points colored by risk level
- Hover shows LGA name + state + values
- Click navigates to LGA detail

## 4.10 Create `client/src/components/RadarComparison.tsx`

- Select 2–3 states (or LGAs) from a dropdown
- Radar chart (Recharts `<RadarChart>`) with axes: MPI, Nightlight, Health, Education, Infrastructure, Conflict, Displacement
- Each state is a different colored polygon overlay
- Shows dimensional comparison at a glance

## 4.11 Create `client/src/components/CrisisCorridor.tsx`

- List of LGAs that rank in the worst quartile (top 25%) across ≥3 dimensions simultaneously
- Table with columns: LGA, State, # Worst-Quartile Dimensions, Dimension List, Composite Score
- "Show on Map" button highlights them on the map with a special overlay

## 4.12 Create `client/src/components/AnomalyPanel.tsx`

- Real-time feed of anomaly alerts
- Each alert: icon (⚠️ severity), LGA, state, description, time ago
- Click → zoom to LGA on map
- "Acknowledge" button (for admin/government roles)
- Badge count on nav icon

## 4.13 Create `client/src/components/InterventionTracker.tsx`

New page (`/interventions`):
- Map overlay showing LGAs with active interventions (green dots)
- Table of interventions with filters (state, organization, status)
- "Add Intervention" form (government/admin only)
- Before/After MPI comparison chart for completed interventions
- Impact score calculation: `(mpi_before - mpi_after) / budget_usd * 1000`

## 4.14 Create `client/src/components/ConflictPovertyNexus.tsx`

New page (`/conflict-nexus`):
- Split view: ACLED events (as red circles sized by fatalities) alongside poverty choropleth
- Timeline at bottom: slide through months to see conflict → poverty correlation
- Correlation coefficient displayed live
- "Conflict corridor" highlight: areas with both high conflict AND high poverty

## 4.15 Create `client/src/components/SeasonalCalendar.tsx`

New page (`/seasonal`):
- Select an LGA from dropdown
- 12-month heatmap grid showing vulnerability levels per month
- Rows: Food Insecurity, Flood Risk, Drought Risk, Conflict Seasonal Pattern
- Columns: Jan–Dec
- Color intensity: green (low) → yellow → red (high)
- Based on historical data patterns

## 4.16 Create `client/src/components/BudgetOptimizer.tsx`

New page (`/budget-optimizer`):
- Input: Total intervention budget (slider or input field)
- Algorithm: Rank LGAs by `composite_poverty_score * population_density / distance_to_urban_km` (cost-effectiveness proxy)
- Output: Ordered list of recommended LGAs with allocated budget per LGA
- Map highlights recommended LGAs
- Show expected impact: "Allocating $X to these Y LGAs could reduce average MPI by Z%"

## 4.17 Create `client/src/components/ReportBuilder.tsx`

New page (`/reports`):
1. **Select scope**: States (multi-select) or individual LGAs (multi-select)
2. **Select metrics**: Checkboxes for MPI, Nightlight, Composite, Health, Education, Conflict, Displacement, Weather
3. **Select format**: PDF or Word (docx)
4. **Preview**: Show data tables and mini charts
5. **Generate**: Hit `/api/v1/reports/generate` endpoint, download file

Use `jspdf` + `jspdf-autotable` for PDF generation on the client side.

## 4.18 Create `client/src/components/DataQualityPanel.tsx`

Panel showing data freshness and quality:
- Per-LGA indicators: "Last updated: 2 hours ago" vs "⚠️ Stale: 14 days"
- Missing value counts per dimension
- Confidence score (% of dimensions with data)
- Color coding: Green (fresh) → Yellow (aging) → Red (stale)

## 4.19 Create `client/src/components/AlertsManager.tsx`

Page to manage alert subscriptions:
- "Subscribe to LGA" — autocomplete search, select alert type (risk change, anomaly)
- "Subscribe to State" — all LGAs in that state
- List of active subscriptions with toggle on/off
- Recent alert history

## 4.20 Create `client/src/components/SavedViews.tsx`

- Save current filter/view configuration with a name
- List of saved views, click to restore
- "Share" button generates a URL with token
- Loading a shared URL restores the exact view state

## 4.21 Update `client/src/components/SwipeComparison.tsx`

Using `react-compare-slider`:
- Left side: Map at month A (e.g., 6 months ago)
- Right side: Map at month B (current)
- Drag slider to compare visually

## 4.22 Create `client/src/components/ScrollytellingTour.tsx`

"Start Briefing" mode:
1. Auto-zooms to top 5 worst LGAs sequentially
2. Sidebar narrates: "Zooming to {LGA}, {State}... Risk: {level} due to {top SHAP factor}"
3. 5-second auto-advance with manual next/prev buttons
4. Exit button to return to normal dashboard

## 4.23 Update `client/src/App.tsx` — Navigation & Routing

Add `react-router-dom` for proper page routing:

```
/                       → Dashboard (Map + Sidebar)
/rankings               → Rankings Table
/states                 → State Overview
/interventions          → Intervention Tracker
/conflict-nexus         → Conflict-Poverty Nexus
/seasonal               → Seasonal Calendar
/budget-optimizer       → Budget Optimizer
/reports                → Report Builder
/alerts                 → Alerts Manager
/settings               → Saved Views + Data Quality
/login                  → Auth page
/shared/:token          → Load shared view
```

Navigation: Keep the existing icon rail on the left, expand it with new page icons. Mobile: bottom tab bar with "More" overflow menu.

## 4.24 Mobile-Responsive Field View

Create `client/src/components/FieldView.tsx`:
- Stripped-down version for field workers on mobile/low-bandwidth
- Simple list of nearby LGAs (use browser geolocation)
- Risk badge + key metrics only
- Offline-capable: cache last-loaded data in localStorage
- Minimal map with marker only (no polygon rendering)
- Toggle: "Field Mode" switch in settings

## 4.25 WebSocket Integration

Create `client/src/hooks/useWebSocket.ts`:
- Connect to Socket.IO server
- Subscribe to relevant LGA/state channels
- On `alert` event → push to `useAlertStore` → show toast notification (react-hot-toast)
- On `lga-update` → refresh data for that LGA
- Reconnection logic with exponential backoff

---

# ============================================================
# PHASE 5: DATA QUALITY & ENRICHMENT
# ============================================================

## 5.1 Population-Weighted MPI

In `src/model_engine.py`, modify `compute_composite_poverty_score()`:
- Multiply MPI by `population_density` before normalization
- A large LGA with MPI 0.85 should rank higher than a tiny LGA with MPI 0.99
- Add config toggle `USE_POPULATION_WEIGHTED_MPI`

## 5.2 Health Facility Quality Scores

In `src/feature_extraction.py`, create `fetch_health_facility_quality()`:
- Query HDX for HMIS (Health Management Information System) data for Nigeria
- Compute per-LGA score based on: functional status, staff count, equipment availability
- Add column `health_quality_score` alongside existing `health_facility_count`

## 5.3 School Enrollment Rates

In `src/feature_extraction.py`, create `fetch_school_enrollment()`:
- Query UBEC (Universal Basic Education Commission) data
- Pull enrollment rates per LGA
- Add column `school_enrollment_rate` alongside existing `school_count`

## 5.4 Market Access Score

In `src/feature_extraction.py`, create `compute_market_access()`:
- Use OSM Overpass API to fetch market locations (`shop=supermarket|marketplace`)
- Compute per-LGA: distance from centroid to nearest market
- Factor in road network density for accessibility
- Add column `market_access_score`

---

# ============================================================
# PHASE 6: ARCHITECTURE POLISH
# ============================================================

## 6.1 Create Dockerfiles

`server/Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

`client/Dockerfile`:
```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`Dockerfile` (Python ML service — project root):
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y libgdal-dev gcc g++ && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY src/ ./src/
COPY data/ ./data/
COPY gee/ ./gee/
COPY .env .
CMD ["python", "src/scheduler_service.py"]
```

## 6.2 Error Handling & Logging

- Server: Use `morgan` for HTTP request logging, structured JSON error responses
- Python: Ensure all functions have try/except with proper logging
- Frontend: Global error boundary component, toast notifications for API failures

## 6.3 Security Hardening

- Server: Add `helmet` middleware for security headers
- Rate limiting per endpoint (stricter for auth endpoints)
- Input validation/sanitization on all POST endpoints
- CORS: restrict to known origins in production

---

# ============================================================
# PHASE 7: TESTING & VALIDATION
# ============================================================

## 7.1 Python Unit Tests

Create `src/tests/` directory with:

- **`test_model_engine.py`** — Test composite score calculation, HDBSCAN clustering, risk tier assignment. Use mock DataFrames with known values and assert expected output.
- **`test_advanced_model.py`** — Test XGBoost training with synthetic data, assert RMSE below threshold, verify SHAP values sum to model output.
- **`test_anomaly_detection.py`** — Inject synthetic nightlight drop anomaly, assert it's detected. Test Isolation Forest with known outliers.
- **`test_temporal_analysis.py`** — Test trend slope computation with a synthetic 12-month series, assert correct trajectory classification.
- **`test_predictive_model.py`** — Test Prophet forecast with synthetic history data, assert output has required columns and confidence bounds.
- **`test_spatial_statistics.py`** — Test Moran's I on a synthetic grid with known spatial pattern.
- **`test_db_utils.py`** — Test upsert logic using an in-memory SQLite database or PostgreSQL test instance.

Run with: `python -m pytest src/tests/ -v`

## 7.2 Node.js API Tests

Create `server/tests/` directory with:

- **`api.test.js`** — End-to-end API tests using `supertest`:
  - `GET /api/health` → 200 OK
  - `GET /api/hotspots` → 200, valid GeoJSON FeatureCollection
  - `GET /api/stats` → 200, correct keys present
  - `GET /api/rankings` → 200, array with required fields
  - `GET /api/states` → 200, array of state objects
  - `GET /api/lga/:name` → 200 for known LGA, 404 for unknown
  - `POST /api/auth/register` → 201 with user object
  - `POST /api/auth/login` → 200 with JWT token
  - `GET /api/v1/anomalies` → 200, requires auth header
  - `GET /api/v1/forecasts` → 200, requires auth header

- **`cache.test.js`** — Test Redis cache hit/miss behavior with a test Redis instance.

- **`auth.test.js`** — Test JWT token generation, validation, expiry, and RBAC role checks.

Install testing dependencies: `npm install --save-dev jest supertest`
Add to `server/package.json`: `"test": "jest --testPathPattern=tests/"`

Run with: `cd server && npm test`

## 7.3 Frontend Tests

Create `client/src/__tests__/` directory with:

- **`App.test.tsx`** — Render App without crashing, test view switching.
- **`MapComponent.test.tsx`** — Mock Leaflet, assert GeoJSON layer is rendered when data provided.
- **`Sidebar.test.tsx`** — Test national summary mode renders correctly; test LGA profile mode with mock LGA data.
- **`RankingsTable.test.tsx`** — Test sorting behavior, confirm rows render with correct data.
- **`StateOverview.test.tsx`** — Test state click triggers map zoom callback.
- **`SearchBar.test.tsx`** — Type into search, assert results dropdown appears; test keyboard navigation.
- **`useWebSocket.test.ts`** — Mock Socket.IO, assert alert events update the store.

Install: `npm install --save-dev @testing-library/react @testing-library/user-event vitest jsdom`
Add to `client/package.json`: `"test": "vitest run"`

Run with: `cd client && npm test`

## 7.4 Integration Tests

Create `tests/integration/` at project root:

- **`pipeline_e2e.py`** — Run the full ML pipeline with a small synthetic dataset, assert output GeoJSON has expected LGA count and all required columns.
- **`db_integration.py`** — Test full DB write → API read cycle with a live test PostgreSQL instance.
- **`websocket_e2e.py`** — Trigger an anomaly alert via the Python service, assert the WebSocket event is received by a test client.

## 7.5 Performance & Load Tests

Using `k6` or Apache JMeter:

- **Baseline load test**: 50 concurrent users hitting `/api/v1/hotspots` for 60 seconds. Target: p95 response time < 500ms with Redis cache enabled.
- **Stress test**: Ramp to 200 concurrent users, assert no 5xx errors.
- **Cache validation**: Compare response times with Redis enabled vs disabled. Assert cache reduces p95 by ≥ 60%.

Run with: `k6 run tests/load/hotspots.js`

---

# ============================================================
# IMPLEMENTATION ORDER (suggested)
# ============================================================

Work in this sequence to avoid breaking existing functionality:

1. **`.env.example`** + **`docker-compose.yml`** + **`server/init.sql`** (infrastructure)
2. **Install all new dependencies** (npm install + pip install)
3. **`server/redis.js`** + **`server/auth.js`** + **`server/websocket.js`** (backend infra)
4. **Update `server/database.js`** with new query functions + PostGIS
5. **Update `server/index.js`** with all new routes + Swagger
6. **`src/advanced_model.py`** + **`src/temporal_analysis.py`** + **`src/predictive_model.py`** + **`src/anomaly_detection.py`** + **`src/spatial_statistics.py`** (Python ML)
7. **Update `src/model_engine.py`** to integrate new models
8. **Update `src/scheduler_service.py`** with new tasks
9. **Update `src/config.py`** + **`src/db_config.py`** with new tables/config
10. **Client state management** (Zustand stores)
11. **MapView upgrade** (deck.gl) + **TimeSlider** + **ChoroplethToggle**
12. **Sidebar enhancement** (sparklines, forecasts, SHAP)
13. **New dashboard panels** (TrendChart, Leaderboard, CorrelationScatter, RadarComparison, CrisisCorridor)
14. **New pages** (InterventionTracker, ConflictPovertyNexus, SeasonalCalendar, BudgetOptimizer, ReportBuilder)
15. **Alerts, SavedViews, DataQuality, ScrollytellingTour**
16. **Mobile FieldView**
17. **Dockerfiles + Docker Compose finalization**
18. **Swagger documentation**
19. **Testing & validation pass** (Phase 7: unit, integration, load tests)

---

# ============================================================
# API KEYS REQUIRED (summary for user)
# ============================================================

| Service | What It's For | Where to Get It | Env Variable |
|---------|--------------|-----------------|--------------|
| ACLED | Conflict event data for Nigeria | https://developer.acleddata.com/ (free registration) | `ACLED_EMAIL`, `ACLED_API_KEY` |
| Google Earth Engine | VIIRS nightlight, NDVI (MODIS), Rainfall (CHIRPS) | https://console.cloud.google.com → Enable EE API → Service Account | `GEE_PROJECT`, `GEE_SERVICE_ACCOUNT`, `GEE_KEY_FILE` |
| IOM DTM | Displacement tracking data | https://dtmapi.iom.int/ (apply for access) | `DTM_API_KEY` |
| NASA LAADS | Raw VIIRS nightlight tiles download | https://ladsweb.modaps.eosdis.nasa.gov/ → Profile → App Keys | `NASA_LAADS_TOKEN` |
| SMTP (Gmail) | Email alerts to subscribed users | https://myaccount.google.com/apppasswords (enable 2FA first) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| Mapbox (optional) | Satellite basemap tiles | https://account.mapbox.com/access-tokens/ | Used in client code, not .env |

**Free / No-Key APIs** (already integrated, no action needed):
- HDX/HumData (health facilities, schools, IDP fallback)
- WorldPop (population density)
- OSM Overpass (roads, markets)
- WFP via HDX (food prices)
- CHIRPS via GEE (rainfall)
- MODIS via GEE (NDVI)

---

# ============================================================
# IMPORTANT IMPLEMENTATION NOTES
# ============================================================

1. **DO NOT break existing functionality**. All current endpoints, components, and data flows must continue working. New features are additive.

2. **Graceful degradation**: If Redis is unavailable, fall back to no-cache. If WebSocket fails, fall back to polling. If XGBoost training data is insufficient, fall back to existing weighted composite. If PostGIS is not enabled, fall back to existing text geometry.

3. **Keep the existing Leaflet map** as a fallback option. The deck.gl upgrade should be a toggle, not a forced replacement.

4. **All new Python modules** should have `if __name__ == "__main__"` blocks for standalone testing.

5. **Database migrations** should be additive (ADD COLUMN IF NOT EXISTS) — never drop existing columns.

6. **The frontend** should detect available API features and gracefully hide UI elements when backend endpoints don't exist yet (check for 404 and hide the panel).

7. **Use existing patterns**: Follow the coding style already in the project (ESM in server, functional components in React, Python class-based services).

8. **Environment detection**: Both `server/.env` and the root `.env` should be loaded. Python already uses `python-dotenv`. The server should load from its own `.env` first, falling back to root `.env`.

9. **Test each phase** before moving to the next. Each phase should result in a working (if incomplete) application.

10. **The `models/` directory** needs to be created for saving trained ML models. Add it to `.gitignore` (models can be large).
