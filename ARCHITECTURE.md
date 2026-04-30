# IOPHIN — Architecture (v4.0)

## System Overview

```text
                    EXTERNAL DATA SOURCES
    +----------------------------------------------------+
    | ACLED (conflict) | DTM/IOM (IDP) | HDX (food prices)|
    | WorldPop (pop.)  | OSM (infra.)  | GEE (env. data) |
    +----------------------------+-----------------------+
                                 |
        LOCAL DATA FILES         |
    +------------------------+   |
    | MPI CSVs (state +      |   |
    |   senatorial district) |   |
    | GRID3 shapefiles (774  |   |
    |   LGA boundaries)      |   |
    | VIIRS raster (10.8 GB  +---+
    |   nightlight data)     |
    +----------+-------------+
               |
               v
    +----------------------------------------------------+
    |       PYTHON INTELLIGENCE ENGINE (src/)             |
    |----------------------------------------------------|
    | data_loader.py        Load shapefiles, CSVs        |
    | feature_extraction.py VIIRS raster + 8 API sources |
    | model_engine.py       KNN, PCA, K-Means, HDBSCAN  |
    | advanced_model.py     XGBoost dynamic scoring      |
    | anomaly_detection.py  Nightlight drop + IForest    |
    | predictive_model.py   Prophet / linear forecast    |
    | spatial_statistics.py Moran's I, Gi*, GWR          |
    | temporal_analysis.py  MPI trajectory analysis      |
    | scheduler_service.py  12+ periodic refresh jobs    |
    +----------+-------------------------------------+---+
               |                                     |
               v                                     v
    +-------------------+             +-------------------+
    | File Outputs      |             | PostgreSQL+PostGIS|
    | final_model_      |             | (iophin_db)       |
    |   output.csv      |  migrate    | poverty_hotspots  |
    | hotspots.geojson  +------------>| hotspot_history   |
    | hotspots.absolute |             | anomaly_alerts    |
    |   .geojson        |             | risk_forecasts    |
    | xgboost_poverty_  |             | interventions     |
    |   model.pkl       |             | users + RBAC      |
    +-------------------+             | mat. views        |
                                      +--------+----------+
                                               |
                                          +----+----+
                                          v         v
                                 +-----------+ +-------------------+
                                 |Redis Cache| |Node.js API Server |
                                 |TTL-based  | |(server/)          |
                                 |hotspots   |<|                   |
                                 |stats      | |/api/*   compat.   |
                                 |rankings   | |/api/v1/* expanded |
                                 |anomalies  | |/api-docs Swagger  |
                                 |forecasts  | |Socket.IO realtime |
                                 |...        | |JWT + RBAC auth    |
                                 +-----------+ |PDF reports        |
                                               |Email/webhook      |
                                               +---------+---------+
                                                         |
                                                         v
                                 +--------------------------------------+
                                 |    React Dashboard (client/)         |
                                 |--------------------------------------|
                                 | 10 Navigation Views:                 |
                                 |   Map, Rankings, State Overview,     |
                                 |   Interventions, Seasonal, Budget,   |
                                 |   Reports, Alerts, Data Quality,     |
                                 |   User Management                    |
                                 |                                      |
                                 | Zustand: data, filter, map,          |
                                 |          auth, alerts stores          |
                                 | WebSocket: real-time updates         |
                                 | Risk Mode: cluster | absolute toggle |
                                 | Theme: dark | light                  |
                                 +--------------------------------------+
```

## Python Intelligence Engine (`src/`)

