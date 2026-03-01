# IOPHIN Server — Express API (v4.0)

## Overview

Node.js Express API server that provides REST endpoints, JWT authentication, role-based access control (RBAC), Redis caching, real-time WebSocket events, PDF report generation, and Swagger API documentation for the IOPHIN poverty intelligence platform.

## Tech Stack

| Package | Version | Purpose |
|---------|---------|---------|
| Express | 4.x | HTTP framework |
| pg (node-postgres) | 8.18 | PostgreSQL client |
| ioredis | 5.x | Redis client + caching |
| Socket.IO | 4.7 | Real-time WebSocket server |
| jsonwebtoken | 9.x | JWT authentication |
| bcryptjs | 2.x | Password hashing |
| PDFKit | 0.15 | PDF report generation |
| swagger-ui-express | 5.x | API documentation UI |
| nodemailer | 6.x | Email notifications |
| compression | 1.x | Response compression |
| cors | 2.x | Cross-origin configuration |

## Quick Start

```bash
cd server
npm install
node index.js     # Starts on port 5000
```

## Environment Variables

```env
DATABASE_URL=postgresql://iophin:iophin@localhost:5432/iophin
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-key
CORS_ORIGIN=http://localhost:3000
PORT=5000
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=alerts@example.com
SMTP_PASS=password
```

## Server Modules

| Module | Purpose |
|--------|---------|
| `index.js` | Main entry: middleware stack, route definitions, server startup |
| `database.js` | PostgreSQL connection pool, query helper, retry logic |
| `auth.js` | JWT middleware, bcrypt hashing, role validation, token generation |
| `rbac.js` | Permission checking, geographic scope enforcement, audit logging |
| `alerts.js` | Alert subscription processing, email dispatch, webhook delivery |
| `reports.js` | PDF generation with charts, tables, and summary statistics |
| `redis.js` | ioredis connection, TTL-based cache get/set/invalidate helpers |
| `websocket.js` | Socket.IO server: room management, event broadcasting |
| `swagger.js` | OpenAPI spec + Swagger UI middleware at `/api-docs` |
| `init.sql` | Complete database schema: tables, views, functions, seed data |

## Database Schema (`init.sql`)

### Tables Created

**Core Data**
- `poverty_hotspots` — Primary LGA data (30+ columns, PK: lga_name)
- `hotspot_history` — Historical snapshots (FK: lga_name)

**Operational**
- `risk_change_log` — Risk level transition audit
- `anomaly_alerts` — Detected anomalies with severity
- `risk_forecasts` — Prophet prediction outputs
- `interventions` — Aid program tracking
- `alert_subscriptions` — Notification preferences
- `saved_views` — Dashboard configurations

**Auth/RBAC**
- `roles` — 6 roles: super_admin, admin, government, ngo, public, user
- `permissions` — 15 granular permissions
- `role_permissions` — Role-permission mapping
- `users` — User accounts (email, role, org, active)
- `user_geographic_scopes` — Per-user state/LGA access restrictions
- `user_audit_log` — JSONB audit trail for admin actions

**Materialized Views**
- `mv_state_aggregation` — State-level averages
- `mv_risk_distribution` — Risk tier counts
- `mv_rankings` — LGA ranking order

**Functions**
- `refresh_materialized_views()` — Refreshes all views in one call

## API Routes

### Health & Config
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | Health check with DB + Redis status |
| GET | `/api/config` | No | Current tiering configuration |
| POST | `/api/config` | Admin | Update tiering configuration |

### Compatibility Routes (`/api/*`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hotspots` | No | All LGA data (supports `?mode=absolute`) |
| GET | `/api/stats` | No | Summary statistics |
| GET | `/api/rankings` | No | LGA rankings (`?search=`, `?limit=`, `?state=`) |
| GET | `/api/states` | No | State aggregations |
| GET | `/api/states/:name` | No | Single state detail |
| GET | `/api/lga/:name` | No | Single LGA detail with history |
| GET | `/api/history/:lga` | No | Historical data for LGA |

### Auth Routes (`/api/auth/*`)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Login -> JWT token |
| POST | `/api/auth/register` | No | User registration |
| GET | `/api/auth/me` | Yes | Current user profile |

