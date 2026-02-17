# Architecture Diagrams

## System Architecture: Static vs Dynamic

### Static Mode (Original)
```
┌─────────────────────────────────────────────┐
│          Static Architecture                │
├─────────────────────────────────────────────┤
│                                             │
│  Local Files          Python ML            │
│  ┌──────────┐       ┌──────────┐           │
│  │ viirs.tif │──────▶│ main.py  │           │
│  └──────────┘       │ K-Means  │           │
│  ┌──────────┐       └────┬─────┘           │
│  │ nga_mpi  │────────────┘                 │
│  │ .csv     │                              │
│  └──────────┘       ┌────────────┐         │
│                     │ hotspots   │         │
│                     │ .geojson   │         │
│                     └─────┬──────┘         │
│                           │                │
│  ┌───────────────────────┼──────────────┐ │
│  │  Node.js API          ▼              │ │
│  │  ┌─────────────────────────┐         │ │
│  │  │ fs.readFileSync()       │         │ │
│  │  │ /api/hotspots           │         │ │
│  │  └──────────┬──────────────┘         │ │
│  └─────────────┼────────────────────────┘ │
│                │                          │
│  ┌─────────────▼────────┐                │
│  │ React Dashboard      │                │
│  │ - Static data        │                │
│  │ - Manual refresh     │                │
│  └──────────────────────┘                │
│                                           │
│  ⚠️  Manual update required               │
│      (days/weeks)                         │
└─────────────────────────────────────────────┘
```

### Dynamic Mode (NEW ✨)
```
┌────────────────────────────────────────────────────────────────┐
│               Dynamic Real-Time Architecture                    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  External APIs (Live Data Sources)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ ACLED API    │  │ NASA GIBS    │  │ Google EE    │         │
│  │ (Conflict)   │  │ (Nightlight) │  │ (Satellite)  │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                 │
│         └─────────────────┼──────────────────┘                 │
│                           │                                    │
│         ┌─────────────────▼────────────────┐                   │
│         │  Python Scheduler Service        │                   │
│         │  (APScheduler - Continuous)      │                   │
│         ├──────────────────────────────────┤                   │
│         │  ⏰ Every 1 Hour:                 │                   │
│         │     fetch_conflict_data()        │                   │
│         │     - Detect crisis events       │                   │
│         │     - Flag LGAs as CRITICAL      │                   │
│         │                                  │                   │
│         │  ⏰ Every 24 Hours:               │                   │
│         │     fetch_latest_nightlights()   │                   │
│         │     - Update VIIRS data          │                   │
│         │     - Detect power outages       │                   │
│         │     - Track development          │                   │
│         │                                  │                   │
│         │  ⏰ Every 6 Hours:                │                   │
│         │     run_ml_engine()              │                   │
│         │     - Re-run K-Means             │                   │
│         │     - Recalculate risks          │                   │
│         └──────────┬───────────────────────┘                   │
│                    │                                            │
│                    ▼                                            │
│         ┌────────────────────┐                                 │
│         │ SQLite/PostgreSQL  │                                 │
│         │  Database          │                                 │
│         ├────────────────────┤                                 │
│         │ poverty_hotspots   │                                 │
│         │ ├─ lga_name        │                                 │
│         │ ├─ risk_level      │                                 │
│         │ ├─ conflict_flag   │  ◄── NEW: Real-time status     │
│         │ ├─ nightlight      │                                 │
│         │ ├─ last_updated    │  ◄── NEW: Auto-timestamp       │
│         │ └─ data_source     │  ◄── NEW: ML/API tracking      │
│         └──────────┬─────────┘                                 │
│                    │                                            │
│  ┌─────────────────┼──────────────────────────┐                │
│  │  Node.js API    ▼                          │                │
│  │  ┌───────────────────────────────┐         │                │
│  │  │ db.getHotspotsAsGeoJSON()     │         │                │
│  │  │ /api/hotspots                 │         │                │
│  │  │ Cache: 60 seconds (real-time) │         │                │
│  │  │ X-Data-Source: database       │         │                │
│  │  └──────────┬────────────────────┘         │                │
│  └─────────────┼──────────────────────────────┘                │
│                │                                                │
│  ┌─────────────▼────────────┐                                  │
│  │ React Dashboard          │                                  │
│  │ - Live data (auto-poll)  │                                  │
│  │ - 60s refresh            │                                  │
│  │ - Conflict alerts        │  ◄── NEW: Crisis indicators     │
│  │ - Trend visualization    │                                  │
│  └──────────────────────────┘                                  │
│                                                                 │
│  ✅ Automatic updates (minutes/hours)                           │
│  ✅ Crisis response enabled                                     │
│  ✅ "Nowcasting" capability                                     │
└────────────────────────────────────────────────────────────────┘
```

## Data Flow Sequence

### Conflict Detection Flow
```
1. ⏰ Scheduler Trigger (Every 1 Hour)
   │
   ▼
2. 🌐 API Call: requests.get('https://api.acleddata.com/...')
   │
   ▼
3. 🔍 Parse Response: Detect conflict events in Nigeria
   │
   ▼
4. ⚠️  Conflict Found: "Armed clash in Zamfara North"
   │
   ▼
5. 💾 Database Update:
   - conflict_flag = 'CRITICAL'
   - last_conflict_event = now()
   - risk_level = 'High' (elevated)
   │
   ▼
6. 📊 Frontend Update: Next API poll shows red zone
```