| Module | Purpose | Key Details |
|--------|---------|-------------|
| `main.py` | Static pipeline orchestration | 4-phase workflow: extract, fuse, cluster, output |
| `config.py` | All configuration | Paths, model params, API URLs, scheduler intervals, thresholds |
| `data_loader.py` | Data loading | Shapefiles, state MPI, senatorial MPI (fuzzy match to LGA), processed CSVs |
| `feature_extraction.py` | Feature engineering | VIIRS windowed raster read, GRID3 health/education, WorldPop, OSM roads, GEE NDVI/rainfall, IDP, food prices |
| `model_engine.py` | Clustering and scoring | KNN imputation, weighted composite score, PCA, K-Means (k=5), HDBSCAN, silhouette comparison |
| `advanced_model.py` | ML dynamic scoring | XGBoost/LightGBM trained on ground-truth MPI, falls back to weighted composite |
| `anomaly_detection.py` | Anomaly detection | Nightlight drop detection (20% threshold), PyOD Isolation Forest multivariate |
| `predictive_model.py` | Forecasting | Prophet or linear extrapolation for 3/6 month risk tier forecasts |
| `spatial_statistics.py` | Spatial analysis | Global Moran's I, Getis-Ord Gi* local hotspots, GWR |
| `temporal_analysis.py` | Temporal analysis | MPI trajectory classification, tier-crossing detection, volatility |
| `scheduler_service.py` | Dynamic scheduler | 12+ jobs with configurable intervals (ACLED, VIIRS, GEE, OSM, etc.) |
| `db_config.py` | ORM models | SQLAlchemy models: PovertyHotspot, HotspotHistory, AnomalyAlert, RiskForecast |
| `db_utils.py` | DB operations | Upsert, history snapshots, filtered queries, rankings, state aggregation |
| `migrate_to_db.py` | One-shot migration | Loads GeoJSON output into PostgreSQL |
| `geospatial_env.py` | PROJ/GDAL bootstrap | Ensures correct runtime PROJ_LIB/GDAL_DATA paths |

### Pipeline Phases (main.py)

1. **Phase 1 — Feature Extraction**: Load LGA shapefile (774 polygons), processed hotspots CSV, extract nightlight features via windowed raster reading from 10.8 GB VIIRS file
2. **Phase 2 — Data Fusion**: Load state MPI (37 states) + senatorial MPI (109 districts), merge to LGA level via fuzzy matching with 60+ name corrections
3. **Phase 2.5 — External Enrichment**: GRID3 health facilities/schools, WorldPop population, OSM road density, IDP counts, food price index
4. **Phase 3 — Unsupervised ML**: KNN imputation (k=5), weighted composite poverty score, PCA (95% variance), K-Means (k=5) + HDBSCAN clustering, risk tier assignment
5. **Output**: CSV + GeoJSON files, database upsert, history snapshot

### Model Parameters (config.py)

| Parameter | Value | Description |
|-----------|-------|-------------|
| `K_CLUSTERS` | 5 | Risk tiers: Critical, High, Medium, Low, Minimal |
| `PCA_VARIANCE` | 0.95 | Retained variance for PCA |
| `KNN_NEIGHBORS` | 5 | KNN imputation neighbors |
| `USE_HDBSCAN` | true | Enable HDBSCAN dual clustering |
| `HDBSCAN_MIN_CLUSTER_SIZE` | 30 | Minimum cluster size |
| `NIGHTLIGHT_DROP_THRESHOLD` | 0.20 | Anomaly trigger threshold |
| `ANOMALY_CONTAMINATION` | 0.05 | Isolation Forest contamination |
| `FORECAST_HORIZONS` | [3, 6] | Months ahead for forecasting |

### Composite Poverty Score Weights

| Indicator | Weight |
|-----------|--------|
| MPI | 0.30 |
| Inverse Nightlight | 0.25 |
| Health Access | 0.15 |
| Education Access | 0.15 |
| Infrastructure | 0.15 |

## Database Layer (PostgreSQL + PostGIS)

### Core Tables
| Table | Purpose |
|-------|---------|
| `poverty_hotspots` | Current LGA poverty data with 30+ indicators + PostGIS geometry |
| `hotspot_history` | Historical snapshots for trend analysis |

### Operational Tables (server/init.sql)
| Table | Purpose |
|-------|---------|
| `risk_change_log` | Audit trail for risk level transitions |
| `anomaly_alerts` | Detected anomalies with severity and acknowledgment status |
| `risk_forecasts` | 3/6 month Prophet/linear predictions per LGA |
| `interventions` | Aid/development program tracking |
| `alert_subscriptions` | Email + webhook notification subscriptions |
| `saved_views` | Shareable map view configurations |

### Auth/RBAC Tables
| Table | Purpose |
|-------|---------|
| `users` | Email, password hash, role, organisation, active status |
| `roles` | super_admin, admin, government, ngo, public, user |
| `permissions` | 15 granular permissions |
| `role_permissions` | Many-to-many role-permission mapping |
| `user_geographic_scopes` | Per-user state/LGA access restrictions |
| `user_audit_log` | JSONB audit trail for admin actions |

