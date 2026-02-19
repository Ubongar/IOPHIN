# IOPHIN — Dynamic Monitoring Guide

## Purpose

Dynamic monitoring keeps poverty risk intelligence fresh by running scheduled data refresh, retraining, and operational analytics jobs.

## Core Runtime Pieces

- `src/scheduler_service.py`: schedule and orchestration.
- `src/config.py`: intervals and external source configuration.
- `server/index.js`: live API serving + cache + websocket.
- `server/init.sql`: advanced operational tables used by v1 routes.

## Typical Scheduler Job Categories

- conflict updates
- infrastructure updates
- environmental refresh (VIIRS/NDVI/rainfall)
- full model retraining
- anomaly detection
- predictive model refresh

## Data Persistence Targets

- `poverty_hotspots`: current-state hotspot records.
- `hotspot_history`: historical snapshots.
- `risk_change_log`: recent score/risk transitions.
- `anomaly_alerts`: anomaly flags and acknowledgement status.
- `risk_forecasts`: forecast outputs.

## API Consumption Pattern

Frontend uses:
- compatibility routes (`/api/hotspots`, `/api/stats`, `/api/rankings`, `/api/states`)
- expanded routes (`/api/v1/anomalies`, `/api/v1/changes`, `/api/v1/forecasts`, etc.)

Server uses:
- Redis cache for hot endpoints
- PostgreSQL as primary source
- GeoJSON fallback for compatible endpoints when DB is unavailable

## Operational Checklist

1. Confirm DB and Redis connectivity.
2. Confirm scheduler starts cleanly.
3. Confirm API health endpoint returns healthy status.
4. Confirm `/api/v1/anomalies` and `/api/v1/changes` return data structures.
5. Confirm dashboard alert and anomaly surfaces update.

## Recommended Production Controls

- Set strong `JWT_SECRET`.
- Restrict `CORS` origins (`CLIENT_URL` in production).
- Monitor scheduler logs and API error logs.
- Use managed PostgreSQL/Redis where possible.
- Periodically refresh materialized views if using SQL optimization paths.
