# IOPHIN Client — React Dashboard

Interactive web dashboard for visualizing Nigeria's poverty hotspots across 774 Local Government Areas.

## Quick Start

```bash
cd client
npm install
npm run dev
```

Dashboard available at **http://localhost:5173** (requires API server on port 5000).

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 7 | Build tool and dev server |
| Tailwind CSS | 4 | Utility-first styling |
| react-leaflet | 5 | Map components |
| Leaflet | 1.9 | Map rendering engine |
| Recharts | 3 | Charts and data visualization |
| Axios | 1.x | HTTP client |

## Architecture

### Components

```
src/
├── App.tsx                    Main layout, state management, view switching
├── main.tsx                   Application entry point
├── types.ts                   TypeScript type definitions (118 lines)
├── index.css                  Full design system (~1180 lines)
├── components/
│   ├── MapComponent.tsx       Interactive Leaflet map (~340 lines)
│   ├── Sidebar.tsx            Analytics panel (~630 lines)
│   ├── RankingsTable.tsx      LGA poverty rankings (~115 lines)
│   ├── StateOverview.tsx      State-level metrics (~75 lines)
│   ├── SearchBar.tsx          Unified search/filter (~180 lines)
│   └── Legend.tsx             Risk level color legend
└── contexts/
    └── ThemeContext.tsx        Dark/light theme management
```

### Views

The dashboard has three main views, switchable via desktop tabs or mobile bottom navigation:

1. **Map View** (default) — Interactive map with 774 LGA polygons colored by risk level
2. **Rankings View** — Table of LGAs ranked by composite poverty score
3. **State Overview** — Aggregated state-level metrics

### Data Flow

```
API Server (port 5000) ──► App.tsx (state management) ──► Child Components
                            │
                            ├── searchQuery ──► SearchBar, RankingsTable, StateOverview
                            ├── stateFilter ──► MapComponent, RankingsTable
                            ├── riskFilter ──► MapComponent, RankingsTable
                            ├── selectedLGA ──► MapComponent, Sidebar
                            └── activeView ──► View switching logic
```

## Features

### Interactive Map
- 774 LGA polygons with risk-level coloring (fillOpacity: 0.8)
- CARTO basemaps (dark/light, switches with theme)
- **Compact hover tooltip**: LGA name, state, risk badge, composite score, "Click for details"
  - `sticky: false` prevents tooltip stacking
- **Click action**: Opens sidebar with full LGA analytics
- **Auto-zoom**: Centers on selected LGA, zooms back on deselect
- **State zoom**: Zooms to state boundary when state filter applied
- **Filter key**: `filterKey` prop forces GeoJSON layer remount on filter changes

### Sidebar Panel
- **National Overview** (no selection): Risk distribution, top critical LGAs, averages
- **LGA Detail** (selected): Full analytics including:
  - Composite poverty score with progress bar
  - MPI, headcount ratio, intensity, severe poverty, senatorial MPI
  - Nightlight intensity
  - Infrastructure: health facilities, schools, road density
  - Environmental: NDVI, rainfall
  - Distance to urban center, population density
  - Displacement: IDP count, food price index
  - Conflict status and poverty probability
- **Close**: Clears selection, zooms back to full Nigeria view
- **Mobile**: Renders as slide-in drawer

### Rankings Table
- LGAs ranked by composite score (worst/best toggle)
- Filtered by search query, state filter, and risk filter
- Shows rank, LGA name, state, score, risk badge
- Filtered count indicator

### State Overview
- State-aggregated metrics from `/api/states`
- Filtered by search query
- Click to zoom map to that state

### Cross-View Search
- SearchBar filters all three views simultaneously
- `onSearchTermChange` propagates search text to Rankings and StateOverview
- `onSelect` zooms map to selected LGA
- Minimum 2 characters, max 10 dropdown results

### Theme Support
- Dark/light mode toggle in toolbar
- Persisted to `localStorage`
- CARTO basemap tiles switch automatically
- Full CSS variable system for both themes

### Responsive Design
- **Desktop**: Full layout with sidebar, toolbar, map
- **Mobile**:
  - Hamburger menu for sidebar access
  - Bottom navigation bar (Map/Rankings/States tabs)
  - Sidebar renders as drawer overlay
  - Map uses `visibility: hidden` (not `display: none`) when inactive — preserves Leaflet initialization

### Auto-Refresh
- 60-second polling interval for fresh data
- Re-fetches on filter changes
- Status indicators show data source and LGA count

## Risk Levels

| Level | Color | Hex |
|-------|-------|-----|
| Critical | Purple | `#7C3AED` |
| High | Red | `#EF4444` |
| Medium | Amber | `#F59E0B` |
| Low | Green | `#10B981` |
| Minimal | Blue | `#3B82F6` |

## Scripts

```bash
npm run dev        # Development server (localhost:5173)
npm run build      # Production build (TypeScript check + Vite build)
npm run preview    # Preview production build
npm run lint       # ESLint check
```

## Configuration

### `vite.config.ts`
- Dev server on port 5173
- API proxy to `http://localhost:5000`

### `tsconfig.json`
- Strict mode enabled
- Path aliases configured
- ES2020 target

### `tailwind.config.js`
- Custom color palette for risk levels
- Dark mode via class strategy
- Content paths configured for all TSX files

## Type System (`types.ts`)

Key types:
- `HotspotProperties` — All LGA properties (30+ fields)
- `HotspotFeature` — GeoJSON Feature with HotspotProperties
- `HotspotsGeoJSON` — FeatureCollection
- `RiskLevel` — `'Critical' | 'High' | 'Medium' | 'Low' | 'Minimal'`
- `RISK_COLORS` — Color mapping for risk levels
- `Stats` — Aggregate statistics
- `HistoryPoint` — Time-series data point
- `StateAggregation` — State-level metrics
- `RankingEntry` — Rankings table row
- `ViewMode` — `'map' | 'rankings' | 'states'`
