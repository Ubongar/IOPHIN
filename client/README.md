# IOPHIN Client — React Dashboard (v4.0)

## Overview

Single-page React application providing an interactive geospatial dashboard for poverty risk monitoring across Nigeria's 774 LGAs. Built with React 19, TypeScript, Vite, and Tailwind CSS.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 7 | Dev server + build |
| Tailwind CSS | 4 | Utility-first styling |
| Leaflet | 1.9 | Choropleth map rendering |
| MapLibre GL JS | 5.x | WebGL/3D map rendering |
| Recharts | 2.15 | Charts and data visualization |
| Zustand | 4.5 | Lightweight state management |
| Socket.IO Client | 4.8 | Real-time WebSocket events |
| Turf.js | 7 | Client-side geospatial calculations |
| jsPDF | 2.5 | Client-side PDF export |

## Quick Start

```bash
cd client
npm install
npm run dev       # Dev server at http://localhost:3000
npm run build     # Production build to dist/
npm run preview   # Preview production build
```

## Environment Variables

Create `.env` in `client/`:
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=http://localhost:5000
```

## Project Structure

```
client/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
├── eslint.config.js
├── nginx.conf              # Production nginx configuration
├── Dockerfile              # Multi-stage build (npm build -> nginx)
├── public/                 # Static assets
└── src/
    ├── main.tsx            # Entry point
    ├── App.tsx             # Root component + routing
    ├── index.css           # Global + Tailwind styles
    ├── types.ts            # Shared TypeScript interfaces
    ├── assets/             # Images, icons
    ├── components/         # 26 UI components
    ├── contexts/           # React contexts (ThemeContext)
    ├── hooks/              # Custom hooks (useWebSocket)
    ├── store/              # 5 Zustand stores
    └── utils/              # Utility functions (riskTiers)
