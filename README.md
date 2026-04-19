# Strategic Intelligence System (SIS)

A multi-tenant strategic intelligence platform: combine live signals
from 56 public data sources with a curated trend radar, causal network,
and strategic canvas to answer forward-looking business questions.

## What you can do in the app

- **Ask a strategic question** on the home page → the 7-stage LLM
  pipeline runs (Frage → Signale → Trends → Kausal → Erkenntnisse →
  Szenarien → Empfehlungen) and returns a structured briefing.
- **Explore the knowledge base** at `/cockpit`: the trend radar, causal
  network, live signal stream, and all data sources in one view.
- **Work in a node canvas** at `/canvas`: each query becomes a node,
  follow-ups branch off, the whole strategic thinking is persistent.
- **Run multiple organisations** side by side — the switcher in the
  header lets members switch tenants; tenant data is fully isolated.

## Stack

- Next.js 15 (App Router), React 19
- TypeScript (strict), Tailwind 4
- NextAuth v5 (email magic link, Drizzle adapter)
- Drizzle ORM — Postgres in prod, SQLite locally
- 56 native connectors in `src/connectors/` + a matcher in
  `src/lib/trend-signal-match.ts`
- Resend (email) + nodemailer SMTP fallback

## Local setup

```bash
npm install
npm run db:setup       # init SQLite + seed trends
npm run dev            # http://localhost:3000
```

No `DATABASE_URL` → auto-fallback to `local.db` (better-sqlite3). Set
`DATABASE_URL=postgres://…` to switch to Supabase/Neon.

### First admin bootstrap

Production deployments start with zero users. Sign in once with the
email you want as the first admin (magic link via Resend or SMTP), then
promote that user from the shell:

```bash
npm run tenant:bootstrap -- you@example.com
```

The banner on `/admin` shows the exact command if no system admin
exists yet.

## Signals pipeline

The pipeline runs every 4h in production via Vercel Cron
(`/api/v1/cron`). Locally you can trigger it on demand:

```bash
npm run signals:pump      # full pipeline run (~15 s)
npm run signals:status    # per-source freshness table
```

9 of the 56 connectors require API keys (Guardian, Finnhub, FRED,
NewsAPI, NewsData, NYT, ACLED, Open Exchange, optional GitHub/Stack
Overflow). The rest work without auth. See `.env.example` for the
required variables; `/monitor` surfaces missing keys with "Get key →"
links.

## Multi-tenant model

- **System role** (`users.role`): `admin` accesses `/admin/*`,
  `member` is the default.
- **Tenant role** (`tenant_memberships.role`): `owner`, `admin`,
  `member`, `viewer` — enforced via `requireTenantRole(minRole)` in
  `src/lib/api-helpers.ts`.
- **Data isolation**: radars, queries, notes, scenarios, and
  bsc_ratings are all scoped by `tenant_id`. Stammdaten
  (trends, live_signals, data_sources) stay global.
- **Active tenant** tracked in `users.last_active_tenant_id`; exposed
  on the session as `session.user.activeTenantId` + `session.user.tenants[]`.

Full architecture notes: `src/lib/tenant-context.tsx` + the QC report
in Notion (linked from `project_tenant_rollout.md` in memory).

## Routes

### User-facing pages
| Path | Purpose |
|---|---|
| `/` | Home — ask a question |
| `/cockpit` | Knowledge Cockpit (radar · network · trends · signals · sources) |
| `/canvas` | Node canvas workspace |
| `/projects` | Your projects list |
| `/projects/archive` | Archived projects |
| `/clusters` | Cluster history viewer (topic evolution + optional LLM changelog/foresight) |
| `/clusters?id={slug}` | Pinned cluster detail |
| `/forecasts` | Team prediction-market-lite (feature-flagged, see Deployment) |
| `/briefing/{slug}-{hash}` | Canonical shareable briefing URL |
| `/admin` | System admin landing |
| `/admin/tenants` | Manage tenants |
| `/admin/tenants/[id]` | Tenant detail + members + invites |
| `/admin/audit` | Global audit log |
| `/settings/tenant` | Tenant owner/admin settings |
| `/invite/accept?token=…` | Public invite landing |
| `/monitor` | Pipeline + data source health (now with per-source z-score anomaly badges) |

