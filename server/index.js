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
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger.js';
import * as db from './database.js';
import { initRedis, getCached, setCache, closeRedis } from './redis.js';
import { initWebSocket } from './websocket.js';
import { registerUser, loginUser, authMiddleware, requireAuth, requireRole, refreshAccessToken } from './auth.js';
import { createSubscription, deleteSubscription, getUserSubscriptions } from './alerts.js';
import { generateReport } from './reports.js';
import rbac, { requirePermission, requireSuperAdmin, NIGERIAN_STATES } from './rbac.js';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool: PgPool } = pg;
const pool = new PgPool({
  connectionString: process.env.DATABASE_URL,
  ssl: (() => {
    if (process.env.NODE_ENV !== 'production') return false;
    if (process.env.DB_CA_CERT) return { rejectUnauthorized: true, ca: process.env.DB_CA_CERT };
    return { rejectUnauthorized: false };
  })()
});

// Load environment variables
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });

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
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175', 'http://localhost:3000'];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// ══════════════════════════════════════════════════════
//  SWAGGER API DOCUMENTATION
// ══════════════════════════════════════════════════════

const swaggerUiOptions = {
  customSiteTitle: 'IOPHIN API Docs',
  customCss: `
    .swagger-ui .topbar { background-color: #1e3a5f; }
    .swagger-ui .topbar .download-url-wrapper { display: none; }
    .swagger-ui .info .title { color: #1e3a5f; }
    .swagger-ui .btn.authorize { background-color: #1e3a5f; border-color: #1e3a5f; }
    .swagger-ui .btn.authorize svg { fill: #fff; }
  `,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    tryItOutEnabled: true,
  },
};

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Serve raw OpenAPI JSON spec
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

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

