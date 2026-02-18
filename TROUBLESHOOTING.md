# IOPHIN — Troubleshooting Guide

Common issues and diagnostic steps for the Nigeria Poverty Hotspot Intelligence System.

## Python ML Engine

### VIIRS Raster Extraction Errors

**Symptom**: `RasterioIOError` or memory errors when processing `viirs_2024.tif`

**Diagnosis**:
```bash
python -c "import rasterio; ds = rasterio.open('data/raw/viirs_2024.tif'); print(ds.meta)"
```

**Solutions**:
- Ensure sufficient RAM (8 GB minimum, 16 GB recommended)
- The system uses windowed reading to avoid loading the full 10.8 GB file into memory
- If the file is missing or corrupted, the pipeline falls back to synthetic nightlight data
- Check disk space: the VIIRS file is ~10.8 GB

### Spatial Bounds Verification

**Symptom**: All nightlight values are 0 or NaN

**Diagnosis**:
```python
import geopandas as gpd
gdf = gpd.read_file('data/raw/NGA_LGA_Boundaries_2_.../grid3_nga_boundary_vacclgas.shp')
print(f"CRS: {gdf.crs}")
print(f"Bounds: {gdf.total_bounds}")
# Expected bounds (EPSG:4326): approximately [2.7, 4.2, 14.7, 13.9]
```

**Solutions**:
- CRS mismatch: The system auto-reprojects, but verify both files use geographic coordinates
- Extent mismatch: Ensure shapefile covers Nigeria (lon 2.7-14.7, lat 4.2-13.9)

### Missing Dependencies

**Symptom**: `ModuleNotFoundError`

**Solution**:
```bash
pip install -r requirements.txt
```

Key packages that often fail to install:
- `rasterio`: May need GDAL binaries → install via `conda install rasterio` or `pip install GDAL` first
- `hdbscan`: Requires C compiler → install build tools or use `conda install hdbscan`
- `geopandas`: Requires fiona and pyproj → `pip install fiona pyproj` first
- `psycopg2-binary`: PostgreSQL dev headers needed on some systems

### KNN Imputation Warnings

**Symptom**: `ConvergenceWarning` from scikit-learn

**Cause**: Too many missing values for KNN to impute reliably (k=5 neighbors)

**Solution**: Normal for sparse data. Warnings can be suppressed but values should be verified:
```python
import pandas as pd
df = pd.read_csv('data/processed/final_model_output.csv')
print(df.isnull().sum())
```

## PostgreSQL Database

### Connection Failed

**Symptom**: `psycopg2.OperationalError: could not connect to server`

**Diagnosis**:
```bash
# Check PostgreSQL is running
# Windows:
Get-Service postgresql*

# Linux:
systemctl status postgresql

# Test connection
psql -U postgres -d iophin_db -c "SELECT 1"
```

**Solutions**:
- Start PostgreSQL service
- Verify connection string in `src/db_config.py`: `postgresql://postgres:<password>@localhost:5432/iophin_db`
- Check `pg_hba.conf` allows local connections
- Create database if missing: `createdb -U postgres iophin_db`

### Migration Issues

**Symptom**: `migrate_to_db.py` fails or inserts 0 records

**Diagnosis**:
```bash
python -c "
from src.db_config import engine
from sqlalchemy import text
with engine.connect() as conn:
    result = conn.execute(text('SELECT COUNT(*) FROM poverty_hotspots'))
    print(f'Records: {result.scalar()}')
"
```

**Solutions**:
- Ensure `final_model_output.csv` exists in `data/processed/`
- Check compound unique constraint: `(lga_name, state)` — duplicate entries are updated, not duplicated
- Run `python -m src.main` first to generate the CSV

### Only 2 LGAs Have Geometry

**Symptom**: Map shows only 2 colored polygons

**Cause**: Migration didn't include geometry data from shapefile

**Solution**: Re-run migration with geometry:
```bash
python -m src.migrate_to_db
```

The migration script reads geometry from the GeoJSON file or shapefile and stores it as GeoJSON text in the `geometry` column.

## Node.js API Server

### Server Won't Start

**Symptom**: Error on `node index.js`

**Common causes**:
1. **Port in use**: `Error: listen EADDRINUSE :::5000`
   ```bash
   # Find and kill process on port 5000
   # Windows:
   netstat -ano | findstr :5000
   taskkill /PID <pid> /F

   # Linux:
   lsof -i :5000
   kill -9 <pid>
   ```

2. **Missing modules**: `Cannot find module 'pg'`
   ```bash
   cd server && npm install
   ```

3. **ESM issues**: `SyntaxError: Cannot use import statement`
   - Ensure `"type": "module"` is in `server/package.json`

### API Returns Empty Data

