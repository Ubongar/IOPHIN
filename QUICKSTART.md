# IOPHIN — Quick Start: Static/Local (v4.0)

This flow runs the core model and dashboard without the scheduler. Ideal for initial setup and testing.

## 1) Install dependencies

```bash
pip install -r requirements.txt
cd server && npm install && cd ..
cd client && npm install && cd ..
```

## 2) Configure environment

Set DB/API basics in `.env` and/or `server/.env`:

```env
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
PORT=5000
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
```

### Risk tiering mode (optional)

Default is `cluster` (relative tiers from K-Means/HDBSCAN clustering). For deterministic absolute thresholds:

```env
RISK_TIERING_MODE=absolute
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0
```

## 3) Start infrastructure

```bash
docker compose up -d postgres redis
# Or start PostgreSQL + Redis locally
```

## 4) Initialise database

```bash
psql -U postgres -d iophin_db -f server/init.sql
```

## 5) Build processed outputs

```bash
python -m src.main
python -m src.migrate_to_db
```

**Outputs generated:**
- `data/processed/final_model_output.csv` — 774 LGA records
- `data/processed/hotspots.geojson` — cluster-mode GeoJSON
- `data/processed/hotspots.absolute.geojson` — absolute-mode GeoJSON
- `data/processed/processed_hotspots.csv` — intermediate features
- `models/xgboost_poverty_model.pkl` — trained model (if sufficient data)

## 6) Start API and frontend

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

## 7) Open

- Dashboard: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`
- Swagger docs: `http://localhost:5000/api-docs`
- API config: `http://localhost:5000/api/config`

## Dashboard Navigation (10 Views)

| View | Description |
|------|-------------|
| Map | Interactive choropleth with LGA risk visualisation |
| Rankings | Sortable table of all 774 LGAs by poverty indicators |
| State Overview | Aggregate statistics by state (37 + FCT) |
| Interventions | Track and manage intervention programs |
| Seasonal | Seasonal vulnerability calendar for planning |
| Budget Optimizer | Resource allocation by risk tier |
| Reports | PDF report generation (national/state/LGA) |
| Alerts | Alert subscription management |
| Data Quality | Data freshness and coverage monitoring |
| User Management | RBAC: users, roles, permissions, scopes, audit |

## Features Available in Static Mode

- Map visualisation with choropleth layers and LGA selection
- LGA rankings and state overviews
- Risk tiering (cluster or absolute mode) with UI toggle
- Intervention tracking (CRUD)
- Budget optimisation
- PDF report generation
- Saved views with shareable tokens
- Theme toggle (dark/light)
- Correlation scatter plots
- Radar comparison charts
- Trend charts (with available history)
- Crisis corridor identification
- Leaderboard
- User management (RBAC)
- Scrollytelling onboarding tour
- Swagger API documentation

## Features Requiring Dynamic Mode

For real-time updates, anomaly detection, live forecasting, and external data refresh, start the scheduler:

```bash
python -m src.scheduler_service
```

See `QUICKSTART_DYNAMIC.md` for details.

## Notes

- If PostgreSQL is unavailable, compatible `/api/*` endpoints fall back to GeoJSON file mode (`X-Data-Source: file`).
- Advanced `/api/v1/*` features require database tables created by `server/init.sql`.
- The frontend toolbar includes a Risk Mode toggle between Relative (cluster) and Absolute (threshold) tiering.
- Redis is optional but recommended; API degrades gracefully without it.
