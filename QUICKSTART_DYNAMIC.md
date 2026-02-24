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

### Available Scheduler Jobs

| Job | Default Interval | Description |
|-----|------------------|-------------|
| conflict | 1 hour | ACLED conflict data refresh |
| viirs | 24 hours | Nightlight data processing |
| infrastructure | 6 hours | OSM infrastructure updates |
| ml_retrain | 12 hours | ML model retraining |
| grid3 | 168 hours (weekly) | Boundary data updates |
| ndvi | 24 hours | Vegetation index processing |
| rainfall | 24 hours | Rainfall data updates |
| population | 720 hours (monthly) | Population data updates |
| idp | 168 hours (weekly) | IDP tracking updates |
| food_price | 168 hours (weekly) | Food price index updates |
| external_enrichment | 24 hours | External API enrichment |
| gee_environmental | 24 hours | Google Earth Engine data |

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
- `GET /api/v1/forecasts` returns forecast data
- `GET /api/v1/forecasts/escalations` returns LGAs predicted to escalate
- Dashboard `Alerts` tab loads and updates

## 6) Optional full stack via Docker

```bash
docker compose up --build
```

## Dynamic Features

### Anomaly Detection
- Automatic detection of unusual poverty score changes
- Anomaly acknowledgment workflow
- Real-time notifications via WebSocket

### Forecasting
- Time-series forecasting using Prophet
- Risk escalation predictions
- Trend analysis per LGA

### Change Tracking
- Historical risk level transitions
- Score change logging
- Configurable lookback periods

### Alert Subscriptions
- Subscribe to alerts by LGA, state, or alert type
- Email and webhook notifications
- Manage subscriptions via Alerts tab

## Risk Tiering Modes

This system supports two risk-tiering modes: `cluster` (default) and `absolute`. Use the frontend toolbar toggle or set `RISK_TIERING_MODE` in your environment to `absolute` to use fixed thresholds (`THRESHOLD_MINIMAL`, `THRESHOLD_LOW`, `THRESHOLD_MEDIUM`, `THRESHOLD_HIGH`, `THRESHOLD_CRITICAL`).

### Environment Variables for Tiering

```env
RISK_TIERING_MODE=cluster
# Or for absolute mode:
RISK_TIERING_MODE=absolute
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0
```

## Monitoring the Scheduler

Check logs for scheduler activity:

```bash
# The scheduler outputs logs to console
# Look for messages like:
# [INFO] Running conflict data refresh...
# [INFO] Running anomaly detection...
# [INFO] Running predictive model update...
```

## Production Considerations

- Set strong `JWT_SECRET`
- Restrict `CORS` origins (`CLIENT_URL` in production)
- Monitor scheduler logs and API error logs
- Use managed PostgreSQL/Redis where possible
- Periodically refresh materialized views if using SQL optimization paths
- Configure appropriate scheduler intervals for your data freshness requirements
