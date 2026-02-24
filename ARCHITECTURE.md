# IOPHIN — Architecture (Current)

## System Overview

```text
External Data + Local Data
        │
        ▼
Python Intelligence Engine (src/)
  - feature extraction
  - clustering + scoring
  - forecasting + anomalies
  - scheduled refresh
        │
        ▼
PostgreSQL + PostGIS (primary)  ◄──► Redis cache
        │
        ▼
Node.js API (server/)
  - /api/* compatibility routes
  - /api/v1/* expanded routes
  - auth + subscriptions + reports
  - Socket.IO real-time channel
        │
        ▼
React Dashboard (client/)
  - multi-view analytics and planning UI
  - Zustand stores + WebSocket updates
```

## Major Runtime Components

### Python layer (`src/`)
- `main.py`: orchestration of static pipeline output.
- `scheduler_service.py`: periodic jobs for dynamic monitoring.
- `feature_extraction.py`: raster/API enrichment features.
- `model_engine.py`: clustering, risk tier assignment, scoring.
- `predictive_model.py`: forecasting logic.
- `anomaly_detection.py`: anomaly detection logic.
- `advanced_model.py`, `spatial_statistics.py`, `temporal_analysis.py`: advanced analytics.
- `migrate_to_db.py`: processed output upsert into PostgreSQL.

### Database layer
- Core tables include `poverty_hotspots`, `hotspot_history`.
- Extended tables and views initialized from `server/init.sql`:
  - `risk_change_log`, `anomaly_alerts`, `risk_forecasts`, `interventions`, `users`, `alert_subscriptions`, `saved_views`
  - materialized views: `mv_state_aggregation`, `mv_risk_distribution`, `mv_rankings`

### API layer (`server/`)
- `index.js`: route registration, middleware, startup, graceful shutdown.
- `database.js`: query and mapping functions.
- `auth.js`: register/login/JWT middleware and role guards.
- `alerts.js`: subscription CRUD helpers.
- `reports.js`: report generation endpoint backend.
- `redis.js`: cached data keys and TTL behavior.
- `websocket.js`: Socket.IO initialization and event wiring.

### Frontend layer (`client/src/`)
- `App.tsx`: top-level shell, navigation, periodic refresh, orchestration.
- `components/*`: map and extended analytics/planning/reporting surfaces.
- `store/*`: Zustand stores (`data`, `filters`, `auth`, `alerts`, `map`).
- `hooks/useWebSocket.ts`: live server updates.

### Risk tiering modes

The system supports two modes for converting numeric poverty scores into human-readable risk tiers:

- **cluster (default)** — the existing pipeline: LGAs are clustered by multiple indicators and clusters are ranked to assign tiers. This yields relative tiers useful for prioritisation within national context.
- **absolute** — map numeric `composite_poverty_score` (or `MPI`) to tiers using configurable numeric thresholds (`ABSOLUTE_RISK_THRESHOLDS` in `src/config.py` or env vars `THRESHOLD_*`).

The frontend exposes a small toggle to switch modes at runtime (persisted to localStorage and optionally to the running server process via `/api/config`).

## Frontend Navigation (Current)

- `map`
- `rankings`
- `states`
- `interventions`
- `seasonal`
- `budget`
- `reports`
- `alerts`
- `settings` (data quality)

## Request/Data Flow

1. Frontend requests `/api/hotspots` and `/api/stats`.
2. API checks Redis cache; if miss, queries PostgreSQL.
3. If DB unavailable for compatible routes, API falls back to `data/processed/hotspots.geojson` where supported.
4. API returns response with `X-Data-Source` (`database`, `cache`, or `file`).
5. Frontend stores data in Zustand and updates active views.
6. WebSocket channel pushes real-time events/notifications.

## Scheduled Dynamic Processing

`src/config.py` drives interval settings (via env with defaults), including:
- conflict
- infrastructure
- viirs
- ml_retrain
- grid3
- ndvi
- rainfall
- population
- idp
- food_price
- external_enrichment
- gee_environmental
- anomaly_detection
- predictive_model

## Deployment Topologies

### Local (non-container)
- PostgreSQL + Redis locally
- API on `:5000`
- Client on `:5173`
- Python scheduler/manual jobs from project root

### Docker Compose
- `postgres` (postgis)
- `redis`
- `server`
- `client`

See `docker-compose.yml` and `SETUP.md` for details.
