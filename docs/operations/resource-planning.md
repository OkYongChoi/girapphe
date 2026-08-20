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
