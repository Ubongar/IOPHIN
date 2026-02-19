# IOPHIN — Quick Start (Dynamic Monitoring)

Use this mode for scheduled refresh, alerts, anomalies, and forecast-aware operations.

## 1) Complete static quick start first

Run steps in `QUICKSTART.md` so base outputs and DB records exist.

## 2) Ensure dynamic prerequisites

- PostgreSQL running and reachable by `DATABASE_URL`
- Redis running and reachable by `REDIS_URL`
- Optional API keys configured in `.env` for enrichment feeds

## 3) Start scheduler

```bash
python -m src.scheduler_service
```

Scheduler intervals are configured in `src/config.py` and can be overridden by environment variables.

## 4) Start API and frontend

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

## 5) Verify dynamic behavior

- `GET /api/health` returns healthy status
- `GET /api/v1/anomalies` returns anomaly list payload (possibly empty)
- `GET /api/v1/changes?days=7` returns recent change logs
- Dashboard `Alerts` tab loads and updates

## 6) Optional full stack via Docker

```bash
docker compose up --build
```
