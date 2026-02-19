# IOPHIN — Troubleshooting

## API server fails to start

### Symptoms
- process exits on launch
- port bind errors

### Checks
```bash
cd server
npm install
npm run dev
```

- Verify `PORT` availability (default `5000`).
- Verify `DATABASE_URL` and `REDIS_URL` are valid.

## Dashboard loads but no hotspot data

### Checks
- Open `http://localhost:5000/api/hotspots` directly.
- Inspect `X-Data-Source` response header (`database`, `cache`, `file`).
- Confirm `data/processed/hotspots.geojson` exists for fallback mode.

## `/api/v1/*` endpoints return errors

### Cause
Advanced tables/views from `server/init.sql` not initialized or DB unavailable.

### Fix
- Apply `server/init.sql` to your database.
- Ensure API can connect to PostgreSQL.

## Auth-protected endpoints return 401/403

### Checks
- Ensure login route returns token (`POST /api/v1/auth/login`).
- Send bearer token in `Authorization` header.
- Confirm role requirements for restricted endpoints.

## Scheduler crashes or does not update data

### Checks
```bash
python -m src.scheduler_service
```

- Validate Python dependencies are installed.
- Validate DB connectivity from Python side.
- Validate optional external API credentials if those jobs are enabled.

## Redis issues

### Symptoms
- cache misses/errors in logs

### Fix
- Start Redis (`redis://localhost:6379`).
- Confirm `REDIS_URL` env var is correct.
- API continues without cache for some operations, but performance may drop.

## Frontend build/lint failures

```bash
cd client
npm install
npm run lint
npm run build
```

- Ensure Node.js version is modern enough for Vite 7 toolchain.

## Python import/build errors

```bash
pip install -r requirements.txt
```

If geospatial libs fail to install, ensure platform geospatial dependencies are available (GDAL/PROJ toolchain or containerized setup).
