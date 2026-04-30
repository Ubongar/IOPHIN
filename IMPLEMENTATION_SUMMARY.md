# IOPHIN — Implementation Summary (v4.0)

## Overview

IOPHIN v4.0 is a full-stack geospatial intelligence platform for monitoring, analyzing, and forecasting poverty risk across Nigeria's 774 Local Government Areas (LGAs). The system combines multi-source data ingestion, machine learning clustering and scoring, advanced spatial and temporal analytics, anomaly detection, forecasting, role-based access control, and real-time event broadcasting through a three-layer architecture.

---

## Layer 1: Python Analytics Engine (`src/`)

### Modules

| Module | Purpose |
|--------|---------|
| `config.py` | Central configuration: thresholds, API keys, model parameters, intervals |
| `data_loader.py` | CSV ingestion, name normalization (60+ corrections), LGA shapefile merge |
| `feature_extraction.py` | VIIRS nightlight raster, 8 external API sources, GEE environmental data |
| `model_engine.py` | KNN imputation, PCA, K-Means + HDBSCAN clustering, composite scoring |
| `advanced_model.py` | XGBoost, LightGBM, Random Forest dynamic scoring with cross-validation |
| `anomaly_detection.py` | Nightlight drop detection + Isolation Forest, configurable thresholds |
| `predictive_model.py` | Prophet / linear fallback forecasting (3-month, 6-month horizons) |
| `spatial_statistics.py` | Moran's I, Getis-Ord Gi*, Geographically Weighted Regression (GWR) |
| `temporal_analysis.py` | MPI trajectory classification, tier-crossing detection |
| `geospatial_env.py` | GEE service account init, rasterio/GDAL environment configuration |
| `db_config.py` | SQLAlchemy engine + session factory |
| `db_utils.py` | Bulk upsert, materialized view refresh, history snapshot, change logging |
| `migrate_to_db.py` | Pipeline output -> PostgreSQL migration with schema validation |
| `scheduler_service.py` | 12+ periodic jobs for data refresh and analytics |
| `main.py` | Static pipeline orchestrator (load -> enrich -> model -> export) |

### Static Pipeline Phases

```
Phase 1: Data Loading
  data_loader.py -> load_mpi_data() + load_boundaries()
  - Reads nga_mpi(3).csv + Nigeria MPI by Senatorial District.csv
  - Normalizes 60+ LGA/state name variations
  - Merges with nigeria_lga.json shapefile

Phase 2: Feature Extraction
  feature_extraction.py -> enrich_with_viirs(), enrich_from_external_apis()
  - VIIRS nightlight raster extraction (mean per LGA)
  - ACLED conflict events
  - OSM infrastructure (health, schools, roads)
  - WorldPop population density
  - DTM/IOM IDP counts
  - HDX food price index
  - GEE NDVI + rainfall

Phase 3: Modelling
  model_engine.py -> run_model_pipeline()
  - KNN imputation (k=5, distance-weighted)
  - PCA (95% variance target, ~8 components)
  - K-Means (k=5) + HDBSCAN (min_cluster_size=15)
  - Silhouette comparison, best-of selected
  - Composite poverty score: MPI (0.3) + nightlight (0.2) + health (0.15) +
    education (0.15) + infrastructure (0.1) + environment (0.1)
  - Cluster ordering worst-to-best -> risk tier assignment
  advanced_model.py -> train_dynamic_model()
  - XGBoost with GridSearchCV (5-fold)
  - Optional LightGBM / Random Forest ensemble

Phase 4: Analytics (if dynamic mode)
  anomaly_detection.py -> detect_anomalies()
  predictive_model.py -> generate_forecasts()
  spatial_statistics.py -> compute_spatial_autocorrelation()
  temporal_analysis.py -> classify_trajectories()

Phase 5: Export
  main.py -> save outputs as CSV + GeoJSON
  migrate_to_db.py -> upsert into PostgreSQL
```

### Composite Poverty Score Weights

| Feature | Weight | Higher = |
|---------|--------|----------|
| MPI (inverted) | 0.30 | More deprived |
| Nightlight intensity (inverted) | 0.20 | Darker = poorer |
| Health deprivation | 0.15 | More deprived |
| Education deprivation | 0.15 | More deprived |
| Infrastructure (inverted) | 0.10 | Less infrastructure |
| Environmental stress | 0.10 | Higher stress |

