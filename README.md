# IOPHIN — Poverty Hotspot Intelligence for Nigeria

**Version 5.0** — April 2026

IOPHIN (Integrated Open Poverty Hotspot Intelligence Network) is a full-stack geospatial intelligence platform for identifying, monitoring, and forecasting poverty risk across all 774 Local Government Areas (LGAs) in Nigeria.

## What's New in v4.0

### Core Features (Original v1.0)
- Python pipeline for feature extraction and K-Means clustering from MPI and nightlight data
- Simple Node.js API for hotspots and statistics
- React dashboard with interactive choropleth map
- Static CSV/GeoJSON output

---

## Recent test results & artifacts

We recently validated the PostGIS + Redis caching strategy and captured test artifacts. Key files and artifacts:

- **Caching validation report**: [CACHING_VALIDATION_REPORT.md](CACHING_VALIDATION_REPORT.md)
- **Quick reference**: [CACHING_QUICK_REFERENCE.md](CACHING_QUICK_REFERENCE.md)
- **Detailed testing guide**: [POSTGIS_REDIS_TESTING_GUIDE.md](POSTGIS_REDIS_TESTING_GUIDE.md)
- **Raw results & images**: `results/perf/` (example: [results/perf/cache_stats.png](results/perf/cache_stats.png), JMeter HTML: [results/perf/jmeter_html_short/index.html](results/perf/jmeter_html_short/index.html))

To regenerate the stats image locally:

```bash
python scripts/generate_stats_image.py --input results/perf/redis_cache_test.json --output results/perf/cache_stats.png
```

Notes:
- If you run tests locally, ensure `REDIS_URL` and `DATABASE_URL` (or `POSTGRES_URL`) are set in your environment or `server/.env`.
- No code modifications are required to reproduce the tests; only service endpoints must be reachable.

Embedded chart (generated):

![Cache vs DB response times](results/perf/cache_stats.png)

### Added in v2.0
- PostgreSQL + PostGIS database with spatial indexes
- Redis caching for API performance
- JWT authentication with role-based access control (RBAC)
- WebSocket real-time updates via Socket.IO
- Expanded `/api/v1/*` route family
- Anomaly detection and forecasting modules
- Intervention tracking system
- Alert subscription management (email + webhook)

### Added in v3.0
- 9 dashboard views (Map, Rankings, State Overview, Interventions, Seasonal, Budget, Reports, Alerts, Data Quality)
- Risk tiering modes (cluster-relative and absolute thresholds) with UI toggle
- Advanced analytics (correlation, crisis corridor, leaderboards)
- PDF report builder with customisable scope (national/state/LGA)
- Saved views with shareable tokens
- Dark/light theme toggle
- Scrollytelling onboarding tour
- Data quality monitoring panel
- 12+ configurable scheduler jobs for dynamic data refresh
- External API integration (ACLED, DTM/IOM, Google Earth Engine, HDX, WorldPop, OSM Overpass)

### Added in v5.0 (Current)
- **User Management Panel**: Full RBAC UI — manage users, roles, permissions, geographic scopes, and audit logs
- **Super Admin Role**: Elevated `super_admin` role with system-wide access
- **Geographic Scoping**: Per-user state/LGA access restrictions via `user_geographic_scopes`
- **Audit Logging**: JSONB-backed `user_audit_log` for all administrative actions
- **Enhanced RBAC**: 15 granular permissions across users, data, reports, alerts, interventions, and settings
- **XGBoost/LightGBM Dynamic Scoring**: ML-trained composite poverty scores replacing static weighted averages when sufficient ground-truth data exists
- **HDBSCAN Clustering**: HDBSCAN-first clustering with automatic K-Means fallback for resilience
- **Senatorial MPI Upgrade**: 3x resolution MPI from senatorial districts (109 zones to 774 LGA mapping via fuzzy match)
- **Spatial Statistics**: Moran's I, Getis-Ord Gi*, and Geographically Weighted Regression
- **Temporal Analysis**: MPI trajectory classification (deteriorating/stable/improving) with tier-crossing alerts
- **Comprehensive Name Normalisation**: 60+ LGA name corrections and 3-level matching for GeoJSON merge
- **Field View, Radar Comparison, Trend Charts, Correlation Scatter, Choropleth Toggle, Time Slider** components
- **MapLibre GL Integration**: Additional map rendering via `react-map-gl` + `maplibre-gl`
- **Google Earth Engine Integration**: Service account auth for NDVI, rainfall, and environmental data
- **Swagger/OpenAPI 3.0**: Full API documentation at `/api-docs`
- **Comprehensive Docker Compose**: 4-service stack (PostgreSQL/PostGIS, Redis, API, Client)

