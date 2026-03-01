/**
 * IOPHIN API - Swagger/OpenAPI 3.0 Specification
 * Full documentation for all REST API endpoints.
 */

export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'IOPHIN Poverty Hotspot Intelligence API',
    version: '2.0.0',
    description: `
## IOPHIN – Integrated Open Poverty Hotspot Intelligence Network

A geospatial intelligence platform for identifying, monitoring, and responding to poverty hotspots across Nigeria's Local Government Areas (LGAs).

### Authentication
Most endpoints require a **Bearer JWT token** in the \`Authorization\` header:
\`\`\`
Authorization: Bearer <your_token>
\`\`\`
Obtain a token via \`POST /api/v1/auth/login\`.

### Rate Limiting
- General endpoints: **200 requests / 15 minutes**
- Auth endpoints: **20 requests / 15 minutes**

### Data Sources
Responses include an \`X-Data-Source\` header indicating: \`database\`, \`cache\`, or \`file\`.
    `,
    contact: {
      name: 'IOPHIN Team',
      email: 'mikeerap14@gmail.com',
    },
    license: {
      name: 'MIT',
      url: 'https://github.com/Ubongar/IOPHIN?tab=License-1-ov-file',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
    {
      url: 'https://api.iophin.ng',
      description: 'Production Server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health and status checks' },
    { name: 'Hotspots', description: 'Poverty hotspot GeoJSON data and spatial queries' },
    { name: 'Statistics', description: 'Aggregate statistics and national summaries' },
    { name: 'LGA', description: 'Local Government Area detail, trends, forecasts, and anomalies' },
    { name: 'States', description: 'State-level aggregated data' },
    { name: 'Rankings', description: 'LGA rankings by poverty score' },
    { name: 'Changes', description: 'Recent risk-level change tracking' },
    { name: 'Anomalies', description: 'Detected anomalies in poverty indicators' },
    { name: 'Forecasts', description: 'Predictive poverty risk forecasts' },
    { name: 'Correlation', description: 'Cross-metric correlation analysis' },
    { name: 'Interventions', description: 'Aid and development intervention tracking' },
    { name: 'Alerts', description: 'User alert subscriptions and notifications' },
    { name: 'Saved Views', description: 'Shareable map view configurations' },
    { name: 'Reports', description: 'PDF report generation' },
    { name: 'Auth', description: 'User registration and authentication' },
    { name: 'Users', description: 'User management (admin only)' },
    { name: 'Roles & Permissions', description: 'RBAC roles and permission management' },
    { name: 'Geographic Scopes', description: 'Nigerian states and LGA geographic scope data' },
    { name: 'Audit Log', description: 'System audit trail (admin only)' },
    { name: 'Profile', description: 'Current authenticated user profile' },
    { name: 'Config', description: 'Runtime configuration management' },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from POST /api/v1/auth/login',
      },
    },
    schemas: {
      // ── Common ──────────────────────────────────────────
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string', example: 'Internal Server Error' },
          message: { type: 'string', example: 'Detailed error description' },
        },
        required: ['error'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'healthy' },
          timestamp: { type: 'string', format: 'date-time' },
          environment: { type: 'string', example: 'production' },
        },
      },
      // ── GeoJSON ─────────────────────────────────────────
      GeoJSONFeature: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'Feature' },
          geometry: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'Polygon' },
              coordinates: {
                type: 'array',
                items: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
              },
            },
          },
          properties: { $ref: '#/components/schemas/LGAProperties' },
        },
      },
      GeoJSONFeatureCollection: {
        type: 'object',
        properties: {
          type: { type: 'string', example: 'FeatureCollection' },
          features: {
            type: 'array',
            items: { $ref: '#/components/schemas/GeoJSONFeature' },
          },
        },
      },
      LGAProperties: {
        type: 'object',
        properties: {
          LGA_Name: { type: 'string', example: 'Aba North' },
          State: { type: 'string', example: 'Abia' },
          risk_level: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Minimal'], example: 'High' },
          MPI: { type: 'number', format: 'float', example: 0.3421 },
          composite_poverty_score: { type: 'number', format: 'float', example: 0.5123 },
          mean_nightlight_intensity: { type: 'number', format: 'float', example: 12.45 },
          health_facility_count: { type: 'integer', example: 5 },
          school_count: { type: 'integer', example: 12 },
          population_density: { type: 'number', format: 'float', example: 234.5 },
        },
      },
      // ── Statistics ──────────────────────────────────────
      Statistics: {
        type: 'object',
        properties: {
          totalLGAs: { type: 'integer', example: 774 },
          riskDistribution: {
            type: 'object',
            properties: {
              high: { type: 'integer', example: 120 },
              medium: { type: 'integer', example: 250 },
              low: { type: 'integer', example: 300 },
              minimal: { type: 'integer', example: 104 },
            },
          },
          averageMPI: { type: 'string', example: '0.3421' },
          averageNightlight: { type: 'string', example: '12.45' },
          statesCount: { type: 'integer', example: 36 },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      // ── Rankings ────────────────────────────────────────
      RankingEntry: {
        type: 'object',
        properties: {
          rank: { type: 'integer', example: 1 },
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          composite_poverty_score: { type: 'number', format: 'float', example: 0.8123 },
          risk_level: { type: 'string', example: 'Critical' },
          mpi: { type: 'number', format: 'float', example: 0.4521 },
        },
      },
      // ── Anomaly ─────────────────────────────────────────
      Anomaly: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          anomaly_type: { type: 'string', example: 'spike' },
          metric: { type: 'string', example: 'composite_poverty_score' },
          value: { type: 'number', format: 'float', example: 0.95 },
          baseline: { type: 'number', format: 'float', example: 0.45 },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], example: 'high' },
          detected_at: { type: 'string', format: 'date-time' },
          acknowledged: { type: 'boolean', example: false },
          acknowledged_by: { type: 'string', nullable: true },
          acknowledged_at: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      // ── Forecast ────────────────────────────────────────
      Forecast: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          forecast_date: { type: 'string', format: 'date' },
          predicted_risk_level: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Minimal'] },
          predicted_score: { type: 'number', format: 'float', example: 0.72 },
          confidence: { type: 'number', format: 'float', example: 0.85 },
          model_version: { type: 'string', example: 'v2.1' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      // ── Intervention ────────────────────────────────────
      Intervention: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          organization: { type: 'string', example: 'UNICEF' },
          intervention_type: { type: 'string', example: 'health' },
          description: { type: 'string', example: 'Mobile health clinic deployment' },
          status: { type: 'string', enum: ['planned', 'active', 'completed', 'cancelled'], example: 'active' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date', nullable: true },
          budget: { type: 'number', format: 'float', example: 500000 },
          beneficiaries: { type: 'integer', example: 5000 },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      InterventionInput: {
        type: 'object',
        required: ['lga_name', 'state', 'organization', 'intervention_type', 'status'],
        properties: {
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          organization: { type: 'string', example: 'UNICEF' },
          intervention_type: { type: 'string', example: 'health' },
          description: { type: 'string', example: 'Mobile health clinic deployment' },
          status: { type: 'string', enum: ['planned', 'active', 'completed', 'cancelled'], example: 'planned' },
          start_date: { type: 'string', format: 'date' },
          end_date: { type: 'string', format: 'date', nullable: true },
          budget: { type: 'number', format: 'float', example: 500000 },
          beneficiaries: { type: 'integer', example: 5000 },
        },
      },
      // ── Alert Subscription ──────────────────────────────
      AlertSubscription: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          lga_name: { type: 'string', nullable: true, example: 'Aba North' },
          state: { type: 'string', nullable: true, example: 'Abia' },
          alert_type: { type: 'string', enum: ['risk_change', 'anomaly', 'forecast'], example: 'risk_change' },
          notify_email: { type: 'boolean', example: true },
          notify_webhook: { type: 'boolean', example: false },
          webhook_url: { type: 'string', nullable: true, example: 'https://hooks.example.com/iophin' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      AlertSubscriptionInput: {
        type: 'object',
        properties: {
          lga_name: { type: 'string', nullable: true, example: 'Aba North' },
          state: { type: 'string', nullable: true, example: 'Abia' },
          alert_type: { type: 'string', enum: ['risk_change', 'anomaly', 'forecast'], example: 'risk_change' },
          notify_email: { type: 'boolean', example: true },
          notify_webhook: { type: 'boolean', example: false },
          webhook_url: { type: 'string', nullable: true, example: 'https://hooks.example.com/iophin' },
        },
      },
      // ── Saved View ──────────────────────────────────────
      SavedView: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Northern Nigeria High Risk' },
          share_token: { type: 'string', example: 'abc123xyz' },
          view_config: { type: 'object', description: 'Arbitrary JSON map configuration' },
          is_public: { type: 'boolean', example: false },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      // ── Auth ────────────────────────────────────────────
      RegisterInput: {
        type: 'object',
        required: ['email', 'password', 'full_name'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, description: 'At least 8 chars with one letter and one digit', example: 'SecurePass1' },
          full_name: { type: 'string', description: 'User\'s full name (required)', example: 'Amaka Obi' },
          role: { type: 'string', enum: ['admin', 'government', 'ngo', 'public', 'user'], default: 'user', description: 'Desired role (super_admin excluded from public registration)', example: 'user' },
          organization: { type: 'string', nullable: true, description: 'Organization name (relevant for government/NGO roles)', example: 'UNICEF Nigeria' },
        },
      },
      ProfileUpdateInput: {
        type: 'object',
        properties: {
          fullName: { type: 'string', description: 'Updated full name', example: 'Amaka Obi-Updated' },
          organization: { type: 'string', nullable: true, description: 'Updated organization', example: 'WHO Nigeria' },
          currentPassword: { type: 'string', description: 'Required when changing password', example: 'OldPass1' },
          newPassword: { type: 'string', minLength: 8, description: 'New password (min 8 chars, must include a letter and digit)', example: 'NewSecure2' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'SecurePass1' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          user: { $ref: '#/components/schemas/UserProfile' },
        },
      },
      // ── User ────────────────────────────────────────────
      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          full_name: { type: 'string', example: 'Amaka Obi' },
          role: { type: 'string', example: 'user' },
          organization: { type: 'string', nullable: true, example: 'UNICEF Nigeria' },
          is_active: { type: 'boolean', example: true },
          created_at: { type: 'string', format: 'date-time' },
          last_login: { type: 'string', format: 'date-time', nullable: true },
          last_active: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      UserCreateInput: {
        type: 'object',
        required: ['email', 'password', 'fullName'],
        properties: {
          username: { type: 'string', example: 'amaka_obi' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', minLength: 8, example: 'SecurePass1' },
          fullName: { type: 'string', example: 'Amaka Obi' },
          roleId: { type: 'integer', example: 3 },
          organization: { type: 'string', nullable: true, example: 'UNICEF Nigeria' },
          geographicScopes: {
            type: 'array',
            items: { type: 'string' },
            example: ['Abia', 'Lagos'],
          },
        },
      },
      UserUpdateInput: {
        type: 'object',
        properties: {
          username: { type: 'string', example: 'amaka_obi' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          fullName: { type: 'string', example: 'Amaka Obi' },
          roleId: { type: 'integer', example: 3 },
          organization: { type: 'string', nullable: true },
          isActive: { type: 'boolean', example: true },
          geographicScopes: { type: 'array', items: { type: 'string' } },
        },
      },
      PaginatedUsers: {
        type: 'object',
        properties: {
          users: { type: 'array', items: { $ref: '#/components/schemas/UserProfile' } },
          total: { type: 'integer', example: 42 },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          totalPages: { type: 'integer', example: 5 },
        },
      },
      // ── Role / Permission ────────────────────────────────
      Role: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'admin' },
          description: { type: 'string', example: 'System administrator' },
        },
      },
      Permission: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'users.view' },
          description: { type: 'string', example: 'View user list' },
        },
      },
      // ── Audit Log ───────────────────────────────────────
      AuditLogEntry: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          user_id: { type: 'string', format: 'uuid', nullable: true },
          user_email: { type: 'string', format: 'email', nullable: true },
          action: { type: 'string', example: 'user.create' },
          target_id: { type: 'string', nullable: true },
          details: { type: 'object', nullable: true },
          ip_address: { type: 'string', example: '192.168.1.1' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      // ── Config ──────────────────────────────────────────
      RuntimeConfig: {
        type: 'object',
        properties: {
          RISK_TIERING_MODE: { type: 'string', enum: ['cluster', 'absolute'], example: 'cluster' },
          ABSOLUTE_THRESHOLDS: {
            type: 'object',
            properties: {
              MINIMAL: { type: 'number', example: 0.05 },
              LOW: { type: 'number', example: 0.10 },
              MEDIUM: { type: 'number', example: 0.20 },
              HIGH: { type: 'number', example: 0.40 },
              CRITICAL: { type: 'number', example: 1.0 },
            },
          },
        },
      },
      // ── Report ──────────────────────────────────────────
      ReportInput: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['national', 'summary', 'state', 'lga'], example: 'national' },
          states: { type: 'array', items: { type: 'string' }, example: ['Abia', 'Lagos'] },
          lgas: { type: 'array', items: { type: 'string' }, example: ['Aba North', 'Ikeja'] },
          metrics: { type: 'array', items: { type: 'string' }, example: ['mpi', 'composite_poverty_score'] },
        },
      },
      // ── Correlation ─────────────────────────────────────
      CorrelationData: {
        type: 'object',
        properties: {
          metric1: { type: 'string', example: 'mpi' },
          metric2: { type: 'string', example: 'mean_nightlight_intensity' },
          correlation: { type: 'number', format: 'float', example: -0.72 },
          data_points: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                lga_name: { type: 'string' },
                state: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
              },
            },
          },
        },
      },
      // ── Temporal Trend ──────────────────────────────────
      TemporalTrend: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          lga_name: { type: 'string', example: 'Aba North' },
          composite_poverty_score: { type: 'number', format: 'float' },
          risk_level: { type: 'string', example: 'High' },
          mpi: { type: 'number', format: 'float' },
        },
      },
      // ── Change ──────────────────────────────────────────
      RecentChange: {
        type: 'object',
        properties: {
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          old_risk_level: { type: 'string', example: 'Medium' },
          new_risk_level: { type: 'string', example: 'High' },
          delta_composite: { type: 'number', format: 'float', example: 0.12 },
          changed_at: { type: 'string', format: 'date-time' },
        },
      },
      // ── Radius Result ───────────────────────────────────
      RadiusResult: {
        type: 'object',
        properties: {
          lga_name: { type: 'string', example: 'Aba North' },
          state: { type: 'string', example: 'Abia' },
          distance_km: { type: 'number', format: 'float', example: 23.4 },
          risk_level: { type: 'string', example: 'High' },
          composite_poverty_score: { type: 'number', format: 'float', example: 0.65 },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Insufficient permissions',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      ServiceUnavailable: {
        description: 'Database or service unavailable',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      InternalError: {
        description: 'Internal server error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },

  paths: {
    // ══════════════════════════════════════════════════════
    //  LEGACY / BACKWARD-COMPATIBLE ENDPOINTS
    // ══════════════════════════════════════════════════════

    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Server health check',
        description: 'Returns the current health status of the API server.',
        operationId: 'getHealth',
        responses: {
          200: {
            description: 'Server is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },

    '/api/hotspots': {
      get: {
        tags: ['Hotspots'],
        summary: 'Get all poverty hotspots (GeoJSON)',
        description: 'Returns a GeoJSON FeatureCollection of all LGA poverty hotspots. Supports optional filtering by state and risk level. Falls back to static file if database is unavailable.',
        operationId: 'getHotspots',
        parameters: [
          {
            name: 'state',
            in: 'query',
            description: 'Filter by Nigerian state name',
            schema: { type: 'string', example: 'Abia' },
          },
          {
            name: 'risk',
            in: 'query',
            description: 'Filter by risk level',
            schema: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Minimal'] },
          },
        ],
        responses: {
          200: {
            description: 'GeoJSON FeatureCollection of hotspots',
            headers: {
              'X-Data-Source': { schema: { type: 'string', enum: ['database', 'cache', 'file'] } },
              'Cache-Control': { schema: { type: 'string' } },
            },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GeoJSONFeatureCollection' } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/stats': {
      get: {
        tags: ['Statistics'],
        summary: 'Get national statistics summary',
        description: 'Returns aggregate statistics including total LGAs, risk distribution, average MPI, and nightlight intensity.',
        operationId: 'getStats',
        responses: {
          200: {
            description: 'National statistics',
            headers: {
              'X-Data-Source': { schema: { type: 'string', enum: ['database', 'cache', 'file'] } },
            },
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Statistics' } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/lga/{name}': {
      get: {
        tags: ['LGA'],
        summary: 'Get LGA by name (legacy)',
        description: 'Returns detailed data for a specific LGA by name.',
        operationId: 'getLGALegacy',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
        ],
        responses: {
          200: {
            description: 'LGA feature data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GeoJSONFeature' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/states': {
      get: {
        tags: ['States'],
        summary: 'Get state aggregations (legacy)',
        description: 'Returns aggregated poverty data grouped by Nigerian state.',
        operationId: 'getStatesLegacy',
        responses: {
          200: {
            description: 'Array of state aggregation objects',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/config': {
      get: {
        tags: ['Config'],
        summary: 'Get runtime configuration',
        description: 'Returns the current runtime configuration including risk tiering mode and absolute thresholds.',
        operationId: 'getConfig',
        responses: {
          200: {
            description: 'Runtime configuration',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RuntimeConfig' } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Config'],
        summary: 'Update runtime configuration',
        description: 'Updates the risk tiering mode. Requires `super_admin` or `admin` role.',
        operationId: 'updateConfig',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['RISK_TIERING_MODE'],
                properties: {
                  RISK_TIERING_MODE: { type: 'string', enum: ['cluster', 'absolute'], example: 'cluster' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Configuration updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    RISK_TIERING_MODE: { type: 'string', example: 'cluster' },
                  },
                },
              },
            },
          },
          400: { description: 'Invalid RISK_TIERING_MODE', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/history/{lga}': {
      get: {
        tags: ['LGA'],
        summary: 'Get historical data for an LGA (legacy)',
        description: 'Returns historical poverty score records for a specific LGA.',
        operationId: 'getLGAHistoryLegacy',
        parameters: [
          {
            name: 'lga',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of records (max 365)',
            schema: { type: 'integer', default: 30, maximum: 365 },
          },
        ],
        responses: {
          200: {
            description: 'Historical records array',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TemporalTrend' } } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/rankings': {
      get: {
        tags: ['Rankings'],
        summary: 'Get LGA rankings (legacy)',
        description: 'Returns LGAs ranked by composite poverty score.',
        operationId: 'getRankingsLegacy',
        parameters: [
          {
            name: 'order',
            in: 'query',
            description: 'Sort order: worst (highest poverty) or best (lowest poverty)',
            schema: { type: 'string', enum: ['worst', 'best'], default: 'worst' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results (max 100)',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Ranked LGA list',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RankingEntry' } } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ══════════════════════════════════════════════════════
    //  V1 API ENDPOINTS
    // ══════════════════════════════════════════════════════

    // ── Auth ──────────────────────────────────────────────
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        description: 'Creates a new user account with auto-login. Returns a JWT token, user profile, and permissions. Password must be at least 8 characters with at least one letter and one digit. Full name is required.',
        operationId: 'registerUser',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } },
        },
        responses: {
          201: {
            description: 'User registered and auto-logged-in',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', description: 'JWT token for immediate use', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    user: {
                      allOf: [
                        { $ref: '#/components/schemas/UserProfile' },
                        { type: 'object', properties: { permissions: { type: 'array', items: { type: 'string' }, example: ['interventions.view'] } } },
                      ],
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Validation error (invalid email, weak password, missing full_name, duplicate email)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/auth/roles': {
      get: {
        tags: ['Auth'],
        summary: 'Get available registration roles',
        description: 'Returns all roles available for public registration (excludes super_admin). No authentication required. Useful for populating role dropdowns on registration forms.',
        operationId: 'getAuthRoles',
        responses: {
          200: {
            description: 'Array of available roles',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Role' },
                  example: [
                    { id: 2, name: 'admin', description: 'System administrator' },
                    { id: 3, name: 'user', description: 'Regular user' },
                    { id: 4, name: 'government', description: 'Government official' },
                    { id: 5, name: 'ngo', description: 'NGO representative' },
                    { id: 6, name: 'public', description: 'Public viewer' },
                  ],
                },
              },
            },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and obtain JWT token',
        description: 'Authenticates a user and returns a JWT token valid for 7 days. Response includes the user\'s permissions array for client-side RBAC.',
        operationId: 'loginUser',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
                    user: {
                      allOf: [
                        { $ref: '#/components/schemas/UserProfile' },
                        { type: 'object', properties: { permissions: { type: 'array', items: { type: 'string' }, example: ['users.view', 'interventions.create'] } } },
                      ],
                    },
                  },
                },
              },
            },
          },
          400: { description: 'Missing email or password', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { description: 'Invalid credentials or deactivated account', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },

    // ── Hotspots V1 ───────────────────────────────────────
    '/api/v1/hotspots': {
      get: {
        tags: ['Hotspots'],
        summary: 'Get all poverty hotspots (v1)',
        description: 'Returns a GeoJSON FeatureCollection of all LGA poverty hotspots with optional state and risk filters.',
        operationId: 'getHotspotsV1',
        parameters: [
          {
            name: 'state',
            in: 'query',
            description: 'Filter by Nigerian state name',
            schema: { type: 'string', example: 'Abia' },
          },
          {
            name: 'risk',
            in: 'query',
            description: 'Filter by risk level',
            schema: { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low', 'Minimal'] },
          },
        ],
        responses: {
          200: {
            description: 'GeoJSON FeatureCollection',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/GeoJSONFeatureCollection' } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/hotspots/within-radius': {
      get: {
        tags: ['Hotspots'],
        summary: 'Get LGAs within a radius',
        description: 'Returns all LGAs within a specified radius (km) of a geographic coordinate.',
        operationId: 'getHotspotsWithinRadius',
        parameters: [
          {
            name: 'lat',
            in: 'query',
            required: true,
            description: 'Latitude of center point',
            schema: { type: 'number', format: 'float', example: 6.5244 },
          },
          {
            name: 'lon',
            in: 'query',
            required: true,
            description: 'Longitude of center point',
            schema: { type: 'number', format: 'float', example: 3.3792 },
          },
          {
            name: 'radius',
            in: 'query',
            description: 'Search radius in kilometers (default: 50)',
            schema: { type: 'number', format: 'float', default: 50, example: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Array of LGAs within radius',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RadiusResult' } } } },
          },
          400: { description: 'Missing lat or lon parameters', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Stats V1 ──────────────────────────────────────────
    '/api/v1/stats': {
      get: {
        tags: ['Statistics'],
        summary: 'Get national statistics (v1)',
        description: 'Returns aggregate national poverty statistics.',
        operationId: 'getStatsV1',
        responses: {
          200: {
            description: 'National statistics',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Statistics' } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── LGA V1 ────────────────────────────────────────────
    '/api/v1/lga/{name}': {
      get: {
        tags: ['LGA'],
        summary: 'Get LGA detail by name',
        description: 'Returns detailed poverty data for a specific LGA.',
        operationId: 'getLGAV1',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
        ],
        responses: {
          200: {
            description: 'LGA detail data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LGAProperties' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/lga/{name}/trends': {
      get: {
        tags: ['LGA'],
        summary: 'Get temporal trends for an LGA',
        description: 'Returns time-series poverty score data for a specific LGA.',
        operationId: 'getLGATrends',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
        ],
        responses: {
          200: {
            description: 'Array of temporal trend records',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/TemporalTrend' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/lga/{name}/forecast': {
      get: {
        tags: ['LGA'],
        summary: 'Get forecasts for an LGA',
        description: 'Returns predictive risk forecasts for a specific LGA.',
        operationId: 'getLGAForecast',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
        ],
        responses: {
          200: {
            description: 'Array of forecast records',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Forecast' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/lga/{name}/anomalies': {
      get: {
        tags: ['LGA'],
        summary: 'Get anomalies for an LGA',
        description: 'Returns active anomalies detected for a specific LGA.',
        operationId: 'getLGAAnomalies',
        parameters: [
          {
            name: 'name',
            in: 'path',
            required: true,
            description: 'URL-encoded LGA name',
            schema: { type: 'string', example: 'Aba%20North' },
          },
        ],
        responses: {
          200: {
            description: 'Array of anomaly records',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Anomaly' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── States V1 ─────────────────────────────────────────
    '/api/v1/states': {
      get: {
        tags: ['States'],
        summary: 'Get state aggregations (v1)',
        description: 'Returns poverty data aggregated by Nigerian state.',
        operationId: 'getStatesV1',
        responses: {
          200: {
            description: 'Array of state aggregation objects',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Rankings V1 ───────────────────────────────────────
    '/api/v1/rankings': {
      get: {
        tags: ['Rankings'],
        summary: 'Get LGA rankings (v1)',
        description: 'Returns LGAs ranked by composite poverty score.',
        operationId: 'getRankingsV1',
        parameters: [
          {
            name: 'order',
            in: 'query',
            description: 'Sort order: worst (highest poverty) or best (lowest poverty)',
            schema: { type: 'string', enum: ['worst', 'best'], default: 'worst' },
          },
          {
            name: 'limit',
            in: 'query',
            description: 'Number of results (max 100)',
            schema: { type: 'integer', default: 20, maximum: 100 },
          },
        ],
        responses: {
          200: {
            description: 'Ranked LGA list',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RankingEntry' } } } },
          },
          503: { $ref: '#/components/responses/ServiceUnavailable' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Changes ───────────────────────────────────────────
    '/api/v1/changes': {
      get: {
        tags: ['Changes'],
        summary: 'Get recent risk-level changes',
        description: 'Returns LGAs that have had risk level changes within the specified number of days.',
        operationId: 'getRecentChanges',
        parameters: [
          {
            name: 'days',
            in: 'query',
            description: 'Number of days to look back (max 90)',
            schema: { type: 'integer', default: 7, maximum: 90 },
          },
        ],
        responses: {
          200: {
            description: 'Array of recent change records',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/RecentChange' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Anomalies ─────────────────────────────────────────
    '/api/v1/anomalies': {
      get: {
        tags: ['Anomalies'],
        summary: 'Get all active anomalies',
        description: 'Returns all currently active (unacknowledged) anomalies across all LGAs.',
        operationId: 'getAnomalies',
        responses: {
          200: {
            description: 'Array of active anomalies',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Anomaly' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/anomalies/{id}/acknowledge': {
      patch: {
        tags: ['Anomalies'],
        summary: 'Acknowledge an anomaly',
        description: 'Marks an anomaly as acknowledged by the current authenticated user.',
        operationId: 'acknowledgeAnomaly',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Anomaly UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Anomaly acknowledged',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Anomaly' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Forecasts ─────────────────────────────────────────
    '/api/v1/forecasts': {
      get: {
        tags: ['Forecasts'],
        summary: 'Get all forecasts',
        description: 'Returns predictive risk forecasts for all LGAs.',
        operationId: 'getForecasts',
        responses: {
          200: {
            description: 'Array of forecast records',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Forecast' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/forecasts/escalations': {
      get: {
        tags: ['Forecasts'],
        summary: 'Get escalation candidates',
        description: 'Returns LGAs predicted to escalate to a higher risk level.',
        operationId: 'getForecastEscalations',
        responses: {
          200: {
            description: 'Array of escalation candidate forecasts',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Forecast' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Correlation ───────────────────────────────────────
    '/api/v1/correlation/{metric1}/{metric2}': {
      get: {
        tags: ['Correlation'],
        summary: 'Get correlation between two metrics',
        description: 'Returns correlation coefficient and scatter plot data between two poverty metrics.',
        operationId: 'getCorrelation',
        parameters: [
          {
            name: 'metric1',
            in: 'path',
            required: true,
            description: 'First metric name',
            schema: { type: 'string', example: 'mpi', enum: ['mpi', 'composite_poverty_score', 'mean_nightlight_intensity', 'health_facility_count', 'school_count', 'population_density'] },
          },
          {
            name: 'metric2',
            in: 'path',
            required: true,
            description: 'Second metric name',
            schema: { type: 'string', example: 'mean_nightlight_intensity', enum: ['mpi', 'composite_poverty_score', 'mean_nightlight_intensity', 'health_facility_count', 'school_count', 'population_density'] },
          },
        ],
        responses: {
          200: {
            description: 'Correlation data with scatter plot points',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CorrelationData' } } },
          },
          400: { description: 'Invalid metric names', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Interventions ─────────────────────────────────────
    '/api/v1/interventions': {
      get: {
        tags: ['Interventions'],
        summary: 'Get all interventions',
        description: 'Returns a list of aid and development interventions with optional filters.',
        operationId: 'getInterventions',
        parameters: [
          {
            name: 'state',
            in: 'query',
            description: 'Filter by state',
            schema: { type: 'string', example: 'Abia' },
          },
          {
            name: 'status',
            in: 'query',
            description: 'Filter by intervention status',
            schema: { type: 'string', enum: ['planned', 'active', 'completed', 'cancelled'] },
          },
          {
            name: 'organization',
            in: 'query',
            description: 'Filter by organization name',
            schema: { type: 'string', example: 'UNICEF' },
          },
        ],
        responses: {
          200: {
            description: 'Array of interventions',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Intervention' } } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Interventions'],
        summary: 'Create a new intervention',
        description: 'Creates a new aid/development intervention record. Requires `super_admin`, `admin`, `government`, or `ngo` role.',
        operationId: 'createIntervention',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/InterventionInput' } } },
        },
        responses: {
          201: {
            description: 'Intervention created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Intervention' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/interventions/{id}': {
      put: {
        tags: ['Interventions'],
        summary: 'Update an intervention',
        description: 'Updates an existing intervention record. Requires `super_admin`, `admin`, `government`, or `ngo` role.',
        operationId: 'updateIntervention',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Intervention UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/InterventionInput' } } },
        },
        responses: {
          200: {
            description: 'Intervention updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Intervention' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Alerts ────────────────────────────────────────────
    '/api/v1/alerts/my': {
      get: {
        tags: ['Alerts'],
        summary: 'Get my alert subscriptions',
        description: 'Returns all alert subscriptions for the authenticated user.',
        operationId: 'getMyAlerts',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of alert subscriptions',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AlertSubscription' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/alerts/subscribe': {
      post: {
        tags: ['Alerts'],
        summary: 'Subscribe to alerts',
        description: 'Creates a new alert subscription for the authenticated user. Subscribe to risk changes or anomalies for a specific LGA or state.',
        operationId: 'subscribeAlert',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AlertSubscriptionInput' } } },
        },
        responses: {
          201: {
            description: 'Subscription created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AlertSubscription' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/alerts/{id}': {
      delete: {
        tags: ['Alerts'],
        summary: 'Delete an alert subscription',
        description: 'Removes an alert subscription. Users can only delete their own subscriptions.',
        operationId: 'deleteAlert',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Alert subscription UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Subscription deleted',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Saved Views ───────────────────────────────────────
    '/api/v1/saved-views': {
      get: {
        tags: ['Saved Views'],
        summary: 'Get my saved views',
        description: 'Returns all saved map views for the authenticated user.',
        operationId: 'getSavedViews',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of saved views',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SavedView' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Saved Views'],
        summary: 'Create a saved view',
        description: 'Saves a map view configuration with a shareable token.',
        operationId: 'createSavedView',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'view_config'],
                properties: {
                  name: { type: 'string', example: 'Northern Nigeria High Risk' },
                  view_config: { type: 'object', description: 'Arbitrary JSON map configuration object' },
                  is_public: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Saved view created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedView' } } },
          },
          400: { description: 'Missing name or view_config', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/saved-views/{token}': {
      get: {
        tags: ['Saved Views'],
        summary: 'Get a saved view by share token',
        description: 'Returns a saved view by its public share token. No authentication required for public views.',
        operationId: 'getSavedViewByToken',
        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            description: 'Share token for the saved view',
            schema: { type: 'string', example: 'abc123xyz' },
          },
        ],
        responses: {
          200: {
            description: 'Saved view data',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SavedView' } } },
          },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Reports ───────────────────────────────────────────
    '/api/v1/reports/generate': {
      post: {
        tags: ['Reports'],
        summary: 'Generate a PDF report',
        description: 'Generates and streams a PDF report. Supports national, state-level, and LGA-level scopes.',
        operationId: 'generateReport',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReportInput' } } },
        },
        responses: {
          200: {
            description: 'PDF file stream',
            headers: {
              'Content-Type': { schema: { type: 'string', example: 'application/pdf' } },
              'Content-Disposition': { schema: { type: 'string', example: 'attachment; filename="iophin_report_1234567890.pdf"' } },
            },
            content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Roles & Permissions ───────────────────────────────
    '/api/v1/roles': {
      get: {
        tags: ['Roles & Permissions'],
        summary: 'Get all roles',
        description: 'Returns all available user roles in the system.',
        operationId: 'getRoles',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of roles',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Role' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/permissions': {
      get: {
        tags: ['Roles & Permissions'],
        summary: 'Get all permissions',
        description: 'Returns all available permissions in the system.',
        operationId: 'getPermissions',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of permissions',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Permission' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/roles/{id}/permissions': {
      get: {
        tags: ['Roles & Permissions'],
        summary: 'Get permissions for a role',
        description: 'Returns all permissions assigned to a specific role.',
        operationId: 'getRolePermissions',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'Role ID',
            schema: { type: 'integer', example: 2 },
          },
        ],
        responses: {
          200: {
            description: 'Array of permissions for the role',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Permission' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── User Management ───────────────────────────────────
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'List all users',
        description: 'Returns a paginated list of users. Requires `users.view` permission.',
        operationId: 'getUsers',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'search', in: 'query', description: 'Search by name or email', schema: { type: 'string' } },
          { name: 'role', in: 'query', description: 'Filter by role name', schema: { type: 'string' } },
          { name: 'state', in: 'query', description: 'Filter by geographic scope state', schema: { type: 'string' } },
        ],
        responses: {
          200: {
            description: 'Paginated user list',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PaginatedUsers' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Create a new user',
        description: 'Creates a new user account. Requires `users.create` permission.',
        operationId: 'createUser',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserCreateInput' } } },
        },
        responses: {
          201: {
            description: 'User created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
          },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user by ID',
        description: 'Returns a specific user by their UUID. Requires `users.view` permission.',
        operationId: 'getUserById',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User profile',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        tags: ['Users'],
        summary: 'Update a user',
        description: 'Updates a user\'s profile, role, or geographic scopes. Requires `users.edit` permission.',
        operationId: 'updateUser',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/UserUpdateInput' } } },
        },
        responses: {
          200: {
            description: 'User updated',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          409: { description: 'Email already exists', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Permanently delete a user',
        description: 'Permanently deletes a user account. Requires super_admin role.',
        operationId: 'deleteUser',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User deleted',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean', example: true } } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/users/{id}/revoke': {
      patch: {
        tags: ['Users'],
        summary: 'Revoke user access',
        description: 'Deactivates a user account (soft delete). Requires `users.delete` permission.',
        operationId: 'revokeUserAccess',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User access revoked',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/users/{id}/restore': {
      patch: {
        tags: ['Users'],
        summary: 'Restore user access',
        description: 'Reactivates a previously deactivated user account. Requires `users.edit` permission.',
        operationId: 'restoreUserAccess',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'User access restored',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    user: { $ref: '#/components/schemas/UserProfile' },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/users/{id}/scopes': {
      get: {
        tags: ['Geographic Scopes'],
        summary: 'Get geographic scopes for a user',
        description: 'Returns the geographic scopes (states/LGAs) assigned to a specific user.',
        operationId: 'getUserScopes',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'User UUID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          200: {
            description: 'Array of geographic scope objects',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Geographic Scopes ─────────────────────────────────
    '/api/v1/geographic-scopes/states': {
      get: {
        tags: ['Geographic Scopes'],
        summary: 'Get list of Nigerian states',
        description: 'Returns the list of all 36 Nigerian states plus FCT.',
        operationId: 'getNigerianStates',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of state names',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'string' }, example: ['Abia', 'Adamawa', 'Anambra'] } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/geographic-scopes/states-with-lga': {
      get: {
        tags: ['Geographic Scopes'],
        summary: 'Get states with their LGAs',
        description: 'Returns all Nigerian states with their associated LGAs for geographic scope assignment.',
        operationId: 'getStatesWithLGA',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of state objects with LGA lists',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      state: { type: 'string', example: 'Abia' },
                      lgas: { type: 'array', items: { type: 'string' }, example: ['Aba North', 'Aba South'] },
                    },
                  },
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Audit Log ─────────────────────────────────────────
    '/api/v1/audit-log': {
      get: {
        tags: ['Audit Log'],
        summary: 'Get audit log',
        description: 'Returns a paginated audit log of system actions. Requires `users.view` permission.',
        operationId: 'getAuditLog',
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'userId', in: 'query', description: 'Filter by user UUID', schema: { type: 'string', format: 'uuid' } },
          { name: 'action', in: 'query', description: 'Filter by action type', schema: { type: 'string', example: 'user.create' } },
        ],
        responses: {
          200: {
            description: 'Array of audit log entries',
            content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLogEntry' } } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    // ── Profile ───────────────────────────────────────────
    '/api/v1/me': {
      get: {
        tags: ['Profile'],
        summary: 'Get current user profile',
        description: 'Returns the full profile of the currently authenticated user, including their permissions array.',
        operationId: 'getMe',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Current user profile with permissions',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/UserProfile' },
                    { type: 'object', properties: { permissions: { type: 'array', items: { type: 'string' }, example: ['users.view', 'interventions.create'] } } },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
      put: {
        tags: ['Profile'],
        summary: 'Update own profile',
        description: 'Updates the authenticated user profile (full name, organization). Optionally changes password by providing currentPassword and newPassword. Returns the updated profile with permissions.',
        operationId: 'updateMe',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileUpdateInput' } } },
        },
        responses: {
          200: {
            description: 'Profile updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/UserProfile' },
                    { type: 'object', properties: { permissions: { type: 'array', items: { type: 'string' } } } },
                  ],
                },
              },
            },
          },
          400: {
            description: 'Validation error (incorrect current password, weak new password)',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          404: { $ref: '#/components/responses/NotFound' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/me/make-super-admin': {
      post: {
        tags: ['Profile'],
        summary: 'Promote self to super admin (first-time setup)',
        description: 'Promotes the currently authenticated user to the `super_admin` role. **Only works when no super admin exists in the system yet** (first-time setup). If a super admin already exists, only existing super admins can use this endpoint. Logs the action to the audit trail.',
        operationId: 'makeMeSuperAdmin',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Successfully promoted to super admin',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/UserProfile' },
                    {
                      type: 'object',
                      properties: {
                        permissions: { type: 'array', items: { type: 'string' } },
                        message: { type: 'string', example: 'Successfully promoted to Super Administrator' },
                      },
                    },
                  ],
                },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: {
            description: 'Super admin already exists and current user is not a super admin',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
          },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },

    '/api/v1/me/permissions': {
      get: {
        tags: ['Profile'],
        summary: 'Get current user permissions',
        description: 'Returns all permissions granted to the currently authenticated user.',
        operationId: 'getMyPermissions',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Array of permission names',
            content: { 'application/json': { schema: { type: 'array', items: { type: 'string' }, example: ['users.view', 'interventions.create'] } } },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          500: { $ref: '#/components/responses/InternalError' },
        },
      },
    },
  },
};

export default swaggerSpec;
