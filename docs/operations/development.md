# Development and Operations

## Local Setup

```bash
npm install
npm run dev
```

If port `3000` is in use:

```bash
npm run dev -- --hostname 127.0.0.1 --port 3001
```

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run check
```

Optional smoke test (app must be running):

```bash
npm run smoke
```

## Documentation Update Rules

When changing graph behavior, update docs in this order:

1. `docs/reference/data-model.md`
2. `docs/reference/api-spec.md`
3. `docs/reference/knowledge-graph-spec.md`
4. `README.md` summary links

## Graph Taxonomy Change Workflow

1. Update nodes in `src/data/graph-nodes.ts`.
2. Update edges in `src/data/graph-edges.ts`.
3. Validate references (all edge endpoints must exist).
4. Check cycle policy:
   - keep `prerequisite` edges acyclic-first
   - if a prerequisite cycle is introduced, register an exception using:
     - SCC scope (node/edge set)
     - exception class (semantic coupling / granularity / operational constraint)
     - blast-radius assessment
     - compensating controls
     - time-boxed waiver + revalidation date
5. Run type check and lint.
6. Update docs if semantics changed.

## Diffusion Logic Change Workflow

1. Update `src/lib/diffusion-engine.ts`.
2. Confirm tri-state normalization remains intact in `src/lib/graph-store.ts`.
3. Verify quiz flow still runs: direct update -> propagation -> diffusion.
4. Update algorithm notes in `docs/reference/knowledge-graph-spec.md`.

## Deployment Notes

Cloudflare/OpenNext commands:

```bash
npm run build:cf
npm run deploy:cf
```

See `/Users/a60157230/Projects/personal-stem-brain/DEPLOY.md` for full runbook and CI template.

## Common Issues

1. Turbopack root warning
- Set `turbopack.root` in `next.config.ts` to project root.

2. `Can't resolve 'tailwindcss'`
- Usually caused by wrong inferred workspace root.
- Ensure project root is explicit and dependencies are installed in the same project.

3. Port bind errors
- Another process holds the port.
- Switch port or stop the existing process.
