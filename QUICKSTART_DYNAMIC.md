# IOPHIN — Quick Start: Dynamic Monitoring (v4.0)

Use this mode for scheduled data refresh, real-time alerts, anomaly detection, and forecast-aware operations.

## 1) Complete static quick start first

Run all steps in `QUICKSTART.md` so base outputs and database records exist.

## 2) Ensure dynamic prerequisites

- PostgreSQL running and reachable via `DATABASE_URL`
- Redis running and reachable via `REDIS_URL`
- Optional: external API keys configured in `.env` for enrichment feeds

## 3) Start scheduler

```bash
python -m src.scheduler_service
```

The scheduler runs 12+ periodic jobs configured in `src/config.py` (overridable via environment variables).

### Scheduler Jobs

| Job | Default Interval | Source | Description |
|-----|------------------|--------|-------------|
| conflict | 1h | ACLED API | Conflict incident data refresh |
| viirs | 24h | GEE / Local raster | Nightlight intensity processing |
| infrastructure | 6h | OSM Overpass | Health facilities, schools, roads |
| ml_retrain | 12h | Internal | Re-cluster + scoring + history snapshot |
| grid3 | 168h (weekly) | GRID3 | LGA boundary updates |
| ndvi | 24h | GEE (MODIS) | Vegetation index processing |
| rainfall | 24h | GEE (CHIRPS) | Precipitation data |
| population | 720h (monthly) | WorldPop | Population density |
| idp | 168h (weekly) | DTM/IOM | IDP displacement tracking |
| food_price | 168h (weekly) | HDX | Food price index |
| external_enrichment | 24h | Multiple | Combined API enrichment |
| gee_environmental | 24h | GEE | Environmental data (NDVI + rainfall) |

## 4) Start API and frontend

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
cd client && npm run dev
```

## 5) Verify dynamic behaviour

```bash
# Health check
curl http://localhost:5000/api/health

# Anomaly list
curl http://localhost:5000/api/v1/anomalies

# Recent changes (last 7 days)
curl "http://localhost:5000/api/v1/changes?days=7"

# Forecasts
curl http://localhost:5000/api/v1/forecasts

# Escalation predictions
curl http://localhost:5000/api/v1/forecasts/escalations

# Current configuration
curl http://localhost:5000/api/config
```

Dashboard Alerts and Data Quality tabs should show live data.

## 6) Full stack via Docker (optional)

```bash
docker compose up --build
```

## Dynamic Features

### Anomaly Detection
- **Nightlight drop detection**: Flags LGAs with >20% nightlight decline vs 30-day rolling average
- **Multivariate outlier detection**: PyOD Isolation Forest across 10 indicators
- Severity levels: low, medium, high, critical
- Acknowledgment workflow via API and UI

### Forecasting
- **Prophet** time-series model per LGA (falls back to linear extrapolation)
- 3-month and 6-month risk tier predictions with confidence scores
- Risk escalation alerts for LGAs forecast to worsen

### Temporal Analysis
- MPI trajectory classification: fast_deteriorating, deteriorating, stable, improving, fast_improving
- Tier-crossing detection with automatic logging
- Volatility and acceleration metrics

### Spatial Statistics
- Global Moran's I for spatial autocorrelation
- Getis-Ord Gi* for local spatial hotspot identification
- Geographically Weighted Regression for spatial variation

### Change Tracking
- Historical risk level transitions in `risk_change_log`
- Score change logging with timestamps
- Configurable lookback periods via API query params

### Alert Subscriptions
- Subscribe by LGA, state, or alert type
- Email notifications via SMTP (nodemailer)
- Webhook notifications with SSRF protection
- Manage via frontend Alerts tab or API

### Real-Time WebSocket
- Socket.IO events: `alert`, `lga-update`, `state-update`
- Room subscriptions: `lga:{name}`, `state:{name}`
- Automatic reconnection on disconnect

## Risk Tiering Modes

| Mode | Description |
|------|-------------|
| `cluster` (default) | K-Means/HDBSCAN clustering on composite score + indicators, clusters ranked to assign tiers |
| `absolute` | Fixed thresholds on `composite_poverty_score` |

Configure via environment or frontend UI toggle:

```env
RISK_TIERING_MODE=absolute
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0
```

## Monitoring the Scheduler

The scheduler outputs structured logs to console:

```text
[INFO] Starting IOPHIN Scheduler Service...
[INFO] Running conflict data refresh...
[INFO] Running anomaly detection pass...
[INFO] Running predictive model update...
[INFO] ML retrain completed: 774 LGAs updated
```

## Production Considerations

- Set strong `JWT_SECRET`
- Restrict CORS origins (`CLIENT_URL` environment variable)
- Use managed PostgreSQL/Redis services
- Monitor scheduler logs and API error rates
- Periodically refresh materialized views (`SELECT refresh_materialized_views()`)
- Configure scheduler intervals based on data freshness requirements
- Set up external monitoring for scheduler failures
- Monitor Redis memory usage
- Back up PostgreSQL regularly
