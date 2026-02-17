# AI/CS Knowledge Graph MVP Specification

## 1. Design Principles

1. Minimal but extensible
- Start with a 200-400 node core taxonomy.
- Keep schema and edge semantics stable so higher-level domains can be added without refactoring.

2. Directed Cyclic Graph (not strict DAG)
- Cycles are allowed for conceptual reinforcement and equivalence loops.
- `prerequisite` edges remain directional.
- `related` and `equivalent_to` are treated as bidirectional relations.

3. Knowledge state as a node attribute
- Canonical user knowledge state is tri-state only: `0` (unknown), `0.5` (partial), `1` (known).
- Confidence is stored separately (`0.0-1.0`) and can be used for rendering and diffusion weighting.

## 2. Core Taxonomy Scope

- Level 0 roots: `Mathematics`, `Computer Science`, `Machine Learning`, `Artificial Intelligence`.
- Level 1+ covers:
  - Mathematics: Linear Algebra, Probability & Statistics, Optimization, Calculus
  - Computer Science: Algorithms, Data Structures, Complexity Theory
  - Machine Learning: Supervised, Unsupervised, Reinforcement Learning
  - Artificial Intelligence: Deep Learning
  - Theoretical ML

Current MVP data target is maintained in:
- `src/data/graph-nodes.ts`
- `src/data/graph-edges.ts`

## 3. Graph Data Model

### 3.1 Node schema

```json
{
  "id": "gradient_descent",
  "label": "Gradient Descent",
  "domain": "Optimization",
  "level": 2,
  "difficulty": 3,
  "type": "algorithm",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Field semantics:
- `id`: unique string key
- `label`: display name
- `domain`: top-level category/subdomain
- `level`: hierarchy depth (`0-5`)
- `difficulty`: integer scale (`1-5` in MVP)
- `type`: `concept | theorem | algorithm | model`

### 3.2 Edge schema

```json
{
  "source": "partial_derivatives",
  "target": "gradient_descent",
  "type": "prerequisite",
  "weight": 0.8
}
```

Supported edge types:
- `prerequisite` (directed)
- `related` (bidirectional)
- `generalizes` (directed)
- `derived_from` (directed)
- `equivalent_to` (bidirectional)

### 3.3 User knowledge state schema

```json
{
  "user_id": "u123",
  "node_id": "gradient_descent",
  "knowledge_state": 1,
  "confidence": 0.85,
  "last_updated": "timestamp",
  "first_known_at": "timestamp"
}
```

Rules:
- `knowledge_state` must be one of `0`, `0.5`, `1`.
- `first_known_at` is set once when a node first becomes `1`.

## 4. Diffusion Design

For advanced mode:
- Build adjacency matrix `A`.
- Build degree matrix `D`.
- Laplacian `L = D - A`.
- Knowledge vector `K in R^N`.
- Diffusion step: `K_new = exp(-tL)K`.

MVP simplified diffusion:
- `K_new = alpha * K + (1 - alpha) * normalized_adjacent_mean`
- Apply increase-biased update to avoid unstable oscillation.
- Convert back to tri-state for persistence (`0/0.5/1`).

## 5. 3D Force Graph Payload

API response payload:

```json
{
  "nodes": [...],
  "links": [...]
}
```

Node rendering fields:

```json
{
  "knowledge": 0.7,
  "growth_daily": 0.02,
  "growth_weekly": 0.10,
  "growth_monthly": 0.30
}
```

Rendering rules:
- Opacity: proportional to `knowledge`
- Size: `knowledge + centrality`
- Color: by `domain`
- Glow animation: based on recent growth

## 6. Storage Strategy

Recommended options:
1. Neo4j (native graph queries)
2. PostgreSQL + adjacency table (recommended MVP)
3. TypeScript in-memory graph (prototype mode)

This project currently supports in-memory graph operations and SQL schema for PostgreSQL migration.

## 7. API Spec

### GET graph
- `GET /api/graph?user_id=<id>`
- Returns node list (with knowledge fields), edge list, and aggregate stats.

### POST quiz result
- `POST /api/quiz_result`

Request body:

```json
{
  "user_id": "u123",
  "node_id": "gradient_descent",
  "result": 1
}
```

Backend flow:
1. Update direct node state
2. Propagate local updates to connected nodes
3. Run global diffusion step
4. Update timestamps and return updated node summary

## 8. Growth Windows

Per node:
- `first_known_at` timestamp persists first time user reaches known state.

Derived windows:
- Daily: within last 24h
- Weekly: within last 7d
- Monthly: within last 30d

Visualization recommendation:
- Concentric wave/ripple animation from newly known nodes.

## 9. Forward Expansion

For large-scale expansion:
- Increase difficulty range from `1-5` to `1-10`.
- Expand to `10,000+` nodes with hierarchical indexing.
- Add node feature vectors for GNN pipelines:
  - `difficulty`
  - `centrality`
  - `time_since_known`
  - `quiz_accuracy`
  - `diffusion_score`

## 10. Current MVP Priorities

1. Lock taxonomy and naming conventions.
2. Keep edge semantics explicit and stable.
3. Preserve tri-state knowledge state while using probabilistic diffusion internally.
