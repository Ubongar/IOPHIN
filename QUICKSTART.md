# IOPHIN — Quick Start (Static/Local)

This flow runs the core model and dashboard without requiring the scheduler.

## 1) Install dependencies

```bash
pip install -r requirements.txt

cd server
npm install

cd ../client
npm install
```

## 2) Configure env

Set DB/API basics in `.env` and/or `server/.env`:

```env
USE_DATABASE=true
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iophin_db
PORT=5000
REDIS_URL=redis://localhost:6379
```

## 3) Build processed outputs

```bash
python -m src.main
python -m src.migrate_to_db
```

Outputs:
- `data/processed/processed_hotspots.csv`
- `data/processed/final_model_output.csv`
- `data/processed/hotspots.geojson`

## 4) Start API and frontend

```bash
# terminal 1
cd server
npm run dev

# terminal 2
cd client
npm run dev
```

## 5) Open app

- Dashboard: `http://localhost:5173`
- API health: `http://localhost:5000/api/health`

## Notes

- If PostgreSQL is unavailable, compatible endpoints can fall back to GeoJSON file mode.
- Advanced features under `/api/v1/*` expect database-backed tables created by `server/init.sql`.
