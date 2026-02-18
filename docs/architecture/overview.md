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

### 1. Frontend (Next.js App Router)

- Renders learning/practice views and graph visualization pages.
- Calls backend routes for graph fetch and quiz submissions.
- Displays growth and knowledge-state driven UI effects.

### 2. API Layer

- `GET /api/graph`: returns graph nodes/links and user-aware stats.
- `POST /api/quiz_result`: accepts assessment result, updates state, propagates, and diffuses.
- Serializes data into force-graph-friendly response format.

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

### 6. Persistence Layer

- Current default: in-memory for rapid development.
- Target production: PostgreSQL schema (`graph_nodes`, `graph_edges`, `user_knowledge_states`).

## Design Principles Applied

- **Minimal, extensible core**: start at ~200-400 nodes.
- **Stable contracts first**: node/edge schema and API response are fixed early.
- **State over score**: explicit tri-state knowledge with confidence metadata.
- **Visualization-driven API**: payload optimized for force graph usage.

## Migration Path (MVP -> Production)

1. Keep current `graph-types.ts` as canonical contract.
2. Replace in-memory store access with SQL repository implementation.
3. Preserve API shape to avoid frontend rewrites.
4. Add caching/indexing around graph queries and per-user state reads.
