# IOPHIN — Implementation Summary

Detailed implementation reference for the Nigeria Poverty Hotspot Intelligence System.

## System Components

### 1. Python ML Engine (`src/`)

#### `src/config.py`
Central configuration for all system parameters:
- **Paths**: `BASE_DIR`, `DATA_DIR`, `RAW_DIR`, `PROCESSED_DIR`
- **Model**: `K_CLUSTERS=5`, `PCA_VARIANCE=0.95`, `USE_HDBSCAN=True`
- **Composite weights**: MPI (30%), inverse nightlight (25%), health access (15%), education access (15%), infrastructure (15%)
- **External APIs**: HDX, WorldPop, DTM, WFP, Overpass, GEE credentials
- **HDBSCAN**: `min_cluster_size=30`
- **MPI column mapping**: Maps CSV columns to internal field names

#### `src/data_loader.py`
Data loading and preprocessing:
- Loads LGA shapefile via GeoPandas (`gpd.read_file`)
- Reads state-level MPI CSV with column mapping
- Reads senatorial district MPI data
- Loads LGA reference JSON for coordinates
- Handles encoding, missing columns, and data type coercion

#### `src/feature_extraction.py`
Memory-safe raster and API data extraction:
- **VIIRS processing**: Windowed reading of 10.8 GB GeoTIFF using `rasterio`
  - Automatic CRS detection and reprojection (`pyproj`)
  - Zonal statistics (mean nightlight per LGA polygon)
  - Falls back to synthetic nightlight data when file unavailable
- **Infrastructure extraction**: Queries Overpass API for health facilities, schools, roads
- **Environmental**: NDVI and rainfall via GEE
- **KNN imputation**: Fills missing values with k=5 nearest neighbors

#### `src/model_engine.py`
Unsupervised ML pipeline:
- **StandardScaler**: Feature normalization
- **PCA**: Dimensionality reduction retaining 95% variance
- **K-Means (k=5)**: Default clustering algorithm
- **HDBSCAN**: Alternative clustering (`min_cluster_size=30`, enabled via `USE_HDBSCAN=True`)
- **Composite scoring**: Weighted sum of normalized features
- **Risk assignment**: Clusters sorted by mean composite score → Critical/High/Medium/Low/Minimal
- **Validation**: Silhouette Score printed to console
- **Output**: DataFrame with all features + cluster + risk_level columns

#### `src/main.py`
Main orchestration script:
1. Loads all data sources
2. Runs feature extraction
3. Runs ML pipeline
4. Exports `final_model_output.csv` and `hotspots.geojson`
5. Prints diagnostic summary

#### `src/db_config.py`
SQLAlchemy ORM configuration:
- Connection: `postgresql://postgres:<password>@localhost:5432/iophin_db`
- `poverty_hotspots` table: 30+ columns with compound unique `(lga_name, state)`
- `hotspot_history` table: Time-series snapshots with `(lga_name, snapshot_date)` index
- Runtime column migration: Adds new columns to existing tables if schema evolves
- Session factory with `sessionmaker`

#### `src/db_utils.py`
Database CRUD operations:
- Upsert logic using compound key `(lga_name, state)`
- Bulk insert/update for migration
- History snapshot creation
- Query helpers for state aggregation and rankings

#### `src/migrate_to_db.py`
One-time CSV → PostgreSQL migration:
- Reads `final_model_output.csv`
- Maps CSV columns to ORM model
- Inserts 774 records with upsert behavior
- Preserves geometry as GeoJSON text

#### `src/scheduler_service.py`
Real-time monitoring scheduler:
- **APScheduler**: Interval-based job scheduling
- Tasks: conflict (1h), infrastructure (6h), nightlight (24h), retrain (12h)
- Each task independently catches errors
- Graceful shutdown on SIGTERM/SIGINT
- Logs task start/completion with timestamps

### 2. Node.js API Server (`server/`)

#### `server/index.js`
Express 4 server using ESM modules:
- **Port**: 5000 (configurable via `PORT` env var)
- **Middleware**: CORS, compression, express-rate-limit (100 req/15min)
- **Dual-mode**: Database-first with automatic GeoJSON file fallback
- **Response header**: `X-Data-Source: database | file`
- **Graceful shutdown**: SIGTERM/SIGINT handlers close DB pool

**7 API Endpoints:**

| Endpoint | Mode | Description |
|----------|------|-------------|
| `GET /api/health` | Both | Health check with DB connectivity status |
| `GET /api/hotspots` | Both | GeoJSON FeatureCollection, optional `?state=` and `?risk=` filters |
| `GET /api/stats` | Both | Aggregate: total LGAs, risk breakdown, average MPI |
| `GET /api/lga/:name` | Both | Single LGA as GeoJSON Feature |
| `GET /api/states` | DB only | Per-state aggregated metrics (count, avg score, risk breakdown) |
| `GET /api/rankings` | DB only | Top-N LGAs by composite score, `?order=worst&limit=50` |
| `GET /api/history/:lga` | DB only | Time-series snapshots, `?limit=30` |