```

## Navigation Views (10)

| Key | Label | Component(s) | Description |
|-----|-------|-------------|-------------|
| `map` | Poverty Map | MapComponent, FieldView, Legend, ChoroplethToggle | Interactive choropleth + 3D terrain |
| `rankings` | Rankings | RankingsTable, Leaderboard | Searchable LGA ranking table |
| `states` | State View | StateAnalytics | State-level aggregation charts |
| `interventions` | Interventions | InterventionTracker | Aid program CRUD + tracking |
| `seasonal` | Seasonal | SeasonalAnalytics | Temporal trend analysis |
| `budget` | Budget | BudgetOptimizer | Budget allocation optimization |
| `reports` | Reports | ReportBuilder | PDF report generation |
| `alerts` | Alerts | AlertsManager | Alert subscriptions + notifications |
| `settings` | Data Quality | DataQualityPanel | Data completeness, freshness monitoring |
| `users` | Users | UserManagementPanel | User CRUD, roles, geographic scoping |

## Components (26)

### Map & Visualization
| Component | Description |
|-----------|-------------|
| `MapComponent.tsx` | Leaflet choropleth map with risk-tier coloring |
| `FieldView.tsx` | MapLibre GL 3D terrain visualization |
| `Legend.tsx` | Dynamic color scale + risk tier legend |
| `ChoroplethToggle.tsx` | Map layer toggle controls |
| `CorrelationScatter.tsx` | Recharts scatter plot for variable correlation |
| `RadarComparison.tsx` | Multi-axis radar chart for LGA comparison |
| `CrisisCorridor.tsx` | Risk corridor visualization |

### Data Display
| Component | Description |
|-----------|-------------|
| `RankingsTable.tsx` | Searchable, sortable, filterable LGA table |
| `Leaderboard.tsx` | Top/bottom performing LGAs |
| `StateAnalytics.tsx` | State drill-down with charts |
| `SeasonalAnalytics.tsx` | Temporal patterns + seasonal trends |
| `AnomalyPanel.tsx` | Anomaly alert list + acknowledge actions |
| `DataQualityPanel.tsx` | Data completeness, missing value metrics |

### Interactive
| Component | Description |
|-----------|-------------|
| `SearchBar.tsx` | Global search with autocomplete |
| `SidePanel.tsx` | Detail panel for selected LGA |
| `Sidebar.tsx` | Main navigation + view switcher |
| `InterventionTracker.tsx` | Intervention CRUD interface |
| `BudgetOptimizer.tsx` | Budget allocation tool |
| `AlertsManager.tsx` | Alert subscription management |

### Reporting & Admin
| Component | Description |
|-----------|-------------|
| `ReportBuilder.tsx` | Configurable PDF report builder |
| `ScrollytellingTour.tsx` | Guided onboarding walkthrough |
| `ThemeToggle.tsx` | Dark/light mode toggle |
| `AuthModal.tsx` | Login/register dialog |
| `UserManagementPanel.tsx` | User management + RBAC admin |

### Utility
| Component | Description |
|-----------|-------------|
| `TimeSlider.tsx` | Temporal navigation control |
| `TierToggle.tsx` | Cluster/absolute risk tier mode switch |

## State Management (Zustand)

### `useDataStore`
Hotspot data, statistics, rankings, state aggregations, tiering mode, loading/error state.

### `useFilterStore`
Selected state, selected LGA, risk filter, search query, date range.

### `useMapStore`
Map center, zoom level, selected feature, layer mode (2D/3D), base map.

### `useAuthStore`
User profile, JWT token, authentication state, role, permissions, login/logout methods.

### `useAlertStore`
Alerts array, subscriptions, anomalies, unread count, WebSocket-driven updates.

## Real-Time Updates

The `useWebSocket` hook (in `hooks/useWebSocket.ts`) manages Socket.IO connections:
- Auto-connects to the API server
- Subscribes to `lga:{name}` and `state:{name}` rooms
- Dispatches `alert`, `lga-update`, and `state-update` events to Zustand stores
- Auto-reconnects on disconnect

## Theming

Dark/light mode via `ThemeContext` in `contexts/ThemeContext.tsx`:
- Persists to `localStorage`
- Applies `dark` class to `<html>` for Tailwind `dark:` variants
- Toggled via `ThemeToggle` component

## Risk Tier Visualization

Colors defined in `utils/riskTiers.ts`:
| Tier | Color | Score Range (Absolute) |
|------|-------|------------------------|
| Critical | `#dc2626` (red-600) | > 0.40 |
| High | `#f97316` (orange-500) | 0.20 - 0.40 |
| Medium | `#eab308` (yellow-500) | 0.10 - 0.20 |
| Low | `#22c55e` (green-500) | 0.05 - 0.10 |
| Minimal | `#3b82f6` (blue-500) | < 0.05 |

Cluster mode uses the same colors but tiers are determined by ML clustering rather than fixed thresholds.

## Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build    # Output in dist/
```

### Docker
```dockerfile
# Multi-stage: Node build -> nginx serve
FROM node:22-alpine AS build
FROM nginx:1.25-alpine AS production
```

The `nginx.conf` handles SPA routing (fallback to `index.html`) and API proxying to the backend.

## Linting & Type Checking

```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript check
```

---

## Recent test results & artifacts

The frontend can use the generated test artifacts for report screenshots and evidence. Key items:

- [CACHING_VALIDATION_REPORT.md](../CACHING_VALIDATION_REPORT.md)
- [CACHING_QUICK_REFERENCE.md](../CACHING_QUICK_REFERENCE.md)
- [POSTGIS_REDIS_TESTING_GUIDE.md](../POSTGIS_REDIS_TESTING_GUIDE.md)
- Results/images: `../results/perf/` (e.g. [../results/perf/cache_stats.png](../results/perf/cache_stats.png), [../results/perf/jmeter_html_short/index.html](../results/perf/jmeter_html_short/index.html))

Use the quick image generator to regenerate charts locally:

```bash
python scripts/generate_stats_image.py --input results/perf/redis_cache_test.json --output results/perf/cache_stats.png
```
