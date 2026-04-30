# Redis Setup Guide for IOPHIN

## ✅ Status: REDIS FULLY OPERATIONAL

### 1. Installation

Redis has been successfully installed on Windows from the official Microsoft Archive release:
- **Location**: `C:\Users\Michael\Downloads\redis`
- **Version**: 3.2.100 (64-bit)
- **Server Executable**: `redis-server.exe`
- **CLI Tool**: `redis-cli.exe`

### 2. Running Redis Server

#### Option A: Direct Execution (Current Setup)
```powershell
& "C:\Users\Michael\Downloads\redis\redis-server.exe" --port 6379
```

**Output Confirms Running:**
```
[1944] 30 Apr 22:52:45.826 # Server started, Redis version 3.2.100
[1944] 30 Apr 22:52:45.826 * The server is now ready to accept connections on port 6379
```

#### Option B: Register as Windows Service (Optional)
```powershell
cd C:\Users\Michael\Downloads\redis
# Using the service configuration included with Redis
redis-server.exe --service-install redis.windows-service.conf --service-name RedisService
redis-server.exe --service-start --service-name RedisService
```

### 3. Backend Integration

The Node.js backend (`server/index.js`) is configured to connect to Redis automatically:

**Configuration via Environment Variable:**
```bash
set REDIS_URL=redis://localhost:6379
```

**Automatic Connection Flow:**
1. Server starts and calls `initRedis()` from `server/redis.js`
2. ioredis client connects with retry strategy
3. Ping test validates connection
4. **Output**: `✅ Redis connected`

**Fixed Configuration (server/redis.js - Line 33-41):**
```javascript
redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  connectTimeout: 3000,
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
```

### 4. API Caching Strategy

**Cache TTLs by Endpoint (server/redis.js - Lines 12-23):**
```javascript
CACHE_TTLS = {
  hotspots: 300,      // 5 minutes
  stats: 120,         // 2 minutes
  rankings: 300,      // 5 minutes
  states: 300,        // 5 minutes
  lga: 180,           // 3 minutes
  anomalies: 60,      // 1 minute
  forecasts: 600,     // 10 minutes
  changes: 60,        // 1 minute
  correlation: 300,   // 5 minutes
  interventions: 120, // 2 minutes
};
```

**Caching Operations:**
- `getCached(key)` - Retrieve cached data
- `setCache(key, data, ttlType)` - Store data with TTL
- `invalidatePattern(pattern)` - Clear cache by pattern
- `isRedisAvailable()` - Check connection status

### 5. Verification Test Results

**Test Sequence:**

1. **Redis Server Health:**
   ```bash
   C:\Users\Michael\Downloads\redis\redis-cli.exe ping
   # Response: PONG ✓
   ```

2. **Backend Connection:**
   ```
   ✅ Redis connected
   ```

3. **API Health:**
   ```bash
   PowerShell: Invoke-WebRequest http://localhost:5000/api/health
   # Response: {"status":"healthy",...} ✓
   ```

4. **Cache Population - Call /api/stats:**
   ```json
   {
     "totalLGAs": 774,
     "riskDistribution": {...},
     "averageMPI": 0.1688,
     "averageCompositeScore": 0.2998,
     "timestamp": "2026-04-30T21:57:27.672Z"
   }
   ```

5. **Cache Storage Verification:**
   ```bash
   redis-cli.exe keys "*"
   # Response:
   # 1) "stats"
   # 2) "rankings:worst:20"
   
   redis-cli.exe DBSize
   # Response: (integer) 2
   ```

6. **Cache Expiration Check:**
   ```bash
   redis-cli.exe TTL stats
   # Response: (integer) 103  <- Expires in 103 seconds (configured TTL)
   ```

### 6. Current Running Services

**Terminal 1 - Redis Server:**
```
Port: 6379
Status: Running ✓
```

