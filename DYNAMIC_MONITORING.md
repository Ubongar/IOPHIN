# IOPHIN — Dynamic Monitoring Guide (v3.0)

## Purpose

Dynamic monitoring keeps poverty risk intelligence fresh by running scheduled data refresh, retraining, and operational analytics jobs.

## Core Runtime Pieces

- `src/scheduler_service.py`: schedule and orchestration.
- `src/config.py`: intervals and external source configuration.
- `server/index.js`: live API serving + cache + websocket.
- `server/init.sql`: advanced operational tables used by v1 routes.

## Scheduler Job Categories

### Data Refresh Jobs

| Job | Interval | Data Source | Purpose |
|-----|----------|-------------|---------|
| conflict | 1h | ACLED API | Conflict incident data |
| viirs | 24h | Local raster | Nightlight intensity |
| infrastructure | 6h | OSM Overpass | Health facilities, schools, roads |
| grid3 | 168h | Shapefile | LGA boundary updates |
| ndvi | 24h | Google Earth Engine | Vegetation index |
| rainfall | 24h | Google Earth Engine | Precipitation data |
| population | 720h | WorldPop API | Population density |
| idp | 168h | DTM/IOM API | IDP displacement |
| food_price | 168h | HDX | Food price index |
| external_enrichment | 24h | Multiple APIs | General enrichment |
| gee_environmental | 24h | Google Earth Engine | Environmental data |

### Analytics Jobs

| Job | Purpose |
|-----|---------|
| ml_retrain | Retrain clustering/scoring models |
| anomaly_detection | Detect unusual patterns in poverty scores |
| predictive_model | Generate forecasts for risk escalation |

## Risk Tiering Modes

Risk labels used by alerts and dashboards can be derived using cluster-relative ranking (default) or absolute thresholds on `composite_poverty_score`. Configure `RISK_TIERING_MODE` in `src/config.py` or via environment variables.

### Cluster Mode (Default)
- LGAs clustered by multiple indicators
- Clusters ranked to assign tiers
- Relative, context-aware classification

### Absolute Mode
- Fixed numeric thresholds
- Configurable via environment:
  ```env
  RISK_TIERING_MODE=absolute
  THRESHOLD_MINIMAL=0.05
  THRESHOLD_LOW=0.10
  THRESHOLD_MEDIUM=0.20
  THRESHOLD_HIGH=0.40
  THRESHOLD_CRITICAL=1.0
  ```

## Data Persistence Targets

| Table | Purpose |
|-------|---------|
| `poverty_hotspots` | Current-state hotspot records |
| `hotspot_history` | Historical snapshots |
| `risk_change_log` | Recent score/risk transitions |
| `anomaly_alerts` | Anomaly flags and acknowledgment status |
| `risk_forecasts` | Forecast outputs |
| `interventions` | Intervention program tracking |
| `alert_subscriptions` | User alert preferences |
| `saved_views` | Shareable dashboard configurations |

## API Consumption Pattern

### Frontend Uses:
- Compatibility routes (`/api/hotspots`, `/api/stats`, `/api/rankings`, `/api/states`)
- Expanded routes (`/api/v1/anomalies`, `/api/v1/changes`, `/api/v1/forecasts`, etc.)

### Server Uses:
- Redis cache for hot endpoints
- PostgreSQL as primary source
- GeoJSON fallback for compatible endpoints when DB is unavailable

## Real-Time Updates

### WebSocket Events
The system pushes real-time updates via Socket.IO:

| Event | Description |
|-------|-------------|
| `risk_change` | LGA risk level changed |
| `anomaly_detected` | New anomaly detected |
| `forecast_update` | Forecast data updated |
| `system_status` | System status change |

### Frontend Integration
- `useWebSocket` hook manages connection
- Automatic reconnection on disconnect
- Updates to Zustand stores on events

## Operational Checklist

1. Confirm DB and Redis connectivity.
2. Confirm scheduler starts cleanly.
3. Confirm API health endpoint returns healthy status.
4. Confirm `/api/v1/anomalies` and `/api/v1/changes` return data structures.
5. Confirm dashboard alert and anomaly surfaces update.
6. Verify WebSocket connection in browser console.

## Monitoring Commands

### Check API Health
```bash
curl http://localhost:5000/api/health
```

### Check Current Configuration
```bash
curl http://localhost:5000/api/config
```

### View Recent Changes
```bash
curl http://localhost:5000/api/v1/changes?days=7
```

### View Active Anomalies
```bash
curl http://localhost:5000/api/v1/anomalies
```

### View Forecasts
```bash
curl http://localhost:5000/api/v1/forecasts
curl http://localhost:5000/api/v1/forecasts/escalations
```

## Recommended Production Controls

- Set strong `JWT_SECRET`
- Restrict `CORS` origins (`CLIENT_URL` in production)
- Monitor scheduler logs and API error logs
- Use managed PostgreSQL/Redis where possible
- Periodically refresh materialized views if using SQL optimization paths
- Configure appropriate scheduler intervals for your data freshness requirements
- Set up alerting for scheduler failures
- Monitor Redis memory usage

## External API Configuration

### Required for Full Functionality

```env
# ACLED Conflict Data
ACLED_EMAIL=your-email@example.com
ACLED_API_KEY=your-api-key

# DTM/IOM IDP Data
DTM_API_KEY=your-api-key

# Google Earth Engine
GEE_PROJECT=your-project-id
GEE_SERVICE_ACCOUNT=your-service-account@project.iam.gserviceaccount.com
GEE_KEY_FILE=./gee/key-file.json

# NASA LAADS (for satellite data)
NASA_LAADS_TOKEN=your-token
```

## Troubleshooting

### Scheduler Not Running
- Check Python dependencies are installed
- Verify database connectivity
- Check external API credentials

### No Real-Time Updates
- Verify Redis is running
- Check WebSocket connection in browser
- Verify Socket.IO is initialized on server

### Stale Data
- Check scheduler job logs
- Verify external API responses
- Check database write permissions
