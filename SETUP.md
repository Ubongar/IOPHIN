# IOPHIN — Setup Guide (Current)

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

# Optional external feeds
ACLED_EMAIL=
ACLED_API_KEY=
DTM_API_KEY=
NASA_LAADS_TOKEN=
GEE_PROJECT=
GEE_SERVICE_ACCOUNT=
GEE_KEY_FILE=./gee/gen-lang-client-0206534143-b4d81af822c7.json
```

## 7) Initialize DB extensions/tables (recommended)

Run `server/init.sql` against your database (required for advanced v1 features and materialized views).

If using Docker compose with the provided mount, this runs automatically on first container initialization.

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
- `http://localhost:5173`

## Optional: full Docker startup

```bash
docker compose up --build
```
