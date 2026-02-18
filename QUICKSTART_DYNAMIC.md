# IOPHIN — Quick Start (Dynamic Monitoring Mode)

Enable real-time monitoring with scheduled data fetches, ML retraining, and live dashboard updates.

## Prerequisites

- All [static mode setup](QUICKSTART.md) completed (ML pipeline ran, database populated)
- PostgreSQL running with `iophin_db` containing 774 LGA records
- External API access (optional — graceful fallback if unavailable)

## Overview

Dynamic mode adds continuous monitoring via `scheduler_service.py` which uses APScheduler to:

| Task | Interval | Source |
|------|----------|--------|
| Conflict events | Every 1 hour | ACLED via HDX API |
| Infrastructure refresh | Every 6 hours | OpenStreetMap Overpass, WorldPop |
| Nightlight data update | Every 24 hours | NASA VIIRS (or GEE) |
| Full model retrain | Every 12 hours | All data sources |

Each update writes to `poverty_hotspots` (upsert) and creates a snapshot in `hotspot_history` for trend analysis.

## Step 1: Ensure Database is Populated

```bash
# Run initial ML pipeline if not done
python -m src.main

# Migrate to database
python -m src.migrate_to_db
```

Verify: `psql -U postgres -d iophin_db -c "SELECT COUNT(*) FROM poverty_hotspots;"`
Expected: `774`

## Step 2: Configure External APIs

Edit `src/config.py` for API endpoints:

```python
# Conflict data (ACLED via HDX)
HDX_API_URL = "https://data.humdata.org/api/3/action/..."

# Population data
WORLDPOP_API = "https://www.worldpop.org/rest/data/..."

# Displacement data
DTM_API = "https://dtm.iom.int/api/..."

# Food prices
WFP_API = "https://api.wfp.org/..."

# Infrastructure (OpenStreetMap)
OVERPASS_API = "https://overpass-api.de/api/interpreter"

# Environmental (Google Earth Engine)
GEE_PROJECT = "your-project-id"
GEE_CREDENTIALS = "gee/your-credentials.json"
```

> **Note**: The system gracefully handles API failures. If an external API is unreachable, that data source is skipped and existing values are retained.

## Step 3: Start the Scheduler Service

```bash
python -m src.scheduler_service
```

**Expected output:**
```
Starting dynamic monitoring scheduler...
Scheduler started with intervals:
  - Conflict check: every 1 hour
  - Infrastructure update: every 6 hours
  - Nightlight refresh: every 24 hours
  - Model retrain: every 12 hours
Next conflict check at: YYYY-MM-DD HH:MM:SS
Waiting for scheduled tasks...
```

The scheduler runs continuously. Keep this terminal open.

## Step 4: Start API Server

```bash
cd server
node index.js
```

The server reads from PostgreSQL. As the scheduler updates the database, the API automatically serves fresh data.

## Step 5: Start Frontend

```bash
cd client
npm run dev
```

Open **http://localhost:5173**

The dashboard polls the API every 60 seconds. Status indicators in the top toolbar show:
- **Data source**: `database` (live) or `file` (fallback)
- **LGA count**: Number of LGAs loaded
- **Last updated**: Timestamp of most recent data

## Data Flow in Dynamic Mode

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  External APIs   │────►│  Scheduler        │────►│  PostgreSQL      │
│  (ACLED, GEE,    │     │  (APScheduler)    │     │  iophin_db       │
│   WorldPop, WFP) │     │                    │     │                  │
└──────────────────┘     │  src/scheduler_    │     │  poverty_hotspots│
                         │  service.py        │     │  hotspot_history │
                         └──────────────────┘     └────────┬─────────┘
                                                           │
                         ┌──────────────────┐              │
                         │  Express API      │◄─────────────┘
                         │  server/index.js  │
                         │  Port 5000        │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │  React Dashboard  │  ◄── 60s polling
                         │  Port 5173        │
                         └──────────────────┘
```

## Monitoring the Scheduler

The scheduler logs each task execution:

```
[2024-01-15 14:00:00] Running conflict check...
[2024-01-15 14:00:05] Conflict check complete: 12 LGAs updated
[2024-01-15 14:00:05] History snapshot saved for 12 LGAs
```

### Time-Series History

Each scheduler run with data changes creates snapshots in `hotspot_history`:

```sql
SELECT lga_name, snapshot_date, composite_poverty_score, risk_level
FROM hotspot_history
WHERE lga_name = 'Maiduguri'
ORDER BY snapshot_date DESC
LIMIT 10;
```

The frontend accesses this via `GET /api/history/:lga` for trend visualization.

## Stopping the Service

Press `Ctrl+C` in the scheduler terminal. The scheduler has a graceful shutdown handler.

## Running All Services

For convenience, run all three services in separate terminals:

```bash
# Terminal 1: Scheduler
python -m src.scheduler_service

# Terminal 2: API Server
cd server && node index.js

# Terminal 3: Frontend
cd client && npm run dev
```

## Troubleshooting

- **Scheduler won't start**: Check PostgreSQL is running and `DATABASE_URL` is correct
- **No data updates**: Check API connectivity with `curl` to external endpoints
- **Stale dashboard**: Verify browser console shows successful API calls every 60s
- **History not appearing**: Ensure `hotspot_history` table exists (auto-created on first run)

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) and [DYNAMIC_MONITORING.md](DYNAMIC_MONITORING.md) for detailed guides.
