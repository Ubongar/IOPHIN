# Dynamic Real-Time Monitoring System Guide

This guide explains how to use the new **Dynamic Real-Time Monitoring System** for IOPHIN.

## Architecture Overview

The system has transitioned from a static, file-based architecture to a dynamic pipeline with three components:

1. **The Harvester (Python Scheduler)**: Background service that fetches data from APIs and updates the database
2. **The Live Database (SQLite/PostgreSQL)**: Single source of truth that changes dynamically
3. **The API Gateway (Node.js)**: Serves the latest state from the database in real-time

```
┌─────────────────────────────────────────────────────────────┐
│                    Dynamic Architecture                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  External APIs            Scheduler Service       Database   │
│  ┌──────────┐           ┌──────────────┐        ┌─────────┐ │
│  │ ACLED    │──hourly──▶│ Conflict     │───────▶│         │ │
│  │ (Conflict)           │ Listener     │        │ SQLite/ │ │
│  └──────────┘           └──────────────┘        │ PostGIS │ │
│                                                  │         │ │
│  ┌──────────┐           ┌──────────────┐        │ poverty │ │
│  │ NASA     │──daily───▶│ Nightlight   │───────▶│ hotspots│ │
│  │ GIBS     │           │ Refresher    │        │ table   │ │
│  └──────────┘           └──────────────┘        │         │ │
│                                ▼                 └────┬────┘ │
│                         ┌──────────────┐              │      │
│                         │ ML Engine    │              │      │
│                         │ (K-Means)    │◀─────────────┘      │
│                         └──────────────┘                     │
│                                                               │
│  Frontend                Node.js API                         │
│  ┌──────────┐           ┌──────────────┐                    │
│  │ React    │◀─60s poll─│ Express      │◀─query─────────────┘
│  │ Dashboard│           │ /api/hotspots│                     │
│  └──────────┘           └──────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
# Python dependencies
pip install -r requirements.txt

# Node.js dependencies (for API server)
cd server
npm install
```

### 2. Initialize Database

First, run the ML model to generate the initial GeoJSON data:

```bash
python -m src.main
```

Then migrate the data to the database:

```bash
python -m src.migrate_to_db
```

This creates `poverty_hotspots.db` with all LGA data.

### 3. Start the Scheduler Service

The scheduler continuously fetches data and updates the database:

```bash
python -m src.scheduler_service
```

You'll see output like:
```
🚀 STARTING DYNAMIC MONITORING SERVICE
✅ Scheduled: Conflict Listener (every 1 hour)
✅ Scheduled: Satellite Refresher (every 24 hours)
✅ Scheduled: ML Model Retraining (every 6 hours)
✅ SCHEDULER SERVICE IS NOW RUNNING
```

### 4. Start the API Server

In a separate terminal:

```bash
cd server
npm start
```

The API will automatically use the database for real-time data.

### 5. Start the Frontend (Optional)

```bash
cd client
npm install
npm run dev
```

Access at http://localhost:5173

## How It Works

### Automated Data Pipeline

#### 1. Conflict Listener (Every 1 Hour)

Simulates fetching from ACLED or GDELT APIs:
- Detects conflict events in LGAs
- Flags affected areas as "CRITICAL"
- Elevates risk levels automatically
- Example: If violence detected in "Zamfara North", system immediately updates database

```python
# Simulated conflict detection
if conflict_detected:
    upsert_conflict_flag(
        lga_name="Zamfara North",
        conflict_flag='CRITICAL'
    )
```

#### 2. Satellite Refresher (Every 24 Hours)

Simulates fetching from NASA GIBS or Google Earth Engine:
- Updates nightlight intensity values
- Detects power outages (-30% to -50%)
- Tracks economic development (+10% to +30%)
- Normal variations (±5%)

```python
# Simulated scenarios
if power_outage:
    new_nightlight = old_value * 0.6  # 40% decrease
    
if development:
    new_nightlight = old_value * 1.2  # 20% increase
```

#### 3. ML Model Retraining (Every 6 Hours)

- Re-runs K-Means clustering on updated data
- Recalculates risk levels based on new indicators
- Updates database with fresh classifications

### Database Schema

The `poverty_hotspots` table stores:

```sql
CREATE TABLE poverty_hotspots (
    id INTEGER PRIMARY KEY,
    lga_name VARCHAR(255) UNIQUE,
    state VARCHAR(100),
    latitude FLOAT,
    longitude FLOAT,
    mean_nightlight_intensity FLOAT,
    mpi FLOAT,
    headcount_ratio FLOAT,
    intensity_of_deprivation FLOAT,
    in_severe_poverty FLOAT,
    cluster INTEGER,
    cluster_label VARCHAR(100),
    risk_level VARCHAR(50),
    conflict_flag VARCHAR(50),  -- NEW: NORMAL, ALERT, CRITICAL
    last_conflict_event DATETIME,
    geometry TEXT,
    last_updated DATETIME,
    data_source VARCHAR(100)  -- ML_MODEL, API_REFRESH, CONFLICT_API
);
```

### API Endpoints

All endpoints now serve real-time data from the database:

**GET /api/hotspots**
- Returns GeoJSON from database
- Cache: 60 seconds (real-time mode)
- Header: `X-Data-Source: database`