---

## Layer 2: Database + API Server (`server/`)

### PostgreSQL Schema

#### Core Tables
| Table | Columns (key) | Purpose |
|-------|---------------|---------|
| `poverty_hotspots` | lga_name PK, state, composite_poverty_score, risk_level, mpi_score, nightlight, health/education indicators, infrastructure, population, conflict, environmental, lat/lng, geometry, updated_at | Current LGA data |
| `hotspot_history` | id PK, lga_name FK, snapshot_date, composite_poverty_score, risk_level | Historical snapshots |

#### Operational Tables
| Table | Purpose |
|-------|---------|
| `risk_change_log` | Transition audit: lga, from/to risk level, score delta, timestamp |
| `anomaly_alerts` | Detected anomalies: lga, type, severity, metric values, acknowledged flag |
| `risk_forecasts` | Prophet predictions: lga, forecast_date, predicted_score, confidence interval |
| `interventions` | Aid programs: lga, type, organization, status, budget, start/end dates |
| `alert_subscriptions` | Notification prefs: email, webhook URL, severity filter, state filter |
| `saved_views` | Dashboard configs: name, filters JSON, user_id |

#### Auth/RBAC Tables
| Table | Purpose |
|-------|---------|
| `roles` | Role definitions: super_admin, admin, government, ngo, public, user |
| `permissions` | 15 granular permissions across 6 domains |
| `role_permissions` | Role-to-permission mapping |
| `users` | Accounts: email, hashed password, role, organization, active, geographic_scope |
| `user_geographic_scopes` | Per-user state/LGA access restrictions |
| `user_audit_log` | Admin action audit: user_id, action, target, details JSONB, ip, timestamp |

#### Materialized Views
| View | Aggregation |
|------|-------------|
| `mv_state_aggregation` | Per-state averages of composite score +  counts by risk level |
| `mv_risk_distribution` | National counts per risk tier |
| `mv_rankings` | Ordered LGA ranking by composite score |

### Express API Server (`server/index.js`)

#### Middleware Stack
1. CORS (configurable origins)
2. JSON body parser (10MB limit)
3. Compression (threshold 1KB)
4. Static file serving (`data/processed/`)
5. JWT authentication middleware
6. RBAC permission checks
7. Geographic scope filtering
8. Request logging

#### Route Families

