# Personal STEM Brain - AI/CS Knowledge Graph MVP

This project implements an AI/CS knowledge graph MVP with:
- 200-400 core-node taxonomy target
- Directed cyclic graph semantics (not strict DAG)
- Tri-state per-node knowledge state (`0`, `0.5`, `1`)
- Quiz-driven knowledge updates and diffusion
- 3D force-graph friendly API payloads

## Core Architecture

```text
[Quiz Engine]
    -> [Knowledge Update Layer]
    -> [Graph Diffusion Engine]
    -> [User Knowledge Vector]
    -> [3D Force Visualization]
```

## Documentation

- Docs index: `/Users/a60157230/Projects/personal-stem-brain/docs/README.md`
- Tech stack: `/Users/a60157230/Projects/personal-stem-brain/docs/tech-stack.md`
- Architecture overview: `/Users/a60157230/Projects/personal-stem-brain/docs/architecture/overview.md`
- API spec: `/Users/a60157230/Projects/personal-stem-brain/docs/reference/api-spec.md`
- Data model: `/Users/a60157230/Projects/personal-stem-brain/docs/reference/data-model.md`
- Knowledge graph spec: `/Users/a60157230/Projects/personal-stem-brain/docs/reference/knowledge-graph-spec.md`
- Development/operations: `/Users/a60157230/Projects/personal-stem-brain/docs/operations/development.md`

## Key Implementation Files

- Graph taxonomy: `src/data/graph-nodes.ts`
- Graph edges: `src/data/graph-edges.ts`
- Types/schema contracts: `src/lib/graph-types.ts`
- In-memory graph store: `src/lib/graph-store.ts`
- Diffusion engine: `src/lib/diffusion-engine.ts`
- API routes:
  - `src/app/api/graph/route.ts`
  - `src/app/api/quiz_result/route.ts`
- PostgreSQL schema: `schema.sql`

## API

### `GET /api/graph`
Returns full graph payload (`nodes`, `links`) plus aggregate stats for the signed-in user.

### `GET /api/health`
Returns health and storage mode:
- `status: "ok"` in fallback mode or DB-connected mode
- `status: "degraded"` with HTTP `503` if DB is configured but unreachable

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
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Core routes:
- `/signup` (alias: `/register`)
- `/login`
- `/practice`
- `/saved`
- `/knowledge`
- `/my-knowledge`
- `/dashboard`
- `/ranking`

Quality commands:

```bash
npm run lint
npm run typecheck
npm run check
```

Smoke check (requires running app):

```bash
npm run smoke
```

Database migrations (Drizzle):

```bash
npm run db:generate
npm run db:migrate
npm run db:studio
```

## UX Defaults

- `/knowledge` opens in **3D Graph View** by default.
- Navbar highlights the active route for signed-in users.
- Home page shows quick progress summary for signed-in users.
- Saved/My Knowledge filters include a `Clear` action.

## Auth Configuration

Authentication is powered by [Clerk](https://clerk.com). Configure these environment variables:

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/practice
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/practice
```

Get your keys from the [Clerk dashboard](https://dashboard.clerk.com).

Clerk handles:
- Email/password sign-up and sign-in (with built-in email verification)
- Social OAuth providers (Google, GitHub, etc. — configure in Clerk dashboard)
- Session management and secure cookie handling
- Multi-factor authentication (optional, configure in Clerk dashboard)

## Environments & Deployment

Cloudflare Workers (OpenNext) commands:

```bash
npm run build:cf
npm run deploy:cf
```

GitHub Actions deployment template and required secrets are documented in:
- `DEPLOY.md` (`6.1 GitHub Actions Template`)
- `DEPLOY.md` (`6. Production Deploy - Cloudflare Workers (OpenNext)`)

See full runbook:
- `DEPLOY.md`
- `ENVIRONMENTS.md`
