# IOPHIN — System Architecture

## High-Level Architecture

```
┌─────────────────────────── EXTERNAL DATA SOURCES ───────────────────────────┐
│                                                                             │
│  NASA VIIRS Nightlights   HDX (ACLED Conflict)    Google Earth Engine       │
│  WorldPop Population      IOM DTM (Displacement)  OpenStreetMap (Overpass)  │
│  WFP Food Prices          HumData Portal          Nigeria MPI Datasets      │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────── PYTHON ML ENGINE ────────────────────────────────┐
│                                                                             │
│  src/data_loader.py ──► src/feature_extraction.py ──► src/model_engine.py   │
│        │                       │                            │               │
│    Load CSV/SHP           Raster/API              PCA + K-Means/HDBSCAN     │
│    State MPI              extraction               Composite scoring        │
│    Senatorial MPI         KNN imputation           5-tier classification    │
│                           Infrastructure                                    │
│                                                                             │
│  src/scheduler_service.py ◄──── APScheduler (Dynamic Mode)                  │
│        │                                                                    │
│    Periodic data fetch + model retrain + DB update                          │
│                                                                             │
│  src/db_config.py ──► SQLAlchemy ORM ──► PostgreSQL                         │
│  src/db_utils.py  ──► CRUD operations                                       │
│  src/migrate_to_db.py ──► CSV → PostgreSQL migration                        │
│                                                                             │
│  Output: final_model_output.csv + hotspots.geojson + PostgreSQL rows        │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────── POSTGRESQL DATABASE ─────────────────────────────┐
│                                                                             │
│  Database: iophin_db                                                        │
│                                                                             │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │   poverty_hotspots (774)    │  │   hotspot_history (time-series)      │  │
│  ├─────────────────────────────┤  ├──────────────────────────────────────┤  │
│  │ id (SERIAL PK)             │  │ id (SERIAL PK)                       │  │
│  │ lga_name + state (UNIQUE)  │  │ lga_name                             │  │
│  │ latitude, longitude        │  │ state                                │  │
│  │ mpi                        │  │ snapshot_date                         │  │
│  │ headcount_ratio            │  │ composite_poverty_score               │  │
│  │ intensity_of_deprivation   │  │ mpi                                  │  │
│  │ in_severe_poverty          │  │ mean_nightlight_intensity             │  │
│  │ senatorial_mpi             │  │ risk_level                           │  │
│  │ mean_nightlight_intensity  │  │ conflict_flag                        │  │
│  │ composite_poverty_score    │  │ population_density                   │  │
│  │ health_facility_count      │  │ distance_to_urban_km                 │  │
│  │ school_count               │  │ ...                                  │  │
│  │ road_density_km            │  └──────────────────────────────────────┘  │
│  │ ndvi_mean, rainfall_mm     │                                            │
│  │ idp_count, food_price_index│  Index: (lga_name, snapshot_date)          │
│  │ population_density         │                                            │
│  │ distance_to_urban_km       │                                            │
│  │ cluster, cluster_label     │                                            │
│  │ risk_level                 │                                            │
│  │ clustering_method          │                                            │
│  │ conflict_flag              │                                            │
│  │ last_conflict_event        │                                            │
│  │ last_updated               │                                            │
│  │ data_source                │                                            │
│  │ geometry (GeoJSON text)    │                                            │
│  └─────────────────────────────┘                                           │
│                                                                             │
│  Constraint: UNIQUE(lga_name, state) — compound index                      │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────── NODE.JS API SERVER ──────────────────────────────┐
│                                                                             │
│  server/index.js — Express 4 (ESM modules)                                  │
│                                                                             │
│  Middleware: CORS, compression, rate-limiting (100 req/15min)               │
│                                                                             │
│  GET /api/health        → Health check (DB connectivity test)               │
│  GET /api/hotspots      → GeoJSON FeatureCollection (filterable)            │
│  GET /api/stats         → Aggregate statistics                              │
│  GET /api/lga/:name     → Single LGA detail                                │
│  GET /api/states        → Per-state aggregated metrics (DB only)            │
│  GET /api/rankings      → Top-N by composite score (DB only)                │
│  GET /api/history/:lga  → Time-series snapshots (DB only)                   │
│                                                                             │
│  Dual-mode: Database-first with automatic file fallback                     │
│  Response header: X-Data-Source: database | file                            │
│                                                                             │
│  server/database.js — pg Pool, row→GeoJSON Feature mapping                  │
│                                                                             │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────── REACT DASHBOARD ─────────────────────────────────┐
│                                                                             │
│  client/src/ — React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                           App.tsx                                   │    │
│  │   State management, view switching, filter propagation              │    │
│  │   Three views: Map | Rankings | State Overview                      │    │
│  │   Mobile: hamburger menu, bottom nav bar, sidebar drawer            │    │
│  ├─────────────────────────────────────────────────────────────────────┤    │
│  │                                                                     │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐    │    │
│  │  │ MapComponent  │ │ RankingsTable│ │ StateOverview            │    │    │
│  │  │              │ │              │ │                          │    │    │
│  │  │ Leaflet map  │ │ Sortable LGA │ │ State-level aggregated   │    │    │
│  │  │ GeoJSON      │ │ rankings by  │ │ metrics, filterable by   │    │    │
│  │  │ overlay      │ │ composite    │ │ search, click to zoom    │    │    │
│  │  │ 5 risk tiers │ │ score        │ │ to state on map          │    │    │
│  │  └──────────────┘ └──────────────┘ └──────────────────────────┘    │    │
│  │                                                                     │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────────┐    │    │
│  │  │ Sidebar      │ │ SearchBar    │ │ Legend                   │    │    │
│  │  │              │ │              │ │                          │    │    │
│  │  │ National     │ │ Search by    │ │ 5-tier risk level        │    │    │
│  │  │ overview +   │ │ LGA/state    │ │ color legend             │    │    │
│  │  │ LGA detail   │ │ Filters all  │ │                          │    │    │
│  │  │ analytics    │ │ views        │ │                          │    │    │
│  │  └──────────────┘ └──────────────┘ └──────────────────────────┘    │    │
│  │                                                                     │    │
│  │  ┌──────────────┐                                                   │    │
│  │  │ ThemeContext  │  Dark/light theme management                      │    │
│  │  └──────────────┘                                                   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Features: 60s auto-refresh, responsive design, cross-view search,         │
│            compact hover tooltips, click-for-detail sidebar                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Static Mode

```
Local Files                    Processing                     Output
─────────────────────────────────────────────────────────────────────────
VIIRS .tif      ──┐
GRID3 .shp      ──┤   feature_extraction.py
State MPI .csv  ──┤──► (windowed raster read)   ──► processed_hotspots.csv
Senatorial .csv ──┤    (zonal stats per LGA)
nigeria_lga.json──┘    (KNN imputation)

