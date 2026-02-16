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

- Graph taxonomy: `/Users/a60157230/Projects/personal-stem-brain/src/data/graph-nodes.ts`
- Graph edges: `/Users/a60157230/Projects/personal-stem-brain/src/data/graph-edges.ts`
- Types/schema contracts: `/Users/a60157230/Projects/personal-stem-brain/src/lib/graph-types.ts`
- In-memory graph store: `/Users/a60157230/Projects/personal-stem-brain/src/lib/graph-store.ts`
- Diffusion engine: `/Users/a60157230/Projects/personal-stem-brain/src/lib/diffusion-engine.ts`
- API routes:
  - `/Users/a60157230/Projects/personal-stem-brain/src/app/api/graph/route.ts`
  - `/Users/a60157230/Projects/personal-stem-brain/src/app/api/quiz_result/route.ts`
- PostgreSQL schema: `/Users/a60157230/Projects/personal-stem-brain/schema.sql`
- Full engineering spec: `/Users/a60157230/Projects/personal-stem-brain/docs/knowledge-graph-spec.md`

## API

### `GET /api/graph`
Returns full graph payload (`nodes`, `links`) plus aggregate stats for the signed-in user.

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

## Auth Configuration

Email/password auth works out of the box.  
OAuth providers can be enabled with env vars:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OPENAI_OAUTH_CLIENT_ID`, `OPENAI_OAUTH_CLIENT_SECRET`, `OPENAI_OAUTH_AUTH_URL`, `OPENAI_OAUTH_TOKEN_URL`, `OPENAI_OAUTH_USERINFO_URL`, optional `OPENAI_OAUTH_SCOPE`
- `CLAUDE_OAUTH_CLIENT_ID`, `CLAUDE_OAUTH_CLIENT_SECRET`, `CLAUDE_OAUTH_AUTH_URL`, `CLAUDE_OAUTH_TOKEN_URL`, `CLAUDE_OAUTH_USERINFO_URL`, optional `CLAUDE_OAUTH_SCOPE`
- `GROK_OAUTH_CLIENT_ID`, `GROK_OAUTH_CLIENT_SECRET`, `GROK_OAUTH_AUTH_URL`, `GROK_OAUTH_TOKEN_URL`, `GROK_OAUTH_USERINFO_URL`, optional `GROK_OAUTH_SCOPE`

Set `APP_BASE_URL` in production so OAuth callbacks use the correct host.
