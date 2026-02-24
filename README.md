# IOPHIN — Poverty Hotspot Intelligence for Nigeria

IOPHIN is a full-stack geospatial intelligence platform for identifying and monitoring poverty risk across Nigeria LGAs.

The current codebase includes:
- A Python intelligence engine (`src/`) for feature extraction, clustering, forecasting, anomaly detection, and scheduled refresh.
- A Node.js API (`server/`) with Redis cache, JWT auth, WebSocket broadcast, reporting endpoints, and PostgreSQL-first data access.
- A React + TypeScript dashboard (`client/`) with multi-view analytics, intervention planning tools, and real-time alert surfaces.

## What’s in this version

- Expanded dashboard navigation (map, rankings, state overview, interventions, seasonal, budget optimizer, reports, alerts, data quality).
- Advanced backend modules for auth, subscriptions, reports, anomalies, correlations, forecasts, saved views, and change tracking.
- PostGIS + materialized-view SQL bootstrap in `server/init.sql`.
- Redis-backed response caching and Socket.IO integration for live events.
- Dockerized stack with `postgres`, `redis`, `server`, and `client` services.

## Tech Stack

### Frontend (`client/`)
- React 19 + TypeScript + Vite
- Tailwind CSS 4
- Leaflet / react-leaflet
- Recharts + framer-motion
- Zustand for app state
- socket.io-client

### Backend (`server/`)
- Node.js + Express 4 (ESM)
- PostgreSQL (`pg`)
- Redis (`ioredis`)
- Socket.IO
- JWT + bcrypt auth
- PDF report generation (`pdfkit`)

### Python Engine (`src/`)
- pandas / numpy / scikit-learn / hdbscan
- xgboost / lightgbm / prophet / pyod / shap
- geopandas / rasterio / shapely / pyproj
- SQLAlchemy + psycopg2
- Earth Engine + external API enrichment

## Quick Start (Local)

### 1) Install dependencies

```bash
# Python (project root)
pip install -r requirements.txt

# Backend
cd server
npm install

# Frontend
cd ../client
npm install
```

### 2) Configure environment

Create `.env` at project root and/or `server/.env` with at least:

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
```

### 3) Generate/update model outputs

```bash
python -m src.main
python -m src.migrate_to_db
```

### 4) Run services

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev

# Optional Terminal 3 (dynamic monitoring)
python -m src.scheduler_service
```

Open `http://localhost:5173`.

## New: Risk Tiering Modes

The application supports two modes for mapping numeric poverty scores to human-readable risk tiers:

- **cluster (default)**: LGAs are clustered by multiple indicators (composite poverty score, nightlights, etc.) and clusters are ranked to assign tiers (Critical, High, Medium, Low, Minimal). This produces relative, context-aware tiers consistent with historical behavior.
- **absolute**: LGAs are assigned tiers using fixed numeric thresholds on `composite_poverty_score` (configurable via environment variables). This mode is deterministic and easier to interpret but may change historical distributions.

To switch modes at runtime use the toolbar toggle in the web app (Top-right) or set `RISK_TIERING_MODE` in the environment (`cluster` or `absolute`).

## Docker (optional)

```bash
docker compose up --build
```

Services:
- API: `http://localhost:5000`
- Client: `http://localhost:5173`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## API Surface

### Backward-compatible endpoints (`/api/*`)
- `GET /api/health`
- `GET /api/hotspots`
- `GET /api/stats`
- `GET /api/lga/:name`
- `GET /api/states`
- `GET /api/rankings`
- `GET /api/history/:lga`

### V1 expanded endpoints (`/api/v1/*`)
- Auth: `POST /auth/register`, `POST /auth/login`
- Hotspots/tools: `GET /hotspots`, `GET /hotspots/within-radius`, `GET /stats`, `GET /states`, `GET /rankings`
- LGA analytics: `GET /lga/:name`, `GET /lga/:name/trends`, `GET /lga/:name/forecast`, `GET /lga/:name/anomalies`
- Change/anomaly: `GET /changes`, `GET /anomalies`, `PATCH /anomalies/:id/acknowledge`
- Forecasts: `GET /forecasts`, `GET /forecasts/escalations`
- Correlation: `GET /correlation/:metric1/:metric2`
- Interventions: `GET /interventions`, `POST /interventions`, `PUT /interventions/:id`
- Alerts: `GET /alerts/my`, `POST /alerts/subscribe`, `DELETE /alerts/:id`
- Saved views: `GET /saved-views`, `POST /saved-views`, `GET /saved-views/:token`
- Reports: `POST /reports/generate`

## Repository Structure

```text
IOPHIN/
├── client/
│   ├── src/
│   │   ├── components/         # Map + analytics + advanced planning/reporting views
│   │   ├── contexts/           # Theme context
│   │   ├── hooks/              # WebSocket hook
│   │   ├── store/              # Zustand stores
│   │   ├── App.tsx             # Main multi-view shell
│   │   └── types.ts
│   └── package.json
├── server/
│   ├── index.js                # API server + v1 routes
│   ├── database.js             # DB access/query layer
│   ├── auth.js                 # JWT + role checks
│   ├── alerts.js               # Alert subscriptions
│   ├── reports.js              # Report generation
│   ├── redis.js                # Redis cache utilities
│   ├── websocket.js            # Socket.IO setup
│   ├── init.sql                # PostGIS + advanced tables/views
│   └── package.json
├── src/                        # Python intelligence engine
├── data/                       # raw + processed datasets
├── docs/
├── docker-compose.yml
└── requirements.txt
```

## Documentation Index

- `SETUP.md` — full installation and environment configuration
- `QUICKSTART.md` — static/local run workflow
- `QUICKSTART_DYNAMIC.md` — scheduler + dynamic monitoring workflow
- `DYNAMIC_MONITORING.md` — scheduler tasks and operational details
- `ARCHITECTURE.md` — end-to-end architecture and data flow
- `IMPLEMENTATION_SUMMARY.md` — module-level implementation summary
- `TROUBLESHOOTING.md` — common issues and fixes
- `DATA_LICENSE.md` — data attribution and dataset licensing context

## License

Software license: MIT (`license.md`)

Dataset terms vary by provider. See `DATA_LICENSE.md` before production or commercial use.