## Tech Stack

### Frontend (`client/`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7 | Build tool / dev server |
| Tailwind CSS | 4 | Utility-first styling |
| Leaflet / react-leaflet | 1.9 / 5.0 | Choropleth map |
| MapLibre GL / react-map-gl | 5.18 / 8.1 | Alternative map renderer |
| Recharts | 3.7 | Charts and visualisations |
| Framer Motion | 11 | Animations |
| Zustand | 4.5 | State management |
| Socket.IO Client | 4.7 | Real-time WebSocket |
| Turf.js | 7.0 | Client-side geospatial |
| jsPDF + AutoTable | 4.1 / 5.0 | Client-side PDF export |

### Backend (`server/`)
| Technology | Version | Purpose |
|-----------|---------|---------|
| Node.js | 20 | Runtime |
| Express | 4 (ESM) | HTTP framework |
| PostgreSQL / pg | 16 / 8.18 | Primary data store |
| PostGIS | 3.4 | Spatial queries |
| Redis / ioredis | 7 / 5.3 | Cache layer |
| Socket.IO | 4.7 | WebSocket server |
| JWT / bcrypt | 9 / 2.4 | Authentication |
| PDFKit | 0.17 | Server-side PDF reports |
| Swagger UI Express | 5.0 | API docs |
| Helmet / Morgan | 7 / 1.10 | Security / logging |
| Nodemailer | 8.0 | Email notifications |

### Python Intelligence Engine (`src/`)
| Technology | Purpose |
|-----------|---------|
| pandas / numpy | Data manipulation |
| scikit-learn | KNN imputation, PCA, K-Means, StandardScaler |
| hdbscan | Density-based clustering |
| xgboost / lightgbm | Dynamic composite poverty scoring |
| prophet | Time-series forecasting |
| pyod | Anomaly detection (Isolation Forest) |
| shap | Model interpretability |
| geopandas / rasterio / shapely | Geospatial processing |
| libpysal / esda / mgwr / splot | Spatial statistics |
| SQLAlchemy / psycopg2 | PostgreSQL ORM |
| earthengine-api | Google Earth Engine |
| schedule | Job scheduling |
| thefuzz / python-Levenshtein | Fuzzy name matching |

## Quick Start (Local)

### 1) Install dependencies

```bash
# Python (project root)
pip install -r requirements.txt

# Backend
cd server && npm install && cd ..

# Frontend
cd client && npm install && cd ..
```

### 2) Configure environment

Create `.env` at project root and `server/.env`:

```env
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
PORT=5000
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
NODE_ENV=development
RISK_TIERING_MODE=cluster
```

### 3) Start infrastructure

```bash
# Option A: Docker
docker compose up -d postgres redis

# Option B: Local PostgreSQL + Redis
```

### 4) Initialise database

```bash
psql -U postgres -d iophin_db -f server/init.sql
```

### 5) Generate model outputs and migrate

```bash
python -m src.main
python -m src.migrate_to_db
```

### 6) Run services

```bash
# Terminal 1 — API
cd server && npm run dev

# Terminal 2 — Frontend
cd client && npm run dev

# Terminal 3 (optional) — Dynamic monitoring
python -m src.scheduler_service
```

### 7) Open

- Dashboard: `http://localhost:5173`
- API Health: `http://localhost:5000/api/health`
- Swagger Docs: `http://localhost:5000/api-docs`

## Docker Compose (Full Stack)

```bash
docker compose up --build
```

| Service | Port | Image |
|---------|------|-------|
| PostgreSQL + PostGIS | 5432 | `postgis/postgis:16-3.4` |
| Redis | 6379 | `redis:7-alpine` |
| API Server | 5000 | `./server` |
| Client | 5173 / 80 | `./client` (nginx) |

## Data Flow

