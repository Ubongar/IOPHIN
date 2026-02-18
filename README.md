<p align="center">
  <img src="https://img.shields.io/badge/IOPHIN-Poverty%20Hotspot%20Intelligence-7C3AED?style=for-the-badge&labelColor=13131A" alt="IOPHIN" />
</p>

<h1 align="center">IOPHIN — Poverty Hotspot Identifier for Nigeria</h1>

<p align="center">
  <strong>A real-time geospatial intelligence dashboard that identifies, monitors, and visualizes poverty hotspots across Nigeria's 774 Local Government Areas using machine learning and multi-source satellite data.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-4.1-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Leaflet-1.9-199900?style=flat-square&logo=leaflet&logoColor=white" alt="Leaflet" />
  <img src="https://img.shields.io/badge/Express-4.18-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Python-3.9+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/scikit--learn-1.2-F7931E?style=flat-square&logo=scikitlearn&logoColor=white" alt="scikit-learn" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

**IOPHIN** (Identification Of Poverty Hotspots In Nigeria) combines satellite nightlight imagery, multidimensional poverty indices, infrastructure data, environmental metrics, and conflict displacement statistics into a unified composite poverty model. The system clusters Nigeria's 774 LGAs into five risk tiers using HDBSCAN, then serves the results through an interactive React dashboard with real-time monitoring capabilities.

The platform is designed for policymakers, NGOs, and researchers working on poverty alleviation in Nigeria — providing actionable intelligence through an intuitive, data-rich interface.

---

## Key Features

### 🗺️ Interactive Geospatial Map
- **Choropleth risk overlay** — 774 LGA boundaries colored by 5-tier risk classification
- **Theme-aware basemaps** — CARTO Dark Matter (dark mode) and CARTO Positron (light mode)
- **Smart interactions** — Hover highlights with compact tooltips; click to zoom and inspect
- **Auto-zoom** — Clicking an LGA smoothly flies to its bounds; clicking away returns to national view
- **Collapsible floating legend** — Risk classification key with composite score ranges

### 📊 Analytics Sidebar
- **National Summary Mode**
  - Total LGAs monitored, states covered, mean MPI, average nightlight intensity
  - Interactive donut chart (Recharts) showing risk tier distribution
  - Horizontal progress bars for each risk level with counts and percentages
  - Conflict zone alert banner with animated pulse indicator
  - Downloadable national summary report (`.txt`)

- **LGA Profile Mode** (click any LGA on the map)
  - Risk level badge, conflict alert status, last-updated timestamp
  - **Core Metrics** — MPI, Nightlight Intensity, Composite Score, Population Density, Headcount Ratio, Intensity of Deprivation
  - **Poverty Depth** — Severe Poverty rate, Senatorial MPI, Urban Distance
  - **Infrastructure** — Health facility count, school count, road density
  - **Environment & Displacement** — NDVI (vegetation), rainfall, IDP count, food price index
  - **Poverty Probability Gauge** — Animated arc gauge (70% MPI + 30% inverse nightlight)
  - **Comparative Analysis** — Bar chart comparing LGA metrics vs national averages
  - Downloadable per-LGA intelligence report (`.txt`)

### 📋 Rankings View
- Sortable table of all 774 LGAs ranked by composite poverty score
- Toggle between **Most Deprived** and **Least Deprived** ordering
- Columns: Rank, LGA, State, Composite Score, MPI, Nightlight, Risk Level, Health Facilities, Schools
- Click any row to navigate to that LGA on the map

### 🏛️ State Overview
- Aggregated state-level analytics across all 37 states
- Metrics: LGA count, average composite score, average MPI, average nightlight, high-risk count, total health facilities, total schools
- Click any state to zoom to its LGAs on the map

### 🔍 Cross-View Search & Filtering
- **Unified search bar** — Searches LGAs and states across all views simultaneously
- **State filter** — Dropdown to filter by any of Nigeria's 37 states
- **Risk filter** — Filter by any of the 5 risk tiers
- Filters propagate across Map, Rankings, and State Overview in real time

### 🌓 Dark / Light Theme
- Full dark mode (true-black `#0A0A0F` background) and light mode
- Theme persisted in `localStorage` and toggled via toolbar button
- All components, map tiles, tooltips, and overlays adapt to theme
- Glassmorphism effects throughout (frosted glass with `backdrop-filter: blur`)

### 📡 Real-Time Monitoring
- **60-second auto-polling** — Dashboard data refreshes automatically
- **Status indicators** — Live system status chip with animated pulse dot
- **Data source chips** — Shows active data sources (PostgreSQL, Satellite, MPI, Infrastructure)
- Conflict zone count displayed in toolbar

