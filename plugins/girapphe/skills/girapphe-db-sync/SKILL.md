---
name: girapphe-db-sync
description: Use when syncing Girapphe static graph data into the PostgreSQL/Neon database, checking DB graph counts, or diagnosing skipped graph edges and knowledge card upserts.
metadata:
  short-description: Sync Girapphe graph DB
---

# Girapphe DB Sync

Use this when the user asks whether knowledge is in the DB, asks to add all graph data to the DB, or asks to inspect graph/card row counts.

## Primary Command

```bash
node scripts/sync-graph-to-db.mjs apps/web/.env.local
```

The script loads `DATABASE_URL` from the env file, imports static graph data from `@stem-brain/graph-engine`, and upserts:

- `graph_nodes`
- `graph_edges`
- `knowledge_cards`

## Expected Output

The script prints JSON with:

- `upserted.graph_nodes`
- `upserted.graph_edges`
- `upserted.knowledge_cards`
- `skipped.graph_edges_missing_endpoints`
- `skipped.duplicate_valid_graph_edges`
- `db_counts`

If `graph_edges_missing_endpoints` is nonzero, the static edge list references node ids not present in `GRAPH_NODES`; those rows cannot be inserted because `graph_edges` has foreign keys.

## Useful Checks

Count static data without touching DB:

```bash
node -r tsx/cjs -e "const { GRAPH_NODES, GRAPH_EDGES, CARD_CONTENT } = require('@stem-brain/graph-engine'); console.log({ nodes: GRAPH_NODES.length, edges: GRAPH_EDGES.length, cards: Object.keys(CARD_CONTENT).length })"
```

Check current worktree before and after syncing:

```bash
git status --short
```

## Guardrails

- Never print `.env.local` contents or `DATABASE_URL`.
- Do not use destructive DB operations for a sync request. The sync path should be upsert-only.
- If a transaction fails, fix the static data or script logic, then rerun the sync.
- Report skipped edges separately from inserted edges so the user does not confuse static edge count with DB row count.
