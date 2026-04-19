/**
 * openapi-spec — minimal hand-curated OpenAPI 3.1 spec (API-19).
 *
 * SIS has 50+ API routes; maintaining a 100 % auto-generated spec
 * would need a Zod-to-OpenAPI pipeline and discipline across every
 * route handler. That's out of scope for this initial pass.
 *
 * This module ships a hand-curated spec covering the endpoints most
 * likely to be called by external integrators (cron targets, mon-
 * itoring probes, feature-flagged primary surfaces). Good enough to
 * be pasted into Swagger UI / Redoc / Postman / client code
 * generators. Feature-flagged endpoints are included with their
 * 404-when-off behaviour documented in the description so integrators
 * know the feature-flag interaction.
 *
 * Kept in a plain TypeScript object (not YAML / JSON file) so
 * TypeScript catches drift between the spec and the route handlers
 * when they share types.
 *
 * Served via `GET /api/v1/openapi.json`.
 */

/** OpenAPI 3.1 root document type — hand-minimal, not the full
 *  spec. Fields we don't use (webhooks, security schemes beyond
 *  a bearer stub, component registries) are omitted. */
export interface OpenApiDoc {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, unknown>;
  };
}

interface OpenApiOperation {
  summary: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header";
    required?: boolean;
    description?: string;
    schema: { type: string; enum?: string[]; format?: string };
  }>;
  requestBody?: {
    required?: boolean;
    content: { "application/json": { schema: unknown } };
  };
  responses: Record<string, {
    description: string;
    content?: { "application/json": { schema: unknown } };
  }>;
}

// ─── Shared schema fragments ─────────────────────────────────────
const SuccessEnvelope = (dataSchema: unknown) => ({
  type: "object",
  required: ["ok", "data"],
  properties: {
    ok: { type: "boolean", const: true },
    data: dataSchema,
  },
});

const ErrorEnvelope = {
  type: "object",
  required: ["ok", "error"],
  properties: {
    ok: { type: "boolean", const: false },
    error: {
      type: "object",
      properties: {
        message: { type: "string" },
        code: { type: "string" },
      },
    },
  },
};

const PaginationEnvelope = {
  type: "object",
  required: ["total", "offset", "limit", "returned", "hasMore"],
  properties: {
    total: { type: "integer", description: "Full row count" },
    offset: { type: "integer" },
    limit: { type: "integer" },
    returned: { type: "integer", description: "Rows in this page" },
    hasMore: { type: "boolean" },
  },
};

const PaginationParams = [
  {
    name: "offset",
    in: "query" as const,
    description: "Number of rows to skip. Default 0. Max 10000.",
    schema: { type: "integer" },
  },
  {
    name: "limit",
    in: "query" as const,
    description: "Page size. Default 50. Max 500.",
    schema: { type: "integer" },
  },
];

// ─── The spec ────────────────────────────────────────────────────

