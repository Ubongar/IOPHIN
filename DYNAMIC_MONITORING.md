# IOPHIN — Dynamic Monitoring Guide

Comprehensive guide for the real-time poverty monitoring system with scheduled data ingestion, ML retraining, and live dashboard updates.

## System Overview

The dynamic monitoring system continuously fetches external data, updates ML predictions, and stores time-series snapshots for trend analysis. It transforms IOPHIN from a static analysis tool into a live intelligence platform.

### Architecture

```
External APIs ──► scheduler_service.py ──► PostgreSQL ──► Express API ──► React Dashboard
                 (APScheduler)              (iophin_db)    (port 5000)     (port 5173)
                                                                            60s polling
```

### Components

| Component | File | Role |
|-----------|------|------|
| Scheduler | `src/scheduler_service.py` | Orchestrates periodic data fetch + retrain |
| Config | `src/config.py` | API URLs, intervals, model parameters |
| DB Config | `src/db_config.py` | SQLAlchemy ORM, table schemas |
| DB Utils | `src/db_utils.py` | CRUD operations for PostgreSQL |
| Model Engine | `src/model_engine.py` | ML pipeline (PCA, K-Means/HDBSCAN) |
| Feature Extraction | `src/feature_extraction.py` | Data enrichment from APIs |

## Database Schema

### `poverty_hotspots` (774 rows)

Primary table storing current state for all LGAs.

```sql
CREATE TABLE poverty_hotspots (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR NOT NULL,
    state VARCHAR NOT NULL,
    latitude FLOAT,
    longitude FLOAT,
    
    -- Poverty indicators
    mpi FLOAT,
    headcount_ratio FLOAT,
    intensity_of_deprivation FLOAT,
    in_severe_poverty FLOAT,
    senatorial_mpi FLOAT,
    
    -- Economic
    mean_nightlight_intensity FLOAT,
    composite_poverty_score FLOAT,
    
    -- Infrastructure
    health_facility_count FLOAT,
    school_count FLOAT,
    road_density_km FLOAT,
    
    -- Environmental
    ndvi_mean FLOAT,
    rainfall_mm FLOAT,
    
    -- Demographics
    population_density FLOAT,
    distance_to_urban_km FLOAT,
    
    -- Displacement
    idp_count FLOAT,
    food_price_index FLOAT,
    
    -- ML outputs
    cluster INTEGER,
    cluster_label VARCHAR,
    risk_level VARCHAR,
    clustering_method VARCHAR,
    
    -- Crisis
    conflict_flag BOOLEAN DEFAULT FALSE,
    last_conflict_event TIMESTAMP,
    
    -- Metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR DEFAULT 'model_output',
    geometry TEXT,  -- GeoJSON polygon (stored as text)
    
    UNIQUE(lga_name, state)  -- Compound unique constraint
);
```

### `hotspot_history` (time-series)

Stores periodic snapshots for trend analysis.

```sql
CREATE TABLE hotspot_history (
    id SERIAL PRIMARY KEY,
    lga_name VARCHAR NOT NULL,
    state VARCHAR,
    snapshot_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    composite_poverty_score FLOAT,
    mpi FLOAT,
    mean_nightlight_intensity FLOAT,
    risk_level VARCHAR,
    conflict_flag BOOLEAN,
    population_density FLOAT,
    distance_to_urban_km FLOAT,
    health_facility_count FLOAT,
    school_count FLOAT
);

CREATE INDEX idx_history_lga_date ON hotspot_history(lga_name, snapshot_date);
```

## Scheduled Tasks

### Task 1: Conflict Monitoring (Every 1 Hour)

**Source**: ACLED data via HDX (Humanitarian Data Exchange) API

**Process**:
1. Fetches recent conflict events for Nigeria
2. Geocodes events to LGAs using spatial lookup
3. Updates `conflict_flag` and `last_conflict_event` columns
4. Creates history snapshots for affected LGAs

**Configuration** (`src/config.py`):
```python
HDX_API_URL = "https://data.humdata.org/api/3/action/..."
ACLED_RESOURCE_ID = "..."
```

### Task 2: Infrastructure Update (Every 6 Hours)

**Sources**: OpenStreetMap (Overpass API), WorldPop

**Process**:
1. Queries Overpass API for health facilities, schools, road networks per LGA
2. Fetches population density from WorldPop
3. Updates `health_facility_count`, `school_count`, `road_density_km`, `population_density`