### 📱 Mobile-First Responsive Design
- **5 responsive breakpoints** — 1400px, 1200px, 1024px, 768px, 480px
- **Mobile bottom navigation** — Fixed bottom tab bar for view switching on phones
- **Sidebar drawer** — Slides in from left with backdrop overlay on mobile
- **Hamburger menu** — Replaces icon rail on small screens
- Columns hidden progressively (Nightlight, Health, Schools) on smaller screens

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Search   │  │    Map     │  │ Rankings │  │   Sidebar    │  │
│  │   Bar     │  │ (Leaflet)  │  │  Table   │  │  (Analytics) │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘  │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Legend   │  │   State    │  │  Theme   │  │   Toolbar    │  │
│  │          │  │  Overview  │  │ Context  │  │  (Filters)   │  │
│  └──────────┘  └────────────┘  └──────────┘  └──────────────┘  │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTP / REST API
┌───────────────────────┴─────────────────────────────────────────┐
│                    Express API Server                            │
│         /api/hotspots · /api/stats · /api/rankings              │
│        /api/states · /api/lga/:name · /api/history/:lga         │
└───────────────────────┬─────────────────────────────────────────┘
                        │
          ┌─────────────┴──────────────┐
          │                            │
  ┌───────┴────────┐         ┌────────┴────────┐
  │  PostgreSQL DB │         │  GeoJSON File   │
  │  (Primary)     │         │  (Fallback)     │
  └───────┬────────┘         └─────────────────┘
          │
┌─────────┴──────────────────────────────────────────┐
│              Python ML Engine                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │
│  │  Feature  │  │ HDBSCAN  │  │  Google Earth    │ │
│  │ Extraction│  │ Cluster  │  │  Engine (VIIRS)  │ │
│  └──────────┘  └──────────┘  └───────────────────┘ │
│  Data Sources: MPI · Nightlight · Infrastructure   │
│  · Conflict/IDP · NDVI · Rainfall · Food Prices    │
└────────────────────────────────────────────────────┘
```

---

## Risk Classification System

The composite poverty model produces a score from 0 to 1 for each LGA, classified into five tiers:

| Tier | Label | Score Range | Color | Hex |
|------|-------|-------------|-------|-----|
| 🟣 Critical | Extreme Deprivation | > 0.80 | Purple | `#7C3AED` |
| 🔴 High | Severe Poverty | 0.60 – 0.80 | Red | `#EF4444` |
| 🟡 Medium | Significant Deprivation | 0.40 – 0.60 | Amber | `#F59E0B` |
| 🟢 Low | Moderate Vulnerability | 0.20 – 0.40 | Green | `#10B981` |
| 🔵 Minimal | Relatively Stable | < 0.20 | Blue | `#3B82F6` |

**Composite Score Formula:**

$$\text{Score} = 0.30 \times \text{MPI} + 0.25 \times (1 - \text{Nightlight}) + 0.15 \times \text{Health} + 0.15 \times \text{Education} + 0.15 \times \text{Infrastructure}$$

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2 | UI framework with hooks and functional components |
| TypeScript | 5.9 | Type-safe development |
| Vite | 7.3 | Build tooling and dev server |
| Tailwind CSS | 4.1 | Utility-first CSS framework |
| Leaflet + react-leaflet | 1.9 / 5.0 | Interactive choropleth map |
| Recharts | 3.7 | Donut charts and data visualization |
| Axios | 1.13 | HTTP client for API calls |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js + Express | 4.18 | REST API server |
| PostgreSQL (`pg`) | 8.18 | Primary database driver |
| express-rate-limit | 8.2 | API rate limiting |
| compression | 1.7 | gzip response compression |
| dotenv | 16.6 | Environment variable management |

### ML & Data Pipeline
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.9+ | ML engine runtime |
| scikit-learn | 1.2+ | Feature scaling, model evaluation |
| HDBSCAN | 0.8+ | Density-based spatial clustering |
| GeoPandas | 0.13+ | Geospatial data manipulation |
| Rasterio | 1.3+ | Satellite raster processing |
| SQLAlchemy | 2.0+ | ORM for PostgreSQL |
| Earth Engine API | 0.1+ | VIIRS nightlight, NDVI, rainfall data |
| APScheduler | — | Recurring model refresh scheduling |

---

## UI Component Architecture

```
App.tsx                          ← Main layout, state management, view routing
├── ThemeContext                  ← Dark/light theme provider (localStorage)
├── SearchBar                    ← Unified search with autocomplete dropdown
├── Toolbar                      ← Filters, status chips, theme toggle
├── Icon Rail                    ← Navigation: Map / Rankings / States
├── Sidebar                      ← National summary or LGA drill-down
│   ├── MetricCard[]             ← Reusable stat display component
│   ├── PieChart (Recharts)      ← Risk distribution donut
│   ├── Poverty Gauge            ← Animated probability arc
│   └── Comparative Analysis     ← LGA vs national average bars
├── MapComponent                 ← Leaflet map with GeoJSON overlay
│   ├── FitBounds                ← Auto-zoom to selected feature bounds
│   ├── MapInstanceCapture       ← ResizeObserver for responsive resize
│   └── Legend                   ← Floating, collapsible risk key
├── RankingsTable                ← Sortable, filterable LGA table
└── StateOverview                ← State-level aggregation table
```

