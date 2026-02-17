# Quick Start Guide - Dynamic Real-Time Monitoring

This guide will get you up and running with the dynamic monitoring system in 5 minutes.

## Prerequisites

- Python 3.9+ installed
- Existing IOPHIN data (from running `python -m src.main`)
- Terminal access

## Step 1: Install Dependencies

```bash
pip install -r requirements.txt
```

This installs:
- sqlalchemy (database ORM)
- apscheduler (task scheduling)
- requests (API calls)
- psycopg2-binary (PostgreSQL support)
- All existing ML dependencies

## Step 2: Initialize Database

First, ensure you have the initial data:

```bash
# If you haven't already, run the ML model
python -m src.main
```

Then migrate to database:

```bash
python -m src.migrate_to_db
```

Expected output:
```
✅ Database schema created
✅ Migration complete: 774 records
```

This creates `poverty_hotspots.db` in the project root.

## Step 3: Start the Scheduler

```bash
python -m src.scheduler_service
```

You'll see:
```
🚀 STARTING DYNAMIC MONITORING SERVICE
================================================================================
📊 SYSTEM STATUS
Total LGAs monitored: 774
Risk Distribution:
  - High Risk: 221 LGAs
  - Medium Risk: 263 LGAs
  - Low Risk: 201 LGAs
  - Minimal Risk: 89 LGAs
Conflict Zones: 0 LGAs
Average MPI: 0.1741
Average Nightlight: 0.38
================================================================================
✅ Scheduled: Conflict Listener (every 1 hour)
✅ Scheduled: Satellite Refresher (every 24 hours)
✅ Scheduled: ML Model Retraining (every 6 hours)
✅ SCHEDULER SERVICE IS NOW RUNNING
```

The service will:
- Check for conflicts every hour
- Update nightlight data every 24 hours
- Retrain the ML model every 6 hours
- Display status every hour

## Step 4: Query the Database

While the scheduler is running (in another terminal):

```bash
python -c "
from src.db_utils import get_statistics
import json
stats = get_statistics()
print(json.dumps(stats, indent=2))
"
```

Or query specific data:

```bash
python -c "
from src.db_utils import get_all_hotspots
hotspots = get_all_hotspots()
print(f'Total LGAs: {len(hotspots)}')
print(f'First LGA: {hotspots[0][\"LGA_Name\"]}')
"
```

## What's Happening?

### Conflict Listener (Every 1 Hour)

Simulates checking ACLED API for conflict events:
- 10% chance of detecting a conflict per run
- Affected LGAs are flagged as "CRITICAL"
- Risk levels automatically elevated

Example output:
```
🔍 CONFLICT DATA LISTENER
⚠️  CONFLICT DETECTED in Zamfara North
   Event Type: Armed Clash
   Severity: HIGH
   Action: Flagging LGA as CRITICAL
✅ Database updated
```

### Satellite Refresher (Every 24 Hours)

Simulates fetching latest VIIRS nightlight data:
- Updates 5-10 random LGAs per run
- Simulates power outages (-30% to -50%)
- Tracks development (+10% to +30%)
- Normal variations (±5%)

Example output:
```
🛰️  SATELLITE REFRESHER
📊 Simulating nightlight changes for 8 LGAs...
   ⚡ Borno South: POWER OUTAGE detected
      Nightlight: 12.5 → 7.8 (-37.6%)
   📈 Lagos Mainland: Economic activity increasing
      Nightlight: 25.3 → 30.4 (+20.2%)
✅ Updated 8 LGAs
```

### ML Model Retraining (Every 6 Hours)

Re-runs K-Means clustering on updated data:
```
🤖 ML ENGINE - Retraining model
📊 Retraining model with 774 LGAs and 5 features
✅ Model retrained successfully
   Silhouette Score: 0.4350
✅ Database updated with new risk classifications
```

## Verifying It's Working

### Check the Database

```bash
# Count records
sqlite3 poverty_hotspots.db "SELECT COUNT(*) FROM poverty_hotspots;"

# Check conflict zones
sqlite3 poverty_hotspots.db "SELECT lga_name, conflict_flag FROM poverty_hotspots WHERE conflict_flag != 'NORMAL';"

# View recent updates
sqlite3 poverty_hotspots.db "SELECT lga_name, last_updated FROM poverty_hotspots ORDER BY last_updated DESC LIMIT 5;"
```

### Monitor Logs

The scheduler writes to:
- Console output (stdout)
- `scheduler_service.log` file

```bash
# Tail the log file
tail -f scheduler_service.log
```

## Stop the Scheduler

Press `Ctrl+C` in the terminal running the scheduler:

```
^C
🛑 Shutting down scheduler service...
✅ Service stopped gracefully
```

## Customizing Update Intervals

Edit `src/scheduler_service.py`:

```python
# Conflict check: every 30 minutes instead of 1 hour
scheduler.add_job(
    self.fetch_conflict_data,
    trigger=IntervalTrigger(minutes=30),
    id='conflict_listener'
)

# Satellite refresh: every 12 hours instead of 24
scheduler.add_job(
    self.fetch_latest_nightlights,
    trigger=IntervalTrigger(hours=12),
    id='satellite_refresher'
)
```

## Next Steps

1. **Connect Real APIs**: Replace simulated functions in `scheduler_service.py` with actual API calls to ACLED, NASA GIBS, etc.

2. **Production Database**: Switch from SQLite to PostgreSQL by setting:
   ```bash
   export DATABASE_URL="postgresql://user:pass@localhost/iophin"
   ```

3. **Deploy as Service**: Use systemd or Docker to run scheduler continuously

4. **Add Alerting**: Implement email/SMS notifications for critical events

5. **Frontend Integration**: Update React app to poll `/api/hotspots` every 60 seconds for real-time updates

## Troubleshooting

**Database not found**
```bash
python -m src.migrate_to_db
```

**Import errors**
```bash
pip install -r requirements.txt
```

**Scheduler not updating**
- Check `scheduler_service.log` for errors
- Verify database file permissions
- Ensure scheduler process is running

## Full Documentation

See [DYNAMIC_MONITORING.md](DYNAMIC_MONITORING.md) for complete architecture details and production deployment guide.