The Cmd+K / Ctrl+K command palette is available globally and surfaces
every navigation above without needing to know the paths.

Legacy German slugs (`/verstehen`, `/sessions`, `/admin/mandanten`,
`/settings/mandant`, etc.) redirect with query-param preservation.

### API (`/api/v1/*`)

Grouped as:
- **Tenant-scoped user data**: canvas, projects, radars, scenarios,
  bsc_ratings, versions, alerts — all gated by `requireTenantContext`
  + role.
- **System admin** (`/admin/*`): tenants + memberships + invites +
  audit.
- **Invite/auth**: invite-accept, switch-tenant.
- **Stammdaten** (shared): trends, feed, signals, sources/status,
  pipeline, monitor, cron.
- **Cluster history**: `/clusters` (list) + `/clusters/[id]/history`
  (Perigon-inspired snapshot timeline with optional LLM changelog
  and SIS-native forward-looking `foresight[]` slot).
- **Forecasts** (feature-flagged): `/forecasts` (list + create),
  `/forecasts/[id]` (detail), `/forecasts/[id]/positions` (stake),
  `/forecasts/[id]/resolve` (two-signer peer-signoff),
  `/forecasts/calibration/[userId]` (per-user Brier summary with
  decile buckets). Every route returns 404 when
  `FORECASTS_ENABLED` is unset.
- **Health**: `/api/v1/health` (unauthenticated liveness probe for
  monitoring/k8s).

## Tests

Plain tsx smoke tests, zero framework install. 232 assertions across
eight suites — `npm test` runs them all in sequence:

| Script | Assertions | Scope |
|---|---:|---|
| `test:tenants` | 20 | Schema idempotency, default-tenant seeding, cross-tenant isolation, last-owner guard, invite/audit retention |
| `test:stream` | 11 | streamQuery retry + reconnect logic (EDGE-17) |
| `test:briefing-url` | 28 | FNV-1a hash + slug round-trip for `/briefing/{slug}-{hash}` (Welle A Item 3) |
| `test:baseline` | 23 | Welford streaming variance + anomaly tiers (Welle B Item 3) |
| `test:cluster-snapshots` | 38 | Cluster history CRUD against local.db (Welle B Item 2) |
| `test:ai-text` | 22 | Anthropic → OpenRouter fallback routing (Welle C Item 1) |
| `test:foresight-parser` | 26 | LLM-output JSON parser robustness (Welle B Item 2 follow-up) |
| `test:forecasts` | 64 | Forecasts CRUD + peer-signoff + Brier calibration (Welle C Items 2 + 3) |
| `test:api` | 37 | HTTP envelope contract (needs `npm run dev` on localhost:3001) |

All offline except `test:api`. Suites tag their rows with a unique
prefix and clean up on exit so parallel runs stay surgical.

**Deferred (open ticket):** Playwright E2E for canvas save-roundtrip,
home-query-to-briefing, and invite-accept happy path. Needs an
explicit `npx playwright install` step so deliberately not bundled
into `npm install`.

## Repository layout

