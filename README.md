# IOPHIN — Nigeria Poverty Hotspot Intelligence System

A geospatial machine learning platform for identifying and monitoring poverty hotspots across Nigeria's 774 Local Government Areas (LGAs). Combines nighttime satellite imagery, multidimensional poverty indicators, and infrastructure data with unsupervised ML to deliver real-time risk classification through an interactive web dashboard.

## Overview

The system fuses multiple data sources:

- **VIIRS Nighttime Lights** (10.8 GB GeoTIFF) — proxy for economic activity
- **State-level MPI Data** — Multidimensional Poverty Index indicators
- **Senatorial District MPI** — sub-state poverty granularity
- **LGA Boundary Shapefiles** — GRID3 geospatial boundaries (774 LGAs)
- **Infrastructure Data** — health facilities, schools, road density (via external APIs)
- **Environmental Data** — NDVI vegetation, rainfall (via Google Earth Engine)
- **Conflict & Displacement Data** — ACLED, IOM DTM, HumData

The analytical engine classifies LGAs into **5 risk tiers**:

| Tier | Color | Description |
|------|-------|-------------|
| **Critical** | Purple `#7C3AED` | Extremely low nightlights + highest poverty + active conflict |
| **High** | Red `#EF4444` | Low nightlights + high poverty indicators |
| **Medium** | Amber `#F59E0B` | Moderate indicators |
| **Low** | Green `#10B981` | Improving indicators |
| **Minimal** | Blue `#3B82F6` | High nightlights + low poverty indicators |

## Architecture

```
External APIs ──► Python Scheduler ──► PostgreSQL ◄── Node.js API ◄── React Dashboard
(ACLED, NASA,       (APScheduler)       (iophin_db)    (Express)       (Vite + Leaflet)
 GEE, HDX, WFP)
```

### Static Mode
One-time ML pipeline: local files → Python engine → GeoJSON → API → dashboard.

### Dynamic Mode
Continuous monitoring: scheduled API fetches → database updates → ML retraining → live dashboard with 60-second polling.

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed diagrams and [DYNAMIC_MONITORING.md](DYNAMIC_MONITORING.md) for the real-time system guide.

## Project Structure

```
IOPHIN/
├── src/                                        Python ML Engine
│   ├── __init__.py                             Package init
│   ├── config.py                               Paths, model params, API config
│   ├── data_loader.py                          Data loading utilities
│   ├── feature_extraction.py                   Memory-safe raster processing
│   ├── model_engine.py                         ML pipeline (KNN, PCA, K-Means/HDBSCAN)
│   ├── main.py                                 Main orchestration script
│   ├── db_config.py                            SQLAlchemy ORM, schema definition
│   ├── db_utils.py                             Database CRUD operations
│   ├── scheduler_service.py                    Real-time monitoring service
│   └── migrate_to_db.py                        CSV → PostgreSQL migration
│
├── server/                                     Node.js Backend API
│   ├── index.js                                Express server (7 endpoints)
│   ├── database.js                             PostgreSQL query module (pg)
│   ├── package.json                            Dependencies
│   └── README.md                               Server documentation
│
├── client/                                     React Frontend Dashboard
│   ├── src/
│   │   ├── App.tsx                             Main layout, view switching, filters
│   │   ├── main.tsx                            Application entry point
│   │   ├── types.ts                            TypeScript type definitions
│   │   ├── index.css                           Design system (dark/light themes)
│   │   ├── components/
│   │   │   ├── MapComponent.tsx                Interactive Leaflet map
│   │   │   ├── Sidebar.tsx                     Analytics panel (national + LGA)
│   │   │   ├── RankingsTable.tsx               LGA poverty rankings table
│   │   │   ├── StateOverview.tsx               State-level aggregated analytics
│   │   │   ├── SearchBar.tsx                   Search/filter across all views
│   │   │   └── Legend.tsx                      Risk level legend
│   │   └── contexts/
│   │       └── ThemeContext.tsx                 Dark/light theme management
│   ├── public/                                 Static assets
│   ├── package.json                            Dependencies
│   ├── vite.config.ts                          Vite 7 configuration
│   ├── tsconfig.json                           TypeScript configuration
│   ├── tailwind.config.js                      Tailwind CSS 4 configuration
│   ├── postcss.config.js                       PostCSS configuration
│   └── eslint.config.js                        ESLint configuration
│
├── data/
│   ├── raw/
│   │   ├── viirs_2024.tif                      VIIRS raster (10.8 GB, local only)
│   │   ├── nga_mpi(3).csv                      State-level MPI data
│   │   ├── Nigeria MPI by Senatorial District.csv  Senatorial MPI
│   │   ├── nigeria_lga.json                    LGA reference data
│   │   └── NGA_LGA_Boundaries_2_.../          GRID3 shapefile directory
│   │       ├── grid3_nga_boundary_vacclgas.shp
│   │       ├── grid3_nga_boundary_vacclgas.dbf
│   │       ├── grid3_nga_boundary_vacclgas.shx
│   │       ├── grid3_nga_boundary_vacclgas.prj
│   │       ├── grid3_nga_boundary_vacclgas.cpg
│   │       └── grid3_nga_boundary_vacclgas.shp.xml
│   └── processed/
│       ├── processed_hotspots.csv              Intermediate LGA coordinates
│       ├── final_model_output.csv              Model output with all features
│       └── hotspots.geojson                    GeoJSON for frontend (fallback)
│
├── gee/                                        Google Earth Engine credentials
├── docs/
│   └── EXAMPLE_OUTPUT.md                       Sample diagnostic output
├── ui designs/                                 UI/UX design assets
│
├── requirements.txt                            Python dependencies
├── ARCHITECTURE.md                             System architecture diagrams
├── SETUP.md                                    Setup and installation guide
├── QUICKSTART.md                               Quick start — static mode
├── QUICKSTART_DYNAMIC.md                       Quick start — dynamic mode
├── DYNAMIC_MONITORING.md                       Real-time monitoring guide
├── IMPLEMENTATION_SUMMARY.md                   Implementation details
├── TROUBLESHOOTING.md                          Troubleshooting guide
├── DATA_LICENSE.md                             Data attribution and licensing
└── license.md                                  MIT software license
```

