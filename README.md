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

- Agent working agreement: `AGENTS.md`
- Feature specification workflow: `specs/README.md`
- Docs index: `docs/README.md`
- Tech stack: `docs/tech-stack.md`
- Architecture overview: `docs/architecture/overview.md`
- Mobile app architecture: `docs/apps/mobile.md`
- Mobile store release checklist: `docs/apps/store-release.md`
- API spec: `docs/reference/api-spec.md`
- WebMCP browser tools: `docs/reference/webmcp.md`
- ChatGPT export import: `docs/reference/chatgpt-export-import.md`
- Private knowledge intelligence: `docs/reference/knowledge-intelligence.md`
- Knowledge export, deletion, and rollout controls: `docs/reference/knowledge-data-controls.md`
- Data model: `docs/reference/data-model.md`
- Ads and subscriptions: `docs/reference/monetization.md`
- Billing operations and activation gates: `docs/operations/billing.md`
- Mobile purchase and AdMob setup: `apps/mobile/SETUP.md`
- Knowledge graph spec: `docs/reference/knowledge-graph-spec.md`
- Development/operations: `docs/operations/development.md`
- Resource planning: `docs/operations/resource-planning.md`
- Admin operations: `docs/operations/admin.md`
- Shareable Codex and Claude Code plugins: `docs/operations/codex-plugin.md`

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

Streamable HTTP MCP endpoint exposing `create_knowledge_bundle_drafts`, the
compatible `create_card_drafts` tool, and owner-scoped `get_topic_context`.
It accepts structured concepts from the current ChatGPT, Claude, Gemini, or
other conversation and creates a private review batch; it never auto-approves
items or writes to the public graph. Structured drafts support concept,
procedure, comparison, mechanism, structure, claim/evidence, question,
decision, event, and language-expression bundles. Event bundles may retain
BCE/CE chronology, and reviewed private relationships may express directional
causality with linked evidence. Context reuse requires the separate
`knowledge:context:read` PAT scope and an explicit item selection or bounded
recent selection. See
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
- `/recall` (signed-in, default-off manual Recall Review)
- `/saved`
- `/knowledge`
- `/my-notes` (legacy `/my-knowledge` URLs redirect here)
- `/knowledge-inbox`
- `/knowledge-inbox/import`
- `/settings` (signed-in AI connections, reuse defaults, and account/data links)
- `/insights`
- `/topics`
- `/subscription`
- `/dashboard`
- `/ranking`
- `/admin` (admin-only, PostgreSQL required)

### Reviewed conversation knowledge

Girapphe turns only user-selected content from the current AI conversation into
pending candidates. Each candidate stays non-canonical until the user
explicitly chooses save as new, merge, update, or ignore. Confirmed items then
appear in a private Topic Hub with overview, open-question, local-graph,
timeline, lifecycle-history, provenance, and context-pack views.

The separate ChatGPT export adapter parses an extracted `conversations.json`
locally and sends only explicitly selected, bounded Q&A exchanges into the same
pending review lifecycle. It never stores the archive or unselected messages.

Provenance retains source selectors and metadata, never raw transcript text.
Context-pack downloads likewise contain only selected canonical knowledge and
selector-only provenance. Web owns full comparison, editing, merge/update,
graph, history, evidence, and export workflows; mobile provides quick
save-as-new/ignore review for simple candidates, requires detailed web review
for causal candidates, and includes the owner-scoped Topics index plus compact
Topic Hub. A public concept can prefill an editable My Notes copy from its
validated public-node ID and trusted current-locale content; nothing is saved
until the user explicitly adds the private note. Web, iOS, and Android My Notes
share owner-scoped frequent-tag reuse, direct entry, and the same bounded tag
normalization contract.

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
- `/settings` defaults its external-AI setup guide to ChatGPT and reusable
  context to Markdown. These versioned, enum-only browser preferences guide
  setup and output format; the connected external client still chooses the
  exact AI model.
- Navbar highlights the active route for signed-in users.
- Home page shows quick progress summary for signed-in users.
- Saved/My Notes filters include a `Clear` action. My Notes keeps secondary
  filters collapsed, shows custom dates only for a custom range, and omits the
  filter panel when the current collection is empty.

## Harness

Before pushing a branch, run:

```bash
pnpm harness
```

This runs workspace checks, validates documentation and feature-spec contracts,
verifies the shareable Codex plugin and patched image parser, validates checked-in
environment templates, and builds the web app.

On a clean checkout, reproduce the CI quality gate with:

```bash
pnpm install --frozen-lockfile
pnpm harness:ci
```

The CI harness includes the local harness and exports both iOS and Android
mobile bundles. Dependency installation stays an explicit bootstrap step so the
harness itself does not mutate the install state.

Documentation-only changes can use the focused gate while iterating:

```bash
pnpm check:docs
```

Before deployment, also run:

```bash
pnpm harness:deploy
```

This runs the local harness, builds the Cloudflare/OpenNext Worker, and verifies
that its uncompressed upload stays within the guarded release-size budget.

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

## Codex and Claude Code Plugins

The public repository includes an installable `girapphe` plugin for Codex and
Claude Code with the project's graph, database, validation, and
protected-release skills. See the [agent plugin guide](docs/operations/codex-plugin.md)
for installation and update commands.

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

Creem and Superwall lifecycle configuration use separate complete groups. New
web and mobile acquisition remain independently fail-closed behind
`WEB_BILLING_ACQUISITION_ENABLED` and
`MOBILE_BILLING_ACQUISITION_ENABLED`; turning a gate off does not disable
webhooks, reconciliation, management, or cancellation for existing subscribers.
The exact Worker names and provider activation evidence are documented in
[Ads and subscriptions](docs/reference/monetization.md). Public mobile Clerk,
Superwall, and AdMob build values belong in EAS Environments; server provider
secrets never belong in an Expo build. See [Mobile setup](apps/mobile/SETUP.md).

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

Enable Clerk's Native API before producing a native build.
`EXPO_PUBLIC_APP_BASE_URL` must point to the deployed HTTPS Worker that serves
`/api/mobile` and anchors first-party candidate review links. Authenticated
Practice reads use a bounded `{ mode, cursor, cycleOnEmpty }` POST and
server-side alternating keyset lanes instead of growing card-ID arrays; notes,
topic summaries, progress, ranking, knowledge-map state, and admin requests use
the same origin and authenticated private no-store responses.

## Environments & Deployment

Branch flow:

```text
feature branch -> PR preview -> PR merge to main -> production deploy
```

- Pull requests deploy an isolated Cloudflare Preview Worker and apply only the
  explicitly allowlisted, idempotent migration subset required by Preview.
- `main` deploys to Cloudflare `prod`, runs the full migration history, then smoke
  tests production.
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
