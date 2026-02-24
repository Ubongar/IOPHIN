# IOPHIN — Implementation Summary (Current)

## Backend Summary

- `server/index.js` now serves two route families:
  - compatibility routes at `/api/*`
  - expanded routes at `/api/v1/*`
- Security and platform middleware includes `helmet`, `morgan`, `cors`, `compression`, and rate limits.
- Redis cache integration is active for frequently requested data.
- JWT auth, role checks, and protected write operations are implemented via `auth.js`.
- WebSocket integration is initialized at startup for live notifications.

## Database Summary

- Core model table and history table remain central (`poverty_hotspots`, `hotspot_history`).
- New operational tables from `server/init.sql` support:
  - risk change logs
  - anomaly lifecycle
  - forecasts
  - interventions
  - user accounts / subscriptions / saved views
- PostGIS extension and spatial index support are included.

## Python Engine Summary

- Static pipeline remains available via `python -m src.main`.
- DB migration remains available via `python -m src.migrate_to_db`.
- Dynamic scheduler and advanced analytics modules are present:
  - forecasting (`predictive_model.py`)
  - anomaly detection (`anomaly_detection.py`)
  - temporal/spatial analysis modules

## Frontend Summary

- Main shell (`client/src/App.tsx`) now drives a broader set of views.
- Zustand stores centralize data, map state, filters, auth, and alert counters.
- WebSocket hook is wired for real-time behavior.
- Extended components include alert management, interventions, seasonal planning, budget optimization, report building, crisis corridor, and data quality.

## Risk Tiering Modes

The system supports two modes for assigning human-readable risk tiers:

- `cluster` (default): cluster-relative mapping based on composite poverty score, nightlights, and other indicators.
- `absolute`: fixed numeric thresholds applied to `composite_poverty_score` (configure via `src/config.py` or env vars `THRESHOLD_*`).

The frontend exposes a toggle (top toolbar) to switch modes at runtime; the toggle persists in localStorage and attempts to POST to `/api/config` to update the running process (admin only).

## Build/Run Summary

- API: `cd server && npm run dev`
- Client: `cd client && npm run dev`
- Scheduler: `python -m src.scheduler_service`
- Docker stack: `docker compose up --build`
