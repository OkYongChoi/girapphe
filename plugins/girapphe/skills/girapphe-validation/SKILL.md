---
name: girapphe-validation
description: Use when validating Girapphe after code, graph, DB, or content changes, including typecheck, lint, harness, smoke checks, and explaining residual test risk.
metadata:
  short-description: Validate Girapphe changes
---

# Girapphe Validation

Use this after implementing changes in this repository or when the user asks whether the project is ready.

## Fast Checks

Run targeted checks for graph/content changes:

```bash
pnpm --filter @stem-brain/web typecheck
pnpm --filter @stem-brain/mobile typecheck
```

Run broader repo checks when the change touches shared behavior, API routes, build config, or release paths:

```bash
pnpm check
pnpm harness
```

## Environment Checks

For local web development:

```bash
npm run check:env:dev
npm run dev
```

For DB-backed checks, confirm the env is configured without printing secrets:

```bash
node scripts/check-env.mjs apps/web/.env.local
```

## Smoke Checks

If a dev server is running:

```bash
npm run smoke
```

For deployment-sensitive work:

```bash
pnpm harness:deploy
```

## Reporting

In the final answer, report:

- Which checks passed.
- Which checks were not run and why.
- Any known residual risk, especially DB rows skipped due to missing graph endpoints.

Keep output high signal; do not paste full command logs unless the user asks.
