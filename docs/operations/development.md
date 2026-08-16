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

## Harness

Use the harness before pushing work for review:

```bash
pnpm harness
```

The local harness runs:

```bash
pnpm check
pnpm --filter @stem-brain/web check:env:examples
pnpm --filter @stem-brain/web build
```

`pnpm check` runs each package's `check` task through Turborepo, including lint
and type checks for the web and mobile apps plus type checks for shared
workspace packages.

CI should use the frozen-lockfile harness:

```bash
pnpm harness:ci
```

Deployment readiness should also run the Cloudflare/OpenNext build:

```bash
pnpm harness:deploy
```

The deployment harness runs the local harness, builds the Cloudflare/OpenNext
Worker, and checks its compressed upload against the guarded release-size budget.

Browser smoke checks use Playwright and start the web dev server automatically:

```bash
pnpm browser:smoke
pnpm harness:browser
```

If Chromium is not installed locally yet, run:

```bash
pnpm exec playwright install --with-deps chromium
```

Release handoff checklist:

```bash
git status --short
git push
```

Branch and environment handoff:

1. Work on a short-lived branch such as `feature/...`, `fix/...`, or `chore/...`.
2. Open a PR into `main`; CI runs quality checks and deploys its isolated Preview Worker.
3. Review the preview URL and merge to `main`.
4. The `main` push runs production migrations, deploys the production Worker, and smoke tests it.

After pushing, wait for CI to finish. GitHub Actions is the only shared deployment path.

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

When changing `/admin`, also update:

5. `docs/operations/admin.md`

## Graph Taxonomy Change Workflow

1. Update nodes in `packages/graph-engine/src/data/graph-nodes.ts`.
2. Update edges in `packages/graph-engine/src/data/graph-edges.ts`.
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

1. Update `packages/graph-engine/src/diffusion-engine.ts`.
2. Confirm tri-state normalization remains intact in `packages/graph-engine/src/graph-store.ts`.
3. Verify quiz flow still runs: direct update -> propagation -> diffusion.
4. Update algorithm notes in `docs/reference/knowledge-graph-spec.md`.

## Deployment Notes

Cloudflare/OpenNext commands:

```bash
pnpm build:cf
```

Production deployment is GitHub Actions only. See `DEPLOY.md` for the runbook and required
repository settings.

## Common Issues

1. Turbopack root warning
- Set `turbopack.root` in `next.config.ts` to project root.

2. `Can't resolve 'tailwindcss'`
- Usually caused by wrong inferred workspace root.
- Ensure project root is explicit and dependencies are installed in the same project.

3. Port bind errors
- Another process holds the port.
- Switch port or stop the existing process.

4. `/admin` looks empty or actions fail immediately
- Confirm `DATABASE_URL` is set. Admin pages do not support the in-memory fallback mode.
- Confirm `ADMIN_CLERK_USER_ID` matches the Clerk user id for the signed-in admin account.
