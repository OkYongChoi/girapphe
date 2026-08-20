# Architecture Overview

## High-Level Flow

```text
[Quiz Engine]
    -> [Knowledge Update Layer]
    -> [Graph Diffusion Engine]
    -> [User Knowledge Vector]
    -> [3D Force Visualization]
```

## Components

### 1. App Surfaces

#### Web (Next.js App Router)

- Renders learning/practice views and graph visualization pages.
- Calls backend routes for graph fetch and quiz submissions.
- Displays growth and knowledge-state driven UI effects.

#### Mobile (Expo / React Native)

- Uses one shared Expo app in `apps/mobile` for both iOS and Android.
- Renders Home, Browse, Practice, and Topic Detail flows through Expo Router.
- Reads graph nodes, graph edges, card content, and domain helpers from
  `@stem-brain/graph-engine`.
- See `docs/apps/mobile.md` for mobile-specific architecture and platform
  guidance.

### 2. API Layer

- `GET /api/graph`: returns graph nodes/links and user-aware stats.
- `POST /api/quiz_result`: accepts assessment result, updates state, propagates, and diffuses.
- `GET /api/mobile`: serves authenticated mobile graph, notes, progress, ranking, and admin payloads.
- `POST /api/mcp`: exposes the pending-only `create_card_drafts` MCP tool.
- Billing, webhook, and health routes live in the same Next.js application and deploy as one Cloudflare Worker.
- Serializes graph data into force-graph-friendly response format.

### 3. Knowledge Update Layer

- Stores per-user tri-state knowledge (`0`, `0.5`, `1`).
- Maintains confidence score (`0.0-1.0`).
- Tracks `first_known_at` and `last_updated`.
- Applies direct update from quiz outcomes.

### 4. Diffusion Engine

- Computes neighborhood influence over graph edges.
- Supports simplified diffusion in MVP (`alpha` blending).
- Keeps persisted state in tri-state space while allowing continuous intermediate calculations.

### 5. Graph Data Layer

- Node and edge taxonomy curated in source-controlled static data.
- Core graph semantics:
  - Directed cyclic graph is allowed.
  - `prerequisite` is directional.
  - `related` and `equivalent_to` behave bidirectionally.

### 6. Authentication Layer

- Powered by [Clerk](https://clerk.com).
- `apps/web/src/middleware.ts` attaches auth context and protects non-public routes while preserving locale handling.
- `apps/web/src/lib/auth.ts` exports `getCurrentUser()` and `requireCurrentUser()` as thin shims over Clerk's `auth()` and `currentUser()`.
- Mobile uses Clerk's Expo SDK with SecureStore-backed session persistence when the publishable key is configured.
- MCP OAuth discovery is published under `/.well-known/` and remains scoped to draft creation rather than public-graph mutation.
- User IDs from Clerk (format: `user_2abc123`) are stored as `text` in `user_knowledge_states.user_id` and related tables.

### 7. Persistence Layer

- Preview and production use PostgreSQL on Neon via `@neondatabase/serverless`.
- Local development can intentionally omit `DATABASE_URL`; public graph/practice routes fall back to in-memory mode.
- Admin, billing, private notes, MCP draft ingestion, and mobile account sync require database mode.
- Static graph taxonomy remains source-controlled in `packages/graph-engine`, while user state and private data persist in PostgreSQL.

### 8. Runtime Topology

```text
[Browser / Expo app / MCP client]
    -> [Next.js App Router on Cloudflare Workers]
    -> [Clerk auth + OAuth metadata]
    -> [Neon Postgres]
```

## Design Principles Applied

- **Minimal, extensible core**: start at ~200-400 nodes.
- **Stable contracts first**: node/edge schema and API response are fixed early.
- **State over score**: explicit tri-state knowledge with confidence metadata.
- **Visualization-driven API**: payload optimized for force graph usage.

## Scaling Path

1. Keep `graph-types.ts`, API payloads, and mobile contracts as the stable surface area.
2. Add caching, pooling, and read/write separation before splitting the app into more services.
3. Move background work such as cleanup, reconciliation, or translation backfills off user-facing requests as traffic grows.
4. Expand authorization and admin topology only after the current single-admin model stops fitting the product.