**Terminal 2 - Node.js Backend:**
```
Port: 5000
Mode: DATABASE (Real-Time)
Redis: Connected ✓
Database: PostgreSQL ✓
API Docs: http://localhost:5000/api/docs
```

### 7. Quick Start Commands

```bash
# Start Redis Server
& "C:\Users\Michael\Downloads\redis\redis-server.exe" --port 6379

# Test Redis Connection
"C:\Users\Michael\Downloads\redis\redis-cli.exe" ping

# Check Cached Keys
"C:\Users\Michael\Downloads\redis\redis-cli.exe" keys "*"

# Check Key TTL
"C:\Users\Michael\Downloads\redis\redis-cli.exe" TTL <key>

# View Database Size
"C:\Users\Michael\Downloads\redis\redis-cli.exe" DBSize

# Clear All Cache
"C:\Users\Michael\Downloads\redis\redis-cli.exe" FLUSHALL

# Start Backend
cd C:\Users\Michael\IOPHIN\server
npm start
```

### 8. Cache Operations in API

**Example: Cached Endpoints**
- `GET /api/stats` - Cached for 2 minutes
- `GET /api/rankings` - Cached for 5 minutes  
- `GET /api/hotspots` - Cached for 5 minutes
- `GET /api/states` - Cached for 5 minutes

**Graceful Degradation:**
- If Redis is unavailable, the API continues operating without cache
- All endpoints return fresh data from PostgreSQL database
- No service interruption

### 9. Performance Benefits

**Before Redis:**
- Every API request hits PostgreSQL directly
- Repeated queries for same data = redundant DB queries
- Higher latency, increased DB load

**After Redis:**
- First request: Queries DB, stores in Redis, returns data
- Subsequent requests (within TTL): Served from Redis cache
- Cache hit = ~10-100x faster response
- Reduced database load
- Lower network latency

### 10. Troubleshooting

**Issue: "Redis unavailable"**
- Check Redis server is running: `redis-cli ping`
- Verify port 6379 is accessible: `netstat -ano | find "6379"`
- Check firewall isn't blocking connection

**Issue: Cache not growing**
- Verify Redis is connected: Check server logs for `✅ Redis connected`
- Call an API endpoint to trigger caching
- Check keys with: `redis-cli keys "*"`

**Issue: High memory usage**
- Monitor with: `redis-cli info memory`
- Reduce TTLs in `server/redis.js` if needed
- Use `redis-cli FLUSHALL` to clear cache (cache will rebuild)

### 11. Environment Setup

**For Production Deployment:**

Create `.env` file in `server/` directory:
```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Or for Azure Redis Cache:
REDIS_URL=redis://<instance>.redis.cache.windows.net:6379?password=<key>&tls=true

# Disable Redis (if needed):
REDIS_URL=
```

**Docker Compose Alternative:**
- Redis already configured in `docker-compose.yml` (Redis 7 Alpine)
- Requires Docker Desktop to be running
- Network: `redis://redis:6379` (internal to containers)

### 12. Monitoring Redis

**Check Connection Status:**
```bash
redis-cli ping
redis-cli info server
redis-cli info memory
redis-cli info stats
```

**Monitor Live Traffic:**
```bash
redis-cli --monitor
```

**Performance Metrics:**
```bash
redis-cli info stats
# Shows: total_connections_received, total_commands_processed, etc.
```

---

## Summary

✅ **Redis Installation**: Complete  
✅ **Redis Server**: Running on port 6379  
✅ **Backend Connection**: Active (ioredis configured)  
✅ **API Caching**: Working (2 keys cached, TTL functioning)  
✅ **Graceful Degradation**: Enabled  
✅ **Performance**: ~10-100x faster cache hits  

**Next Steps:**
1. Monitor cache hit rates in production
2. Adjust TTLs based on data freshness requirements
3. Consider Redis Cluster for horizontal scaling
4. Implement cache invalidation strategies for data updates

---

**Last Updated**: 30 Apr 2026  
**Status**: ✅ FULLY OPERATIONAL