Each component is self-contained with TypeScript interfaces and accepts filter props from `App.tsx` for cross-view data consistency.

---

## Design System

### Color Palette

**Dark Theme (Default)**
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#0A0A0F` | Page background |
| `--bg-rail` | `#101018` | Icon rail |
| `--bg-sidebar` | `#12121C` | Sidebar panel |
| `--bg-panel` | `#1A1A28` | Cards, dropdowns |
| `--border` | `rgba(255,255,255,0.08)` | Dividers |
| `--text-primary` | `#FFFFFF` | Headings |
| `--text-secondary` | `#E2E8F0` | Body text |
| `--text-tertiary` | `#94A3B8` | Labels |
| `--text-quaternary` | `#64748B` | Muted, captions |

**Light Theme**
| Token | Value | Usage |
|---|---|---|
| `--bg` | `#F8FAFC` | Page background |
| `--bg-rail` | `#FFFFFF` | Icon rail |
| `--bg-sidebar` | `#FFFFFF` | Sidebar panel |
| `--bg-panel` | `#F1F5F9` | Cards, dropdowns |
| `--text-primary` | `#0F172A` | Headings |
| `--text-secondary` | `#1E293B` | Body text |

### Typography
- **Primary font:** Inter (system fallback stack)
- **Monospace font:** JetBrains Mono — used for metric values, scores, and table data
- **Scale:** 10px (micro labels) → 22px (main headings), 4px base grid

### Visual Effects
- **Glassmorphism** — `backdrop-filter: blur(16px–20px)` on status chips, search overlays, legend, bottom nav
- **Animations** — `fade-in-up` (sidebar entry), `spin` (loading spinner), `pulse-dot` (system status)
- **Border radius** — `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`

### Layout System
| Zone | Width | Behavior |
|---|---|---|
| Icon Rail | 56px fixed | Left navigation column |
| Sidebar Panel | 380px fixed | Analytics panel, scrollable |
| Main Content | `flex: 1` | Map, rankings, or state view |

---

## Responsive Breakpoints

| Breakpoint | Layout Changes |
|---|---|
| **≥ 1400px** | Sidebar expands to 400px, larger padding |
| **≤ 1200px** | Sidebar shrinks to 320px |
| **≤ 1024px** | Sidebar 290px, tighter spacing |
| **≤ 768px** | Icon rail hidden; sidebar becomes slide-in drawer with backdrop; mobile bottom nav appears; toolbar adapts to stacked layout |
| **≤ 480px** | Sidebar fills 100vw; extra-compact padding; search/filter widths reduced |

On mobile devices, view switching happens via a fixed bottom navigation bar. The sidebar is accessible through a hamburger menu button and slides in from the left with a semi-transparent backdrop overlay.

---

## Quick Start

### Prerequisites
- **Node.js** 18+ and npm
- **Python** 3.9+
- **PostgreSQL** 14+ (optional — falls back to GeoJSON file)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/iophin.git
cd iophin

# Backend
cd server
npm install

# Frontend
cd ../client
npm install

# ML Engine (optional)
cd ..
pip install -r requirements.txt
```

### 2. Configure Environment

Create `server/.env`:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=iophin_db
DB_USER=postgres
DB_PASSWORD=your_password
PORT=5000
```

### 3. Run

```bash
# Terminal 1 — API server
cd server
npm run dev          # runs on :5000

# Terminal 2 — Frontend
cd client
npm run dev          # runs on :5173
```

Open **http://localhost:5173** in your browser.

