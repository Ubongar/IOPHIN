# IOPHIN — Implementation Summary (v3.0)

## Backend Summary

### API Server (`server/index.js`)
The server serves two route families:
- **Compatibility routes** at `/api/*` — for backward compatibility with v1.0 clients
- **Expanded routes** at `/api/v1/*` — for advanced features

### Security and Platform Middleware
- `helmet` — HTTP security headers
- `morgan` — request logging
- `cors` — cross-origin resource sharing
- `compression` — gzip response compression
- Rate limiting — 200 requests per 15 minutes (general), 20 per 15 minutes (auth)

### Redis Cache Integration
- Hot endpoints cached with configurable TTL
- Cache keys for: hotspots, stats, states, rankings
- Graceful fallback when Redis unavailable

### Authentication System (`server/auth.js`)
- JWT-based authentication with bcrypt password hashing
- Role-based access control: `admin`, `government`, `ngo`, `user`
- Protected write operations requiring authentication
- Token expiration and refresh support

### WebSocket Integration (`server/websocket.js`)
- Socket.IO initialization at server startup
- Real-time notifications for:
  - Risk level changes
  - New anomalies detected
  - Forecast escalations
  - System status updates

## Database Summary

### Core Tables
- `poverty_hotspots` — current LGA poverty data with spatial geometry
- `hotspot_history` — historical snapshots for trend analysis

### Operational Tables (`server/init.sql`)
| Table | Purpose |
|-------|---------|
| `risk_change_log` | Tracks risk level transitions over time |
| `anomaly_alerts` | Stores detected anomalies with acknowledgment status |
| `risk_forecasts` | Predicted risk levels for future periods |
| `interventions` | Intervention program tracking |
| `users` | User accounts with roles |
| `alert_subscriptions` | User alert preferences |
| `saved_views` | Shareable dashboard configurations |

### Materialized Views
- `mv_state_aggregation` — pre-computed state-level statistics
- `mv_risk_distribution` — risk tier distribution counts
- `mv_rankings` — pre-sorted LGA rankings

### Spatial Features
- PostGIS extension enabled
- Spatial indexes on geometry columns
- Radius-based queries supported

## Python Engine Summary

### Static Pipeline (`src/main.py`)
- Data loading from CSV and shapefile sources
- Feature extraction and enrichment
- Clustering with K-Means and HDBSCAN
- Risk tier assignment
- Output to CSV and GeoJSON formats

### Dynamic Scheduler (`src/scheduler_service.py`)
- Configurable job intervals via environment variables
- Scheduled jobs for:
  - Conflict data refresh (1h)
  - VIIRS nightlight processing (24h)
  - Infrastructure updates (6h)
  - ML model retraining (12h)
  - GRID3 boundary updates (168h/weekly)
  - NDVI processing (24h)
  - Rainfall data (24h)
  - Population updates (720h/monthly)
  - IDP tracking (168h/weekly)
  - Food price index (168h/weekly)
  - External enrichment (24h)
  - GEE environmental data (24h)

### Advanced Analytics Modules
- `predictive_model.py` — Time series forecasting with Prophet
- `anomaly_detection.py` — Anomaly detection with PyOD
- `advanced_model.py` — Advanced ML models (XGBoost, LightGBM)
- `spatial_statistics.py` — Spatial autocorrelation and clustering
- `temporal_analysis.py` — Temporal pattern analysis

### DB Migration (`src/migrate_to_db.py`)
- Upserts processed data into PostgreSQL
- Handles both inserts and updates
- Maintains history snapshots

## Frontend Summary

### Main Shell (`client/src/App.tsx`)
- Top-level navigation with 9 views
- Periodic data refresh (configurable interval)
- Filter state management (state, risk level, search)
- Theme toggle (dark/light mode)
- Authentication modal integration

### State Management (Zustand Stores)
| Store | Purpose |
|-------|---------|
| `useDataStore` | Hotspots, stats, rankings, anomalies, system status |
| `useFilterStore` | State filter, risk filter, search query, active view, tiering mode |
| `useMapStore` | Selected LGA, sidebar state |
| `useAlertStore` | Unread alert count |
| `useAuthStore` | Authentication state, user info |

### Component Architecture
```
App.tsx
├── Navigation Bar
│   ├── SearchBar
│   ├── Filters
│   ├── Risk Mode Toggle
│   └── Theme Toggle
├── Main Content Area
│   ├── MapComponent (map view)
│   ├── RankingsTable (rankings view)
│   ├── StateOverview (states view)
│   ├── InterventionTracker (interventions view)
│   ├── SeasonalCalendar (seasonal view)
│   ├── BudgetOptimizer (budget view)
│   ├── ReportBuilder (reports view)
│   ├── AlertsManager (alerts view)
│   └── DataQualityPanel (settings view)
├── Sidebar
│   ├── LGA Details
│   ├── AnomalyPanel
│   ├── CrisisCorridor
│   └── Leaderboard
└── Modals
    ├── AuthModal
    └── ScrollytellingTour
```

### Key Components
| Component | File | Description |
|-----------|------|-------------|
| Map | `MapComponent.tsx` | Leaflet choropleth with risk layers |
| Sidebar | `Sidebar.tsx` | LGA detail panel with tabs |
| Rankings | `RankingsTable.tsx` | Sortable/filterable table |
| Anomalies | `AnomalyPanel.tsx` | Anomaly list with acknowledgment |
| Interventions | `InterventionTracker.tsx` | CRUD for intervention programs |
| Budget | `BudgetOptimizer.tsx` | Resource allocation tool |
| Reports | `ReportBuilder.tsx` | PDF generation interface |
| Alerts | `AlertsManager.tsx` | Subscription management |
| Crisis Corridor | `CrisisCorridor.tsx` | Geographic crisis analysis |
| Leaderboard | `Leaderboard.tsx` | Comparative performance |
| Data Quality | `DataQualityPanel.tsx` | Data freshness metrics |
| Tour | `ScrollytellingTour.tsx` | Interactive onboarding |

## Risk Tiering Modes

### Cluster Mode (Default)
- LGAs clustered by composite poverty score, nightlights, and other indicators
- Clusters ranked to assign tiers: Critical, High, Medium, Low, Minimal
- Relative, context-aware classification

### Absolute Mode
- Fixed numeric thresholds on `composite_poverty_score`
- Configurable via environment variables:
  - `THRESHOLD_MINIMAL` (default: 0.05)
  - `THRESHOLD_LOW` (default: 0.10)
  - `THRESHOLD_MEDIUM` (default: 0.20)
  - `THRESHOLD_HIGH` (default: 0.40)
  - `THRESHOLD_CRITICAL` (default: 1.0)

### UI Toggle
- Frontend toolbar toggle between Relative/Absolute modes
- Persisted to localStorage
- Can sync to server via `POST /api/config` (admin only)

## Build/Run Summary

### Development
```bash
# API
cd server && npm run dev

# Client
cd client && npm run dev

# Scheduler
python -m src.scheduler_service
```

### Production
```bash
# Docker stack
docker compose up --build

# Or manual
cd server && npm start
cd client && npm run build && npm run preview
```

### Environment Requirements
- Python 3.11+ (3.9+ supported)
- Node.js 18+
- PostgreSQL 14+ with PostGIS
- Redis 7+
