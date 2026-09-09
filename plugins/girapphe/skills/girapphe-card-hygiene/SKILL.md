---
name: girapphe-card-hygiene
description: Use when auditing or removing Girapphe production/development knowledge_cards or graph_nodes that look like test, dummy, numeric, sponsored, drill, or otherwise non-canonical content, and when diagnosing environment separation issues that let test content reach the live service.
metadata:
  short-description: Audit Girapphe card hygiene
---

# Girapphe Card Hygiene

Use this when the user reports junk cards in the service, such as `Test`,
numeric-only titles, dummy cards, sponsored placeholders, generated drill cards,
or admin-created graph nodes that should not exist in the canonical graph.

## Primary Workflow

1. Do not print secrets or env file contents.
2. Start with a dry-run audit:

```bash
node .codex/skills/girapphe-card-hygiene/scripts/audit-card-hygiene.mjs --env apps/web/.env.local
```

3. Review the JSON output:
   - `environment_hint` says whether the env looks like dev/prod/unknown.
   - `suspicious_knowledge_cards` are rows matching explicit junk patterns.
   - `orphan_knowledge_cards` are DB card ids absent from the static graph card set.
   - `suspicious_graph_nodes` are graph nodes matching explicit junk patterns.
   - `orphan_graph_nodes` are DB graph node ids absent from `GRAPH_NODES`.
4. If cleanup is appropriate, delete only explicit junk patterns first:

```bash
node .codex/skills/girapphe-card-hygiene/scripts/audit-card-hygiene.mjs --env apps/web/.env.local --delete --confirm
```

5. Delete broader orphan rows only after confirming they are not intentional admin
content:

```bash
node .codex/skills/girapphe-card-hygiene/scripts/audit-card-hygiene.mjs --env apps/web/.env.local --delete --delete-orphans --confirm
```

## Guardrails

- Never run delete mode without first showing the dry-run results.
- Treat `orphan_*` rows as review-required. They can include intentional admin
content because the DB sync is upsert-only and does not remove rows absent from
static files.
- `drill_%`, `graph_adv_%`, `Sponsored Content %`, exact/near-exact
`test card`, `dummy card`, `sample card`, `placeholder card`, numeric-only
ids/titles, and generated markers are explicit junk signals.
- Do not use broad substring matching for words like `testing` or `sample`;
those are legitimate STEM terms in this graph.
- Canonical static graph ids are exempt from suspicious-pattern deletion.
- If `.env.local` points at production Neon, local admin pages and scripts can
mutate production. Recommend a separate dev database and separate Worker secrets.

## Related Files

- DB sync: `scripts/sync-graph-to-db.mjs`
- Card serving and seeding: `apps/web/src/actions/card-actions.ts`
- Admin mutations: `apps/web/src/actions/admin-actions.ts`
- Env rules: `ENVIRONMENTS.md`