### Materialized Views
| View | Purpose |
|------|---------|
| `mv_state_aggregation` | Per-state averages (MPI, nightlight, composite, facilities) |
| `mv_risk_distribution` | Risk level counts and averages |
| `mv_rankings` | LGA rank by composite score |

### Spatial Features
- PostGIS extensions: `postgis`, `postgis_topology`, `pg_trgm`
- Geometry column: `geom geometry(MultiPolygon, 4326)`
- GIST spatial index for geographic queries
- Radius-based proximity queries via `/api/v1/hotspots/within-radius`

## API Layer (`server/`)

| Module | Purpose |
|--------|---------|
| `index.js` | Route registration, middleware stack, HTTP server, graceful shutdown |
| `database.js` | PostgreSQL query/mapping: getHotspots, getStats, getRankings, getStateAggregation, getHistory |
| `auth.js` | JWT register/login, bcrypt hashing, `authMiddleware`, `requireAuth`, `requireRole` |
| `rbac.js` | Role/permission CRUD, geographic scopes, user management, audit logging |
| `alerts.js` | Alert subscription CRUD, email (nodemailer), webhook with SSRF protection |
| `reports.js` | PDF generation with PDFKit: stat cards, bar charts, tables, risk distribution |
| `redis.js` | ioredis with TTL-based caching, graceful degradation, pattern invalidation |
| `websocket.js` | Socket.IO init, room subscriptions (lga, state), event emission |
| `swagger.js` | OpenAPI 3.0 spec (1854 lines) for all endpoints |
| `init.sql` | PostGIS setup, all tables, materialized views, refresh function |

### Middleware Stack
- `helmet` — HTTP security headers
- `morgan` — request logging
- `cors` — cross-origin (configurable origins)
- `compression` — gzip responses
- Rate limiting: 200 req/15min (general), 20 req/15min (auth)

### Redis Cache TTLs
| Key | TTL (seconds) |
|-----|---------------|
| hotspots | 300 |
| stats | 120 |
| rankings | 300 |
| states | 300 |
| lga | 180 |
| anomalies | 60 |
| forecasts | 600 |
| changes | 60 |
| correlation | 300 |
| interventions | 120 |

### Data Source Fallback
1. Redis cache (if available) — `X-Data-Source: cache`
2. PostgreSQL database — `X-Data-Source: database`
3. GeoJSON file fallback (compatible routes only) — `X-Data-Source: file`

## Frontend Layer (`client/src/`)

### Application Shell (`App.tsx`)
- 10-view navigation with active state
- Periodic data refresh on configurable interval
- Filter orchestration (state, risk level, search query)
- Risk tiering mode toggle (cluster/absolute)
- Theme toggle (dark/light)
- Authentication modal integration
- Scrollytelling onboarding tour

### Navigation Views (10)
| View ID | Component | Description |
|---------|-----------|-------------|
| `map` | `MapComponent.tsx` | Leaflet choropleth with risk-colored polygons, click-to-select |
| `rankings` | `RankingsTable.tsx` | Sortable/filterable table of all 774 LGAs |
| `states` | `StateOverview.tsx` | Aggregate state-level statistics |
| `interventions` | `InterventionTracker.tsx` | CRUD for intervention programs |
| `seasonal` | `SeasonalCalendar.tsx` | Seasonal vulnerability patterns |
| `budget` | `BudgetOptimizer.tsx` | Resource allocation by risk tier |
| `reports` | `ReportBuilder.tsx` | PDF report generation UI |
| `alerts` | `AlertsManager.tsx` | Alert subscription management |
| `settings` | `DataQualityPanel.tsx` | Data freshness and coverage metrics |
| `users` | `UserManagementPanel.tsx` | Full RBAC: users, roles, permissions, scopes, audit |

### Sidebar and Analytical Overlays
| Component | Description |
|-----------|-------------|
| `Sidebar.tsx` | LGA detail panel — stats, charts, tabs |
| `AnomalyPanel.tsx` | Anomaly list with acknowledgment workflow |
| `CrisisCorridor.tsx` | Geographic crisis corridor identification |
| `Leaderboard.tsx` | Comparative performance rankings |
| `Legend.tsx` | Risk tier colour legend |
| `SearchBar.tsx` | LGA search with autocomplete |
| `ChoroplethToggle.tsx` | Map display mode switcher |
| `TimeSlider.tsx` | Temporal navigation for history |
| `TrendChart.tsx` | Time-series charts per LGA |
| `CorrelationScatter.tsx` | Scatter plots for indicator pairs |
| `RadarComparison.tsx` | Multi-indicator radar charts |
| `FieldView.tsx` | Extended field data view |
| `ScrollytellingTour.tsx` | Interactive onboarding |
| `AuthModal.tsx` | Login/registration form |

