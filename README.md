# Girapphe - Personal Knowledge Graph

This project implements an AI/CS knowledge graph MVP with:
- 200-400 core-node taxonomy target
- Directed cyclic graph semantics (not strict DAG)
- Tri-state per-node knowledge state (`0`, `0.5`, `1`)
- Quiz-driven knowledge updates and diffusion
- 3D force-graph friendly API payloads
- reviewed ChatGPT/Claude MCP conversation-card drafts
- five-card sponsored practice intervals with cross-platform `ad_free` subscriptions

## Core Architecture

```text
[Quiz Engine]
    -> [Knowledge Update Layer]
    -> [Graph Diffusion Engine]
    -> [User Knowledge Vector]
    -> [3D Force Visualization]
```

## Documentation

- Docs index: `docs/README.md`
- Tech stack: `docs/tech-stack.md`
- Architecture overview: `docs/architecture/overview.md`
- Mobile app architecture: `docs/apps/mobile.md`
- Mobile store release checklist: `docs/apps/store-release.md`
- API spec: `docs/reference/api-spec.md`
- WebMCP browser tools: `docs/reference/webmcp.md`
- Data model: `docs/reference/data-model.md`
- Ads and subscriptions: `docs/reference/monetization.md`
- Mobile purchase and AdMob setup: `apps/mobile/SETUP.md`
- Knowledge graph spec: `docs/reference/knowledge-graph-spec.md`
- Development/operations: `docs/operations/development.md`
- Resource planning: `docs/operations/resource-planning.md`
- Admin operations: `docs/operations/admin.md`

## Key Implementation Files

- Graph taxonomy: `packages/graph-engine/src/data/graph-nodes.ts`
- Graph edges: `packages/graph-engine/src/data/graph-edges.ts`
- Types/schema contracts: `packages/graph-engine/src/graph-types.ts`
- In-memory graph store: `packages/graph-engine/src/graph-store.ts`
- Diffusion engine: `packages/graph-engine/src/diffusion-engine.ts`
- Mobile app: `apps/mobile`
- API routes:
  - `apps/web/src/app/api/graph/route.ts`
  - `apps/web/src/app/api/quiz_result/route.ts`
  - `apps/web/src/app/api/knowledge-profile/route.ts`
  - `apps/web/src/app/api/knowledge-context/route.ts`
  - `apps/web/src/app/api/mcp/route.ts`
- PostgreSQL schema: `apps/web/schema.sql`

## API

### `GET /api/graph`
Returns full graph payload (`nodes`, `links`) plus aggregate stats for the signed-in user.

### `GET /api/knowledge-profile`
Returns a machine-readable per-user knowledge profile JSON for MCP/tooling integration.

### `GET /api/knowledge-context`
Returns a compact AI-ready context payload containing a short `summary` and a prompt-safe `prompt_block`.

### `GET /api/health`
Returns health and storage mode:
- `status: "ok"` in fallback mode or DB-connected mode
- `status: "degraded"` with HTTP `503` if DB is configured but unreachable

### `POST /api/mcp`

Streamable HTTP MCP endpoint exposing the scoped `create_card_drafts` tool.
It accepts structured concepts from the current ChatGPT, Claude, Gemini, or
other conversation and creates a private review batch; it never auto-approves
cards or writes to the public graph. See
[`docs/reference/mcp-card-ingestion.md`](docs/reference/mcp-card-ingestion.md).

### `POST /api/quiz_result`
Body:

```json
{
  "node_id": "gradient_descent",
  "result": 1
}
```

Flow:
1. Direct node update
2. Local propagation
3. Global diffusion
4. Return updated node summary

## Development

```bash
pnpm install
pnpm env:setup:dev
pnpm check:env:dev
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Core routes:
- `/signup` (alias: `/register`)
- `/login`
- `/practice`
- `/saved`
- `/knowledge`
- `/my-knowledge`
- `/knowledge-inbox`
- `/subscription`
- `/dashboard`
- `/ranking`
- `/admin` (admin-only, PostgreSQL required)

Quality commands:

```bash
pnpm check
pnpm check:env:examples
pnpm check:env:dev
pnpm --filter @stem-brain/web check
pnpm --filter @stem-brain/mobile check
```

Smoke check (requires running app):

```bash
pnpm smoke
```

Database migrations (Drizzle):

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:studio
```

## UX Defaults

