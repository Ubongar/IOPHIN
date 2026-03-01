# IOPHIN — Example Output Reference (v4.0)

## Pipeline Output Files

After running the Python analytics pipeline (`python -m src.main`), the following files are generated:

### `data/processed/final_model_output.csv`

Complete LGA-level output with 30+ columns:

```csv
lga_name,state,mpi_score,nightlight_intensity,composite_poverty_score,risk_level,cluster,health_deprivation,education_deprivation,living_standards_deprivation,health_facility_count,school_count,road_density_km,population_density,conflict_flag,last_conflict_event,idp_count,food_price_index,ndvi_mean,rainfall_mm,latitude,longitude
Abadam,Borno,0.782,0.34,0.891,Critical,4,0.85,0.79,0.88,2,3,12.5,45.2,1,2024-01-15,15420,185.3,0.12,280.5,13.15,13.18
Aba North,Abia,0.125,45.2,0.087,Low,1,0.15,0.12,0.18,28,42,85.3,1250.0,0,,,95.2,0.68,1520.3,5.12,7.37
Abaji,Abuja,0.245,22.8,0.198,Medium,2,0.28,0.22,0.31,15,25,55.8,320.5,0,,,112.8,0.45,980.2,8.98,6.94
...
```

**Key columns:**
| Column | Type | Description |
|--------|------|-------------|
| lga_name | string | LGA name (primary key, normalized) |
| state | string | State name |
| mpi_score | float | Multidimensional Poverty Index (0-1) |
| nightlight_intensity | float | VIIRS mean radiance |
| composite_poverty_score | float | Weighted composite (0-1) |
| risk_level | string | Critical / High / Medium / Low / Minimal |
| cluster | int | K-Means/HDBSCAN cluster assignment |
| health_deprivation | float | Health indicator (0-1) |
| education_deprivation | float | Education indicator (0-1) |
| living_standards_deprivation | float | Living standards (0-1) |
| health_facility_count | int | OSM health facilities in LGA |
| school_count | int | OSM schools in LGA |
| road_density_km | float | Road network density |
| population_density | float | WorldPop estimate (people/km²) |
| conflict_flag | bool | ACLED conflict in last 6 months |
| last_conflict_event | date | Most recent conflict date |
| idp_count | int | DTM/IOM displaced persons |
| food_price_index | float | HDX food price metric |
| ndvi_mean | float | Vegetation index (GEE MODIS) |
| rainfall_mm | float | Annual rainfall (GEE CHIRPS) |
| latitude | float | LGA centroid |
| longitude | float | LGA centroid |

### `data/processed/hotspots.geojson`

