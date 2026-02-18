# IOPHIN — Quick Start (Static Mode)

Run the full ML pipeline from local files to interactive dashboard in under 10 minutes.

## Prerequisites

- Python 3.9+ with dependencies installed (`pip install -r requirements.txt`)
- Node.js 18+ with npm
- PostgreSQL 14+ with `iophin_db` database created
- Data files in `data/raw/` (see [SETUP.md](SETUP.md))

## Step 1: Run the ML Pipeline

```bash
python -m src.main
```

This executes 3 phases:

### Phase 1: Feature Extraction
- Loads 774 LGA boundaries from GRID3 shapefile
- Extracts mean nightlight intensity from VIIRS raster (memory-safe windowed reads)
- Falls back to synthetic nightlight data if VIIRS file is unavailable
- Outputs: `data/processed/processed_hotspots.csv`

### Phase 2: Data Fusion & Enrichment
- Merges state-level MPI indicators (e.g., headcount ratio, intensity of deprivation)
- Merges senatorial district MPI for sub-state granularity
- Enriches with infrastructure data (health facilities, schools, road density)
- KNN imputation (k=5) for missing values
- Feature standardization via StandardScaler

### Phase 3: Unsupervised ML
- PCA dimensionality reduction (retains 95% variance)
- Clustering: K-Means (k=5) or HDBSCAN (min_cluster_size=30, configurable via `USE_HDBSCAN` in config)
- Composite poverty score calculation:
  - MPI: 30%
  - Inverse nightlight: 25%
  - Health access: 15%
  - Education access: 15%
  - Infrastructure: 15%
- Risk tier assignment (5 tiers): Critical, High, Medium, Low, Minimal
- Silhouette Score validation printed to console

**Outputs:**
- `data/processed/final_model_output.csv` — All 774 LGAs with full feature set
- `data/processed/hotspots.geojson` — GeoJSON FeatureCollection for the API

## Step 2: Migrate to Database

```bash
python -m src.migrate_to_db
```

This reads `final_model_output.csv` and inserts/updates all 774 LGA records into the `poverty_hotspots` table in PostgreSQL. Uses compound unique constraint `(lga_name, state)` for upsert behavior.

**Expected output:**
```
Migrating 774 records to PostgreSQL...
Migration complete: 774 records inserted/updated
```

## Step 3: Start the API Server

```bash
cd server
npm install    # first time only
node index.js
```

**Expected output:**
```
Server running on port 5000
Database connected successfully
Loaded X hotspots from database
```

The server exposes 7 endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/hotspots` | GeoJSON FeatureCollection |
| `GET /api/stats` | Aggregate statistics |
| `GET /api/lga/:name` | Single LGA detail |
| `GET /api/states` | Per-state metrics |
| `GET /api/rankings` | Ranked LGA list |
| `GET /api/history/:lga` | Time-series data |

Verify: `curl http://localhost:5000/api/health`

## Step 4: Start the Frontend

```bash
cd client
npm install    # first time only
npm run dev
```

**Expected output:**
```
  VITE v7.x.x  ready in XXXms

  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

## What You'll See

### Map View (Default)
- Interactive map centered on Nigeria
- 774 LGA polygons color-coded by risk level:
  - **Purple** (#7C3AED) — Critical
  - **Red** (#EF4444) — High
  - **Amber** (#F59E0B) — Medium
  - **Green** (#10B981) — Low
  - **Blue** (#3B82F6) — Minimal
- Hover for compact tooltip (LGA name, state, risk badge, composite score)
- Click any LGA for full analytics in the sidebar panel
- Legend in bottom-left corner

### Rankings View
- Table of all LGAs ranked by composite poverty score
- Toggle between worst-first and best-first
- Filterable by search, state, and risk level

### State Overview
- Aggregated state-level metrics
- Filterable by search
- Click a state to zoom into it on the map

### Top Toolbar
- Search bar (filters across all views)
- State filter dropdown
- Risk level filter dropdown
- Theme toggle (dark/light)
- Status indicator (data source: database/file, LGA count)

### Mobile
- Bottom navigation bar for switching views
- Hamburger menu for sidebar access
- Responsive layout

## Troubleshooting

If the map shows no data:
1. Check that the API server is running: `curl http://localhost:5000/api/hotspots`
2. Check the browser console for errors
3. Ensure `hotspots.geojson` exists in `data/processed/` or the database has data

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more.
