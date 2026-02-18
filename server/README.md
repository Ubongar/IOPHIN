# IOPHIN Server — Node.js API

Express 4 backend serving poverty hotspot data from PostgreSQL with automatic GeoJSON file fallback.

## Quick Start

```bash
cd server
npm install
node index.js
```

Server starts on **http://localhost:5000**.

## Architecture

- **Runtime**: Node.js 18+ with ESM modules
- **Framework**: Express 4
- **Database**: PostgreSQL via `pg` (node-postgres)
- **Fallback**: Static GeoJSON file (`data/processed/hotspots.geojson`)

### Dual-Mode Operation

The server attempts to read from PostgreSQL first. If the database is unavailable, it falls back to reading from the static GeoJSON file. The `X-Data-Source` response header indicates which source was used (`database` or `file`).

## API Endpoints

### `GET /api/health`

Health check with database connectivity status.

```json
{
    "status": "ok",
    "dbConnected": true,
    "hotspots": 774,
    "timestamp": "2024-01-15T14:30:00.000Z"
}
```

### `GET /api/hotspots`

Returns GeoJSON FeatureCollection of all LGAs.

**Query Parameters:**
- `state` (optional) — Filter by state name
- `risk` (optional) — Filter by risk level (Critical, High, Medium, Low, Minimal)

**Response:** GeoJSON FeatureCollection with properties:

```json
{
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": { "type": "Polygon", "coordinates": [...] },
            "properties": {
                "lga_name": "Maiduguri",
                "state": "Borno",
                "latitude": 11.846,
                "longitude": 13.160,
                "mpi": 0.567,
                "headcount_ratio": 0.823,
                "intensity_of_deprivation": 0.689,
                "in_severe_poverty": 0.456,
                "senatorial_mpi": 0.612,
                "mean_nightlight_intensity": 2.34,
                "composite_poverty_score": 0.78,
                "health_facility_count": 12,
                "school_count": 8,
                "road_density_km": 0.45,
                "ndvi_mean": 0.23,
                "rainfall_mm": 450,
                "population_density": 1500,
                "distance_to_urban_km": 5.2,
                "idp_count": 15000,
                "food_price_index": 1.35,
                "cluster": 0,
                "cluster_label": "Cluster 0",
                "risk_level": "Critical",
                "clustering_method": "hdbscan",
                "conflict_flag": true,
                "last_conflict_event": "2024-01-10T00:00:00.000Z",
                "last_updated": "2024-01-15T14:30:00.000Z",
                "data_source": "model_output"
            }
        }
    ]
}
```

**Fallback**: File mode returns the same structure from `hotspots.geojson`.

### `GET /api/stats`

Aggregate statistics across all LGAs.

```json
{
    "total": 774,
    "byRisk": {
        "Critical": 45,
        "High": 120,
        "Medium": 250,
        "Low": 200,
        "Minimal": 159
    },
    "avgMPI": 0.234,
    "avgCompositeScore": 0.456
}
```

### `GET /api/lga/:name`

Single LGA detail by name.

```json
{
    "type": "Feature",
    "geometry": { "type": "Polygon", "coordinates": [...] },
    "properties": { ... }
}
```

### `GET /api/states` (Database Only)

Per-state aggregated metrics.

```json
[
    {
        "state": "Borno",
        "count": 27,
        "avgCompositeScore": 0.72,
        "avgMPI": 0.54,
        "riskBreakdown": {
            "Critical": 8,
            "High": 12,
            "Medium": 5,
            "Low": 2,
            "Minimal": 0
        }
    }
]
```

### `GET /api/rankings` (Database Only)

LGAs ranked by composite poverty score.

**Query Parameters:**
- `order` — `worst` (default) or `best`
- `limit` — Number of results (default: 50)

```json
[
    {
        "lga_name": "Maiduguri",
        "state": "Borno",
        "composite_poverty_score": 0.89,
        "risk_level": "Critical",
        "mpi": 0.567
    }
]
```

### `GET /api/history/:lga` (Database Only)

Time-series snapshots for trend analysis.

**Query Parameters:**
- `limit` — Number of snapshots (default: 30)

```json
[
    {
        "snapshot_date": "2024-01-15T14:30:00.000Z",
        "composite_poverty_score": 0.78,
        "mpi": 0.567,
        "mean_nightlight_intensity": 2.34,
        "risk_level": "Critical",
        "conflict_flag": true
    }
]
```

## Middleware

| Middleware | Config |
|-----------|--------|
| CORS | Allows all origins (development) |
| Compression | gzip responses |
| Rate Limiting | 100 requests per 15 minutes per IP |
| JSON Parser | Express built-in |

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `DATABASE_URL` | `postgresql://postgres:...@localhost:5432/iophin_db` | PostgreSQL connection string |

### Files

- `index.js` — Server entry point, route handlers, middleware
- `database.js` — PostgreSQL connection pool, query functions, row mapping
- `package.json` — Dependencies and scripts

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.x | HTTP framework |
| pg | ^8.x | PostgreSQL client |
| cors | ^2.x | Cross-origin requests |
| compression | ^1.x | Response compression |
| dotenv | ^16.x | Environment variables |
| express-rate-limit | ^7.x | API rate limiting |

> **Note**: `better-sqlite3` is listed in `package.json` as a historical artifact but is **not used anywhere** in the codebase. The server exclusively connects to PostgreSQL via `pg`.

## Error Handling

- Database connection errors → automatic file fallback
- Invalid LGA name → 404 response
- Rate limit exceeded → 429 Too Many Requests
- Graceful shutdown on SIGTERM/SIGINT (closes DB pool)