### State Management (Zustand)
| Store | File | Manages |
|-------|------|---------|
| Data | `useDataStore.ts` | Hotspots, stats, rankings, anomalies, forecasts, changes, interventions |
| Filters | `useFilterStore.ts` | State filter, risk filter, search query, active view, tiering mode |
| Map | `useMapStore.ts` | Selected LGA, sidebar open/close |
| Auth | `useAuthStore.ts` | User info, JWT token, role |
| Alerts | `useAlertStore.ts` | Unread count |

### Real-Time (WebSocket)
- `hooks/useWebSocket.ts` connects via Socket.IO
- Room subscriptions: `lga:{name}`, `state:{name}`
- Events: `alert`, `lga-update`, `state-update`
- Auto-reconnection on disconnect

### Risk Tiering (Client-Side)
- `utils/riskTiers.ts` provides `getDynamicRiskLevel()`
- Supports both cluster-relative and absolute threshold modes
- Toggle persisted to localStorage, optionally synced to server via `POST /api/config`

## Deployment Topologies

### Local Development (non-container)
- PostgreSQL + Redis installed locally
- API on `:5000`, Client on `:5173`
- Python scheduler from project root

### Docker Compose
```yaml
services:
  postgres:   postgis/postgis:16-3.4 (port 5432, init.sql auto-applied)
  redis:      redis:7-alpine (port 6379)
  server:     ./server (port 5000, depends on postgres + redis)
  client:     ./client (port 5173/80 via nginx, depends on server)
```

### Production Considerations
- Set strong `JWT_SECRET` and restrict `CORS` origins
- Use managed PostgreSQL/Redis services
- Monitor scheduler logs and API error rates
- Periodically refresh materialized views
- Configure scheduler intervals for data freshness needs
- Set up alerting for scheduler failures and Redis memory

## Security Features

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT tokens (7-day expiry) with bcrypt password hashing (12 rounds) |
| Authorization | Role-based access: super_admin, admin, government, ngo, public, user |
| Permissions | 15 granular permissions across 6 domains |
| Geographic Scoping | Per-user state/LGA restrictions |
| Rate Limiting | 200 req/15min (general), 20 req/15min (auth) |
| Security Headers | Helmet.js |
| CORS | Environment-configurable allowed origins |
| Audit Trail | JSONB audit log for all admin actions |
| SSRF Protection | Webhook URLs validated (HTTPS only, no private IPs) |

## External Data Sources

| Source | Type | Refresh | Purpose |
|--------|------|---------|---------|
| Nigeria MPI (NBS) | CSV | Static | Multidimensional Poverty Index (state + senatorial) |
| GRID3 Nigeria | Shapefile | Weekly | LGA boundary geometries (774 LGAs) |
| VIIRS/NOAA | GeoTIFF | Daily | Nightlight intensity raster (10.8 GB) |
| ACLED | REST API | Hourly | Armed conflict incidents |
| DTM/IOM | REST API | Weekly | IDP displacement tracking |
| Google Earth Engine | API | Daily | NDVI (MODIS), rainfall (CHIRPS), environmental |
| HDX | REST API | Weekly | Food price index |
| WorldPop | REST API | Monthly | Population density estimates |
| OpenStreetMap | Overpass API | 6-hourly | Health facilities, schools, road networks |

---

## Recent test results & artifacts

Architecture and operations notes were validated during PostGIS + Redis performance testing. Key artifacts:

- [CACHING_VALIDATION_REPORT.md](CACHING_VALIDATION_REPORT.md)
- [CACHING_QUICK_REFERENCE.md](CACHING_QUICK_REFERENCE.md)
- [POSTGIS_REDIS_TESTING_GUIDE.md](POSTGIS_REDIS_TESTING_GUIDE.md)
- Raw results/images: [results/perf/cache_stats.png](results/perf/cache_stats.png), [results/perf/jmeter_html_short/index.html](results/perf/jmeter_html_short/index.html)

These artifacts provide evidence for the system performance claims and recommended deployment configuration.
