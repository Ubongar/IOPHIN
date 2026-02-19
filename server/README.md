# IOPHIN Server

Node.js/Express API for hotspot, forecasting, anomaly, intervention, and alert operations.

## Run

```bash
cd server
npm install
npm run dev
```

Server default URL: `http://localhost:5000`

## Runtime Features

- PostgreSQL-first data access
- Redis caching
- GeoJSON fallback for compatible endpoints
- JWT auth + role-gated operations
- Socket.IO initialization
- Report generation endpoint

## Route Families

### Compatibility routes (`/api/*`)
- `GET /api/health`
- `GET /api/hotspots`
- `GET /api/stats`
- `GET /api/lga/:name`
- `GET /api/states`
- `GET /api/rankings`
- `GET /api/history/:lga`

### Expanded routes (`/api/v1/*`)

- Auth
  - `POST /auth/register`
  - `POST /auth/login`
- Hotspots and analytics
  - `GET /hotspots`
  - `GET /hotspots/within-radius`
  - `GET /stats`
  - `GET /states`
  - `GET /rankings`
  - `GET /changes`
  - `GET /anomalies`
  - `PATCH /anomalies/:id/acknowledge`
  - `GET /forecasts`
  - `GET /forecasts/escalations`
  - `GET /correlation/:metric1/:metric2`
  - `GET /lga/:name`
  - `GET /lga/:name/trends`
  - `GET /lga/:name/forecast`
  - `GET /lga/:name/anomalies`
- Interventions
  - `GET /interventions`
  - `POST /interventions`
  - `PUT /interventions/:id`
- Alerts
  - `GET /alerts/my`
  - `POST /alerts/subscribe`
  - `DELETE /alerts/:id`
- Saved views
  - `GET /saved-views`
  - `POST /saved-views`
  - `GET /saved-views/:token`
- Reports
  - `POST /reports/generate`

## Environment

Key variables:

```env
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
PORT=5000
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
NODE_ENV=development
```

## SQL Bootstrap

Use `server/init.sql` to initialize PostGIS and advanced tables/materialized views used by v1 features.