### Expanded Routes (`/api/v1/*`)
| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/v1/anomalies` | Yes | view_anomalies | Anomaly alerts |
| PATCH | `/api/v1/anomalies/:id/acknowledge` | Yes | manage_anomalies | Acknowledge anomaly |
| GET | `/api/v1/changes` | Yes | view_changes | Risk change log |
| GET | `/api/v1/forecasts` | Yes | view_forecasts | Risk forecasts |
| GET | `/api/v1/forecasts/escalations` | Yes | view_forecasts | Predicted escalations |
| GET | `/api/v1/correlation` | Yes | view_data | Correlation scatter data |
| GET | `/api/v1/interventions` | Yes | view_interventions | List interventions |
| POST | `/api/v1/interventions` | Yes | manage_interventions | Create intervention |
| PUT | `/api/v1/interventions/:id` | Yes | manage_interventions | Update intervention |
| DELETE | `/api/v1/interventions/:id` | Yes | manage_interventions | Delete intervention |
| GET | `/api/v1/alerts/subscriptions` | Yes | manage_alerts | List subscriptions |
| POST | `/api/v1/alerts/subscriptions` | Yes | manage_alerts | Create subscription |
| GET | `/api/v1/saved-views` | Yes | view_data | List saved views |
| POST | `/api/v1/saved-views` | Yes | view_data | Save a view |
| POST | `/api/v1/reports/generate` | Yes | generate_reports | Generate PDF report |

### User Management Routes (`/api/v1/*`)
| Method | Endpoint | Auth | Permission | Description |
|--------|----------|------|------------|-------------|
| GET | `/api/v1/users` | Yes | manage_users | List all users |
| POST | `/api/v1/users` | Yes | manage_users | Create user |
| PUT | `/api/v1/users/:id` | Yes | manage_users | Update user |
| DELETE | `/api/v1/users/:id` | Yes | manage_users | Delete user |
| PUT | `/api/v1/users/:id/scopes` | Yes | manage_users | Set geographic scopes |
| GET | `/api/v1/roles` | Yes | manage_users | List roles |
| GET | `/api/v1/permissions` | Yes | manage_users | List permissions |
| GET | `/api/v1/audit-log` | Yes | super_admin | View audit log |

## Middleware Stack

Applied in order:
1. **CORS** — Configurable origins via `CORS_ORIGIN`
2. **Compression** — gzip responses > 1KB
3. **JSON Parser** — 10MB body limit
4. **Static Files** — Serves `data/processed/` for GeoJSON access
5. **JWT Auth** — Validates Bearer token on protected routes
6. **RBAC** — Permission + geographic scope enforcement
7. **Request Logging** — Console logging for debugging

## Redis Caching

Data source priority: Redis cache -> PostgreSQL -> GeoJSON file fallback.

Response header `X-Data-Source` indicates which source served the request.

| Cache Key | TTL | Route |
|-----------|-----|-------|
| `hotspots` | 5 min | `/api/hotspots` |
| `stats` | 2 min | `/api/stats` |
| `rankings` | 5 min | `/api/rankings` |
| `states` | 5 min | `/api/states` |
| `anomalies` | 1 min | `/api/v1/anomalies` |
| `forecasts` | 10 min | `/api/v1/forecasts` |
| `changes` | 1 min | `/api/v1/changes` |
| `correlation` | 5 min | `/api/v1/correlation` |
| `interventions` | 2 min | `/api/v1/interventions` |

## WebSocket Events

Socket.IO server initialized in `websocket.js`:

| Event | Direction | Description |
|-------|-----------|-------------|
| `alert` | Server -> Client | Risk change, anomaly, or forecast alert |
| `lga-update` | Server -> Client | LGA data updated (scoped to `lga:{name}` room) |
| `state-update` | Server -> Client | State data updated (scoped to `state:{name}` room) |
| `subscribe-lga` | Client -> Server | Join LGA-specific room |
| `subscribe-state` | Client -> Server | Join state-specific room |

## RBAC System

### Roles (6)
`super_admin` > `admin` > `government` > `ngo` > `user` > `public`

### Permissions (15)
| Domain | Permissions |
|--------|------------|
| Data | view_data, export_data |
| Anomalies | view_anomalies, manage_anomalies |
| Changes | view_changes |
| Forecasts | view_forecasts |
| Interventions | view_interventions, manage_interventions |
| Alerts | manage_alerts |
| Reports | generate_reports |
| Users | manage_users, manage_roles |
| Config | manage_config |
| Audit | view_audit_log |
| System | system_admin |

### Geographic Scoping
Users can be restricted to specific states or LGAs via `user_geographic_scopes`. Enforced server-side by RBAC middleware. Admin and super_admin bypass scoping.

## Swagger Documentation

Auto-generated API docs available at:
```
http://localhost:5000/api-docs
```

Configured in `swagger.js` with OpenAPI 3.0 specification.

## Docker

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "index.js"]
```

## Error Handling

- All routes wrapped in try/catch with standardized error responses
- Database connection retry logic in `database.js`
- Redis graceful degradation (falls back to DB-only on Redis failure)
- JWT expiry returns 401 with descriptive message
- Permission denied returns 403 with required permission name
