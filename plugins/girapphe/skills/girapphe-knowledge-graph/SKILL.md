---
name: girapphe-knowledge-graph
description: Use when adding, editing, or reviewing Girapphe knowledge graph nodes, edges, domains, colors, or card content in packages/graph-engine and the mobile featured knowledge list.
metadata:
  short-description: Edit Girapphe graph knowledge
---

# Girapphe Knowledge Graph

Use this for taxonomy/content changes to the Girapphe STEM knowledge graph.

## Key Files

- Nodes: `packages/graph-engine/src/data/graph-nodes.ts`
- Edges: `packages/graph-engine/src/data/graph-edges.ts`
- Card content: `packages/graph-engine/src/data/card-content.ts`
- Domain colors and parent-domain mapping: `packages/graph-engine/src/graph-types.ts`
- Mobile root/featured nodes: `apps/mobile/src/knowledge.ts`
- DB sync: `scripts/sync-graph-to-db.mjs`

## Workflow

1. Add every new concept as a stable snake_case node id in `graph-nodes.ts`.
2. Add Korean or English card content in `card-content.ts` with a useful `summary` and substantive `explanation`. Keep formulas in LaTeX when relevant.
3. Add edges in `graph-edges.ts`. Prefer:
   - `generalizes` from parent domains to child concepts
   - `prerequisite` for learning order
   - `derived_from` for formulas produced by a governing equation or constitutive law
   - `related` for non-directional conceptual links
4. If introducing a new domain, update `DOMAIN_COLORS` and `PARENT_DOMAIN_MAP` in `graph-types.ts`.
5. If the new domain should appear prominently in mobile, update `ROOT_DOMAINS` or `FEATURED_NODE_IDS` in `apps/mobile/src/knowledge.ts`.
6. If card content should refresh in the web DB, bump `CARD_CONTENT_VERSION` in `apps/web/src/actions/card-actions.ts`.

## Guardrails

- Do not leave edges pointing to missing node ids. The DB sync skips them because of foreign keys.
- Keep `prerequisite` edges acyclic unless the cycle is intentional and documented.
- Do not invent a new node type unless the type contract already supports it. Current common types are `concept`, `theorem`, `algorithm`, and `model`.
- For broad domain imports, add category nodes first, then formula/concept nodes, then cross-links.

## Validation

Run targeted checks after graph edits:

```bash
pnpm --filter @stem-brain/web typecheck
pnpm --filter @stem-brain/mobile typecheck
```

When DB-backed behavior matters, run:

```bash
node scripts/sync-graph-to-db.mjs apps/web/.env.local
```
