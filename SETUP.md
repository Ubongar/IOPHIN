# IOPHIN — Setup Guide (v4.0)

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Python | 3.9+ | 3.11 |
| Node.js | 18+ | 20 LTS |
| npm | 9+ | 10+ |
| PostgreSQL | 14+ | 16 with PostGIS 3.4 |
| Redis | 6+ | 7 |

## 1) Clone and enter project

```bash
git clone https://github.com/Ubongar/IOPHIN.git
cd IOPHIN
```

## 2) Python environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

The `requirements.txt` installs 57 packages including:
- Core: pandas, numpy, scikit-learn, scipy
- Geospatial: geopandas, rasterio, shapely, fiona, pyproj
- ML: xgboost, lightgbm, prophet, hdbscan, pyod, shap
- Spatial stats: libpysal, esda, mgwr, splot
- DB: SQLAlchemy, psycopg2-binary
- Enrichment: earthengine-api, requests, schedule
- Utilities: thefuzz, python-Levenshtein, openpyxl, python-dotenv

## 3) Backend dependencies

```bash
cd server
npm install
cd ..
```

Server dependencies include: express, pg, ioredis, socket.io, jsonwebtoken, bcryptjs, pdfkit, swagger-ui-express, helmet, morgan, nodemailer, compression, cors, express-rate-limit.

## 4) Frontend dependencies

```bash
cd client
npm install
cd ..
```

Client dependencies include: react 19, vite 7, tailwindcss 4, leaflet, react-leaflet, maplibre-gl, react-map-gl, recharts, zustand, socket.io-client, framer-motion, @turf/turf, jspdf, axios.

## 5) Database and Redis

### Option A: Docker (recommended)

```bash
docker compose up -d postgres redis
```

This starts:
- **PostgreSQL 16 + PostGIS 3.4** on port 5432 (database: `iophin_db`)
- **Redis 7** on port 6379

The `init.sql` script is automatically applied on first container start via Docker volume mount.

### Option B: Local services

**PostgreSQL:**
```bash
createdb iophin_db
psql -U postgres -d iophin_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

**Redis:**
Start Redis on `localhost:6379`.

## 6) Environment configuration

Create `.env` at repository root and/or `server/.env`:

```env
# Required
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
PORT=5000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me-to-strong-random-string

# Risk tiering mode (cluster or absolute)
RISK_TIERING_MODE=cluster
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0

# External APIs (optional, for dynamic monitoring)
ACLED_EMAIL=
ACLED_API_KEY=
DTM_API_KEY=
NASA_LAADS_TOKEN=
GEE_PROJECT=gen-lang-client-0206534143
GEE_SERVICE_ACCOUNT=
GEE_KEY_FILE=./gee/gen-lang-client-0206534143-b4d81af822c7.json

# Scheduler intervals in hours (optional overrides)
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
```

## 7) Initialise database tables and views

Run `server/init.sql` against your database. This creates PostGIS extensions, all operational tables (risk_change_log, anomaly_alerts, risk_forecasts, interventions, users, roles, permissions, role_permissions, user_geographic_scopes, user_audit_log, alert_subscriptions, saved_views), materialized views, and refresh functions.

```bash
# Using psql
psql -U postgres -d iophin_db -f server/init.sql

# Or via Docker
docker exec -i iophin-postgres-1 psql -U postgres -d iophin_db < server/init.sql
```

If using Docker Compose with the provided volume mount, this runs automatically on first container start.

## 8) Generate model outputs and migrate

```bash
# Run the Python pipeline (produces CSV + GeoJSON outputs)
python -m src.main

# Migrate processed data into PostgreSQL
python -m src.migrate_to_db
```

Output files generated:
- `data/processed/final_model_output.csv` — 774 LGA records with all indicators
- `data/processed/hotspots.geojson` — GeoJSON with cluster-mode risk tiers
- `data/processed/hotspots.absolute.geojson` — GeoJSON with absolute-mode risk tiers
- `models/xgboost_poverty_model.pkl` — Trained XGBoost model (if sufficient data)

## 9) Run services

```bash
# Terminal 1 — API server
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev

# Terminal 3 (optional) — Dynamic scheduler
python -m src.scheduler_service
```

## 10) Validate

```bash
# API health
curl http://localhost:5000/api/health

# Hotspots data
curl http://localhost:5000/api/hotspots | head

# Risk tiering config
curl http://localhost:5000/api/config

# Swagger docs
open http://localhost:5000/api-docs
```

- Dashboard: `http://localhost:5173`
- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/api-docs`

## Full Docker Startup (Alternative)

```bash
docker compose up --build
```

This starts all 4 services:
| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL 16 + PostGIS 3.4 |
| `redis` | 6379 | Redis 7 cache |
| `server` | 5000 | Node.js API |
| `client` | 5173 | React frontend (nginx) |

## Post-Setup Configuration

### Create admin user

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"securepassword","full_name":"Admin User","role":"admin"}'
```

### Create super admin (first user setup)

The `super_admin` role provides full system access including user management, role assignment, geographic scoping, and audit log access.

### Verify risk tiering

```bash
curl http://localhost:5000/api/config
# Returns: { "tiering_mode": "cluster", "thresholds": {...} }
```

### Test WebSocket

The frontend auto-connects via Socket.IO. Check browser console for `[WebSocket] Connected` messages.

## Troubleshooting

See `TROUBLESHOOTING.md` for common issues and solutions.