**Symptom**: `/api/hotspots` returns `{"type":"FeatureCollection","features":[]}`

**Diagnosis**:
```bash
# Check database
psql -U postgres -d iophin_db -c "SELECT COUNT(*) FROM poverty_hotspots WHERE geometry IS NOT NULL"

# Check file fallback
ls data/processed/hotspots.geojson
```

**Solutions**:
- Check `X-Data-Source` response header — if `file`, the database connection failed
- Ensure `hotspots.geojson` exists in `data/processed/` for file fallback
- Re-run migration: `python -m src.migrate_to_db`

### Database-Only Endpoints Return 404

**Symptom**: `/api/states`, `/api/rankings`, `/api/history/:lga` return errors

**Cause**: These endpoints have no file fallback — they require PostgreSQL

**Solution**: Ensure PostgreSQL is running and `DATABASE_URL` is configured correctly

## React Frontend

### Map Shows No Data

**Symptom**: Map loads but no colored polygons appear

**Diagnosis**:
1. Open browser DevTools → Network tab
2. Check `/api/hotspots` response — should return GeoJSON with `features` array
3. Check Console for errors

**Solutions**:
- Ensure API server is running on port 5000
- Check CORS: API must allow requests from `http://localhost:5173`
- Verify `hotspots.geojson` or database contains geometry data
- Check that `fillOpacity` is set (currently 0.8)

### Map Shows on Desktop but Not Mobile

**Symptom**: Map container has `display: none` on small screens

**Solution**: The map uses `visibility: hidden` (not `display: none`) when inactive views are shown on mobile. If the map disappears entirely, check CSS:
```css
/* Correct — preserves Leaflet initialization */
.map-container { visibility: hidden; height: 0; }

/* Wrong — breaks Leaflet */
.map-container { display: none; }
```

### Build Errors

**Symptom**: `npm run build` fails

**Common fixes**:
```bash
# Clear cache
cd client
rm -rf node_modules/.vite
npm run build

# TypeScript errors
npx tsc --noEmit  # Check for type errors without building

# Dependency issues
rm -rf node_modules package-lock.json
npm install
```

### Tooltip Stacking

**Symptom**: Multiple tooltips stack on top of each other when hovering

**Solution**: Ensure `sticky: false` is set on the GeoJSON tooltip options and using compact tooltip format:
```typescript
onEachFeature={(feature, layer) => {
    layer.bindTooltip(compactTooltipContent, {
        sticky: false,
        className: 'custom-tooltip-compact'
    });
}}
```

### Theme Not Persisting

**Symptom**: Dark/light mode resets on page reload

**Solution**: Check `localStorage`:
```javascript
console.log(localStorage.getItem('theme'));
```
ThemeContext should read/write to `localStorage` and add `dark` class to `<html>`.

## Scheduler Service

### Scheduler Won't Start

**Symptom**: `scheduler_service.py` crashes immediately

**Solutions**:
- Check PostgreSQL is running
- Check `DATABASE_URL` in `src/db_config.py`
- Ensure APScheduler is installed: `pip install apscheduler`
- Check for port conflicts if using any network features

### External API Failures

**Symptom**: Scheduler logs show API fetch errors

**Solution**: The scheduler handles API failures gracefully — each task runs independently. If an API is down:
- Existing data is preserved
- Other tasks continue
- Check API status manually: `curl <api_url>`

### No History Snapshots

**Symptom**: `/api/history/:lga` returns empty array

**Solutions**:
- `hotspot_history` table is only populated during scheduler runs
- Run the scheduler and wait for at least one retrain cycle (12 hours, or modify interval for testing)
- Manually verify: `psql -d iophin_db -c "SELECT COUNT(*) FROM hotspot_history"`

## General

### Environment Variables Not Loading

**Symptom**: Database URL or API keys not found

**Solutions**:
- Python: Ensure `python-dotenv` is installed and `.env` file exists in project root
- Node.js: Ensure `dotenv` is imported at top of `index.js` and `.env` exists in `server/`

### Disk Space

**Key file sizes**:
- `viirs_2024.tif`: ~10.8 GB
- `hotspots.geojson`: ~15 MB
- PostgreSQL database: ~50 MB
- `node_modules/` (server + client): ~300 MB

### Performance

**Slow ML pipeline**:
- VIIRS extraction is the bottleneck (processes 774 LGA polygons against 10.8 GB raster)
- Use `processed_hotspots.csv` to skip re-extraction if shapefile hasn't changed
- Reduce `K_CLUSTERS` for faster (but less granular) clustering

**Slow API responses**:
- Enable compression: Already configured via `compression` middleware
- Check PostgreSQL indices: `(lga_name, state)` should be indexed
- Rate limiting: 100 requests per 15 minutes per IP