**GET /api/stats**
- Real-time statistics including conflict zones
- Returns: `totalLGAs`, `riskDistribution`, `conflictZones`, etc.

**GET /api/lga/:name**
- Individual LGA details with conflict status
- Includes `conflict_flag` and `last_conflict_event`

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Database configuration
DATABASE_URL=sqlite:///./poverty_hotspots.db
# For PostgreSQL: postgresql://user:password@localhost/iophin

# API server
PORT=5000
USE_DATABASE=true
```

### Scheduler Intervals

Edit `src/scheduler_service.py` to customize:

```python
# Conflict check: every 1 hour
scheduler.add_job(fetch_conflict_data, trigger=IntervalTrigger(hours=1))

# Satellite refresh: every 24 hours  
scheduler.add_job(fetch_latest_nightlights, trigger=IntervalTrigger(hours=24))

# Model retrain: every 6 hours
scheduler.add_job(run_ml_engine, trigger=IntervalTrigger(hours=6))
```

## Production Deployment

### Using Real APIs

Replace simulated functions with actual API calls:

**1. ACLED Conflict Data**

```python
def fetch_conflict_data():
    response = requests.get(
        'https://api.acleddata.com/acled/read',
        params={
            'key': 'YOUR_API_KEY',
            'country': 'Nigeria',
            'event_date': today,
            'event_date_where': '>'
        }
    )
    
    for event in response.json()['data']:
        if event['admin2']:  # LGA level
            upsert_conflict_flag(
                lga_name=event['admin2'],
                conflict_flag='CRITICAL'
            )
```

**2. NASA GIBS Nightlights**

```python
import ee
ee.Initialize()

def fetch_latest_nightlights():
    # Google Earth Engine approach
    image = ee.ImageCollection('NOAA/VIIRS/DNB/MONTHLY_V1/VCMSLCFG') \
        .filterDate('2024-01-01', '2024-12-31') \
        .select('avg_rad') \
        .mean()
    
    # Extract values for each LGA geometry
    # Update database with new values
```

### PostgreSQL for Production

1. Install PostgreSQL with PostGIS:
```bash
sudo apt-get install postgresql postgis
```

2. Update `DATABASE_URL`:
```env
DATABASE_URL=postgresql://user:password@localhost/iophin_db
```

3. The system auto-migrates to PostgreSQL schema

### Frontend Auto-Refresh

The frontend can use SWR or React Query for polling:

```typescript
import useSWR from 'swr';

function Dashboard() {
  const { data } = useSWR('/api/hotspots', fetcher, {
    refreshInterval: 60000  // Poll every 60 seconds
  });
  
  // Map automatically updates when data changes
}
```

## Monitoring

### Logs

The scheduler writes to:
- Console (stdout)
- `scheduler_service.log` file

Example log output:
```
2024-01-15 10:30:00 - INFO - 🔍 CONFLICT DATA LISTENER
2024-01-15 10:30:01 - WARNING - ⚠️  CONFLICT DETECTED in Zamfara North
2024-01-15 10:30:01 - INFO - ✅ Database updated: Zamfara North marked as CRITICAL
2024-01-15 11:00:00 - INFO - 🛰️  SATELLITE REFRESHER
2024-01-15 11:00:05 - WARNING - ⚡ Borno South: POWER OUTAGE detected
2024-01-15 11:00:05 - INFO - ✅ Updated 8 LGAs with new nightlight data
```

### Status Dashboard

The scheduler displays system status hourly:
```
📊 SYSTEM STATUS
Total LGAs monitored: 774
Risk Distribution:
  - High Risk: 180 LGAs
  - Medium Risk: 215 LGAs
  - Low Risk: 200 LGAs
  - Minimal Risk: 179 LGAs
Conflict Zones: 3 LGAs
Average MPI: 0.0567
Average Nightlight: 12.34
```

## Advantages Over Static System

| Feature | Static System | Dynamic System |
|---------|--------------|----------------|
| Data freshness | Manual update | Automatic (hourly/daily) |
| Conflict detection | Not supported | Real-time alerts |
| Response time | Days/weeks | Minutes/hours |
| Crisis response | Manual intervention | Automatic flagging |
| Data source | Local files | Live APIs |
| Scalability | Single snapshot | Continuous monitoring |

## Troubleshooting

**Database not found**
```bash
python -m src.migrate_to_db
```

**Scheduler not updating**
- Check logs in `scheduler_service.log`
- Verify database permissions
- Ensure scheduler process is running

**API returns static file**
- Check `USE_DATABASE=true` in environment
- Verify database file exists
- Check console for connection errors

## Next Steps

1. **Obtain API Keys**: Register for ACLED, NASA GIBS, or Google Earth Engine
2. **Implement Real Fetchers**: Replace simulated functions with actual API calls
3. **Deploy Scheduler**: Run as systemd service or Docker container
4. **Scale Database**: Migrate to PostgreSQL for production
5. **Add Alerting**: Email/SMS notifications for critical events

## References

- ACLED API: https://acleddata.com/
- NASA GIBS: https://gibs.earthdata.nasa.gov/
- Google Earth Engine: https://earthengine.google.com/
- APScheduler Docs: https://apscheduler.readthedocs.io/