GeoJSON FeatureCollection with cluster-mode risk tiers:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "lga_name": "Abadam",
        "state": "Borno",
        "mpi_score": 0.782,
        "nightlight_intensity": 0.34,
        "composite_poverty_score": 0.891,
        "risk_level": "Critical",
        "cluster": 4,
        "health_deprivation": 0.85,
        "education_deprivation": 0.79,
        "living_standards_deprivation": 0.88,
        "health_facility_count": 2,
        "school_count": 3,
        "road_density_km": 12.5,
        "population_density": 45.2,
        "conflict_flag": true,
        "idp_count": 15420,
        "food_price_index": 185.3,
        "ndvi_mean": 0.12,
        "rainfall_mm": 280.5
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[[13.18, 13.15], [13.22, 13.15], ...]]]
      }
    }
  ]
}
```

### `data/processed/hotspots.absolute.geojson`

Same structure as `hotspots.geojson` but with absolute-mode risk tier assignments based on fixed composite score thresholds.

### `data/processed/processed_hotspots.csv`

Intermediate file with processed features before final model scoring.

---

## API Response Examples

### `GET /api/health`
```json
{
  "status": "healthy",
  "database": "connected",
  "redis": "connected",
  "hotspots_count": 774,
  "timestamp": "2024-01-15T12:00:00.000Z",
  "version": "4.0.0"
}
```

### `GET /api/stats`
```json
{
  "total_lgas": 774,
  "risk_distribution": {
    "Critical": 89,
    "High": 156,
    "Medium": 234,
    "Low": 198,
    "Minimal": 97
  },
  "avg_composite_score": 0.187,
  "avg_mpi": 0.312,
  "states_count": 37,
  "data_source": "database",
  "tiering_mode": "cluster"
}
```

### `GET /api/rankings?limit=5`
```json
{
  "rankings": [
    {
      "rank": 1,
      "lga_name": "Abadam",
      "state": "Borno",
      "composite_poverty_score": 0.891,
      "risk_level": "Critical",
      "mpi_score": 0.782,
      "nightlight_intensity": 0.34
    },
    {
      "rank": 2,
      "lga_name": "Mobbar",
      "state": "Borno",
      "composite_poverty_score": 0.867,
      "risk_level": "Critical",
      "mpi_score": 0.756,
      "nightlight_intensity": 0.41
    }
  ],
  "total": 774,
  "source": "database"
}
```

### `GET /api/states`
```json
{
  "states": [
    {
      "state": "Borno",
      "avg_composite_score": 0.654,
      "lga_count": 27,
      "critical_count": 18,
      "high_count": 6,
      "medium_count": 3,
      "low_count": 0,
      "minimal_count": 0
    },
    {
      "state": "Lagos",
      "avg_composite_score": 0.078,
      "lga_count": 20,
      "critical_count": 0,
      "high_count": 0,
      "medium_count": 2,
      "low_count": 8,
      "minimal_count": 10
    }
  ]
}
```

### `GET /api/v1/anomalies`
```json
{
  "anomalies": [
    {
      "id": 1,
      "lga_name": "Kaga",
      "state": "Borno",
      "anomaly_type": "nightlight_drop",
      "severity": "high",
      "metric_value": -0.45,
      "baseline_value": 12.5,
      "current_value": 6.8,
      "detected_at": "2024-01-14T08:30:00.000Z",
      "acknowledged": false,
      "description": "Nightlight intensity dropped 45% from baseline"
    }
  ],
  "total": 12
}
```

### `GET /api/v1/changes?days=7`
```json
{
  "changes": [
    {
      "id": 1,
      "lga_name": "Gwoza",
      "state": "Borno",
      "previous_risk_level": "High",
      "new_risk_level": "Critical",
      "previous_score": 0.385,
      "new_score": 0.442,
      "changed_at": "2024-01-13T16:00:00.000Z",
      "change_reason": "composite_score_increase"
    }
  ],
  "period_days": 7,
  "total": 5
}
```

### `GET /api/v1/forecasts`
```json
{
  "forecasts": [
    {
      "id": 1,
      "lga_name": "Bama",
      "state": "Borno",
      "forecast_date": "2024-04-15",
      "predicted_score": 0.72,
      "confidence_lower": 0.65,
      "confidence_upper": 0.79,
      "model": "prophet",
      "current_score": 0.68,
      "predicted_direction": "worsening",
      "generated_at": "2024-01-15T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/v1/forecasts/escalations`
```json
{
  "escalations": [
    {
      "lga_name": "Bama",
      "state": "Borno",
      "current_risk_level": "High",
      "predicted_risk_level": "Critical",
      "current_score": 0.38,
      "predicted_score": 0.45,
      "escalation_probability": 0.82,
      "forecast_date": "2024-04-15"
    }
  ],
  "total": 8
}
```

### `POST /api/auth/login`
**Request:**
```json
{
  "email": "admin@example.com",
  "password": "securepass"
}
```
**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "admin@example.com",
    "role": "admin",
    "organization": "IOPHIN",
    "permissions": [
      "view_data", "export_data", "view_anomalies", "manage_anomalies",
      "view_changes", "view_forecasts", "view_interventions",
      "manage_interventions", "manage_alerts", "generate_reports",
      "manage_users", "manage_config"
    ]
  }
}
```

### `GET /api/v1/users` (Admin only)
```json
{
  "users": [
    {
      "id": 1,
      "email": "admin@example.com",
      "role": "admin",
      "organization": "IOPHIN",
      "active": true,
      "geographic_scopes": [],
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "email": "borno.officer@gov.ng",
      "role": "government",
      "organization": "Borno State Government",
      "active": true,
      "geographic_scopes": [
        {"scope_type": "state", "scope_value": "Borno"}
      ],
      "created_at": "2024-01-05T00:00:00.000Z"
    }
  ]
}
```

---

## Pipeline Console Output Example

```
[2024-01-15 12:00:00] IOPHIN Pipeline v4.0 — Starting
[2024-01-15 12:00:01] Loading MPI data... 774 LGAs loaded
[2024-01-15 12:00:01] Loading boundary data... 774 geometries merged
[2024-01-15 12:00:02] Name normalization: 63 corrections applied
[2024-01-15 12:00:03] Feature extraction: VIIRS nightlight... done (774 LGAs)
[2024-01-15 12:00:15] Feature extraction: ACLED conflict... done (89 events)
[2024-01-15 12:00:20] Feature extraction: OSM infrastructure... done
[2024-01-15 12:00:25] Feature extraction: WorldPop population... done
[2024-01-15 12:00:30] Feature extraction: GEE environmental... done
[2024-01-15 12:00:31] KNN imputation (k=5)... 23 missing values filled
[2024-01-15 12:00:32] PCA reduction: 15 features -> 8 components (95.2% variance)
[2024-01-15 12:00:33] K-Means clustering (k=5)... silhouette=0.412
[2024-01-15 12:00:34] HDBSCAN clustering (min=15)... silhouette=0.389
[2024-01-15 12:00:34] Selected: K-Means (higher silhouette)
[2024-01-15 12:00:35] Composite scoring... done
[2024-01-15 12:00:35] Risk tier assignment:
                       Critical: 89 LGAs (11.5%)
                       High:     156 LGAs (20.2%)
                       Medium:   234 LGAs (30.2%)
                       Low:      198 LGAs (25.6%)
                       Minimal:  97 LGAs (12.5%)
[2024-01-15 12:00:36] XGBoost dynamic model... R²=0.847, RMSE=0.043
[2024-01-15 12:00:37] Saved: data/processed/final_model_output.csv
[2024-01-15 12:00:38] Saved: data/processed/hotspots.geojson
[2024-01-15 12:00:38] Saved: data/processed/hotspots.absolute.geojson
[2024-01-15 12:00:39] Database migration... 774 rows upserted
[2024-01-15 12:00:39] Materialized views refreshed
[2024-01-15 12:00:39] Pipeline complete in 39.2 seconds
```
