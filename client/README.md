# IOPHIN Web Dashboard

Production-grade React + TypeScript dashboard for visualizing poverty hotspots across Nigeria's 774 LGAs.

## Features

- 🗺️ **Interactive Map** - React-Leaflet with color-coded risk levels
- 📊 **Analytics Dashboard** - National overview and LGA-specific insights
- 🎨 **Modern UI** - Glassmorphism design with Tailwind CSS
- 📈 **Data Visualization** - Recharts pie charts and progress bars
- ⚡ **Fast & Responsive** - Built with Vite and optimized for performance
- 🔍 **Search Functionality** - SearchBar component for finding specific LGAs
- 🌓 **Theme Support** - Dark/light mode with ThemeContext

## Installation

```bash
cd client
npm install
```

## Configuration

Create a `.env` file:

```
VITE_API_URL=http://localhost:5000/api
```

## Running

```bash
# Development
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Technology Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling with glassmorphism effects
- **React-Leaflet** - Interactive maps
- **Recharts** - Data visualization
- **Axios** - HTTP client

## Components

### MapComponent
Renders Nigeria's 774 LGAs with color-coded risk levels:
- **Red (#EF4444)** - High Risk
- **Amber (#F59E0B)** - Medium Risk  
- **Green (#10B981)** - Low Risk
- **Blue (#3B82F6)** - Minimal Risk

Features:
- Hover tooltips with LGA details
- Click to zoom and view detailed analytics
- Auto-fit bounds to Nigeria

### Sidebar
Displays analytics in two modes:

**National Overview**:
- Total LGAs and states
- Average MPI and nightlight
- Risk distribution pie chart
- Detailed breakdown

**LGA Profile** (when clicked):
- MPI score and nightlight intensity
- Poverty probability gauge
- Comparative analysis vs national averages
- Download report button

### Legend
Floating legend explaining the risk level color codes.

### SearchBar
Allows users to search and filter LGAs by name.

### ThemeContext
Manages theme state (dark/light mode) across the application.

## Browser Support

Modern browsers with ES6+ support:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

The app uses hot module replacement (HMR) for instant updates during development.

Key files:
- `src/App.tsx` - Main layout
- `src/main.tsx` - Application entry point
- `src/components/MapComponent.tsx` - Interactive map
- `src/components/Sidebar.tsx` - Analytics panel
- `src/components/Legend.tsx` - Risk level legend
- `src/components/SearchBar.tsx` - LGA search functionality
- `src/contexts/ThemeContext.tsx` - Theme management
- `src/types.ts` - TypeScript definitions
- `src/index.css` - Global styles with Tailwind
