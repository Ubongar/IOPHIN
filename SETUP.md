# IOPHIN Web Dashboard - Setup Guide

This guide will help you set up and run the complete IOPHIN system including the ML engine, backend API, and frontend dashboard.

## Prerequisites

- **Python 3.8+** (for the ML engine)
- **Node.js 18+** and npm (for backend and frontend)
- **Git** (for cloning the repository)

## Quick Start (Dashboard Only)

If the ML engine has already processed the data and `data/processed/hotspots.geojson` exists:

### 1. Start the Backend API

```bash
cd server
npm install
npm start
```

The API will be available at http://localhost:5000

### 2. Start the Frontend Dashboard

In a new terminal:

```bash
cd client
npm install
npm run dev
```

The dashboard will be available at http://localhost:5173

## Full Setup (Including ML Engine)

### Step 1: Python ML Engine

```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the ML pipeline
python -m src.main
```

This will:
- Load LGA shapefiles
- Extract nightlight intensity from VIIRS data (or generate synthetic data)
- Merge with MPI indicators
- Run K-Means clustering
- Generate `data/processed/hotspots.geojson`

### Step 2: Backend API

```bash
cd server
npm install

# Optional: Create .env file with custom settings
cat > .env << EOF
PORT=5000
NODE_ENV=development
DATA_PATH=../data/processed/hotspots.geojson
EOF

npm start
```

Available endpoints:
- `GET /api/health` - Health check
- `GET /api/stats` - Summary statistics
- `GET /api/hotspots` - Full GeoJSON data
- `GET /api/lga/:name` - Individual LGA details

### Step 3: Frontend Dashboard

```bash
cd client
npm install

# Optional: Create .env file with custom API URL
cat > .env << EOF
VITE_API_URL=http://localhost:5000/api
EOF

# Development mode with hot reload
npm run dev

# Or build for production
npm run build
npm run preview
```

## Environment Variables

### Backend (`server/.env`)

```env
PORT=5000                                      # API server port
NODE_ENV=development                           # Environment (development/production)
DATA_PATH=../data/processed/hotspots.geojson  # Path to GeoJSON data
```

### Frontend (`client/.env`)

```env
VITE_API_URL=http://localhost:5000/api  # Backend API URL
```

## Production Deployment

### Backend

```bash
cd server
npm install --production
NODE_ENV=production npm start
```

Consider using:
- **PM2** for process management
- **Nginx** as reverse proxy
- **SSL/TLS** certificates for HTTPS

### Frontend

```bash
cd client
npm run build
```

Deploy the `dist/` folder to:
- **Netlify**
- **Vercel**
- **GitHub Pages**
- Or serve with Nginx/Apache

Update `VITE_API_URL` to point to your production API.

## Troubleshooting

### Backend Issues

**"Model is currently retraining" error**
- The `hotspots.geojson` file is missing
- Run the Python ML engine first: `python -m src.main`

**Port already in use**
- Change the PORT in `server/.env`
- Or stop the process using port 5000

**CORS errors**
- Ensure the frontend URL is allowed in `server/index.js`
- Check CORS configuration in production

### Frontend Issues

**Network error / Failed to fetch**
- Ensure backend is running on http://localhost:5000
- Check `VITE_API_URL` in `client/.env`

**Map tiles not loading**
- OpenStreetMap tiles may be blocked by ad blockers
- Or check network connectivity

**Build errors**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again
- Ensure Node.js version is 18+

## Data Notes

- **774 LGAs** are included in the current dataset with complete data for analysis
- The system can be updated when additional data becomes available

## Performance

### Backend
- GZIP compression enabled for large files
- Streaming for efficient memory usage
- Rate limiting: 100 requests per 15 minutes per IP

### Frontend
- Single-page React application suitable for dashboard-style interactions
- Production builds use standard React tooling optimizations (minification, bundling)
- Architecture allows adding code splitting, memoization, and lazy loading for heavy components if needed

## Security Features

✅ Rate limiting on all API endpoints
✅ CORS configuration
✅ Input validation
✅ Error handling with no sensitive data exposure
✅ Environment-based configuration

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the documentation in `README.md`
3. Check individual component READMEs (`server/README.md`, `client/README.md`)
4. Open an issue on GitHub

## License

This project is part of the IOPHIN (Integrated Optimization Platform for Health Information in Nigeria) initiative.
