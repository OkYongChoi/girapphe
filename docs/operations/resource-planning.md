# Resource Planning

This document is the repeatable capacity-review companion to `DEPLOY.md` and
`ENVIRONMENTS.md`. It focuses on where Girapphe is likely to bottleneck first,
what to measure before changing plans, and which infrastructure changes are the
lowest-risk next step.

Refresh live plan names, quotas, and dashboard usage before making a production
sizing decision. Those values are provider-owned and time-sensitive.

## Current Repo Posture

- **Cloudflare**: one OpenNext Worker serves production plus isolated PR preview
  Workers. The repository does not currently use Durable Objects, Queues, or a
  custom scheduled Worker entrypoint.
- **Worker bundle guardrail**: `scripts/check-worker-size.mjs` enforces a
  `3020 KiB` compressed upload budget so bundle growth becomes visible before
  platform script-size limits are threatened.
- **Clerk**: one auth boundary covers web, mobile, and MCP OAuth metadata.
  Guest practice can still run without Clerk, but private notes, billing,
  restore, admin, and OAuth-backed MCP draft creation all depend on a valid
  Clerk deployment.
- **Neon**: authenticated graph, billing, mobile sync, MCP drafts, and admin
  flows all converge on PostgreSQL through `DATABASE_URL`. The repo does not
  declare a read replica, per-feature database split, or a queue-backed write
  path.

## Likely Bottleneck Order

1. **Neon** is usually the first shared bottleneck because nearly every
   authenticated or private feature depends on it, and the current topology is
   intentionally simple.
2. **Cloudflare Worker runtime and bundle size** are next. The app is fairly
   stateless, but translation backfills, reconciliation loops, and larger
   static catalogs can create CPU and package-size pressure.
3. **Clerk** is more often a quota, MAU, or auth-topology concern than a raw
   latency bottleneck. Growth pain usually appears as pricing/feature pressure,
   OAuth sprawl, or admin-role complexity first.

## What To Watch

### Cloudflare

- `pnpm harness:deploy` and the `scripts/check-worker-size.mjs` budget trend.
- Worker errors, long CPU duration, preview propagation delays, and any route
  that starts doing batch work during user-facing requests.
- Translation backfills, cleanup jobs, or billing reconciliation that become
  visible in end-user latency.

### Clerk

- Monthly active users, sign-in error rate, mobile Native API adoption, and the
  number of OAuth applications/clients you need to support.
- Separation of preview and production keys. Do not mix live keys into preview
  or local/mobile development builds.
- Any move from one trusted admin user to multiple admins or role-based access,
  because the current `ADMIN_CLERK_USER_ID` model is intentionally narrow.

### Neon

- Compute saturation, query latency, connection churn, slow queries, storage
  growth, and preview-versus-production contention.
- Whether the application is using a pooled connection string once serverless
  concurrency begins to rise.
- Whether reporting/dashboard reads start competing with write-heavy flows like
  practice updates, draft approvals, or billing reconciliation.

## Expansion Playbook

### Early beta

- Keep the current topology.
- Use `pnpm check`, `pnpm harness`, and the health endpoint before releases.
- Add indexes only when slow-query data or query plans show a concrete need.

### Launch growth

- Increase Neon compute headroom before introducing more architectural moving
  parts.
- Move application traffic to Neon pooled connections when concurrency or
  connection churn rises.
- Cache stable public reads such as content catalogs or graph payloads before
  scaling the database further.

### Heavier private-data or billing load

- Move cleanup, backfill, and reconciliation work off the latency-sensitive
  request path.
- Consider a Neon read replica for dashboard, ranking, and reporting reads while
  keeping writes on the primary.
- If preview QA starts colliding with production-like data needs, tighten the
  preview database lifecycle and access policy rather than sharing richer data
  by default.

### Enterprise or compliance requirements

- Protect preview URLs with Cloudflare Access.
- Tighten Neon network policy, replica topology, and auditability according to
  the active plan's supported features.
- Replace the single-admin environment gate with explicit Clerk role or group
  management and audited admin flows.

## Update Triggers

Update this document whenever you change:

- `apps/web/wrangler.jsonc`
- `scripts/check-worker-size.mjs`
- auth boundaries, OAuth scopes, or admin authorization rules
- Neon branch topology, connection method, replica strategy, or preview DB
  policy
- background-job architecture such as cleanup, billing, or translation backfill

## Admin Capacity Dashboard

`/admin/ops` is the protected, production-oriented review surface for the
three shared providers. It caches an aggregated snapshot for five minutes and
continues to render a clear unavailable state when a provider is not connected.
It never exposes provider credentials to the browser.

### Signals and Sources

- **Cloudflare**: Worker request/error totals, request trend, and `cpuTimeP99`
  come from the Workers Analytics GraphQL API. The dashboard also shows the
  repository-owned compressed Worker bundle budget from
  `config/resource-limits.json`.
- **Clerk**: the Backend API supplies total users and sign-ins during the
  selected range. Monthly Retained Users (MRU) stays a Clerk Console metric, so
  the UI deliberately does not relabel range sign-ins as MRU.
- **Neon**: a guarded SQL read supplies database size, active sessions,
  configured connection ceiling, and query-read latency. The Neon control-plane
  API supplies autoscaling limits, compute state, and compute-unit consumption
  when the active plan permits that history endpoint. Pooling is detected from
  the `-pooler` hostname in `DATABASE_URL`, not inferred from endpoint metadata.

### Activation

The dashboard is usable with no extra provider credentials, but shows
configuration-safe unavailable states. For production live provider signals,
configure both complete groups in GitHub Actions and Worker runtime secrets:

```bash
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_ANALYTICS_API_TOKEN=...
NEON_API_KEY=...
NEON_PROJECT_ID=...
NEON_BRANCH_ID=...
```

Use a dedicated Cloudflare token limited to Account Analytics read access. Keep
Neon project and branch identifiers as repository variables where possible;
store API tokens as secrets. These credentials are intentionally absent from
PR preview deployments so previews cannot inspect production operations data.

### Review and Expansion Rules

- Treat Worker error rate at or above 1% as an immediate investigation signal.
- Review Neon sessions when active sessions reach 70% of the configured ceiling
  and move serverless traffic to a Neon pooled URL before adding a larger
  compute plan.
- Investigate persistent Worker CPU p99 increases before changing a Cloudflare
  plan; first remove request-path batch work, cache stable reads, or split
  background work from user traffic.
- Review Clerk MRU and sign-in errors in the Clerk Console before crossing a
  plan threshold; do not use total historical users as an active-user proxy.
- Estimate supported simultaneous rooms only after a representative load test:
  measure peak Worker CPU, requests, database sessions, and query latency for a
  known room count, retain a 30% headroom buffer, then scale the limiting
  provider. Do not publish a static room-count promise from plan names alone.