### Nightlight Update Flow
```
1. ⏰ Scheduler Trigger (Every 24 Hours)
   │
   ▼
2. 🛰️  Fetch VIIRS Data: NASA GIBS API or Google Earth Engine
   │
   ▼
3. 📉 Calculate Changes: Compare with previous values
   │
   ├─▶ Decrease > 30%: ⚡ Power Outage Detected
   ├─▶ Increase > 10%: 📈 Economic Development
   └─▶ Change < 5%:    Normal Variation
   │
   ▼
4. 💾 Database Update: mean_nightlight_intensity = new_value
   │
   ▼
5. 🤖 Trigger ML Retraining (if significant changes)
   │
   ▼
6. 🗺️  Map Updates: Risk levels recalculated
```

### ML Model Retraining Flow
```
1. ⏰ Scheduler Trigger (Every 6 Hours)
   │
   ▼
2. 📥 Fetch Latest Data: SELECT * FROM poverty_hotspots
   │
   ▼
3. 🧮 Feature Preparation:
   - KNN Imputation
   - StandardScaler
   - PCA (95% variance)
   │
   ▼
4. 🎯 K-Means Clustering:
   - n_clusters = 4
   - Silhouette Score validation
   │
   ▼
5. 🏷️  Assign Labels:
   - High Risk (low lights + high poverty)
   - Medium Risk
   - Low Risk
   - Minimal Risk
   │
   ▼
6. 💾 Database Update: All 774 LGAs with new clusters
   │
   ▼
7. 📊 Frontend Refresh: Updated risk distribution
```

## Database Schema

```sql
CREATE TABLE poverty_hotspots (
    -- Primary Key
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Identifiers (UNIQUE constraint on lga_name)
    lga_name VARCHAR(255) UNIQUE NOT NULL,
    state VARCHAR(100),
    latitude FLOAT,
    longitude FLOAT,
    
    -- Economic Indicators
    mean_nightlight_intensity FLOAT,      -- Proxy for economic activity
    
    -- Poverty Indicators (from MPI data)
    mpi FLOAT,                             -- Multidimensional Poverty Index
    headcount_ratio FLOAT,                 -- % in poverty
    intensity_of_deprivation FLOAT,        -- Severity of poverty
    in_severe_poverty FLOAT,               -- % in severe poverty
    vulnerable_to_poverty FLOAT,           -- At-risk population
    
    -- ML Model Outputs
    cluster INTEGER,                       -- K-Means cluster (0-3)
    cluster_label VARCHAR(100),            -- Human-readable label
    risk_level VARCHAR(50),                -- High, Medium, Low, Minimal
    
    -- NEW: Crisis Tracking
    conflict_flag VARCHAR(50) DEFAULT 'NORMAL',  -- NORMAL, ALERT, CRITICAL
    last_conflict_event DATETIME,         -- When conflict occurred
    
    -- Geometry (stored as JSON string)
    geometry TEXT,                         -- GeoJSON geometry
    
    -- NEW: Metadata
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(100) DEFAULT 'ML_MODEL'  -- ML_MODEL, API_REFRESH, CONFLICT_API
);

-- Indexes for performance
CREATE INDEX idx_risk_level ON poverty_hotspots(risk_level);
CREATE INDEX idx_conflict_flag ON poverty_hotspots(conflict_flag);
CREATE INDEX idx_state ON poverty_hotspots(state);
```

## Component Interactions

```
┌─────────────────────────────────────────────────────┐
│                  Components                          │
├─────────────────────────────────────────────────────┤
│                                                      │
│  scheduler_service.py (Always Running)              │
│  ├─ fetch_conflict_data() ──────▶ Database         │
│  ├─ fetch_latest_nightlights() ─▶ Database         │
│  └─ run_ml_engine() ─────────────▶ Database         │
│                                                      │
│  server/index.js (HTTP Server)                      │
│  ├─ GET /api/hotspots ───────────▶ Database Query  │
│  ├─ GET /api/stats ──────────────▶ Database Query  │
│  └─ GET /api/lga/:name ──────────▶ Database Query  │
│                                                      │
│  client/src (React App)                             │
│  ├─ useSWR('/api/hotspots', {                       │
│  │    refreshInterval: 60000  // Poll every minute  │
│  │  })                                              │
│  └─ Map auto-updates when data changes             │
│                                                      │
│  Database (poverty_hotspots.db)                     │
│  └─ Single source of truth for all components      │
└─────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌──────────────────────────────────────────────┐
│           Production Deployment               │
├──────────────────────────────────────────────┤
│                                               │
│  Cloud Server (AWS EC2 / Azure VM)           │
│  ┌─────────────────────────────────────────┐ │
│  │                                         │ │
│  │  Systemd Services:                      │ │
│  │  ├─ scheduler.service (background)      │ │
│  │  ├─ api.service (port 5000)             │ │
│  │  └─ nginx (reverse proxy, port 80)      │ │
│  │                                         │ │
│  │  PostgreSQL with PostGIS:               │ │
│  │  ├─ poverty_hotspots table              │ │
│  │  └─ Automatic backups                   │ │
│  │                                         │ │
│  │  Monitoring:                            │ │
│  │  ├─ PM2 for Node.js                     │ │
│  │  ├─ Supervisor for Python               │ │
│  │  └─ CloudWatch / Azure Monitor          │ │
│  │                                         │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  Frontend (Vercel / Netlify)                 │
│  ┌─────────────────────────────────────────┐ │
│  │ Static React build                      │ │
│  │ Connects to API server                  │ │
│  │ Auto-polling enabled                    │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```