- `/knowledge` opens in **3D Graph View** by default.
- Navbar highlights the active route for signed-in users.
- Home page shows quick progress summary for signed-in users.
- Saved/My Notes filters include a `Clear` action.

## Harness

Before pushing a branch, run:

```bash
pnpm harness
```

This runs workspace checks, validates checked-in environment templates, and
builds the web app.

CI should run:

```bash
pnpm harness:ci
```

Before deployment, also run:

```bash
pnpm harness:deploy
```

This runs the local harness, builds the Cloudflare/OpenNext Worker, and verifies
that its compressed upload stays within the guarded release-size budget.

Browser smoke checks use Playwright and start the web dev server automatically:

```bash
pnpm browser:smoke
pnpm harness:browser
```

If Chromium is not installed locally yet, run:

```bash
pnpm exec playwright install --with-deps chromium
```

Push is part of release handoff, not the repeatable validation script:

```bash
git status --short
git push
```

## Auth Configuration

Authentication is powered by [Clerk](https://clerk.com). Configure these environment variables:

Use environment-specific templates:

```bash
cp apps/web/.env.dev.example apps/web/.env.local
# For production values/secrets, use apps/web/.env.prod.example only as a reference.
# Prefer CI secrets, Wrangler secrets, or temporary shell env vars over a persistent .env.production file.
```

```
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/practice
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/practice
```

Get your keys from the [Clerk dashboard](https://dashboard.clerk.com).

For native MCP connectors, also configure Clerk **OAuth applications**: prefer
CIMD with an explicit client allowlist where supported, enable Dynamic Client
Registration only when a target client requires it, and include `profile` in
the default scopes. Girapphe publishes OAuth discovery under `/.well-known/`;
see [MCP card-draft ingestion](docs/reference/mcp-card-ingestion.md).

Stripe, RevenueCat, AdSense, and Toss are optional complete configuration groups. Toss also
requires the separate, default-off `TOSS_BILLING_ENABLED=true` operational gate. The exact
server names, webhook/scheduler requirements, migrations, and activation tests are documented
in [Ads and subscriptions](docs/reference/monetization.md). Mobile Clerk, RevenueCat, and AdMob
public build values belong in EAS Environments; see [Mobile setup](apps/mobile/SETUP.md).

Admin routes additionally require:

```bash
ADMIN_CLERK_USER_ID=user_...
```

`ADMIN_CLERK_USER_ID` must match the Clerk user id allowed to access `/admin`. Admin pages
also require `DATABASE_URL`; they do not use the app's in-memory fallback mode.

Clerk handles:
- Email/password sign-up and sign-in (with built-in email verification)
- Social OAuth providers (Google, GitHub, etc. — configure in Clerk dashboard)
- Session management and secure cookie handling
- Multi-factor authentication (optional, configure in Clerk dashboard)

### Mobile authentication and API

For iOS and Android, copy `apps/mobile/.env.example` to a local `.env` file and configure the
following **public** EAS environment variables for each build profile. Do not put a Clerk secret
key in the mobile app.

```text
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY
EXPO_PUBLIC_APP_BASE_URL
```

Enable Clerk's Native API before producing a native build. `EXPO_PUBLIC_APP_BASE_URL` must point to the
deployed HTTPS Worker that serves `/api/mobile`; it is where authenticated mobile notes, progress,
knowledge-map state, and admin requests are processed.

## Environments & Deployment

Branch flow:

```text
feature branch -> PR preview -> PR merge to main -> production deploy
```

- Pull requests deploy an isolated Cloudflare Preview Worker. They never run migrations.
- `main` deploys to Cloudflare `prod`, runs migrations, then smoke tests production.
- Do not commit real `.env*` files. Keep local values in `apps/web/.env.local`;
  inject CI values with GitHub Secrets/Variables and Cloudflare runtime values
  with Wrangler Worker secrets.

Cloudflare Workers (OpenNext) commands:

```bash
pnpm build:cf
```

Pull requests automatically receive a Cloudflare Worker preview. Its stable address is
`https://pr-<number>-girapphe-preview.<workers-subdomain>.workers.dev`; it uses preview
Clerk keys and an isolated Neon database.

Preview retention is automatic: merged PR previews remain available for 24 hours, and
closed-but-unmerged previews remain for 7 days. A six-hour cleanup job then removes their
Cloudflare Worker versions. Reopened PRs are never removed while open.

GitHub Actions deployment details and required secrets are documented in:
- `DEPLOY.md`
- `ENVIRONMENTS.md`
