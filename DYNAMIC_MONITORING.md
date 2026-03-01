# IOPHIN — Dynamic Monitoring Guide (v4.0)

## Purpose

Dynamic monitoring keeps poverty risk intelligence fresh by running scheduled data refresh, ML retraining, anomaly detection, forecasting, and real-time event broadcasting.

## Core Runtime Components

| Component | Role |
|-----------|------|
| `src/scheduler_service.py` | Job scheduling and orchestration (12+ periodic tasks) |
| `src/config.py` | Intervals, API URLs, thresholds, model parameters |
| `src/anomaly_detection.py` | Nightlight drop detection + Isolation Forest |
| `src/predictive_model.py` | Prophet / linear forecasting (3 and 6 months) |
| `src/temporal_analysis.py` | MPI trajectory classification + tier-crossing |
| `src/spatial_statistics.py` | Moran's I, Getis-Ord Gi*, GWR |
| `src/model_engine.py` | KNN imputation, PCA, K-Means + HDBSCAN clustering |
| `src/advanced_model.py` | XGBoost dynamic composite scoring |
| `src/feature_extraction.py` | VIIRS raster + 8 external API data sources |
| `server/index.js` | API serving + Redis cache + WebSocket events |
| `server/init.sql` | All operational tables and materialized views |

## Scheduler Job Categories

### Data Refresh Jobs

| Job | Interval | Data Source | Target |
|-----|----------|-------------|--------|
| conflict | 1h | ACLED REST API | `poverty_hotspots.conflict_flag`, `last_conflict_event` |
| viirs | 24h | GEE / VIIRS raster | `mean_nightlight_intensity` |
| infrastructure | 6h | OSM Overpass API | `health_facility_count`, `school_count`, `road_density_km` |
| grid3 | 168h (weekly) | GRID3 shapefile | LGA boundary geometry updates |
| ndvi | 24h | GEE (MODIS) | `ndvi_mean` |
| rainfall | 24h | GEE (CHIRPS) | `rainfall_mm` |
| population | 720h (monthly) | WorldPop API | `population_density` |
| idp | 168h (weekly) | DTM/IOM API | `idp_count` |
| food_price | 168h (weekly) | HDX API | `food_price_index` |
| external_enrichment | 24h | Multiple APIs | Combined enrichment pass |
| gee_environmental | 24h | Google Earth Engine | Environmental indicators |

### Analytics Jobs

| Job | Interval | Module | Output |
|-----|----------|--------|--------|
| ml_retrain | 12h | `model_engine.py`, `advanced_model.py` | Re-cluster, re-score, save history snapshot |
| anomaly_detection | configurable | `anomaly_detection.py` | Nightlight drop flags, Isolation Forest outliers -> `anomaly_alerts` |
| predictive_model | configurable | `predictive_model.py` | Prophet/linear forecasts -> `risk_forecasts` |

## Data Persistence Targets

### Core Tables
| Table | Updated By | Purpose |
|-------|-----------|---------|
| `poverty_hotspots` | scheduler (upsert), pipeline | Current LGA poverty data (30+ columns) |
| `hotspot_history` | scheduler (snapshot) | Historical records for trend analysis |

### Operational Tables
| Table | Updated By | Purpose |
|-------|-----------|---------|
| `risk_change_log` | scheduler | Risk level transition audit trail |
| `anomaly_alerts` | anomaly_detection | Detected anomalies with severity + acknowledgment |
| `risk_forecasts` | predictive_model | 3/6 month risk predictions per LGA |
| `interventions` | API (user CRUD) | Aid/development program tracking |
| `alert_subscriptions` | API (user CRUD) | Email + webhook notification preferences |
| `saved_views` | API (user CRUD) | Shareable dashboard view configurations |

### Auth/RBAC Tables
| Table | Purpose |
|-------|---------|
| `users` | Account management (email, role, org, active) |
| `roles` | super_admin, admin, government, ngo, public, user |
| `permissions` | 15 granular permissions across 6 domains |
| `role_permissions` | Role-permission mapping |
| `user_geographic_scopes` | Per-user state/LGA access restrictions |
| `user_audit_log` | JSONB audit trail for admin actions |

### Materialized Views
| View | Refresh | Purpose |
|------|---------|---------|
| `mv_state_aggregation` | On demand / after retrain | Per-state averages |
| `mv_risk_distribution` | On demand / after retrain | Risk tier counts |
| `mv_rankings` | On demand / after retrain | LGA rank ordering |

Refresh all views: `SELECT refresh_materialized_views();`

## Risk Tiering Modes