#### `server/database.js`
PostgreSQL query module:
- Uses `pg` (node-postgres) `Pool` for connection management
- Constructs GeoJSON Features from database rows
- Maps all v2 properties: `composite_poverty_score`, `population_density`, `health_facility_count`, `school_count`, `road_density_km`, `ndvi_mean`, `rainfall_mm`, `distance_to_urban_km`, `idp_count`, `food_price_index`, `senatorial_mpi`, `headcount_ratio`, `intensity_of_deprivation`, `in_severe_poverty`
- Filtering by state and risk_level in SQL WHERE clause
- State aggregation and ranking queries

### 3. React Frontend (`client/`)

#### `client/src/App.tsx` (~365 lines)
Main application component:
- **State management**: `selectedLGA`, `hoveredLGA`, `searchQuery`, `stateFilter`, `riskFilter`, `activeView` (map/rankings/states), `sidebarOpen`
- **Views**: Map (default), Rankings, State Overview — switched via mobile bottom nav or desktop tabs
- **Top toolbar**: Unified bar with SearchBar, state/risk filter dropdowns, theme toggle, status chips
- **Mobile layout**: Hamburger menu, bottom navigation bar, sidebar drawer
- **Data fetching**: `useEffect` with 60-second polling interval, re-fetch on filter changes
- **Filter propagation**: `searchQuery`, `stateFilter`, `riskFilter` passed to all child views
- **GeoJSON remount**: `filterKey` prop forces MapComponent to rebuild GeoJSON layer on filter change

#### `client/src/components/MapComponent.tsx` (~340 lines)
Interactive Leaflet map:
- **Basemaps**: CARTO dark/light tiles (switches with theme)
- **GeoJSON overlay**: 774 LGA polygons colored by risk level
- **Fill opacity**: 0.8 for clear risk visualization
- **Hover tooltip**: Compact format — LGA name, state, risk badge, composite score, "Click for details"
  - `sticky: false` to prevent tooltip stacking
  - Custom CSS class `.custom-tooltip-compact`
- **Click handler**: Opens sidebar with full LGA analytics
- **Auto-zoom**: Centers/zooms to selected LGA, zooms back when deselected
- **State zoom**: Computes bounds of all LGAs in a state for state filter zoom
- **prevSelectedRef**: Tracks previous selection for zoom-back logic
- **filterKey**: Prop used as React `key` to force GeoJSON layer remount

#### `client/src/components/Sidebar.tsx` (~630 lines)
Analytics panel:
- **National Overview** (no LGA selected):
  - Total LGAs, risk distribution chart
  - Average MPI, average composite score
  - Top 5 critical LGAs
- **LGA Detail** (LGA selected):
  - LGA name, state, risk badge
  - Composite poverty score with progress bar
  - MPI, headcount ratio, intensity of deprivation, severe poverty
  - Senatorial MPI
  - Mean nightlight intensity
  - Infrastructure: health facilities, schools, road density
  - Environmental: NDVI, rainfall
  - Distance to urban center
  - Population density
  - Displacement: IDP count, food price index
  - Conflict status
  - Poverty probability (derived from composite score)
- **Close button**: Clears selection and zooms map back to full Nigeria view
- **Mobile**: Renders as drawer overlay

#### `client/src/components/RankingsTable.tsx` (~115 lines)
LGA poverty rankings:
- Fetches from `/api/rankings`
- Sortable: worst-first (default) or best-first
- Filtered by `searchQuery` (LGA name match), `stateFilter`, `riskFilter`
- Displays: rank, LGA name, state, composite score, risk badge
- Shows filtered count vs total

#### `client/src/components/StateOverview.tsx` (~75 lines)
State-level aggregated analytics:
- Fetches from `/api/states`
- Filtered by `searchQuery` (state name match)
- Displays: state name, LGA count, average composite score, risk breakdown
- Click handler: switches to map view and applies state filter for zoom

#### `client/src/components/SearchBar.tsx` (~180 lines)
Unified search across all views:
- Searches LGAs and states by name (case-insensitive)
- Minimum 2 characters, max 10 dropdown results
- `onSelect` callback: zooms map to selected LGA
- `onSearchTermChange` callback: propagates search text to filter Rankings and StateOverview
- Dynamic `placeholder` prop: changes based on active view
- Dropdown with LGA name, state, risk badge, composite score

