# IOPHIN — Setup Guide (v3.0)

## Prerequisites

- Python 3.11 recommended (3.9+ supported by dependency ranges)
- Node.js 18+
- npm 9+
- PostgreSQL 14+ (PostGIS recommended)
- Redis 7+

## 1) Clone and enter project

```bash
git clone <repo-url>
cd IOPHIN
```

## 2) Python environment

```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

## 3) Backend dependencies

```bash
cd server
npm install
cd ..
```

## 4) Frontend dependencies

```bash
cd client
npm install
cd ..
```

## 5) Database and Redis

### Option A: Local services
- Start PostgreSQL and create database `iophin_db`.
- Start Redis on `localhost:6379`.

### Option B: Docker

```bash
docker compose up -d postgres redis
```

## 6) Environment configuration

Create `.env` at repository root and `server/.env` (or use one source and load accordingly):

```env
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD
PORT=5000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me

# Optional: Risk tiering mode
# Set to 'absolute' to use fixed composite score thresholds instead of cluster-relative tiers
RISK_TIERING_MODE=cluster
THRESHOLD_MINIMAL=0.05
THRESHOLD_LOW=0.10
THRESHOLD_MEDIUM=0.20
THRESHOLD_HIGH=0.40
THRESHOLD_CRITICAL=1.0

# Optional external feeds
ACLED_EMAIL=
ACLED_API_KEY=
DTM_API_KEY=
NASA_LAADS_TOKEN=
GEE_PROJECT=
GEE_SERVICE_ACCOUNT=
GEE_KEY_FILE=./gee/gen-lang-client-0206534143-b4d81af822c7.json

# Scheduler intervals (hours)
SCHEDULER_CONFLICT_INTERVAL=1
SCHEDULER_VIIRS_INTERVAL=24
SCHEDULER_INFRASTRUCTURE_INTERVAL=6
SCHEDULER_ML_RETRAIN_INTERVAL=12
SCHEDULER_GRID3_INTERVAL=168
SCHEDULER_NDVI_INTERVAL=24
SCHEDULER_RAINFALL_INTERVAL=24
SCHEDULER_POPULATION_INTERVAL=720
SCHEDULER_IDP_INTERVAL=168
SCHEDULER_FOOD_PRICE_INTERVAL=168
SCHEDULER_EXTERNAL_ENRICHMENT_INTERVAL=24
SCHEDULER_GEE_ENVIRONMENTAL_INTERVAL=24
```

## 7) Initialize DB extensions/tables (recommended)

Run `server/init.sql` against your database (required for advanced v1 features and materialized views).

If using Docker compose with the provided mount, this runs automatically on first container initialization.

### Manual initialization

```bash
# Using psql
psql -U postgres -d iophin_db -f server/init.sql

# Or using Docker
docker exec -i iophin-postgres psql -U postgres -d iophin_db < server/init.sql
```

## 8) Generate model outputs and migrate

```bash
python -m src.main
python -m src.migrate_to_db
```

## 9) Run services

```bash
# API
cd server
npm run dev

# Frontend
cd ../client
npm run dev

# Optional scheduler (new terminal, from repo root)
python -m src.scheduler_service
```

## 10) Validate

- `http://localhost:5000/api/health`
- `http://localhost:5000/api/hotspots`
- `http://localhost:5000/api/config`
- `http://localhost:5173`

## Optional: Full Docker startup

```bash
docker compose up --build
```

This starts all services:
- `postgres` — PostgreSQL with PostGIS
- `redis` — Redis cache
- `server` — Node.js API
- `client` — React frontend

## Post-Setup Configuration

### Create Admin User

```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"securepassword","full_name":"Admin User","role":"admin"}'
```

### Verify Risk Tiering Mode

```bash
curl http://localhost:5000/api/config
```

### Test WebSocket Connection

The frontend automatically connects via Socket.IO. Check browser console for connection messages.

## Troubleshooting

See `TROUBLESHOOTING.md` for common issues and solutions.
