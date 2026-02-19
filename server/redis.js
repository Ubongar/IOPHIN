/**
 * Redis Cache Layer for IOPHIN API
 * Gracefully degrades to no-cache if Redis is unavailable.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let Redis;
let redis = null;
let redisAvailable = false;

const CACHE_TTLS = {
  hotspots: 300,      // 5 minutes
  stats: 120,         // 2 minutes
  rankings: 300,
  states: 300,
  lga: 180,
  anomalies: 60,
  forecasts: 600,
  changes: 60,
  correlation: 300,
  interventions: 120,
};

async function initRedis() {
  try {
    const mod = await import('ioredis');
    Redis = mod.default || mod;
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      lazyConnect: true,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
    });
    await redis.ping();
    redisAvailable = true;
    console.log('✅ Redis connected');
  } catch (err) {
    redisAvailable = false;
    console.warn('⚠️  Redis unavailable — running without cache:', err.message);
    if (redis) { try { redis.disconnect(); } catch { /* ignore */ } }
    redis = null;
  }
}

export function isRedisAvailable() { return redisAvailable; }

export async function getCached(key) {
  if (!redisAvailable || !redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch { return null; }
}

export async function setCache(key, data, ttlType = 'stats') {
  if (!redisAvailable || !redis) return;
  try {
    const ttl = CACHE_TTLS[ttlType] || 120;
    await redis.setex(key, ttl, JSON.stringify(data));
  } catch { /* silent */ }
}

export async function invalidatePattern(pattern) {
  if (!redisAvailable || !redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* silent */ }
}

export async function closeRedis() {
  if (redis) { await redis.quit(); redis = null; redisAvailable = false; }
}

export { initRedis };
export default { getCached, setCache, invalidatePattern, isRedisAvailable, initRedis, closeRedis };