export const OPENAPI_DOC: OpenApiDoc = {
  openapi: "3.1.0",
  info: {
    title: "Strategic Intelligence System — API",
    version: "1.0.0",
    description:
      "SIS is a strategic-intelligence platform for trend analysis, signal monitoring, and team-level forecasting. This is a minimal curated spec covering the primary external-facing endpoints. Not every internal route is documented — scope is discoverability for monitoring probes, integrators, and API consumers. Feature-flagged routes (/forecasts/*, some /clusters/*) return 404 when their flag is unset — the shape is identical to any other not-found response.",
  },
  servers: [
    { url: "/api/v1", description: "API v1 (current)" },
  ],
  paths: {
    // ─── Health ──────────────────────────────────────────────────
    "/health": {
      get: {
        summary: "Liveness / readiness probe",
        description:
          "Unauthenticated. Suitable for k8s readiness probes, Vercel monitoring, BetterUptime etc. Returns 200 when DB is reachable, 503 when not.",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Healthy or pipeline-stale-but-up",
            content: { "application/json": { schema: {
              type: "object",
              properties: {
                ok: { type: "boolean" },
                uptimeMs: { type: "number" },
                timestamp: { type: "string", format: "date-time" },
                db: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    dialect: { type: "string", enum: ["sqlite", "postgres"] },
                  },
                },
                pipeline: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    newestSignalAgeHours: { type: "number", nullable: true },
                    signalsLast72h: { type: "integer", nullable: true },
                  },
                },
              },
            } } },
          },
          "503": {
            description: "DB unreachable",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
    },

    // ─── Clusters ────────────────────────────────────────────────
    "/clusters": {
      get: {
        summary: "List topic clusters",
        description:
          "Catalogue of topic clusters that have at least one pipeline-generated snapshot. Paginated.",
        tags: ["Clusters"],
        parameters: PaginationParams,
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({
              type: "object",
              properties: {
                count: { type: "integer" },
                clusters: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ClusterCatalogEntry" },
                },
                pagination: PaginationEnvelope,
              },
            }) } },
          },
        },
      },
    },
    "/clusters/{id}/history": {
      get: {
        summary: "Cluster snapshot time-series",
        description:
          "Reverse-chronological snapshot history for one cluster. Perigon-style history with SIS's added `foresight[]` slot. Paginated.",
        tags: ["Clusters"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            description: "Cluster slug (from `/clusters` catalogue)",
            schema: { type: "string" },
          },
          ...PaginationParams,
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({
              type: "object",
              properties: {
                clusterId: { type: "string" },
                topic: { type: "string", nullable: true },
                count: { type: "integer" },
                snapshots: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ClusterSnapshot" },
                },
                pagination: PaginationEnvelope,
              },
            }) } },
          },
        },
      },
    },

    // ─── Forecasts (feature-flagged) ─────────────────────────────
    "/forecasts": {
      get: {
        summary: "List forecasts in the active tenant",
        description:
          "Tenant-scoped. Requires `FORECASTS_ENABLED=true` — otherwise 404. Paginated.",
        tags: ["Forecasts"],
        parameters: [
          {
            name: "state",
            in: "query",
            description: "Filter by forecast state.",
            schema: { type: "string", enum: ["DRAFT", "OPEN", "CLOSED", "PENDING_RESOLUTION", "RESOLVED", "CANCELLED"] },
          },
          ...PaginationParams,
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({
              type: "object",
              properties: {
                count: { type: "integer" },
                forecasts: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Forecast" },
                },
                pagination: PaginationEnvelope,
              },
            }) } },
          },
          "404": {
            description: "Feature flag off, or resource not found",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
      post: {
        summary: "Create a forecast (member+)",
        description: "Tenant role `member` or higher. Feature-flagged.",
        tags: ["Forecasts"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["question"],
            properties: {
              question: { type: "string", maxLength: 500 },
              description: { type: "string", maxLength: 4000, nullable: true },
              closeAt: { type: "string", format: "date-time", nullable: true },
              state: { type: "string", enum: ["DRAFT", "OPEN"] },
            },
          } } },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: SuccessEnvelope({ $ref: "#/components/schemas/Forecast" }) } },
          },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
    },
    "/forecasts/{id}": {
      get: {
        summary: "Single forecast with positions",
        description:
          "Returns the forecast + all positions + derived team-mean probability.",
        tags: ["Forecasts"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({
              allOf: [
                { $ref: "#/components/schemas/Forecast" },
                {
                  type: "object",
                  properties: {
                    positions: { type: "array", items: { $ref: "#/components/schemas/ForecastPosition" } },
                    derivedYesProbability: { type: "number", nullable: true, minimum: 0, maximum: 1 },
                  },
                },
              ],
            }) } },
          },
          "404": {
            description: "Feature flag off, or forecast not in this tenant",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
    },
    "/forecasts/{id}/positions": {
      post: {
        summary: "Stake your probability estimate",
        description:
          "Upsert the caller's position on this forecast. Idempotent per (forecast, user). Fails if the forecast isn't OPEN or the close date has passed.",
        tags: ["Forecasts"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            type: "object",
            required: ["yesProbability"],
            properties: {
              yesProbability: { type: "number", minimum: 0, maximum: 1 },
              rationale: { type: "string", maxLength: 2000, nullable: true },
            },
          } } },
        },
        responses: {
          "201": {
            description: "Position recorded (or upserted)",
            content: { "application/json": { schema: SuccessEnvelope({ $ref: "#/components/schemas/ForecastPosition" }) } },
          },
          "400": {
            description: "Probability out of range, or forecast not OPEN",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
          "404": {
            description: "FORECASTS_ENABLED feature flag is unset",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
    },
    "/forecasts/{id}/resolve": {
      post: {
        summary: "Propose or approve a resolution (admin+)",
        description:
          "Two-signer workflow. First call (action: propose) transitions to PENDING_RESOLUTION. Second call (action: approve) by a DIFFERENT admin transitions to RESOLVED. Same-user self-approval rejected.",
        tags: ["Forecasts"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: {
            oneOf: [
              {
                type: "object",
                required: ["action", "resolution", "rationale"],
                properties: {
                  action: { type: "string", enum: ["propose"] },
                  resolution: { type: "string", enum: ["YES", "NO", "PARTIAL", "CANCEL"] },
                  rationale: { type: "string", minLength: 1, maxLength: 2000 },
                },
              },
              {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["approve"] },
                },
              },
            ],
          } } },
        },
        responses: {
          "200": {
            description: "Proposed or approved",
            content: { "application/json": { schema: SuccessEnvelope({ $ref: "#/components/schemas/Forecast" }) } },
          },
          "400": {
            description: "Invalid transition, or proposer === approver",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
          "404": {
            description: "FORECASTS_ENABLED feature flag is unset",
            content: { "application/json": { schema: ErrorEnvelope } },
          },
        },
      },
    },
    "/forecasts/calibration": {
      get: {
        summary: "Tenant calibration leaderboard",
        description:
          "Per-user mean Brier scores, sorted best-calibrated first. Filters out users with too few resolved predictions (default 3) to avoid ranking on noise. Requires `FORECASTS_ENABLED=true` — otherwise 404.",
        tags: ["Forecasts"],
        parameters: [
          {
            name: "min",
            in: "query",
            description: "Minimum resolved predictions to qualify. Default 3.",
            schema: { type: "integer" },
          },
          ...PaginationParams,
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({
              type: "object",
              properties: {
                count: { type: "integer" },
                leaderboard: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CalibrationLeaderboardRow" },
                },
                pagination: PaginationEnvelope,
              },
            }) } },
          },
        },
      },
    },
    "/forecasts/calibration/{userId}": {
      get: {
        summary: "Per-user calibration summary",
        description:
          "Decile-bucketed calibration curve shape for one user. Suitable for plotting against a y=x reference diagonal. Requires `FORECASTS_ENABLED=true` — otherwise 404.",
        tags: ["Forecasts"],
        parameters: [
          { name: "userId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Success",
            content: { "application/json": { schema: SuccessEnvelope({ $ref: "#/components/schemas/CalibrationSummary" }) } },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      ClusterCatalogEntry: {
        type: "object",
        properties: {
          clusterId: { type: "string", description: "URL-safe slug" },
          topic: { type: "string" },
          latestAt: { type: "string", format: "date-time" },
          snapshotCount: { type: "integer" },
          latestSignalCount: { type: "integer" },
        },
      },
      ClusterSnapshot: {
        type: "object",
        properties: {
          id: { type: "string" },
          triggeredAt: { type: "string", format: "date-time" },
          signalCount: { type: "integer" },
          signalIds: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          changelog: {
            type: "string", nullable: true,
            description: "LLM-generated one-sentence diff vs prior snapshot. Null when CLUSTER_DIFF_LLM_ENABLED is unset or this is the first snapshot.",
          },
          foresight: {
            type: "array", nullable: true,
            description: "LLM-generated forward scenarios. Null when CLUSTER_FORESIGHT_LLM_ENABLED is unset.",
            items: {
              type: "object",
              properties: {
                scenario: { type: "string", maxLength: 80 },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                drivers: { type: "array", items: { type: "string" }, maxItems: 3 },
              },
            },
          },
        },
      },
      Forecast: {
        type: "object",
        properties: {
          id: { type: "string" },
          tenantId: { type: "string" },
          question: { type: "string" },
          description: { type: "string", nullable: true },
          state: { type: "string", enum: ["DRAFT", "OPEN", "CLOSED", "PENDING_RESOLUTION", "RESOLVED", "CANCELLED"] },
          closeAt: { type: "string", format: "date-time", nullable: true },
          resolvedAt: { type: "string", format: "date-time", nullable: true },
          resolution: { type: "string", enum: ["YES", "NO", "PARTIAL", "CANCEL"], nullable: true },
          resolutionRationale: { type: "string", nullable: true },
          resolvedBy: { type: "string", nullable: true },
          resolutionApprover: { type: "string", nullable: true },
          createdBy: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ForecastPosition: {
        type: "object",
        properties: {
          id: { type: "string" },
          forecastId: { type: "string" },
          userId: { type: "string" },
          yesProbability: { type: "number", minimum: 0, maximum: 1 },
          rationale: { type: "string", nullable: true },
          stakedAt: { type: "string", format: "date-time" },
        },
      },
      CalibrationSummary: {
        type: "object",
        properties: {
          user: { type: "string" },
          totalResolved: { type: "integer" },
          meanBrier: {
            type: "number", nullable: true, minimum: 0, maximum: 1,
            description: "0 = perfect, 0.25 = always 50:50, 1 = maximally wrong. Null with zero resolved.",
          },
          buckets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                bucketMid: { type: "number", minimum: 0, maximum: 1 },
                count: { type: "integer" },
                observedRate: { type: "number", nullable: true },
              },
            },
          },
        },
      },
      CalibrationLeaderboardRow: {
        type: "object",
        properties: {
          userId: { type: "string" },
          totalResolved: { type: "integer" },
          meanBrier: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};