## Installation

### Prerequisites

- **Python 3.9+** with pip
- **Node.js 18+** with npm
- **PostgreSQL 14+** with a database named `iophin_db`

### Python ML Engine

```bash
pip install -r requirements.txt
```

### Node.js Backend

```bash
cd server
npm install
```

### React Frontend

```bash
cd client
npm install
```

## Usage

### Static Mode

```bash
# Run the ML pipeline (generates GeoJSON + CSV)
python -m src.main

# Migrate results to PostgreSQL
python -m src.migrate_to_db

# Start the API server
cd server && node index.js

# Start the frontend (in another terminal)
cd client && npm run dev
```

### Dynamic Mode (Real-Time Monitoring)

```bash
# 1. Run ML model for initial data
python -m src.main

# 2. Migrate to database
python -m src.migrate_to_db

# 3. Start the scheduler service (continuous)
python -m src.scheduler_service

# 4. Start the API server
cd server && node index.js

# 5. Start the frontend
cd client && npm run dev
```

The scheduler automatically:
- Checks for conflict events every 1 hour
- Updates nightlight data every 24 hours
- Refreshes infrastructure data every 6 hours
- Retrains the ML model every 12 hours

See [QUICKSTART.md](QUICKSTART.md) and [QUICKSTART_DYNAMIC.md](QUICKSTART_DYNAMIC.md) for detailed guides.

## Pipeline Phases

### Phase 1: Feature Extraction (Memory-Safe)
- Loads LGA boundaries from GRID3 shapefile (774 LGAs)
- Extracts mean nightlight intensity from VIIRS raster using windowed reading
- Automatic CRS detection and reprojection
- Falls back to synthetic data when VIIRS file is unavailable

### Phase 2: Data Fusion & Enrichment
- Merges state-level and senatorial MPI indicators
- Enriches with infrastructure data (health facilities, schools, roads)
- Adds environmental data (NDVI, rainfall)
- KNN imputation for missing values (k=5)
- Feature standardization via StandardScaler

