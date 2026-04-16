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
| `/admin` | System admin landing |
| `/admin/tenants` | Manage tenants |
| `/admin/tenants/[id]` | Tenant detail + members + invites |
| `/admin/audit` | Global audit log |
| `/settings/tenant` | Tenant owner/admin settings |
| `/invite/accept?token=…` | Public invite landing |
| `/monitor` | Pipeline + data source health |

Legacy German slugs (`/verstehen`, `/sessions`, `/admin/mandanten`,
`/settings/mandant`, etc.) redirect with query-param preservation.

### API (`/api/v1/*`)

44 routes, grouped as:
- **Tenant-scoped user data** (15): canvas, projects, radars,
  scenarios, bsc_ratings, versions, alerts — all gated by
  `requireTenantContext` + role.
- **System admin** (`/admin/*`): tenants + memberships + invites +
  audit.
- **Invite/auth**: invite-accept, switch-tenant.
- **Stammdaten** (shared): trends, feed, signals, sources/status,
  pipeline, monitor, cron.
- **Health**: `/api/v1/health` (unauthenticated liveness probe for
  monitoring/k8s).

## Tests

Plain tsx smoke tests, zero framework install:

```bash
npm run test:tenants    # 20 assertions — schema, isolation, guards
```

Covers: migration idempotency, default-tenant seeding, cross-tenant
radar isolation, bsc_ratings tenant-unique, last-owner guard, invite
expiry/uniqueness, audit-log truncation window.

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
| `npm run test:tenants` | Tenant-layer smoke tests (20 assertions) |

## Deployment

Targets Vercel. Cron job on `/api/v1/cron` every 4h runs the signal
pipeline. Set `CRON_SECRET`, `NEXTAUTH_SECRET`, `AUTH_SECRET`,
`RESEND_API_KEY`, `ANTHROPIC_API_KEY`, optionally `DATABASE_URL` for
Postgres. See `.env.example` for the full list.

## License

Internal. Do not redistribute.
