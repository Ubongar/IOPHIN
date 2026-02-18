# IOPHIN — Setup Guide

Complete installation and configuration guide for the Nigeria Poverty Hotspot Intelligence System.

## Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.9+ | ML engine, data processing |
| Node.js | 18+ | API server |
| PostgreSQL | 14+ | Primary database |
| npm | 9+ | Package management |
| Git | Latest | Version control |

### Hardware

- **RAM**: 8 GB minimum (16 GB recommended for VIIRS raster processing)
- **Disk**: ~12 GB for VIIRS GeoTIFF + processed outputs
- **CPU**: Multi-core recommended for raster extraction

## 1. Clone & Navigate

```bash
git clone <repository-url>
cd IOPHIN
```

## 2. PostgreSQL Setup

Create the database and user:

```sql
-- Connect as superuser
psql -U postgres

-- Create database
CREATE DATABASE iophin_db;

-- Verify
\l
```

The application uses the connection string:
```
postgresql://postgres:<password>@localhost:5432/iophin_db
```

Tables are auto-created by the Python ORM on first run. The schema includes:
- `poverty_hotspots` — 774 LGA rows with compound unique constraint `(lga_name, state)`
- `hotspot_history` — time-series snapshots indexed on `(lga_name, snapshot_date)`

## 3. Python Environment

```bash
# Create virtual environment (recommended)
python -m venv venv

# Activate
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Python Dependencies

Core packages installed by `requirements.txt`:

| Package | Purpose |
|---------|---------|
| numpy, pandas | Data manipulation |
| scikit-learn | PCA, K-Means, KNN imputation |
| hdbscan | Alternative clustering algorithm |
| geopandas | Geospatial dataframe operations |
| rasterio | VIIRS raster reading (windowed) |
| shapely, fiona, pyproj | Geometry operations, file I/O, CRS |
| sqlalchemy | ORM for PostgreSQL |
| psycopg2-binary | PostgreSQL driver for Python |
| requests | HTTP API calls |
| schedule | Task scheduling |
| python-dotenv | Environment variable management |
| earthengine-api | Google Earth Engine integration |
| thefuzz | Fuzzy string matching for LGA names |
| matplotlib, seaborn | Visualization (diagnostics) |
| openpyxl | Excel file reading |

## 4. Node.js Backend

```bash
cd server
npm install
```

### Server Dependencies

| Package | Purpose |
|---------|---------|
| express | HTTP server framework |
| pg | PostgreSQL client for Node.js |
| cors | Cross-origin resource sharing |
| compression | gzip response compression |
| dotenv | Environment variables |
| express-rate-limit | API rate limiting |

> **Note**: `better-sqlite3` appears in `package.json` as a legacy dependency but is **not used**. The server exclusively uses `pg` for PostgreSQL.

## 5. React Frontend

```bash
cd client
npm install
```

### Client Dependencies

| Package | Purpose |
|---------|---------|
| react, react-dom | UI framework (v19) |
| typescript | Type safety (v5.9) |
| vite | Build tool (v7) |
| tailwindcss | Utility CSS framework (v4) |
| react-leaflet, leaflet | Interactive map |
| recharts | Charts and sparklines |
| axios | HTTP client |
| @types/leaflet | Leaflet type definitions |

## 6. Environment Configuration

### Python (`src/config.py`)

Key configuration values (modify in `src/config.py`):

```python
# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

# Model Parameters
K_CLUSTERS = 5                    # Number of clusters
PCA_VARIANCE = 0.95               # PCA variance threshold
USE_HDBSCAN = True                # Use HDBSCAN instead of K-Means

# Composite Score Weights
COMPOSITE_WEIGHTS = {
    "mpi": 0.30,
    "inverse_nightlight": 0.25,
    "health_access": 0.15,
    "education_access": 0.15,
    "infrastructure": 0.15
}
```

### Python Database (`src/db_config.py`)

```python
DATABASE_URL = "postgresql://postgres:<password>@localhost:5432/iophin_db"
```

Or set via environment variable:
```bash
export DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/iophin_db"
```

### Node.js Server (`server/.env` — optional)

```env
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/iophin_db
```

The server defaults to port 5000 and reads from `data/processed/hotspots.geojson` when the database is unavailable.

### React Frontend (`client/vite.config.ts`)

The dev server runs on port 5173 with API proxy to `http://localhost:5000`.

## 7. Data Files

### Required Files

| File | Location | Source |
|------|----------|--------|
| LGA Shapefile | `data/raw/NGA_LGA_Boundaries_2_.../grid3_nga_boundary_vacclgas.shp` | GRID3 Nigeria |
| State MPI | `data/raw/nga_mpi(3).csv` | Oxford MPI |
| Senatorial MPI | `data/raw/Nigeria MPI by Senatorial District.csv` | Oxford MPI |
| LGA Reference | `data/raw/nigeria_lga.json` | Manual reference |

### Optional Files

| File | Location | Notes |
|------|----------|-------|
| VIIRS Raster | `data/raw/viirs_2024.tif` | 10.8 GB — synthetic data used when absent |
| GEE Credentials | `gee/*.json` | Required only for Google Earth Engine features |

## 8. Verify Installation

```bash
# Check Python
python -c "import geopandas; import rasterio; import sqlalchemy; print('Python OK')"

# Check Node
node -e "require('pg'); require('express'); console.log('Node OK')"

# Check PostgreSQL
psql -U postgres -d iophin_db -c "SELECT 1"

# Run ML pipeline
python -m src.main

# Start server
cd server && node index.js

# Start frontend (new terminal)
cd client && npm run dev
```

## Port Summary

| Service | Port | URL |
|---------|------|-----|
| React Dev Server | 5173 | http://localhost:5173 |
| Node.js API | 5000 | http://localhost:5000 |
| PostgreSQL | 5432 | postgresql://localhost:5432/iophin_db |

## Next Steps

- [QUICKSTART.md](QUICKSTART.md) — Run the static pipeline
- [QUICKSTART_DYNAMIC.md](QUICKSTART_DYNAMIC.md) — Enable real-time monitoring
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — Diagnose common issues
