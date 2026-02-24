# IOPHIN — Troubleshooting (v3.0)

## API server fails to start

### Symptoms
- Process exits on launch
- Port bind errors

### Checks
```bash
cd server
npm install
npm run dev
```

- Verify `PORT` availability (default `5000`).
- Verify `DATABASE_URL` and `REDIS_URL` are valid.
- Check for error messages in console output.

### Common Causes
- Port already in use: Change `PORT` in `.env` or kill the process using the port
- Missing dependencies: Run `npm install` in server directory
- Invalid environment variables: Check `.env` file syntax

## Dashboard loads but no hotspot data

### Checks
- Open `http://localhost:5000/api/hotspots` directly.
- Inspect `X-Data-Source` response header (`database`, `cache`, `file`).
- Confirm `data/processed/hotspots.geojson` exists for fallback mode.

### Solutions
1. **If X-Data-Source is 'file'**: Database may be unavailable, check PostgreSQL connection
2. **If 503 error**: Run the Python pipeline to generate data:
   ```bash
   python -m src.main
   python -m src.migrate_to_db
   ```
3. **If empty response**: Check if `poverty_hotspots` table has data

## `/api/v1/*` endpoints return errors

### Cause
Advanced tables/views from `server/init.sql` not initialized or DB unavailable.

### Fix
- Apply `server/init.sql` to your database:
  ```bash
  psql -U postgres -d iophin_db -f server/init.sql
  ```
- Ensure API can connect to PostgreSQL.
- Verify tables exist:
  ```sql
  \dt
  \dv
  ```

## Auth-protected endpoints return 401/403

### Checks
- Ensure login route returns token (`POST /api/v1/auth/login`).
- Send bearer token in `Authorization` header.
- Confirm role requirements for restricted endpoints.

### Solutions
1. **401 Unauthorized**: Token missing or invalid
   - Login again to get fresh token
   - Check token expiration
2. **403 Forbidden**: Insufficient permissions
   - User role may not have access to endpoint
   - Admin/government/ngo roles required for write operations

### Role Permissions
| Role | Permissions |
|------|-------------|
| admin | Full access, can change system config |
| government | Create/update interventions |
| ngo | Create/update interventions |
| user | Read-only access |

## Scheduler crashes or does not update data

### Checks
```bash
python -m src.scheduler_service
```

- Validate Python dependencies are installed.
- Validate DB connectivity from Python side.
- Validate optional external API credentials if those jobs are enabled.

### Common Issues
1. **Import errors**: Install requirements
   ```bash
   pip install -r requirements.txt
   ```
2. **Database connection errors**: Check `DATABASE_URL` in `.env`
3. **External API failures**: Verify API keys are valid
4. **Permission errors**: Check file/directory permissions for data files

## Redis issues

### Symptoms
- Cache misses/errors in logs
- Slower API response times

### Fix
- Start Redis (`redis://localhost:6379`).
- Confirm `REDIS_URL` env var is correct.
- API continues without cache for some operations, but performance may drop.

### Verify Redis
```bash
redis-cli ping
# Should return: PONG
```

## Frontend build/lint failures

```bash
cd client
npm install
npm run lint
npm run build
```

- Ensure Node.js version is modern enough for Vite 7 toolchain.
- Check for TypeScript errors in console.
- Verify all dependencies are installed.

### Common Issues
1. **Module not found**: Run `npm install`
2. **TypeScript errors**: Check type definitions in `types.ts`
3. **Vite build errors**: Clear cache with `rm -rf node_modules/.vite`

## Python import/build errors

```bash
pip install -r requirements.txt
```

If geospatial libs fail to install, ensure platform geospatial dependencies are available (GDAL/PROJ toolchain or containerized setup).

### Windows-Specific Issues
1. **GDAL not found**: Use OSGeo4W or conda
2. **rasterio errors**: Install pre-built wheels from PyPI
3. **fiona errors**: Use conda-forge channel

### Linux-Specific Issues
```bash
# Ubuntu/Debian
sudo apt-get install gdal-bin libgdal-dev python3-gdal

# Fedora
sudo dnf install gdal gdal-devel python3-gdal
```

## WebSocket not connecting

### Symptoms
- No real-time updates in dashboard
- Browser console shows WebSocket errors

### Checks
1. Verify server is running with Socket.IO
2. Check browser console for connection errors
3. Verify CORS settings allow your origin

### Solutions
1. **CORS error**: Add your origin to allowed origins in `server/index.js`
2. **Connection refused**: Verify server is running on correct port
3. **Proxy issues**: Configure Vite proxy in `vite.config.ts`

## Risk tiering mode not changing

### Symptoms
- Toggle doesn't update risk levels
- Server returns old mode

### Checks
1. Verify localStorage has the setting
2. Check if user has admin role for server-side change
3. Verify `/api/config` endpoint returns expected mode

### Solutions
1. **Client-side only**: Clear localStorage and try again
2. **Server-side change**: Login as admin user
3. **Environment override**: Set `RISK_TIERING_MODE` in `.env`

## Report generation fails

### Symptoms
- PDF download doesn't start
- Error message in UI

### Checks
1. Verify `pdfkit` is installed on server
2. Check server logs for errors
3. Verify request body has required fields

### Solutions
1. **Missing pdfkit**: `npm install pdfkit` in server directory
2. **Invalid data**: Check report parameters
3. **Memory issues**: Large reports may need increased memory limit

## Data quality panel shows stale data

### Symptoms
- Last update timestamp is old
- Coverage shows incomplete

### Checks
1. Run scheduler to refresh data
2. Check `data/processed/` file timestamps
3. Verify database records are recent

### Solutions
```bash
# Force refresh
python -m src.main
python -m src.migrate_to_db
```

## Docker issues

### Container won't start
```bash
docker compose logs server
docker compose logs client
docker compose logs postgres
```

### Database not initialized
```bash
# Re-run init script
docker exec -i iophin-postgres psql -U postgres -d iophin_db < server/init.sql
```

### Permission issues
```bash
# Reset volumes
docker compose down -v
docker compose up --build
```
