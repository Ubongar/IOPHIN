# Example Runtime Output

This file shows representative logs for the current system flow.

## Python static pipeline (`python -m src.main`)

```text
[INFO] Loading source datasets...
[INFO] Extracting features for LGAs...
[INFO] Running clustering and scoring...
[INFO] Writing processed output to data/processed/final_model_output.csv
[INFO] Writing GeoJSON output to data/processed/hotspots.geojson
[INFO] Pipeline complete.
```

## DB migration (`python -m src.migrate_to_db`)

```text
[INFO] Reading data/processed/final_model_output.csv

Note: Risk Tiering Modes — risk labels in the output may be produced by cluster-relative mapping (default) or by absolute thresholds if `RISK_TIERING_MODE=absolute` is set. See `src/config.py` for thresholds and `client` toolbar to toggle at runtime.
[INFO] Upserting records into poverty_hotspots...
[INFO] Migration complete.
```

## API server (`cd server && npm run dev`)

```text
🔄 Initializing database connection...
🚀 IOPHIN API Server running on port 5000
📊 Mode: DATABASE (Real-Time)
```

## Frontend (`cd client && npm run dev`)

```text
VITE v7.x ready in xxx ms
➜ Local: http://localhost:5173/
```

## Health check sample

`GET /api/health`

```json
{
  "status": "healthy",
  "timestamp": "2026-02-19T00:00:00.000Z",
  "environment": "development"
}
```