**Compatibility Routes (`/api/*`)**
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/hotspots` | GET | No | All LGA data with tiering mode support |
| `/api/stats` | GET | No | Summary statistics |
| `/api/rankings` | GET | No | LGA rankings with search, limit, state filter |
| `/api/states` | GET | No | State aggregations |
| `/api/states/:name` | GET | No | Single state detail |
| `/api/lga/:name` | GET | No | Single LGA detail |
| `/api/history/:lga` | GET | No | Historical data for LGA |
| `/api/config` | GET/POST | Post: Admin | Tiering configuration |

**Expanded Routes (`/api/v1/*`)**
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/anomalies` | GET | Yes | Anomaly alerts (severity, state filters) |
| `/api/v1/anomalies/:id/acknowledge` | PATCH | Yes | Acknowledge anomaly |
| `/api/v1/changes` | GET | Yes | Risk change log (days filter) |
| `/api/v1/forecasts` | GET | Yes | Risk forecasts |
| `/api/v1/forecasts/escalations` | GET | Yes | Predicted escalations |
| `/api/v1/correlation` | GET | Yes | Scatter correlation data |
| `/api/v1/interventions` | GET/POST | Yes | CRUD interventions |
| `/api/v1/interventions/:id` | PUT/DELETE | Yes | Update/delete intervention |
| `/api/v1/alerts/subscriptions` | GET/POST | Yes | Alert subscription management |
| `/api/v1/saved-views` | GET/POST | Yes | Dashboard view configs |
| `/api/v1/reports/generate` | POST | Admin | PDF report generation |
| `/api/v1/users` | GET/POST | Admin | User management |
| `/api/v1/users/:id` | PUT/DELETE | Admin | User CRUD |
| `/api/v1/users/:id/scopes` | PUT | Admin | Geographic scope assignment |
| `/api/v1/roles` | GET | Admin | List roles |
| `/api/v1/permissions` | GET | Admin | List permissions |
| `/api/v1/audit-log` | GET | Super Admin | Audit log access |

**Auth Routes (`/api/auth/*`)**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Email/password login -> JWT |
| `/api/auth/register` | POST | User registration |
| `/api/auth/me` | GET | Current user profile |

#### Supporting Server Modules
| Module | Purpose |
|--------|---------|
| `database.js` | PostgreSQL connection pool, query helper, retry logic |
| `auth.js` | JWT middleware, bcrypt hashing, role validation |
| `rbac.js` | Permission checking, geographic scope enforcement, audit logging |
| `alerts.js` | Alert subscription processing, email (nodemailer), webhook dispatch |
| `reports.js` | PDF generation (PDFKit) with charts and tables |
| `redis.js` | ioredis connection, TTL-based caching helpers |
| `websocket.js` | Socket.IO server: rooms, alert broadcasting, state/LGA events |
| `swagger.js` | Swagger UI auto-docs at `/api-docs` |

---

## Layer 3: React Dashboard (`client/`)

### Tech Stack
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7 | Build tooling |

---

## Recent test results & artifacts

We performed and documented PostGIS + Redis performance testing. Important artifacts to reference from implementation and operations:

- [CACHING_VALIDATION_REPORT.md](CACHING_VALIDATION_REPORT.md)
- [CACHING_QUICK_REFERENCE.md](CACHING_QUICK_REFERENCE.md)
- [POSTGIS_REDIS_TESTING_GUIDE.md](POSTGIS_REDIS_TESTING_GUIDE.md)
- Results and images: `results/perf/` (e.g. [results/perf/cache_stats.png](results/perf/cache_stats.png), [results/perf/jmeter_html_short/index.html](results/perf/jmeter_html_short/index.html))

These files include run commands, expected outputs, and troubleshooting steps for reproducing test evidence.
| Tailwind CSS | 4 | Utility styling |
| Leaflet | 1.9 | Choropleth map |
| MapLibre GL | 5.x | 3D/WebGL map rendering |
| Recharts | 2.15 | Charts and visualizations |
| Zustand | 4.5 | State management |
| Socket.IO Client | 4.8 | Real-time events |
| Turf.js | 7 | Geospatial calculations |
| jsPDF | 2.5 | Client-side PDF export |

### Navigation Views (10 total)

| View Key | Label | Component |
|----------|-------|-----------|
| `map` | Poverty Map | MapComponent + FieldView + Legend |
| `rankings` | Rankings | RankingsTable + Leaderboard |
| `states` | State View | StateAnalytics |
| `interventions` | Interventions | InterventionTracker |
| `seasonal` | Seasonal | SeasonalAnalytics |
| `budget` | Budget | BudgetOptimizer |
| `reports` | Reports | ReportBuilder |
| `alerts` | Alerts | AlertsManager |
| `settings` | Data Quality | DataQualityPanel |
| `users` | Users | UserManagementPanel |

### Component Inventory (26 components)

**Map & Visualization**
- `MapComponent.tsx` — Leaflet choropleth + MapLibre GL toggle
- `FieldView.tsx` — 3D MapLibre terrain view
- `Legend.tsx` — Color scale + risk tier legend
- `ChoroplethToggle.tsx` — Layer toggle UI
- `CorrelationScatter.tsx` — Recharts scatter plot
- `RadarComparison.tsx` — Multi-axis radar chart
- `CrisisCorridor.tsx` — Risk corridor visualization

**Data Display**
- `RankingsTable.tsx` — Searchable, sortable LGA table
- `Leaderboard.tsx` — Top/bottom LGA rankings
- `StateAnalytics.tsx` — State-level drill-down charts
- `SeasonalAnalytics.tsx` — Temporal trend analysis
- `AnomalyPanel.tsx` — Anomaly alert viewer + acknowledgment
- `DataQualityPanel.tsx` — Data completeness + freshness metrics

**Interactive**
- `SearchBar.tsx` — Global LGA/state search with autocomplete
- `SidePanel.tsx` — Detail panel for selected LGA
- `Sidebar.tsx` — Navigation + view switcher
- `InterventionTracker.tsx` — Intervention CRUD
- `BudgetOptimizer.tsx` — Budget allocation recommendations
- `AlertsManager.tsx` — Alert subscription management

**Reporting & Admin**
- `ReportBuilder.tsx` — PDF report configuration + generation
- `ScrollytellingTour.tsx` — Guided onboarding walkthrough
- `ThemeToggle.tsx` — Dark/light mode switch
- `AuthModal.tsx` — Login/register modal
- `UserManagementPanel.tsx` — User CRUD, role assignment, geographic scoping

**Utility**
- `TimeSlider.tsx` — Temporal navigation control
- `TierToggle.tsx` — Cluster/absolute risk tier mode switcher

### Zustand Stores (5 stores)

| Store | Key State |
|-------|-----------|
| `useDataStore` | hotspots[], stats, rankings[], states[], loading, error, tiering mode |
| `useFilterStore` | selectedState, selectedLga, riskFilter, searchQuery, dateRange |
| `useMapStore` | mapCenter, zoom, selectedFeature, layer mode, 3D toggle |
| `useAuthStore` | user, token, isAuthenticated, role, permissions, login/logout |
| `useAlertStore` | alerts[], subscriptions[], anomalies[], unread count |

### Context & Hooks
| Item | Location | Purpose |
|------|----------|---------|
| `ThemeContext` | `contexts/ThemeContext.tsx` | Dark/light mode state + toggle |
| `useWebSocket` | `hooks/useWebSocket.ts` | Socket.IO connection + event handling |

### Utilities
| File | Purpose |
|------|---------|
| `utils/riskTiers.ts` | Tier color mapping, threshold constants, tier calculation |
| `types.ts` | Shared TypeScript interfaces (Hotspot, State, Intervention, etc.) |

---

## Data Flow Summary

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Raw Sources    │───>│  Python Engine    │───>│   PostgreSQL     │
│                  │    │                  │    │                  │
│ MPI CSVs         │    │ Load + Normalize │    │ poverty_hotspots │
│ LGA Shapefile    │    │ Feature Extract  │    │ hotspot_history  │
│ VIIRS Raster     │    │ ML Pipeline      │    │ risk_change_log  │
│ ACLED API        │    │ Anomaly Detect   │    │ anomaly_alerts   │
│ OSM Overpass     │    │ Forecasting      │    │ risk_forecasts   │
│ WorldPop API     │    │ Spatial Stats    │    │ materialized     │
│ DTM/IOM API      │    │ Temporal Analysis│    │ views            │
│ HDX API          │    │                  │    │                  │
│ GEE (VIIRS/NDVI) │    │ Export CSV/JSON  │    │                  │
└─────────────────┘    └──────────────────┘    └────────┬─────────┘
                                                         │
                       ┌──────────────────┐              │
                       │   Redis Cache    │<─────────────│
                       │   TTL: 1-10min   │              │
                       └────────┬─────────┘              │
                                │                        │
                       ┌────────▼─────────┐              │
                       │  Express API     │<─────────────┘
                       │  + Socket.IO     │
                       │  + Swagger Docs  │
                       └────────┬─────────┘
                                │
                       ┌────────▼─────────┐
                       │  React Dashboard │
                       │  10 Views        │
                       │  26 Components   │
                       │  5 Zustand Stores│
                       └──────────────────┘
```

## Security Model

| Feature | Implementation |
|---------|---------------|
| Authentication | JWT (HS256, 24h expiry) + bcrypt password hashing |
| Authorization | 6 roles, 15 permissions, role-permission matrix |
| Geographic Scoping | Per-user state/LGA restrictions enforced server-side |
| Audit Logging | JSONB audit trail for admin operations |
| Rate Limiting | Configurable per-route (future) |
| CORS | Configurable allowed origins |
| Input Validation | Server-side validation on all write endpoints |

## Deployment

| Method | Command |
|--------|---------|
| Docker Compose | `docker compose up --build` |
| Local Development | See SETUP.md |
| Production | See ARCHITECTURE.md |

Four Docker services: `postgres` (16-alpine + PostGIS 3.4), `redis` (7-alpine), `server` (Node 22-alpine), `client` (nginx 1.25-alpine).
