# IOPHIN — Architecture (v3.0)

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
- `utils/riskTiers.ts`: dynamic risk tier calculation.

### Risk tiering modes

The system supports two modes for converting numeric poverty scores into human-readable risk tiers:

- **cluster (default)** — the existing pipeline: LGAs are clustered by multiple indicators and clusters are ranked to assign tiers. This yields relative tiers useful for prioritisation within national context.
- **absolute** — map numeric `composite_poverty_score` (or `MPI`) to tiers using configurable numeric thresholds (`ABSOLUTE_RISK_THRESHOLDS` in `src/config.py` or env vars `THRESHOLD_*`).

The frontend exposes a small toggle to switch modes at runtime (persisted to localStorage and optionally to the running server process via `/api/config`).

## Frontend Navigation (v3.0)

| View | Component | Description |
|------|-----------|-------------|
| `map` | `MapComponent.tsx` | Interactive choropleth map with risk visualization |
| `rankings` | `RankingsTable.tsx` | Sortable table of LGAs by poverty indicators |
| `states` | `StateOverview.tsx` | Aggregate statistics by state |
| `interventions` | `InterventionTracker.tsx` | Track and manage intervention programs |
| `seasonal` | `SeasonalCalendar.tsx` | Seasonal calendar for planning |
| `budget` | `BudgetOptimizer.tsx` | Resource allocation optimization |
| `reports` | `ReportBuilder.tsx` | PDF report generation |
| `alerts` | `AlertsManager.tsx` | Alert subscription management |
| `settings` | `DataQualityPanel.tsx` | Data quality monitoring |

## Request/Data Flow

1. Frontend requests `/api/hotspots` and `/api/stats`.
2. API checks Redis cache; if miss, queries PostgreSQL.
3. If DB unavailable for compatible routes, API falls back to `data/processed/hotspots.geojson` where supported.
4. API returns response with `X-Data-Source` (`database`, `cache`, or `file`).
5. Frontend stores data in Zustand and updates active views.
6. WebSocket channel pushes real-time events/notifications.

## Scheduled Dynamic Processing

`src/config.py` drives interval settings (via env with defaults), including:
- conflict (1h default)
- infrastructure (6h default)
- viirs (24h default)
- ml_retrain (12h default)
- grid3 (168h/weekly default)
- ndvi (24h default)
- rainfall (24h default)
- population (720h/monthly default)
- idp (168h/weekly default)
- food_price (168h/weekly default)
- external_enrichment (24h default)
- gee_environmental (24h default)
- anomaly_detection (configurable)
- predictive_model (configurable)

## External Data Sources

| Source | Type | Purpose |
|--------|------|---------|
| Nigeria MPI | CSV | Multidimensional Poverty Index data |
| GRID3 | Shapefile | LGA boundary geometries |
| VIIRS | Raster | Nightlight intensity data |
| ACLED | API | Conflict incident data |
| DTM/IOM | API | IDP displacement tracking |
| Google Earth Engine | API | Environmental data (NDVI, rainfall) |
| HDX | API | Humanitarian data exchange |
| WorldPop | API | Population density data |
| OpenStreetMap | Overpass | Infrastructure (health facilities, schools, roads) |

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

## Security Features

- JWT-based authentication with bcrypt password hashing
- Role-based access control (admin, government, ngo, user)
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS configuration with environment-based origins
- Auth rate limiting (20 requests per 15 minutes)
- Protected write operations requiring authentication