**Configuration**:
```python
OVERPASS_API = "https://overpass-api.de/api/interpreter"
WORLDPOP_API = "https://www.worldpop.org/rest/data/..."
```

### Task 3: Nightlight Refresh (Every 24 Hours)

**Source**: NASA VIIRS via Google Earth Engine

**Process**:
1. Authenticates with GEE using service account
2. Extracts mean nightlight intensity per LGA boundary
3. Updates `mean_nightlight_intensity`

**Configuration**:
```python
GEE_PROJECT = "your-project-id"
GEE_CREDENTIALS = "gee/your-credentials.json"
```

### Task 4: Full Model Retrain (Every 12 Hours)

**Process**:
1. Reads current `poverty_hotspots` data from PostgreSQL
2. Re-runs the full ML pipeline:
   - Standard scaling of all features
   - PCA (95% variance retained)
   - K-Means (k=5) or HDBSCAN clustering
   - Composite poverty score recalculation
   - 5-tier risk level re-assignment
3. Updates all rows in `poverty_hotspots`
4. Creates snapshots in `hotspot_history` for all 774 LGAs

## API Endpoints for Dynamic Data

| Endpoint | Response | Notes |
|----------|----------|-------|
| `GET /api/hotspots?state=X&risk=Y` | GeoJSON FeatureCollection | Filterable by state and risk level |
| `GET /api/stats` | `{ total, byRisk, avgMPI, ... }` | Summary statistics |
| `GET /api/states` | `[{ state, count, avgScore, riskBreakdown }]` | Per-state aggregations (DB only) |
| `GET /api/rankings?order=worst&limit=50` | `[{ lga, state, score, risk }]` | Ranked list (DB only) |
| `GET /api/history/:lga?limit=30` | `[{ date, score, risk, nightlight }]` | Time-series (DB only) |
| `GET /api/lga/:name` | Single LGA feature | Full detail |
| `GET /api/health` | `{ status, dbConnected, hotspots }` | Health check |

All responses include `X-Data-Source: database` header when serving from PostgreSQL.

## Frontend Integration

### Auto-Refresh

The React dashboard polls `/api/hotspots` and `/api/stats` every 60 seconds:

```typescript
// In App.tsx
useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
}, []);
```

### Status Display

The top toolbar shows data freshness:
- Source indicator: **DB** (live database) or **File** (static fallback)
- LGA count badge
- Theme toggle (dark/light)

### History Visualization

When a user clicks an LGA, the sidebar can display trend data from `/api/history/:lga`:
- Composite score over time
- Risk level transitions
- Nightlight intensity trends

## Error Handling

### API Failures

Each scheduled task has independent error handling:

```python
try:
    fetch_conflict_data()
except Exception as e:
    logger.error(f"Conflict fetch failed: {e}")
    # Other tasks continue unaffected
```

### Database Connection

- SQLAlchemy connection pooling with auto-reconnect
- Express server tests DB connection on `/api/health`
- Graceful fallback to static GeoJSON file when DB is unavailable

### Rate Limiting

- Overpass API: Built-in request throttling
- HDX API: Respects rate limits with backoff
- Express API: 100 requests per 15 minutes per IP

## Deployment Considerations

### Running as a Service

```bash
# Using systemd (Linux)
[Unit]
Description=IOPHIN Scheduler Service
After=postgresql.service

[Service]
Type=simple
WorkingDirectory=/path/to/IOPHIN
ExecStart=/path/to/venv/bin/python -m src.scheduler_service
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Environment Variables

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/iophin_db
PORT=5000
NODE_ENV=production
```

### Logging

The scheduler logs to stdout. Redirect for persistent logging:

```bash
python -m src.scheduler_service 2>&1 | tee -a logs/scheduler.log
```

## Monitoring Checklist

| Check | Command | Expected |
|-------|---------|----------|
| DB row count | `psql -d iophin_db -c "SELECT COUNT(*) FROM poverty_hotspots"` | 774 |
| History snapshots | `psql -d iophin_db -c "SELECT COUNT(*) FROM hotspot_history"` | Growing over time |
| API health | `curl localhost:5000/api/health` | `{"status":"ok","dbConnected":true}` |
| Recent update | `psql -d iophin_db -c "SELECT MAX(last_updated) FROM poverty_hotspots"` | Recent timestamp |
| Conflict flags | `psql -d iophin_db -c "SELECT COUNT(*) FROM poverty_hotspots WHERE conflict_flag=true"` | Variable |