// Persist/return runtime configuration for front-end toggles (simple file-backed or env-driven)
app.get('/api/config', (req, res) => {
  try {
    const runtimeConfig = {
      RISK_TIERING_MODE: process.env.RISK_TIERING_MODE || 'cluster',
      ABSOLUTE_THRESHOLDS: {
        MINIMAL: parseFloat(process.env.THRESHOLD_MINIMAL || '0.05'),
        LOW: parseFloat(process.env.THRESHOLD_LOW || '0.10'),
        MEDIUM: parseFloat(process.env.THRESHOLD_MEDIUM || '0.20'),
        HIGH: parseFloat(process.env.THRESHOLD_HIGH || '0.40'),
        CRITICAL: parseFloat(process.env.THRESHOLD_CRITICAL || '1.0'),
      }
    };
    res.json(runtimeConfig);
  } catch (err) {
    console.error('Error in /api/config:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/config', requireRole('super_admin', 'admin'), express.json(), (req, res) => {
  try {
    const { RISK_TIERING_MODE } = req.body;
    if (RISK_TIERING_MODE && (RISK_TIERING_MODE === 'cluster' || RISK_TIERING_MODE === 'absolute')) {
      // For now we only set an in-memory env override for the running process
      process.env.RISK_TIERING_MODE = RISK_TIERING_MODE;
      res.json({ ok: true, RISK_TIERING_MODE });
    } else {
      res.status(400).json({ error: 'Invalid RISK_TIERING_MODE' });
    }
  } catch (err) {
    console.error('Error in POST /api/config:', err);
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
    if (!full_name) return res.status(400).json({ error: 'Full name is required' });
    const result = await registerUser(email, password, full_name, role || 'user', organization);
    // Auto-login after registration
    const loginResult = await loginUser(email, password);
    const permissions = await rbac.getUserPermissions(loginResult.user.id);
    res.status(201).json({ ...loginResult, user: { ...loginResult.user, permissions } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public roles list for registration form
v1.get('/auth/roles', async (req, res) => {
  try {
    const roles = await rbac.getRoles();
    // Only return non-system roles for public registration (exclude super_admin)
    const publicRoles = (roles || []).filter(r => r.name !== 'super_admin');
    res.json(publicRoles);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const result = await loginUser(email, password);
    // Also fetch permissions for the logged-in user
    const permissions = await rbac.getUserPermissions(result.user.id);
    res.json({ ...result, user: { ...result.user, permissions } });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// Refresh an expired access token using a valid refresh token
v1.post('/auth/refresh', authLimiter, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'Refresh token required' });
    const result = await refreshAccessToken(refreshToken);
    const permissions = await rbac.getUserPermissions(result.user.id);
    res.json({ ...result, user: { ...result.user, permissions } });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
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

v1.post('/interventions', requireAuth, requireRole('super_admin', 'admin', 'government', 'ngo'), async (req, res) => {
  try {
    const data = await db.createIntervention(req.body);
    if (!data) return res.status(500).json({ error: 'Failed to create intervention' });
    res.status(201).json(data);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.put('/interventions/:id', requireAuth, requireRole('super_admin', 'admin', 'government', 'ngo'), async (req, res) => {
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
    if (!lga_name && !state) return res.status(400).json({ error: 'lga_name or state is required' });
    const data = await createSubscription(req.user.id, lga_name, state, alert_type, notify_email, notify_webhook, webhook_url);
    const emailSent = data.emailSent || false;
    delete data.emailSent;
    res.status(201).json({ ...data, emailSent });
  } catch (error) {
    console.error('Subscribe error:', error.message);
    if (error.code === '23505') return res.status(409).json({ error: 'Already subscribed to this LGA/alert type' });
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
v1.post('/reports/generate', authMiddleware, async (req, res) => {
  try {
    await generateReport(res, req.body);
  } catch (error) { res.status(500).json({ error: 'Report generation failed' }); }
});

// ══════════════════════════════════════════════════════
//  RBAC / USER MANAGEMENT ENDPOINTS
// ══════════════════════════════════════════════════════

// ── Roles & Permissions ───────────────────────────────
v1.get('/roles', requireAuth, async (req, res) => {
  try {
    const roles = await rbac.getRoles();
    res.json(roles || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/permissions', requireAuth, async (req, res) => {
  try {
    const permissions = await rbac.getPermissions();
    res.json(permissions || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/roles/:id/permissions', requireAuth, async (req, res) => {
  try {
    const permissions = await rbac.getRolePermissions(req.params.id);
    res.json(permissions || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── User Management (Super Admin & Admin) ─────────────
v1.get('/users', requireAuth, requirePermission('users.view'), async (req, res) => {
  try {
    const { page, limit, search, role, state } = req.query;
    const result = await rbac.getUsers({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      search: search || '',
      role: role || '',
      state: state || ''
    });
    if (!result) return res.status(500).json({ error: 'Failed to fetch users' });
    res.json(result);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/users/:id', requireAuth, requirePermission('users.view'), async (req, res) => {
  try {
    const user = await rbac.getUserById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.post('/users', requireAuth, requirePermission('users.create'), async (req, res) => {
  try {
    const { username, email, password, fullName, roleId, organization, geographicScopes } = req.body;
    if (!email || !password || !fullName) {
      return res.status(400).json({ error: 'Email, password, and full name are required' });
    }
    // Validate password
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters with at least one letter and one digit' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await rbac.createUser({
      username,
      email,
      passwordHash,
      fullName,
      roleId: roleId || 3, // Default to 'user' role
      organization,
      geographicScopes: geographicScopes || []
    }, req.user.id);
    res.status(201).json(result);
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

v1.put('/users/:id', requireAuth, requirePermission('users.edit'), async (req, res) => {
  try {
    const { username, email, fullName, roleId, organization, isActive, geographicScopes } = req.body;
    const updatedUser = await rbac.updateUser(req.params.id, {
      username,
      email,
      fullName,
      roleId,
      organization,
      isActive,
      geographicScopes
    }, req.user.id);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json(updatedUser);
  } catch (error) {
    if (error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

v1.patch('/users/:id/revoke', requireAuth, requirePermission('users.delete'), async (req, res) => {
  try {
    const user = await rbac.revokeUserAccess(req.params.id, req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.patch('/users/:id/restore', requireAuth, requirePermission('users.edit'), async (req, res) => {
  try {
    const user = await rbac.restoreUserAccess(req.params.id, req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.delete('/users/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const deleted = await rbac.deleteUser(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Geographic Scopes ─────────────────────────────────
v1.get('/geographic-scopes/states', requireAuth, async (req, res) => {
  try {
    res.json(NIGERIAN_STATES);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/geographic-scopes/states-with-lga', requireAuth, async (req, res) => {
  try {
    const states = await rbac.getStatesWithLGA();
    res.json(states);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/users/:id/scopes', requireAuth, async (req, res) => {
  try {
    const scopes = await rbac.getUserGeographicScopes(req.params.id);
    res.json(scopes);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Audit Log ─────────────────────────────────────────
v1.get('/audit-log', requireAuth, requirePermission('users.view'), async (req, res) => {
  try {
    const { page, limit, userId, action } = req.query;
    const logs = await rbac.getAuditLog({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
      userId: userId || null,
      action: action || null
    });
    res.json(logs || []);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Current User Profile ───────────────────────────────
v1.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await rbac.getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Also fetch permissions
    const permissions = await rbac.getUserPermissions(req.user.id);
    res.json({ ...user, permissions });
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

v1.get('/me/permissions', requireAuth, async (req, res) => {
  try {
    const permissions = await rbac.getUserPermissions(req.user.id);
    res.json(permissions);
  } catch (error) { res.status(500).json({ error: 'Internal Server Error' }); }
});

// ── Update own profile ────────────────────────────────
v1.put('/me', requireAuth, async (req, res) => {
  try {
    const { fullName, organization, currentPassword, newPassword } = req.body;
    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (organization !== undefined) updateData.organization = organization;

    // Password change
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }
      // Validate new password
      if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        return res.status(400).json({ error: 'New password must be at least 8 characters with at least one letter and one digit' });
      }
      // Verify current password
      const { default: bcryptLib } = await import('bcryptjs');
      const userRow = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
      if (userRow.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      const valid = await bcryptLib.compare(currentPassword, userRow.rows[0].password_hash);
      if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });
      // Hash and set new password
      const newHash = await bcryptLib.hash(newPassword, 12);
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);
    }

    // Update other fields
    if (Object.keys(updateData).length > 0) {
      const updated = await rbac.updateUser(req.user.id, updateData, req.user.id);
      if (!updated) return res.status(404).json({ error: 'User not found' });
    }

    // Return fresh profile
    const profile = await rbac.getUserById(req.user.id);
    const permissions = await rbac.getUserPermissions(req.user.id);
    res.json({ ...profile, permissions });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ── Promote current logged-in user to super_admin (first-time setup) ──
v1.post('/me/make-super-admin', requireAuth, async (req, res) => {
  try {
    // Only allow if there are no super_admins yet, OR user is already super_admin
    const adminCheck = await pool.query(
      `SELECT COUNT(*) as cnt FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'super_admin'`
    );
    const superAdminCount = parseInt(adminCheck.rows[0].cnt);
    if (superAdminCount > 0 && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin already exists. Only existing super admins can promote users.' });
    }

    // Get super_admin role ID
    const roleResult = await pool.query("SELECT id FROM roles WHERE name = 'super_admin'");
    if (roleResult.rows.length === 0) return res.status(500).json({ error: 'Super admin role not found in database' });
    const superAdminRoleId = roleResult.rows[0].id;

    // Promote user
    await pool.query('UPDATE users SET role_id = $1 WHERE id = $2', [superAdminRoleId, req.user.id]);

    // Log action
    await pool.query(
      `INSERT INTO user_audit_log (user_id, action, target_user_id, details) VALUES ($1, 'self_promoted_super_admin', $1, '{"reason": "initial_setup"}')`,
      [req.user.id]
    );

    // Return fresh profile
    const profile = await rbac.getUserById(req.user.id);
    const permissions = await rbac.getUserPermissions(req.user.id);
    res.json({ ...profile, permissions, message: 'Successfully promoted to Super Administrator' });
  } catch (error) {
    console.error('Error promoting to super admin:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
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
  await closeRedis();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

httpServer.listen(PORT, () => {
  console.log(`🚀 IOPHIN API Server running on port ${PORT}`);
  console.log(`📊 Mode: ${USE_DATABASE ? 'DATABASE (Real-Time)' : 'FILE (Static)'}`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`📄 OpenAPI JSON: http://localhost:${PORT}/api/docs.json`);
});

export default app;