### Phase 3: Machine Learning
- PCA dimensionality reduction (95% variance retained)
- K-Means clustering (k=5) or HDBSCAN (min_cluster_size=30)
- Composite poverty score: MPI (30%) + inverse nightlight (25%) + health access (15%) + education access (15%) + infrastructure (15%)
- Silhouette Score validation
- Assignment of 5 risk tiers: Critical, High, Medium, Low, Minimal

## API Endpoints

| Method | Route | Description | Fallback |
|--------|-------|-------------|----------|
| `GET` | `/api/health` | Health check | — |
| `GET` | `/api/hotspots?state=&risk=` | GeoJSON FeatureCollection (filterable) | Static file |
| `GET` | `/api/stats` | Aggregate statistics | Static file |
| `GET` | `/api/lga/:name` | Single LGA detail | Static file |
| `GET` | `/api/states` | Per-state aggregated metrics | DB only |
| `GET` | `/api/rankings?order=worst&limit=50` | Top-N by composite score | DB only |
| `GET` | `/api/history/:lga?limit=30` | Time-series snapshots | DB only |

Response header `X-Data-Source` indicates `database` or `file` mode.

## Web Dashboard

### Features

- **Interactive Map** — 774 LGAs color-coded by 5 risk levels with hover tooltips
- **Rankings Table** — LGAs ranked by composite poverty score (worst/best toggle)
- **State Overview** — Aggregated state-level metrics with drill-down to map
- **Search & Filter** — Search by LGA or state name, filter by state and risk level across all views
- **LGA Detail Panel** — Click any LGA for full analytics (MPI, nightlight, composite score, infrastructure, poverty probability)
- **Dark/Light Themes** — Toggle between dark and light modes
- **Responsive Design** — Mobile-optimized with bottom navigation bar and sidebar drawer
- **Auto-Refresh** — 60-second polling for live data updates

### Quick Start

```bash
# Start API server (port 5000)
cd server && npm install && node index.js

# Start frontend (port 5173)
cd client && npm install && npm run dev
```

Dashboard available at **http://localhost:5173**

## Database

### PostgreSQL (`iophin_db`)

Connection: `postgresql://postgres:<password>@localhost:5432/iophin_db`

**Primary table: `poverty_hotspots`** — 774 rows, one per LGA

| Category | Columns |
|----------|---------|
| Identifiers | `lga_name`, `state`, `latitude`, `longitude` |
| Poverty | `mpi`, `headcount_ratio`, `intensity_of_deprivation`, `in_severe_poverty`, `senatorial_mpi` |
| Economic | `mean_nightlight_intensity`, `composite_poverty_score` |
| Infrastructure | `health_facility_count`, `school_count`, `road_density_km` |
| Environmental | `ndvi_mean`, `rainfall_mm` |
| Displacement | `idp_count`, `food_price_index` |
| ML outputs | `cluster`, `cluster_label`, `risk_level`, `clustering_method` |
| Crisis | `conflict_flag`, `last_conflict_event` |
| Metadata | `last_updated`, `data_source`, `geometry` (GeoJSON text) |

Unique constraint: `(lga_name, state)` compound index.

**History table: `hotspot_history`** — time-series snapshots for trend analysis, indexed on `(lga_name, snapshot_date)`.

## Dependencies

### Python
numpy, pandas, scikit-learn, scipy, geopandas, rasterio, shapely, fiona, pyproj, matplotlib, seaborn, sqlalchemy, psycopg2-binary, requests, schedule, python-dotenv, earthengine-api, hdbscan, thefuzz, openpyxl

### Node.js (Server)
express 4, cors, compression, dotenv, express-rate-limit, pg

### React (Client)
react 19, react-dom, typescript 5.9, vite 7, tailwindcss 4, react-leaflet 5, leaflet, recharts 3, axios

## Outputs

### CSV (`data/processed/final_model_output.csv`)
All 774 LGAs with features, cluster assignments, and risk levels.

### GeoJSON (`data/processed/hotspots.geojson`)
FeatureCollection with polygon geometries and all properties — used as static fallback when database is unavailable.

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for diagnosis of common issues including VIIRS raster extraction errors, spatial bounds verification, database connection issues, and frontend build errors.

## License

MIT License — see [license.md](license.md). Data attribution in [DATA_LICENSE.md](DATA_LICENSE.md).

IOPHIN — Integrated Optimization Platform for Health Information in Nigeria.
