/**
 * IOPHIN - Backend API Server
 * NOW UPDATED FOR POSTGRESQL (Async/Await)
 */

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { createReadStream, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import * as db from './database.js';

// Load environment variables
dotenv.config();

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const PORT = process.env.PORT || 5000;
const DATA_PATH = join(__dirname, process.env.DATA_PATH || '../data/processed/hotspots.geojson');
const USE_DATABASE = (process.env.USE_DATABASE ?? 'true') === 'true';

// Cache for Fallback Static Data
let cachedGeoJSON = null;
let cachedStats = null;
let lgaIndex = new Map();
let cacheTimestamp = null;

async function loadGeoJSONData() {
  try {
    const { stat } = await import('fs/promises');
    const fileStat = await stat(DATA_PATH);
    const fileModTime = fileStat.mtime.getTime();
    if (cachedGeoJSON && cacheTimestamp === fileModTime) return cachedGeoJSON;
    const data = await readFile(DATA_PATH, 'utf8');
    const geoJSON = JSON.parse(data);
    cachedGeoJSON = geoJSON;
    cacheTimestamp = fileModTime;
    lgaIndex.clear();
    if (geoJSON.features) {
      geoJSON.features.forEach((feature, index) => {
        if (feature.properties && feature.properties.LGA_Name) {
          lgaIndex.set(feature.properties.LGA_Name, index);
        }
      });
    }
    cachedStats = null;
    return geoJSON;
  } catch (error) {
    console.error('Error loading GeoJSON:', error);
    throw error;
  }
}

async function calculateStats() {
  if (cachedStats) return cachedStats;
  const geoJSON = await loadGeoJSONData();
  const features = geoJSON.features || [];
  const stats = {
    totalLGAs: features.length,
    riskDistribution: { high: 0, medium: 0, low: 0, minimal: 0 },
    averageMPI: 0,
    averageNightlight: 0,
    states: new Set(),
    timestamp: new Date().toISOString()
  };
  let totalMPI = 0;
  let mpiCount = 0;
  let totalNightlight = 0;
  let nightlightCount = 0;
  features.forEach(feature => {
    const { risk_level, MPI, mean_nightlight_intensity, State } = feature.properties;
    if (risk_level === 'High') stats.riskDistribution.high++;
    else if (risk_level === 'Medium') stats.riskDistribution.medium++;
    else if (risk_level === 'Low') stats.riskDistribution.low++;
    else if (risk_level === 'Minimal') stats.riskDistribution.minimal++;
    if (typeof MPI === 'number') { totalMPI += MPI; mpiCount++; }
    if (typeof mean_nightlight_intensity === 'number') { totalNightlight += mean_nightlight_intensity; nightlightCount++; }
    if (State) stats.states.add(State);
  });
  stats.averageMPI = mpiCount > 0 ? (totalMPI / mpiCount).toFixed(4) : '0';
  stats.averageNightlight = nightlightCount > 0 ? (totalNightlight / nightlightCount).toFixed(2) : '0';
  stats.statesCount = stats.states.size;
  delete stats.states;
  cachedStats = stats;
  return stats;
}

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? [process.env.CLIENT_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

/**
 * GET /api/hotspots
 * Query params: ?state=Lagos&risk=High
 */
app.get('/api/hotspots', async (req, res) => {
  try {
    const { state, risk } = req.query;

    if (USE_DATABASE && db.isDatabaseAvailable()) {
      console.log('📊 Serving hotspots from database (real-time data)');
      const geoJSON = await db.getHotspotsAsGeoJSON(state || null, risk || null);
      
      if (geoJSON && geoJSON.features && geoJSON.features.length > 0) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Data-Source', 'database');
        return res.json(geoJSON);
      } else {
        console.log(`⚠️ Database returned ${geoJSON?.features?.length ?? 0} features — falling back to static file`);
      }
    }
    
    console.log('📁 Serving hotspots from static file (fallback)');
    if (!existsSync(DATA_PATH)) {
      return res.status(503).json({ error: 'Service Unavailable', message: 'Model is currently retraining.' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Data-Source', 'file');
    const fileStream = createReadStream(DATA_PATH, { encoding: 'utf8' });
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error in /api/hotspots:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'An unexpected error occurred' });
  }
});

/**
 * GET /api/stats
 */
app.get('/api/stats', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      console.log('📊 Serving stats from database (real-time)');
      // ADDED AWAIT HERE
      const stats = await db.getStatistics();
      
      if (stats) {
        res.setHeader('X-Data-Source', 'database');
        return res.json(stats);
      }
    }
    
    console.log('📁 Serving stats from static file (fallback)');
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    const stats = await calculateStats();
    res.setHeader('X-Data-Source', 'file');
    res.json(stats);
  } catch (error) {
    console.error('Error in /api/stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/lga/:name
 */
app.get('/api/lga/:name', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.name);

    if (USE_DATABASE && db.isDatabaseAvailable()) {
      console.log(`📊 Fetching LGA '${lgaName}' from database`);
      // ADDED AWAIT HERE
      const lga = await db.getLGAByName(lgaName);
      
      if (lga) {
        res.setHeader('X-Data-Source', 'database');
        return res.json(lga);
      } else {
        return res.status(404).json({ error: 'Not Found', message: `LGA '${lgaName}' not found` });
      }
    }
    
    console.log(`📁 Fetching LGA '${lgaName}' from static file (fallback)`);
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    const geoJSON = await loadGeoJSONData();
    const featureIndex = lgaIndex.get(lgaName);
    if (featureIndex === undefined) return res.status(404).json({ error: 'Not Found' });
    const feature = geoJSON.features[featureIndex];
    res.setHeader('X-Data-Source', 'file');
    res.json(feature);
  } catch (error) {
    console.error('Error in /api/lga/:name:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/states — per-state aggregated stats
 */
app.get('/api/states', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const data = await db.getStateAggregation();
      if (data) {
        res.setHeader('X-Data-Source', 'database');
        return res.json(data);
      }
    }
    res.status(503).json({ error: 'Service Unavailable', message: 'Database not connected' });
  } catch (error) {
    console.error('Error in /api/states:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/history/:lga — time-series for one LGA
 * Query params: ?limit=30
 */
app.get('/api/history/:lga', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.lga);
    const limit = Math.min(parseInt(req.query.limit) || 30, 365);

    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const data = await db.getHistoryForLGA(lgaName, limit);
      if (data) {
        res.setHeader('X-Data-Source', 'database');
        return res.json(data);
      }
      return res.status(404).json({ error: 'Not Found', message: `No history for '${lgaName}'` });
    }
    res.status(503).json({ error: 'Service Unavailable', message: 'Database not connected' });
  } catch (error) {
    console.error('Error in /api/history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/rankings — top-N worst or best LGAs
 * Query params: ?order=worst&limit=20
 */
app.get('/api/rankings', async (req, res) => {
  try {
    const order = req.query.order === 'best' ? 'best' : 'worst';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const data = await db.getRankings(order, limit);
      if (data) {
        res.setHeader('X-Data-Source', 'database');
        return res.json(data);
      }
    }
    res.status(503).json({ error: 'Service Unavailable', message: 'Database not connected' });
  } catch (error) {
    console.error('Error in /api/rankings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

if (USE_DATABASE) {
  console.log('🔄 Initializing database connection...');
  // ADDED AWAIT (Optional here, but good practice)
  await db.initDatabase();
}

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing...`);
  if (USE_DATABASE) await db.closeDatabase();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

app.listen(PORT, () => {
  console.log(`🚀 IOPHIN API Server running on port ${PORT}`);
  console.log(`📊 Mode: ${USE_DATABASE ? 'DATABASE (Real-Time)' : 'FILE (Static)'}`);
});

export default app;