```
src/
  app/                  # Next App Router pages + API routes
    api/v1/             # 44 endpoints
    cockpit/            # Knowledge Cockpit (was /verstehen)
    projects/           # Projects list (was /sessions + /projekte)
    admin/              # System-admin UIs
    settings/           # Owner/admin tenant settings
    invite/accept/      # Public invite landing
  components/
    tenant/             # TenantSwitcher
    radar/              # Trend detail panel, radar chart, causal graph
    verstehen/          # Trend overview, quellen table
    volt/               # Volt UI primitives (icons, modals, confirm)
  connectors/           # 56 data source connectors
  db/                   # Drizzle schema (sqlite + pg), migrations, seed
  lib/
    auth.ts             # NextAuth v5 config + SQLite adapter
    auth.config.ts      # Edge-safe auth config
    api-helpers.ts      # requireTenantContext, requireTenantRole, ...
    tenant-context.tsx  # React context (server-hydrated)
    tenant-storage.ts   # Tenant-scoped localStorage
    trend-signal-match.ts # Fuzzy matcher trends ↔ signals
    pipeline.ts         # 7-stage signals pipeline
    emails.ts           # Resend + SMTP + dry-run fallback
    briefing-url.ts     # FNV-1a slug+hash for /briefing/{slug}-{hash}
    commands.ts         # Cmd+K palette registry
    cluster-snapshots.ts # Perigon-inspired cluster history + LLM diff/foresight
    baseline.ts         # Welford streaming-variance anomaly baseline
    ai-text.ts          # Anthropic → OpenRouter fallback helper
    forecasts.ts        # Forecast-Layer + Brier calibration
scripts/
  tenant-bootstrap.ts   # Promote user to system admin
  tenant-smoke-test.ts  # Zero-install integration tests
  signals-pump.ts       # Direct pipeline trigger
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:setup` | Init SQLite + seed |
| `npm run db:studio` | Drizzle Studio |
| `npm run signals:pump` | Trigger the signals pipeline once |
| `npm run signals:status` | Per-source freshness table |
| `npm run tenant:bootstrap -- <email>` | Promote user to system admin |
| `npm run test:tenants` | Tenant-layer smoke tests (20, offline) |
| `npm run test:stream` | streamQuery retry + reconnect (11, offline) |
| `npm run test:briefing-url` | Briefing URL slug + hash (28, offline) |
| `npm run test:baseline` | Welford baseline math (23, offline) |
| `npm run test:cluster-snapshots` | Cluster history CRUD (38, offline) |
| `npm run test:ai-text` | AI-router fallback (22, offline) |
| `npm run test:foresight-parser` | Foresight JSON parser (26, offline) |
| `npm run test:forecasts` | Forecasts + calibration (64, offline) |
| `npm run test:api` | HTTP envelope smoke (37, needs dev server) |
| `npm run test` | All suites in sequence |

## Deployment

Targets Vercel. Cron job on `/api/v1/cron` every 4h runs the signal
pipeline. See `.env.example` for the full variable list.

### Required secrets

| Variable | Purpose |
|---|---|
| `CRON_SECRET` | Vercel cron auth |
| `NEXTAUTH_SECRET`, `AUTH_SECRET` | Session signing |
| `RESEND_API_KEY` (or SMTP creds) | Magic-link + invite emails |
| `ANTHROPIC_API_KEY` | Primary LLM for briefings + ai-text helpers |

### Optional connector keys

`GUARDIAN_API_KEY`, `FINNHUB_API_KEY`, `FRED_API_KEY`, `NEWSAPI_KEY`,
`NEWSDATA_KEY`, `NYT_API_KEY`, `ACLED_KEY`, `OPENEXCHANGE_KEY`,
optional `GITHUB_TOKEN` / `STACKOVERFLOW_KEY`. `/monitor` surfaces
anything missing with a "Get key →" link. SIS stays online without
them — affected connectors just go silent instead of erroring.

### Optional feature flags

| Flag | Effect |
|---|---|
| `FORECASTS_ENABLED=true` | Activates the full `/forecasts` feature (CRUD + peer-signoff resolution + Brier calibration). When unset, all `/api/v1/forecasts/*` routes return 404 and the `/forecasts` page renders a "not enabled" splash. |
| `CLUSTER_DIFF_LLM_ENABLED=true` | Pipeline Phase 2d generates an LLM changelog between consecutive cluster snapshots. Cost: ~30 extra LLM calls per pipeline run (4h cadence × ~30 clusters in prod). |
| `CLUSTER_FORESIGHT_LLM_ENABLED=true` | Pipeline Phase 2d generates 2–3 forward scenarios per cluster snapshot. Independent of the changelog flag; same cost shape. |
| `OPENROUTER_API_KEY=<key>` | Activates the OpenRouter secondary provider in `src/lib/ai-text.ts`. Anthropic stays primary; OpenRouter only fires on 5xx / 429 / timeout. No behaviour change when unset. |
| `SIS_ALLOW_DEV_AUTH=true` (dev only) | Explicit opt-in to the dev-mode auth bypass; keeps production builds safe even if `NODE_ENV` is misread. |

## License

Internal. Do not redistribute.