> **No database?** The server automatically falls back to the bundled `data/processed/hotspots.geojson` file if PostgreSQL is unavailable.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/hotspots` | All LGA hotspots as GeoJSON FeatureCollection |
| `GET` | `/api/stats` | Aggregate statistics (risk distribution, conflict zones, averages) |
| `GET` | `/api/rankings` | All LGAs ranked by composite poverty score |
| `GET` | `/api/states` | State-level aggregated metrics |
| `GET` | `/api/lga/:name` | Detailed data for a specific LGA |
| `GET` | `/api/history/:lga` | Historical trend data for a specific LGA |

All endpoints return JSON. The server uses CORS, gzip compression, and rate limiting (100 req/15 min).

---

## Data Sources

| Source | Metrics | Update Frequency |
|---|---|---|
| **VIIRS Nightlight** (Google Earth Engine) | Mean nightlight intensity | Monthly |
| **Nigeria MPI** (OPHI/NBS) | Multidimensional Poverty Index, headcount ratio, deprivation intensity | Annual |
| **GRID3 Nigeria** | LGA boundary shapefiles (774 LGAs) | Static |
| **DTM Baseline Assessment** | IDP counts, displacement data | Quarterly |
| **Health & Education Registries** | Facility counts, school counts | Periodic |
| **Senatorial District MPI** | Sub-national poverty granularity | Annual |
| **NDVI / Rainfall** (Earth Engine) | Vegetation index, precipitation | Monthly |
| **Road Network Data** | Road density per LGA | Static |
| **Food Price Index** | Consumer food price tracking | Monthly |

---

## Project Structure

```
iophin/
├── client/                        # React frontend
│   ├── src/
│   │   ├── App.tsx                # Main app — layout, state, routing
│   │   ├── main.tsx               # Entry point with ThemeProvider
│   │   ├── index.css              # Full design system (~1,200 lines)
│   │   ├── types.ts               # TypeScript interfaces & constants
│   │   ├── components/
│   │   │   ├── MapComponent.tsx   # Leaflet choropleth map
│   │   │   ├── Sidebar.tsx        # Analytics sidebar (national + LGA)
│   │   │   ├── RankingsTable.tsx  # LGA rankings table
│   │   │   ├── StateOverview.tsx  # State aggregation table
│   │   │   ├── SearchBar.tsx      # Search with autocomplete
│   │   │   └── Legend.tsx         # Floating map legend
│   │   └── contexts/
│   │       └── ThemeContext.tsx    # Dark/light theme provider
│   ├── package.json
│   └── vite.config.ts
├── server/                        # Express API server
│   ├── index.js                   # Routes, middleware, dual-mode data
│   ├── database.js                # PostgreSQL queries
│   └── package.json
├── src/                           # Python ML engine
│   ├── main.py                    # Pipeline orchestrator
│   ├── data_loader.py             # Multi-source data ingestion
│   ├── feature_extraction.py      # Feature engineering & normalization
│   ├── model_engine.py            # HDBSCAN clustering & scoring
│   ├── db_config.py               # SQLAlchemy ORM models
│   ├── db_utils.py                # Database utilities
│   ├── migrate_to_db.py           # CSV → PostgreSQL migration
│   ├── scheduler_service.py       # APScheduler for recurring runs
│   └── config.py                  # Model weights, API keys, thresholds
├── data/
│   ├── raw/                       # Source datasets (MPI, shapefiles)
│   └── processed/                 # Model output (GeoJSON, CSV)
├── gee/                           # Google Earth Engine credentials
├── requirements.txt               # Python dependencies
└── README.md
```

---

## ML Pipeline

The Python engine runs a multi-stage pipeline:

1. **Data Loading** — Ingests MPI CSV, nightlight rasters, infrastructure registries, IDP data, and shapefiles
2. **Feature Extraction** — Normalizes and engineers 15+ features per LGA including spatial joins, fuzzy matching (senatorial districts → LGAs), and composite index calculation
3. **Clustering** — Applies HDBSCAN (density-based) or K-Means (K=5) to group LGAs by deprivation similarity
4. **Scoring** — Computes composite poverty score with weighted formula: MPI (30%), inverse nightlight (25%), health (15%), education (15%), infrastructure (15%)
5. **Classification** — Maps composite scores to 5 risk tiers
6. **Export** — Writes results to PostgreSQL and/or GeoJSON for the dashboard

The scheduler service can run this pipeline on a recurring basis (configurable via APScheduler) for continuous monitoring.

---

## Accessibility

- All interactive elements use semantic HTML (`button`, `table`, `nav`)
- Search implements full ARIA: `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-activedescendant`
- Keyboard navigation: Arrow keys for search results, Enter to select, Escape to dismiss
- Risk colors are accompanied by text labels (not color-only)
- Sufficient contrast ratios in both dark and light themes

---

## Report Generation

Both national and per-LGA intelligence reports can be downloaded as formatted `.txt` files directly from the sidebar. Reports include:

- **National Report** — Overall statistics, risk distribution breakdown, top critical LGAs, data source summary
- **LGA Report** — All metrics (MPI, nightlight, composite, infrastructure, environment, displacement), risk assessment narrative, comparative analysis vs national averages, poverty probability calculation

---

## License

This project is licensed under the **MIT License** — see [license.md](license.md) for details.

Data sources are subject to their respective licenses — see [DATA_LICENSE.md](DATA_LICENSE.md).

---

<p align="center">
  <sub>Built with purpose — identifying where help is needed most.</sub>
</p>
