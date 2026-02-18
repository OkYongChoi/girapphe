# Data Model

## Overview

The platform maintains three main data groups:

1. Graph structure (`graph_nodes`, `graph_edges`)
2. User knowledge state (`user_knowledge_states`)
3. Legacy card model (`knowledge_cards`, `user_card_states`)

## Graph Node Model

Canonical fields:

- `id`: unique stable node key (string)
- `label`: display title
- `domain`: category/subdomain
- `level`: hierarchy depth (`0-5`)
- `difficulty`: difficulty (`1-5` in MVP)
- `type`: `concept | theorem | algorithm | model`
- `created_at`, `updated_at`

## Graph Edge Model

Canonical fields:

- `source`: upstream node id
- `target`: downstream node id
- `type`: semantic relation
- `weight`: edge strength (`0.0-1.0`)

Supported edge types:

- `prerequisite` (directed)
- `related` (bidirectional)
- `generalizes` (directed)
- `derived_from` (directed)
- `equivalent_to` (bidirectional)

## User Knowledge State Model

Canonical fields:

- `user_id`
- `node_id`
- `knowledge_state`: tri-state (`0`, `0.5`, `1`)
- `confidence`: `0.0-1.0`
- `last_updated`
- `first_known_at` (set when state first reaches `1`)

## Tri-State Semantics

- `0`: unknown
- `0.5`: partial
- `1`: known

The system may use continuous intermediate values internally for diffusion, but persisted state is normalized back to tri-state.

## SQL Tables

Defined in `/Users/a60157230/Projects/personal-stem-brain/schema.sql`.

Main graph tables:

- `graph_nodes`
- `graph_edges`
- `user_knowledge_states`

Key constraints:

- `graph_nodes.type` constrained enum-like check.
- `graph_edges.type` constrained enum-like check.
- `graph_edges.weight` in `[0, 1]`.
- `user_knowledge_states.knowledge_state` in `(0, 0.5, 1)`.

## Indexing Strategy

- By node domain and level for taxonomy browsing.
- By edge source/target/type for traversal and neighborhood lookup.
- By user_id and node_id for fast personalization reads.

## Versioning Guidance

- Do not repurpose existing node IDs.
- Additive changes preferred (new nodes/edges) over destructive edits.
- If edge semantics change materially, document migration in `docs/operations/development.md`.
