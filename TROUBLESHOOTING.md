# IOPHIN — Troubleshooting Guide (v4.0)

## Table of Contents
1. [Docker & Infrastructure](#docker--infrastructure)
2. [Database Issues](#database-issues)
3. [Python Engine Issues](#python-engine-issues)
4. [API Server Issues](#api-server-issues)
5. [Frontend Issues](#frontend-issues)
6. [Authentication & RBAC](#authentication--rbac)
7. [Real-Time & WebSocket](#real-time--websocket)
8. [Data Quality Issues](#data-quality-issues)
9. [External API Issues](#external-api-issues)
10. [Performance Issues](#performance-issues)

---

## Docker & Infrastructure

### Containers fail to start
```bash
docker compose down -v
docker compose up --build
```
Check logs per service:
```bash
docker compose logs postgres
docker compose logs redis
docker compose logs server
docker compose logs client
```

### Port conflicts
Default ports: PostgreSQL `5432`, Redis `6379`, API `5000`, Client `3000`.
Change in `docker-compose.yml` or `.env`:
```env
POSTGRES_PORT=5432
REDIS_PORT=6379
API_PORT=5000
CLIENT_PORT=3000
```

### PostgreSQL container won't initialize
- Remove the volume: `docker volume rm iophin_pgdata`
- Rebuild: `docker compose up --build postgres`
- Check `server/init.sql` for syntax errors

### Redis connection refused
```bash
redis-cli ping   # Should return PONG
docker compose logs redis
```
Verify `REDIS_URL` in `.env` matches the running Redis instance.

---

## Database Issues

### Tables missing after startup
The API server auto-runs `init.sql` on first connect. If tables are missing:
```bash
docker compose exec postgres psql -U iophin -d iophin -f /docker-entrypoint-initdb.d/init.sql
```
Or manually:
```bash
psql -U iophin -d iophin -f server/init.sql
```

### Materialized views not refreshing
```sql
SELECT refresh_materialized_views();
```
Or refresh individually:
```sql
REFRESH MATERIALIZED VIEW mv_state_aggregation;
REFRESH MATERIALIZED VIEW mv_risk_distribution;
REFRESH MATERIALIZED VIEW mv_rankings;
```

### Data not appearing after pipeline run
1. Check `data/processed/final_model_output.csv` exists
2. Run migration: `python -m src.migrate_to_db`
3. Verify row count: `SELECT COUNT(*) FROM poverty_hotspots;`
4. Check for upsert errors in migration logs

### PostGIS extension missing
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
Ensure the Docker image is `postgis/postgis:16-3.4-alpine`.

---

## Python Engine Issues

### Import errors
```bash
pip install -r requirements.txt
```
Key dependencies: pandas, numpy, scikit-learn, hdbscan, xgboost, prophet, pyod, geopandas, rasterio, sqlalchemy, earthengine-api, libpysal, esda, mgwr.

### Pipeline crashes during feature extraction
- **VIIRS raster missing**: Ensure `data/raw/` contains the VIIRS `.tif` file or configure GEE for remote fetch
- **External API timeout**: Check network connectivity and API credentials in `.env`
- **Memory error**: Large raster processing requires 4GB+ RAM; reduce resolution in `config.py`

### Name normalization mismatches
The pipeline normalizes 60+ LGA/state name variations. If an LGA doesn't match:
1. Check `data_loader.py` `NAME_CORRECTIONS` dict
2. Add the variant: `'Variant Name': 'Canonical Name'`
3. Re-run pipeline

### Scheduler not starting
```bash
python -m src.scheduler_service
```
Common issues:
- Missing `DATABASE_URL` environment variable
- PostgreSQL not reachable from Python process
- Import error in a dependency module

### Model training fails
- **Insufficient data**: Need 50+ LGAs with valid features for clustering
- **NaN domination**: Check imputation in `model_engine.py` (KNN k=5)
- **HDBSCAN no clusters**: min_cluster_size too large; default is 15, reduce in `config.py`

---

## API Server Issues

### Server won't start
```bash
cd server && npm install
node index.js
```
Check:
- `DATABASE_URL` is set and valid
- `REDIS_URL` is set (optional but recommended)
- Port `5000` is available

### 500 errors on API routes
Check server logs:
```bash
docker compose logs server --tail=100
```
Common causes:
- Database connection pool exhausted (increase `max` in `database.js`)
- Missing columns in `poverty_hotspots` table (run latest `init.sql`)
- Redis connection dropped (server falls back to DB-only mode)

### Swagger docs not loading
Navigate to `http://localhost:5000/api-docs`. If blank:
- Ensure `swagger.js` is imported in `index.js`
- Check for Express static middleware conflicts
- Verify `swagger-ui-express` is installed

### CORS errors from frontend
Update `CORS_ORIGIN` in `.env`:
```env
CORS_ORIGIN=http://localhost:3000
```
For multiple origins, update `server/index.js` CORS configuration.

### API returns stale data
Force Redis cache clear:
```bash
redis-cli FLUSHDB
```
Or wait for TTL expiry (1-10 minutes depending on route).

---

## Frontend Issues

### Blank page after build
```bash
cd client && npm install && npm run build
```
Check browser console for errors. Common causes:
- Missing environment variable `VITE_API_URL`
- API server not running
- CORS blocking requests

### Map not rendering
- **Leaflet**: Check that CSS is imported (`leaflet/dist/leaflet.css`)
- **MapLibre GL**: Check WebGL support in browser; try `maplibregl.supported()`
- **GeoJSON 404**: Verify `data/processed/hotspots.geojson` exists and API serves it

### Dark mode issues
Theme is managed by `ThemeContext`. If toggle doesn't work:
- Check `contexts/ThemeContext.tsx` is wrapping the app
- Verify Tailwind `darkMode: 'class'` in config
- Clear localStorage: `localStorage.removeItem('theme')`

### Components not updating in real-time
- Verify WebSocket connection (browser console: `socket.connected`)
- Check that `useWebSocket` hook is mounted in `App.tsx`
- Verify Redis is running (WebSocket events dispatched after cache update)

### TypeScript build errors
```bash
cd client && npx tsc --noEmit
```
Check `types.ts` for missing interface properties. After backend schema changes, update the `Hotspot` interface.

---

## Authentication & RBAC

### Cannot log in
- Verify user exists: `SELECT email, role, active FROM users;`
- Check password: passwords are bcrypt-hashed, cannot be read directly
- Ensure `active = true` for the account
- Check JWT_SECRET is set in `.env`

### Creating initial admin user
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"securepass","role":"admin","organization":"IOPHIN"}'
```

### Creating super_admin
Super admin must be created via SQL (not the register endpoint):
```sql
INSERT INTO users (email, password_hash, role, organization, active)
VALUES ('superadmin@example.com', '$2b$10$...hashed...', 'super_admin', 'IOPHIN', true);
```
Or promote an existing admin:
```sql
UPDATE users SET role = 'super_admin' WHERE email = 'admin@example.com';
```

### Permission denied errors
Check role-permission mapping:
```sql
SELECT r.name AS role, p.name AS permission
FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id
JOIN permissions p ON p.id = rp.permission_id
WHERE r.name = 'your_role'
ORDER BY p.name;
```

### Geographic scope not filtering
- Verify scopes are assigned: `SELECT * FROM user_geographic_scopes WHERE user_id = ?;`
- Check that `rbac.js` middleware is applied to the route
- Admin and super_admin roles bypass geographic scoping by default

### Audit log not recording
- Ensure `user_audit_log` table exists
- Check that RBAC middleware calls `logAuditEvent()` in `rbac.js`
- Only admin-level actions are audited by default

---

## Real-Time & WebSocket

### No WebSocket connection
Check browser console for Socket.IO errors:
```javascript
// Browser console
io.connect('http://localhost:5000')
```
Common fixes:
- Ensure `VITE_WS_URL` points to the API server
- Check CORS settings allow WebSocket upgrade
- Verify `websocket.js` is initialized in `server/index.js`

### Events not reaching frontend
1. Verify server emits events: add `console.log` in `websocket.js`
2. Check room subscriptions: events are scoped to `lga:*` and `state:*` rooms
3. Verify `useWebSocket` hook is connected and subscribed

### Duplicate events
- Multiple Socket.IO connections (check for duplicate hook mounts)
- Fix: ensure `useWebSocket` is used only once at the App level

---

## Data Quality Issues

### Missing LGAs in output
1. Check raw CSV: `wc -l data/raw/nga_mpi\(3\).csv`
2. Check name normalization: look for unmatched names in pipeline logs
3. Check shapefile merge: LGAs without geometry are dropped in spatial operations

### Risk tiers all showing same level
- **Cluster mode**: K-Means needs variance in features; check for constant columns
- **Absolute mode**: Verify thresholds match data range in `config.py`
- Check `composite_poverty_score` distribution:
```sql
SELECT risk_level, COUNT(*), AVG(composite_poverty_score)
FROM poverty_hotspots GROUP BY risk_level;
```

### GeoJSON geometry issues
- Validate: `ogr2ogr -f GeoJSON /dev/null data/processed/hotspots.geojson`
- Check CRS is EPSG:4326
- Simplify if file is too large (>50MB)

---

## External API Issues

### ACLED (conflict data)
- Verify credentials: `ACLED_EMAIL` and `ACLED_API_KEY` in `.env`
- Test: `curl "https://api.acleddata.com/acled/read?email=$ACLED_EMAIL&key=$ACLED_API_KEY&country=Nigeria&limit=1"`
- Rate limit: 500 requests/day

### Google Earth Engine
- Verify service account: `GEE_SERVICE_ACCOUNT` and `GEE_KEY_FILE` in `.env`
- Test: `python -c "import ee; ee.Initialize()"`
- Common error: "Earth Engine not initialized" — check `geospatial_env.py`

### WorldPop
- API endpoint changes periodically; check `config.py` for current URL
- Fallback: download raster manually to `data/raw/`

### OSM Overpass
- Rate limited: avoid rapid sequential calls
- Timeout: increase in `config.py` if queries fail for large areas

---

## Performance Issues

### Slow API responses
1. Check Redis is running (cache miss = DB query every time)
2. Add indexes: `CREATE INDEX ON poverty_hotspots (state);`
3. Increase PostgreSQL connection pool size
4. Refresh materialized views

### Slow pipeline execution
- Reduce VIIRS raster resolution
- Limit external API calls (disable non-critical sources in `config.py`)
- Use `--skip-enrichment` flag if available

### High memory usage
- VIIRS raster processing: reduce window size in `feature_extraction.py`
- Large GeoJSON: simplify geometries before serving
- Increase Docker memory limits in `docker-compose.yml`

### Browser performance
- Reduce GeoJSON feature count for map rendering
- Use MapLibre GL for better performance with large datasets
- Limit Recharts data points in temporal views