```text
INPUT DATA SOURCES
  Local Files:
    data/raw/nga_mpi(3).csv                  (State MPI, 37 states)
    data/raw/Nigeria MPI by Senatorial District.csv  (109 districts)
    data/raw/NGA_LGA_Boundaries_2_*/grid3_*.shp      (774 LGA shapes)
    data/raw/viirs_2024.tif                           (10.8 GB raster)
  External APIs (scheduler_service.py):
    ACLED -> conflict incidents
    DTM/IOM -> IDP displacement
    Google Earth Engine -> NDVI, rainfall, nightlights
    HDX -> food prices
    WorldPop -> population density
    OSM Overpass -> health facilities, schools, roads
        |
        v
PYTHON INTELLIGENCE ENGINE (src/)
  Phase 1: Feature Extraction (data_loader, feature_extraction)
  Phase 2: Data Fusion (model_engine: KNN, composite score, PCA, HDBSCAN-first + K-Means fallback)
  Phase 3: Analytics (anomaly_detection, predictive_model, spatial_statistics, temporal_analysis)
        |
        v
OUTPUT ARTIFACTS
  data/processed/final_model_output.csv
  data/processed/hotspots.geojson
  data/processed/hotspots.absolute.geojson
  models/xgboost_poverty_model.pkl
        |
        v
PostgreSQL + PostGIS (iophin_db)
  Tables: poverty_hotspots, hotspot_history, risk_change_log, anomaly_alerts,
          risk_forecasts, interventions, users, roles, permissions, ...
  Mat. Views: mv_state_aggregation, mv_risk_distribution, mv_rankings
        |
        v
Node.js API (server/) + Redis Cache
  /api/*     backward-compatible routes
  /api/v1/*  expanded analytical routes
  /api-docs  Swagger UI
  Socket.IO  real-time WebSocket events
        |
        v
React Dashboard (client/)
  10 views: Map, Rankings, States, Interventions, Seasonal,
            Budget, Reports, Alerts, Data Quality, User Management
  Zustand stores + WebSocket + Risk Mode Toggle + Theme
```

## Risk Tiering Modes

|Mode|Approach|Use Case|
|---|---|---|
|`cluster` (default)|HDBSCAN-first clustering (K-Means fallback only when needed); clusters ranked into tiers|Relative, context-aware prioritisation|
|`absolute`|Fixed numeric thresholds on `composite_poverty_score`|Deterministic, easy to interpret|

**Absolute thresholds** (configurable via env):
| Tier | Score Range |
|------|------------|
| Minimal | 0 - 0.05 |
| Low | 0.05 - 0.10 |
| Medium | 0.10 - 0.20 |
| High | 0.20 - 0.40 |
| Critical | 0.40 - 1.0 |

Toggle at runtime via the UI toolbar or `RISK_TIERING_MODE` environment variable.

## API Surface

### Health and Config
- `GET /api/health` — service health check
- `GET /api/config` — current risk tiering configuration
- `POST /api/config` — update tiering mode (admin only)

### Backward-Compatible (`/api/*`)
- `GET /api/hotspots`, `/api/stats`, `/api/lga/:name`, `/api/states`, `/api/rankings`, `/api/history/:lga`

### Expanded (`/api/v1/*`)
| Category | Endpoints |
|----------|-----------|
| **Auth** | `POST /auth/register`, `POST /auth/login`, `GET /auth/profile` |
| **Hotspots** | `GET /hotspots`, `GET /hotspots/within-radius`, `GET /stats`, `GET /states`, `GET /rankings` |
| **LGA Analytics** | `GET /lga/:name`, `GET /lga/:name/trends`, `GET /lga/:name/forecast`, `GET /lga/:name/anomalies` |
| **Change/Anomaly** | `GET /changes`, `GET /anomalies`, `PATCH /anomalies/:id/acknowledge` |
| **Forecasts** | `GET /forecasts`, `GET /forecasts/escalations` |
| **Correlation** | `GET /correlation/:metric1/:metric2` |
| **Interventions** | `GET /interventions`, `POST /interventions`, `PUT /interventions/:id` |
| **Alerts** | `GET /alerts/my`, `POST /alerts/subscribe`, `DELETE /alerts/:id` |
| **Saved Views** | `GET /saved-views`, `POST /saved-views`, `GET /saved-views/:token` |
| **Reports** | `POST /reports/generate` |
| **Users/RBAC** | `GET /users`, `PUT /users/:id/role`, `GET /roles`, `GET /permissions`, geographic scopes, audit log |

Swagger UI available at `http://localhost:5000/api-docs`.

## Frontend Components

