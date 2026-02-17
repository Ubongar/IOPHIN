# IOPHIN Backend Server

Express.js API server for the Poverty Hotspot Identifier System.

## Features

- **GET /api/hotspots** - Streams GeoJSON data with GZIP compression
- **GET /api/stats** - Provides summary statistics
- **GET /api/lga/:name** - Retrieves detailed LGA information
- **GET /api/health** - Health check endpoint

## Installation

```bash
cd server
npm install
```

## Configuration

Create a `.env` file:

```
PORT=5000
NODE_ENV=development
DATA_PATH=../data/processed/hotspots.geojson
```

## Running

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### GET /api/hotspots
Returns the complete GeoJSON dataset with all 774 LGAs.

**Response**: `application/json` with GZIP compression

### GET /api/stats
Returns summary statistics.

**Response**:
```json
{
  "totalLGAs": 774,
  "riskDistribution": {
    "high": 222,
    "medium": 269,
    "low": 208,
    "minimal": 75
  },
  "averageMPI": "0.1723",
  "averageNightlight": "0.40",
  "statesCount": 37
}
```

### GET /api/lga/:name
Get details for a specific LGA.

**Parameters**: 
- `name` - LGA name (e.g., "Aba North")

**Response**: GeoJSON Feature object

## Error Handling

- **503 Service Unavailable** - Data file not found (model retraining)
- **404 Not Found** - LGA not found or invalid route
- **500 Internal Server Error** - Unexpected errors