### Cluster Mode (Default)
- LGAs clustered by composite poverty score, nightlights, health/education, infrastructure
- K-Means (k=5) + optional HDBSCAN with silhouette-score comparison
- Clusters ranked worst-to-best to assign: Critical, High, Medium, Low, Minimal
- Relative tiers that adapt to data distribution

### Absolute Mode
- Fixed thresholds on `composite_poverty_score`:
  | Tier | Threshold |
  |------|-----------|
  | Minimal | < 0.05 |
  | Low | 0.05 - 0.10 |
  | Medium | 0.10 - 0.20 |
  | High | 0.20 - 0.40 |
  | Critical | > 0.40 |
- Configurable via `RISK_TIERING_MODE=absolute` + `THRESHOLD_*` env vars
- Deterministic: same score always maps to same tier

### Configuration
```env
RISK_TIERING_MODE=cluster    # or 'absolute'
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0
```

Frontend UI toggle persists to localStorage and optionally syncs to server via `POST /api/config`.

## API Consumption Pattern

### Server Data Sources (priority order)
1. **Redis cache** — TTL-based, checked first (`X-Data-Source: cache`)
2. **PostgreSQL** — primary data store (`X-Data-Source: database`)
3. **GeoJSON file** — fallback for compatible routes (`X-Data-Source: file`)

### Frontend Endpoints Used
| Route Family | Endpoints |
|--------------|-----------|
| Compatibility (`/api/*`) | hotspots, stats, rankings, states, lga, history, config |
| Expanded (`/api/v1/*`) | anomalies, changes, forecasts, escalations, correlation, interventions, alerts, saved-views, reports, users, roles, permissions |

### Redis Cache TTLs
| Key | TTL |
|-----|-----|
| hotspots | 5 min |
| stats | 2 min |
| rankings | 5 min |
| states | 5 min |
| anomalies | 1 min |
| forecasts | 10 min |
| changes | 1 min |
| correlation | 5 min |
| interventions | 2 min |

## Real-Time WebSocket Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `alert` | Risk change, anomaly, forecast update | `{ type, lga_name, state, timestamp, ... }` |
| `lga-update` | LGA data changed | Targeted to `lga:{name}` room |
| `state-update` | State data changed | Targeted to `state:{name}` room |

Frontend `useWebSocket` hook:
- Auto-connects via Socket.IO
- Subscribes to rooms on LGA/state selection
- Updates Zustand stores on events
- Auto-reconnects on disconnect

## Operational Checklist

1. Confirm PostgreSQL and Redis connectivity
2. Confirm scheduler starts cleanly (`python -m src.scheduler_service`)
3. Confirm API health: `GET /api/health`
4. Confirm anomalies endpoint: `GET /api/v1/anomalies`
5. Confirm changes endpoint: `GET /api/v1/changes`
6. Confirm forecasts endpoint: `GET /api/v1/forecasts`
7. Verify WebSocket in browser console
8. Check dashboard Alerts and Data Quality tabs update
9. Review Swagger docs: `GET /api-docs`

## Monitoring Commands

```bash
# API health
curl http://localhost:5000/api/health

# Current risk tiering config
curl http://localhost:5000/api/config

# Recent changes
curl "http://localhost:5000/api/v1/changes?days=7"

# Active anomalies
curl http://localhost:5000/api/v1/anomalies

# Forecasts
curl http://localhost:5000/api/v1/forecasts

# Escalation predictions
curl http://localhost:5000/api/v1/forecasts/escalations

# Redis status (if redis-cli available)
redis-cli ping
redis-cli info memory
```

## External API Configuration

### Required for full enrichment

```env
# ACLED Conflict Data
ACLED_EMAIL=your-email@example.com
ACLED_API_KEY=your-api-key

# DTM/IOM IDP Data
DTM_API_KEY=your-api-key

# Google Earth Engine
GEE_PROJECT=your-project-id
GEE_SERVICE_ACCOUNT=your-sa@project.iam.gserviceaccount.com
GEE_KEY_FILE=./gee/your-key-file.json

# NASA LAADS (satellite data)
NASA_LAADS_TOKEN=your-token
```

### GEE Service Account Setup
The project includes a GEE service account key at `gee/gen-lang-client-0206534143-b4d81af822c7.json`. For production, use your own GEE project and service account.

## Troubleshooting Dynamic Mode

### Scheduler not starting
- Check Python dependencies: `pip install -r requirements.txt`
- Verify `DATABASE_URL` in `.env`
- Check logs for import errors

### No real-time updates
- Verify Redis is running: `redis-cli ping`
- Check WebSocket connection in browser console
- Verify Socket.IO CORS settings in `server/index.js`

### Stale data
- Check scheduler job logs for errors
- Verify external API credentials
- Check database write permissions
- Force refresh: `python -m src.main && python -m src.migrate_to_db`