processed_hotspots.csv ──► model_engine.py ──────► final_model_output.csv
                           (StandardScaler)        hotspots.geojson
                           (PCA 95% variance)
                           (K-Means k=5 or HDBSCAN)
                           (Composite scoring)
                           (5-tier classification)

final_model_output.csv ──► migrate_to_db.py ─────► PostgreSQL poverty_hotspots
hotspots.geojson        ──► (fallback file for API)
```

### Dynamic Mode

```
Scheduler (APScheduler)                    Database
────────────────────────────────────────────────────────
Every 1h:  ACLED API → conflict events  ──► poverty_hotspots.conflict_flag
Every 6h:  Infrastructure APIs          ──► poverty_hotspots (health, schools)
Every 24h: VIIRS data refresh           ──► poverty_hotspots.nightlight
Every 12h: Full model retrain           ──► poverty_hotspots (all columns)
                                            hotspot_history (new snapshots)

API Server (Express)                       Frontend (React)
────────────────────────────────────────────────────────
GET /api/hotspots                       → GeoJSON for map
GET /api/stats                          → Summary statistics
GET /api/states                         → State aggregations
GET /api/rankings                       → Ranked LGA list
GET /api/history/:lga                   → Trend sparklines

                    ◄──── 60-second polling ────►
```

## Composite Poverty Score Formula

```
composite_poverty_score = (
    0.30 × mpi_normalized +
    0.25 × inverse_nightlight_normalized +
    0.15 × health_access_normalized +
    0.15 × education_access_normalized +
    0.15 × infrastructure_normalized
)
```

Higher scores = higher poverty risk. Scores are standardized before weighting.

## Risk Level Assignment

After K-Means (k=5) or HDBSCAN clustering:

1. Clusters sorted by mean composite poverty score (descending)
2. Labels assigned top-down: Critical → High → Medium → Low → Minimal
3. Risk colors: `#7C3AED` (Critical), `#EF4444` (High), `#F59E0B` (Medium), `#10B981` (Low), `#3B82F6` (Minimal)

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| ML Engine | Python | 3.9+ |
| ML Libs | scikit-learn, HDBSCAN, geopandas, rasterio | Latest |
| ORM | SQLAlchemy | Latest |
| Database | PostgreSQL | 14+ |
| API Server | Node.js / Express | 18+ / 4.x |
| DB Driver | pg (node-postgres) | Latest |
| Frontend | React + TypeScript | 19 / 5.9 |
| Build | Vite | 7.x |
| Styling | Tailwind CSS | 4.x |
| Maps | Leaflet + react-leaflet | 1.9 / 5.x |
| Charts | Recharts | 3.x |

## Security & Performance

- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured for localhost development
- **Compression**: gzip via `compression` middleware
- **Graceful shutdown**: SIGTERM/SIGINT handlers on API server
- **Memory-safe raster processing**: Windowed reads for 10.8 GB VIIRS file
- **GeoJSON caching**: Frontend caches fetched data and only re-requests on filter changes
- **Polling**: 60-second interval with re-fetch on page focus