#### `client/src/components/Legend.tsx`
Risk level color legend:
- 5 tiers with color swatches and labels
- Colors: Critical (#7C3AED), High (#EF4444), Medium (#F59E0B), Low (#10B981), Minimal (#3B82F6)
- Positioned bottom-left of map

#### `client/src/contexts/ThemeContext.tsx`
Theme management:
- React Context providing `theme` and `toggleTheme`
- Persists selection to `localStorage`
- Adds `dark` class to `<html>` element for Tailwind dark mode

#### `client/src/types.ts` (118 lines)
TypeScript type definitions:

```typescript
interface HotspotProperties {
    lga_name: string;
    state: string;
    latitude: number;
    longitude: number;
    mpi: number;
    headcount_ratio: number;
    intensity_of_deprivation: number;
    in_severe_poverty: number;
    senatorial_mpi: number;
    mean_nightlight_intensity: number;
    composite_poverty_score: number;
    health_facility_count: number;
    school_count: number;
    road_density_km: number;
    ndvi_mean: number;
    rainfall_mm: number;
    population_density: number;
    distance_to_urban_km: number;
    idp_count: number;
    food_price_index: number;
    cluster: number;
    cluster_label: string;
    risk_level: RiskLevel;
    clustering_method: string;
    conflict_flag: boolean;
    last_conflict_event: string | null;
    last_updated: string;
    data_source: string;
}

type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal';

const RISK_COLORS: Record<RiskLevel, string> = {
    Critical: '#7C3AED',
    High: '#EF4444',
    Medium: '#F59E0B',
    Low: '#10B981',
    Minimal: '#3B82F6',
};
```

#### `client/src/index.css` (~1180 lines)
Complete design system:
- CSS variables for dark/light themes
- `.custom-tooltip-compact`: Compact hover tooltip styling
- `.map-tooltip-compact`: Map-specific tooltip overrides
- Mobile bottom navigation bar styles
- Sidebar drawer transitions (mobile)
- Scrollable containers for rankings and state lists
- Responsive breakpoints
- Custom scrollbar styling
- Risk level badge colors

## Data Files

| File | Size | Contents |
|------|------|----------|
| `data/raw/viirs_2024.tif` | 10.8 GB | VIIRS nighttime lights raster (local only) |
| `data/raw/NGA_LGA_Boundaries_2_.../*.shp` | ~50 MB | GRID3 LGA boundary shapefile (774 polygons) |
| `data/raw/nga_mpi(3).csv` | ~5 KB | State-level MPI indicators |
| `data/raw/Nigeria MPI by Senatorial District.csv` | ~10 KB | Senatorial MPI data |
| `data/raw/nigeria_lga.json` | ~30 KB | LGA reference coordinates |
| `data/processed/processed_hotspots.csv` | ~200 KB | Intermediate processing output |
| `data/processed/final_model_output.csv` | ~500 KB | Full model output (774 rows) |
| `data/processed/hotspots.geojson` | ~15 MB | GeoJSON for API fallback |

## Risk Classification

### 5-Tier System

| Tier | Hex Color | Composite Score Range | Interpretation |
|------|-----------|----------------------|----------------|
| Critical | `#7C3AED` | Highest cluster mean | Extreme poverty, low nightlights, infrastructure deficit |
| High | `#EF4444` | Second highest | Significant poverty indicators |
| Medium | `#F59E0B` | Middle cluster | Moderate development challenges |
| Low | `#10B981` | Second lowest | Above-average development |
| Minimal | `#3B82F6` | Lowest cluster mean | Highest development indicators |

### Composite Score Formula

```
score = 0.30 × mpi_norm + 0.25 × inv_nightlight_norm + 0.15 × health_norm + 0.15 × edu_norm + 0.15 × infra_norm
```

All features normalized via StandardScaler before weighting. Higher score = higher poverty risk.

## Dependencies Summary

### Python (`requirements.txt`)
```
numpy, pandas, scikit-learn, scipy, geopandas, rasterio, shapely, fiona, pyproj,
matplotlib, seaborn, sqlalchemy, psycopg2-binary, requests, schedule, python-dotenv,
earthengine-api, hdbscan, thefuzz, openpyxl
```

### Node.js Server (`server/package.json`)
```json
{
    "express": "^4.x",
    "pg": "^8.x",
    "cors": "^2.x",
    "compression": "^1.x",
    "dotenv": "^16.x",
    "express-rate-limit": "^7.x"
}
```

> Note: `better-sqlite3` is listed in `package.json` as a legacy dependency but is **not used** — the server exclusively uses `pg` for PostgreSQL.

### React Client (`client/package.json`)
```json
{
    "react": "^19.x",
    "react-dom": "^19.x",
    "typescript": "~5.9",
    "vite": "^7.x",
    "tailwindcss": "^4.x",
    "react-leaflet": "^5.x",
    "leaflet": "^1.9",
    "recharts": "^3.x",
    "axios": "^1.x",
    "@types/leaflet": "^1.x"
}
```

## Build & Dev

### Frontend Build
```bash
cd client
npm run dev        # Development server (localhost:5173)
npm run build      # Production build (dist/)
npm run preview    # Preview production build
```

### API Server
```bash
cd server
node index.js      # Start on port 5000
```

### ML Pipeline
```bash
python -m src.main           # Run full pipeline
python -m src.migrate_to_db  # Migrate to PostgreSQL
python -m src.scheduler_service  # Start dynamic monitoring
```
