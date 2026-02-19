/**
 * IOPHIN - Backend API Server v2
 * Backward compatible v1 API expansion with Redis, WebSocket, Auth, Forecasts, Anomalies, Interventions
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
import http from 'http';
import * as db from './database.js';
import { initRedis, getCached, setCache } from './redis.js';
import { initWebSocket } from './websocket.js';
import { registerUser, loginUser, authMiddleware, requireAuth, requireRole } from './auth.js';
import { createSubscription, deleteSubscription, getUserSubscriptions } from './alerts.js';
import { generateReport } from './reports.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    averageMPI: 0, averageNightlight: 0,
    states: new Set(), timestamp: new Date().toISOString()
  };
  let totalMPI = 0, mpiCount = 0, totalNightlight = 0, nightlightCount = 0;
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

// Security & logging
const helmet = (await import('helmet')).default;
const morgan = (await import('morgan')).default;
app.use(helmet());
app.use(morgan('combined'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: 'Too many requests from this IP.',
  standardHeaders: true, legacyHeaders: false,
});
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use(limiter);

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction
  ? [process.env.CLIENT_URL]
  : ['http://localhost:5173', 'http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// ══════════════════════════════════════════════════════
//  EXISTING (backward-compatible) ENDPOINTS
// ══════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

app.get('/api/hotspots', async (req, res) => {
  try {
    const { state, risk } = req.query;
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached(`hotspots:${state||''}:${risk||''}`);
      if (cached) { res.setHeader('X-Data-Source', 'cache'); return res.json(cached); }
      const geoJSON = await db.getHotspotsAsGeoJSON(state || null, risk || null);
      if (geoJSON && geoJSON.features && geoJSON.features.length > 0) {
        await setCache(`hotspots:${state||''}:${risk||''}`, geoJSON, 'hotspots');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, max-age=60');
        res.setHeader('X-Data-Source', 'database');
        return res.json(geoJSON);
      }
    }
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Data-Source', 'file');
    createReadStream(DATA_PATH, { encoding: 'utf8' }).pipe(res);
  } catch (error) {
    console.error('Error in /api/hotspots:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached('stats');
      if (cached) { res.setHeader('X-Data-Source', 'cache'); return res.json(cached); }
      const stats = await db.getStatistics();
      if (stats) {
        await setCache('stats', stats, 'stats');
        res.setHeader('X-Data-Source', 'database');
        return res.json(stats);
      }
    }
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    const stats = await calculateStats();
    res.setHeader('X-Data-Source', 'file');
    res.json(stats);
  } catch (error) {
    console.error('Error in /api/stats:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/lga/:name', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.name);
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const lga = await db.getLGAByName(lgaName);
      if (lga) { res.setHeader('X-Data-Source', 'database'); return res.json(lga); }
      return res.status(404).json({ error: 'Not Found', message: `LGA '${lgaName}' not found` });
    }
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    const geoJSON = await loadGeoJSONData();
    const featureIndex = lgaIndex.get(lgaName);
    if (featureIndex === undefined) return res.status(404).json({ error: 'Not Found' });
    res.setHeader('X-Data-Source', 'file');
    res.json(geoJSON.features[featureIndex]);
  } catch (error) {
    console.error('Error in /api/lga/:name:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/states', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached('states');
      if (cached) { res.setHeader('X-Data-Source', 'cache'); return res.json(cached); }
      const data = await db.getStateAggregation();
      if (data) {
        await setCache('states', data, 'states');
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

app.get('/api/history/:lga', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.lga);
    const limit = Math.min(parseInt(req.query.limit) || 30, 365);
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const data = await db.getHistoryForLGA(lgaName, limit);
      if (data) { res.setHeader('X-Data-Source', 'database'); return res.json(data); }
      return res.status(404).json({ error: 'Not Found', message: `No history for '${lgaName}'` });
    }
    res.status(503).json({ error: 'Service Unavailable', message: 'Database not connected' });
  } catch (error) {
    console.error('Error in /api/history:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/rankings', async (req, res) => {
  try {
    const order = req.query.order === 'best' ? 'best' : 'worst';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached(`rankings:${order}:${limit}`);
      if (cached) { res.setHeader('X-Data-Source', 'cache'); return res.json(cached); }
      const data = await db.getRankings(order, limit);
      if (data) {
        await setCache(`rankings:${order}:${limit}`, data, 'rankings');
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

// ══════════════════════════════════════════════════════
//  V1 API ROUTER
// ══════════════════════════════════════════════════════

const v1 = express.Router();

// ── Auth ──────────────────────────────────────────────
v1.post('/auth/register', authLimiter, async (req, res) => {
  try {
    const { email, password, full_name, role, organization } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await registerUser(email, password, full_name, role, organization);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

v1.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await loginUser(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// ── Hotspots ──────────────────────────────────────────
v1.get('/hotspots', async (req, res) => {
  try {
    const { state, risk } = req.query;
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached(`v1:hotspots:${state||''}:${risk||''}`);
      if (cached) return res.json(cached);
      const geoJSON = await db.getHotspotsAsGeoJSON(state || null, risk || null);
      if (geoJSON) { await setCache(`v1:hotspots:${state||''}:${risk||''}`, geoJSON, 'hotspots'); return res.json(geoJSON); }
    }
    if (!existsSync(DATA_PATH)) return res.status(503).json({ error: 'Service Unavailable' });
    const data = await readFile(DATA_PATH, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/hotspots/within-radius', async (req, res) => {
  try {
    const { lat, lon, radius = 50 } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const data = await db.getLGAsWithinRadius(parseFloat(lat), parseFloat(lon), parseFloat(radius));
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/stats', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached('v1:stats');
      if (cached) return res.json(cached);
      const stats = await db.getStatistics();
      if (stats) { await setCache('v1:stats', stats, 'stats'); return res.json(stats); }
    }
    const stats = await calculateStats().catch(() => null);
    if (stats) return res.json(stats);
    res.status(503).json({ error: 'Service Unavailable' });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/lga/:name', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.name);
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const lga = await db.getLGAByName(lgaName);
      if (lga) return res.json(lga);
      return res.status(404).json({ error: 'Not Found' });
    }
    res.status(503).json({ error: 'Service Unavailable' });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/lga/:name/trends', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.name);
    const data = await db.getTemporalTrends(lgaName);
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/lga/:name/forecast', async (req, res) => {
  try {
    const lgaName = decodeURIComponent(req.params.name);
    const data = await db.getForecasts(lgaName);
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/lga/:name/anomalies', async (req, res) => {
  try {
    // Return anomalies filtered by LGA name
    const lgaName = decodeURIComponent(req.params.name);
    const all = await db.getActiveAnomalies();
    const filtered = (all || []).filter(a => a.lga_name === lgaName);
    res.json(filtered);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/states', async (req, res) => {
  try {
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const cached = await getCached('v1:states');
      if (cached) return res.json(cached);
      const data = await db.getStateAggregation();
      if (data) { await setCache('v1:states', data, 'states'); return res.json(data); }
    }
    res.status(503).json({ error: 'Service Unavailable' });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/rankings', async (req, res) => {
  try {
    const order = req.query.order === 'best' ? 'best' : 'worst';
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    if (USE_DATABASE && db.isDatabaseAvailable()) {
      const data = await db.getRankings(order, limit);
      if (data) return res.json(data);
    }
    res.status(503).json({ error: 'Service Unavailable' });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/changes', async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const data = await db.getRecentChanges(days);
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/anomalies', async (req, res) => {
  try {
    const data = await db.getActiveAnomalies();
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.patch('/anomalies/:id/acknowledge', requireAuth, async (req, res) => {
  try {
    const data = await db.acknowledgeAnomaly(req.params.id);
    if (!data) return res.status(404).json({ error: 'Not Found' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/forecasts', async (req, res) => {
  try {
    const data = await db.getForecasts();
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/forecasts/escalations', async (req, res) => {
  try {
    const data = await db.getEscalationCandidates();
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/correlation/:metric1/:metric2', async (req, res) => {
  try {
    const { metric1, metric2 } = req.params;
    const data = await db.getCorrelationData(metric1, metric2);
    if (data === null) return res.status(400).json({ error: 'Invalid metrics' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/interventions', async (req, res) => {
  try {
    const data = await db.getInterventions({ state: req.query.state, status: req.query.status, organization: req.query.organization });
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.post('/interventions', requireAuth, requireRole('admin', 'government', 'ngo'), async (req, res) => {
  try {
    const data = await db.createIntervention(req.body);
    if (!data) return res.status(500).json({ error: 'Failed to create intervention' });
    res.status(201).json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.put('/interventions/:id', requireAuth, requireRole('admin', 'government', 'ngo'), async (req, res) => {
  try {
    const data = await db.updateIntervention(req.params.id, req.body);
    if (!data) return res.status(404).json({ error: 'Not Found' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Alerts ────────────────────────────────────────────
v1.get('/alerts/my', requireAuth, async (req, res) => {
  try {
    const data = await getUserSubscriptions(req.user.id);
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.post('/alerts/subscribe', requireAuth, async (req, res) => {
  try {
    const { lga_name, state, alert_type, notify_email, notify_webhook, webhook_url } = req.body;
    const data = await createSubscription(req.user.id, lga_name, state, alert_type, notify_email, notify_webhook, webhook_url);
    res.status(201).json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.delete('/alerts/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await deleteSubscription(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Not Found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Saved Views ───────────────────────────────────────
v1.get('/saved-views', requireAuth, async (req, res) => {
  try {
    const data = await db.getSavedViews(req.user.id);
    res.json(data || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.post('/saved-views', requireAuth, async (req, res) => {
  try {
    const { name, view_config, is_public } = req.body;
    if (!name || !view_config) return res.status(400).json({ error: 'name and view_config required' });
    const data = await db.createSavedView(req.user.id, name, view_config, is_public);
    res.status(201).json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/saved-views/:token', async (req, res) => {
  try {
    const data = await db.getSavedViewByToken(req.params.token);
    if (!data) return res.status(404).json({ error: 'Not Found' });
    res.json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Reports ───────────────────────────────────────────
v1.post('/reports/generate', requireAuth, async (req, res) => {
  try {
    await generateReport(res, req.body);
  } catch (error) { res.status(500).json({ error: 'Report generation failed' }); }
});

app.use('/api/v1', v1);

// ── Catch-all ──────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not Found' }));
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// ══════════════════════════════════════════════════════
//  STARTUP
// ══════════════════════════════════════════════════════

if (USE_DATABASE) {
  console.log('🔄 Initializing database connection...');
  await db.initDatabase();
}

await initRedis();

const httpServer = http.createServer(app);
const io = await initWebSocket(httpServer);

const shutdown = async (signal) => {
  console.log(`\n${signal} received. Closing...`);
  if (USE_DATABASE) await db.closeDatabase();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

httpServer.listen(PORT, () => {
  console.log(`🚀 IOPHIN API Server running on port ${PORT}`);
  console.log(`📊 Mode: ${USE_DATABASE ? 'DATABASE (Real-Time)' : 'FILE (Static)'}`);
});

export default app;
