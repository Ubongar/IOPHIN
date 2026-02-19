# IOPHIN Client

React + TypeScript dashboard for geospatial poverty intelligence and operational decision support.

## Run

```bash
cd client
npm install
npm run dev
```

Client default URL: `http://localhost:5173`

## Current Frontend Stack

- React 19
- TypeScript 5.x
- Vite 7
- Tailwind CSS 4
- Leaflet / react-leaflet
- Recharts
- Zustand
- socket.io-client

## Main App Structure

- `src/App.tsx`: top-level shell, nav, filters, polling, orchestration.
- `src/store/`: Zustand stores (`data`, `filters`, `auth`, `alerts`, `map`).
- `src/hooks/useWebSocket.ts`: WebSocket client hook.
- `src/components/`: visual/analytical modules.

## Active Navigation Views

- Map
- Rankings
- State Overview
- Interventions
- Seasonal
- Budget Optimizer
- Reports
- Alerts
- Data Quality

## Key Components in Current Build

- `MapComponent.tsx`
- `Sidebar.tsx`
- `RankingsTable.tsx`
- `StateOverview.tsx`
- `AnomalyPanel.tsx`
- `InterventionTracker.tsx`
- `SeasonalCalendar.tsx`
- `BudgetOptimizer.tsx`
- `ReportBuilder.tsx`
- `AlertsManager.tsx`
- `CrisisCorridor.tsx`
- `Leaderboard.tsx`
- `DataQualityPanel.tsx`
- `ScrollytellingTour.tsx`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

## API Expectation

`App.tsx` points to:
- `VITE_API_URL` if present
- fallback: `http://localhost:5000/api`

Ensure backend is running for full feature availability.
