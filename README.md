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

## Key Files

- Graph taxonomy: `src/data/graph-nodes.ts`
- Graph edges: `src/data/graph-edges.ts`
- Types/schema contracts: `src/lib/graph-types.ts`
- In-memory graph store: `src/lib/graph-store.ts`
- Diffusion engine: `src/lib/diffusion-engine.ts`
- API routes:
  - `src/app/api/graph/route.ts`
  - `src/app/api/quiz_result/route.ts`
- PostgreSQL schema: `schema.sql`
- Full engineering spec: `docs/knowledge-graph-spec.md`

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

## UX Defaults

- `/knowledge` opens in **3D Graph View** by default.
- Navbar highlights the active route for signed-in users.
- Home page shows quick progress summary for signed-in users.
- Saved/My Knowledge filters include a `Clear` action.

## Auth Configuration

Email/password auth works out of the box.  
OAuth providers can be enabled with env vars:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_CLIENT_SECRET`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_USERINFO_URL`, optional `OPENAI_OAUTH_SCOPE`
- `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_CLIENT_SECRET`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL`, `CLAUDE_OAUTH_USERINFO_URL`, optional `CLAUDE_OAUTH_SCOPE`
- `GROK_OAUTH_CLIENT_ID`, `GROK_OAUTH_CLIENT_SECRET`, `GROK_OAUTH_AUTH_URL`, `GROK_OAUTH_TOKEN_URL`, `GROK_OAUTH_USERINFO_URL`, optional `GROK_OAUTH_SCOPE`

Set `APP_BASE_URL` in production so OAuth callbacks use the correct host.

## Environments & Deployment

See full runbook:
- `DEPLOY.md`