### Navigation Views (10)
| View | Component | Description |
|------|-----------|-------------|
| Map | `MapComponent.tsx` | Interactive choropleth with risk layers |
| Rankings | `RankingsTable.tsx` | Sortable table of all 774 LGAs |
| State Overview | `StateOverview.tsx` | Aggregate statistics by state |
| Interventions | `InterventionTracker.tsx` | CRUD for intervention programs |
| Seasonal | `SeasonalCalendar.tsx` | Seasonal vulnerability calendar |
| Budget | `BudgetOptimizer.tsx` | Resource allocation optimisation |
| Reports | `ReportBuilder.tsx` | PDF report generation |
| Alerts | `AlertsManager.tsx` | Alert subscription management |
| Data Quality | `DataQualityPanel.tsx` | Data freshness monitoring |
| User Management | `UserManagementPanel.tsx` | RBAC: users, roles, permissions, scopes |

### Sidebar and Overlay Components
`Sidebar.tsx`, `AnomalyPanel.tsx`, `CrisisCorridor.tsx`, `Leaderboard.tsx`, `Legend.tsx`, `SearchBar.tsx`, `ChoroplethToggle.tsx`, `TimeSlider.tsx`, `TrendChart.tsx`, `CorrelationScatter.tsx`, `RadarComparison.tsx`, `FieldView.tsx`, `ScrollytellingTour.tsx`, `AuthModal.tsx`

### State Management (Zustand)
| Store | Purpose |
|-------|---------|
| `useDataStore` | Hotspots, stats, rankings, anomalies, forecasts |
| `useFilterStore` | State filter, risk filter, search, active view, tiering mode |
| `useMapStore` | Selected LGA, sidebar visibility |
| `useAuthStore` | Authentication state, user info, role |
| `useAlertStore` | Unread alert count |

## Repository Structure

```text
IOPHIN/
+-- client/                          # React + TypeScript dashboard
|   +-- src/
|   |   +-- components/              # 26 UI components
|   |   +-- contexts/ThemeContext.tsx
|   |   +-- hooks/useWebSocket.ts
|   |   +-- store/                   # 5 Zustand stores
|   |   +-- utils/riskTiers.ts
|   |   +-- App.tsx, main.tsx, types.ts, index.css
|   +-- Dockerfile, nginx.conf, package.json, vite.config.ts
|
+-- server/                          # Node.js/Express API
|   +-- index.js, database.js, auth.js, rbac.js
|   +-- alerts.js, reports.js, redis.js, websocket.js, swagger.js
|   +-- init.sql, Dockerfile, package.json
|
+-- src/                             # Python intelligence engine
|   +-- main.py, config.py, data_loader.py, feature_extraction.py
|   +-- model_engine.py, advanced_model.py
|   +-- anomaly_detection.py, predictive_model.py
|   +-- spatial_statistics.py, temporal_analysis.py
|   +-- scheduler_service.py, db_config.py, db_utils.py
|   +-- migrate_to_db.py, geospatial_env.py
|
+-- data/raw/                        # Source datasets (MPI CSVs, shapefiles, VIIRS)
+-- data/processed/                  # Model outputs (CSV, GeoJSON)
+-- models/                          # Trained ML models (XGBoost .pkl)
+-- gee/                             # Google Earth Engine credentials
+-- scripts/                         # Utility scripts
+-- docs/                            # Additional documentation
+-- ui designs/                      # Design mockups
+-- docker-compose.yml               # 4-service stack
+-- Dockerfile                       # Python scheduler container
+-- requirements.txt                 # 57 Python packages
```

## Documentation Index

| Document | Purpose |
|----------|---------|
| `README.md` | Project overview, quick start, structure (this file) |
| `ARCHITECTURE.md` | End-to-end architecture, data flow, component interactions |
| `SETUP.md` | Full installation and environment configuration |
| `QUICKSTART.md` | Static/local run workflow |
| `QUICKSTART_DYNAMIC.md` | Scheduler + dynamic monitoring workflow |
| `DYNAMIC_MONITORING.md` | Scheduler jobs, operational details, monitoring |
| `IMPLEMENTATION_SUMMARY.md` | Module-level implementation details |
| `TROUBLESHOOTING.md` | Common issues and solutions |
| `DATA_LICENSE.md` | Dataset attribution and licensing |
| `client/README.md` | Frontend-specific documentation |
| `server/README.md` | Backend-specific documentation |
| `docs/EXAMPLE_OUTPUT.md` | Representative runtime output examples |

## License

Software: MIT (see `license.md`)

Dataset terms vary by provider. See `DATA_LICENSE.md` before production or commercial use.
