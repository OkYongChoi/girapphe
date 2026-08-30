# Development and Operations

## Local Setup

```bash
pnpm install
pnpm env:setup:dev
pnpm check:env:dev
pnpm dev
```

If port `3000` is in use:

```bash
pnpm dev -- --hostname 127.0.0.1 --port 3001
```

## Quality Checks

```bash
pnpm check
pnpm check:docs
pnpm check:env:examples
pnpm --filter @stem-brain/web check
pnpm --filter @stem-brain/mobile check
```

`pnpm check` is the workspace gate. It runs each package's own `check` task
through Turborepo, which currently includes:

- web lint, typecheck, server tests, localization tests, and Worker type drift checks
- mobile lint, typecheck, purchase-guard tests, and i18n catalog validation
- shared package and graph-engine type checks

## Harness

Use the harness before pushing work for review:

```bash
pnpm harness
```

The local harness runs:

```bash
pnpm check
pnpm check:docs
pnpm verify:image-size-hardening
pnpm --filter @stem-brain/web check:env:examples
pnpm --filter @stem-brain/web build
```

`pnpm check` runs each package's `check` task through Turborepo, including lint
and type checks for the web and mobile apps plus type checks for shared
workspace packages. `pnpm check:docs` validates local Markdown links and the
minimum feature-spec structure described in `specs/README.md`.

On a clean checkout, reproduce the CI quality gate with:

```bash
pnpm install --frozen-lockfile
pnpm harness:ci
```

`harness:ci` runs the local harness and exports both iOS and Android bundles.
Dependency installation remains a separate bootstrap step; this makes the
harness repeatable without changing the caller's installed dependency state.
The GitHub Actions `Quality Checks` job invokes this same command after its
frozen-lockfile install.

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

### Runtime Schema Policy

Production request handlers never run `CREATE`, `ALTER`, index creation, or
card seeding. The `Run Drizzle Migrations` CI job is the only production schema
and seed path, and it completes before the Worker deployment. This keeps a cold
Worker request below Cloudflare's subrequest limit and makes database changes
auditable.

Preview and local environments may use the existing bootstrap behavior because
preview Workers intentionally do not run migrations. Any production data or
schema change must therefore be represented by a checked-in Drizzle migration.

After pushing, wait for CI to finish. GitHub Actions is the only shared deployment path.

Optional smoke test (app must be running):

```bash
pnpm smoke
```

## Feature Specification Workflow

Use `specs/features/_template.md` for new user journeys, API/database contracts,
auth/privacy/payment/ownership changes, cross-platform behavior, and meaningful
architecture or rollout decisions. Small bug fixes normally need a regression
test and PR explanation rather than a standalone spec.

For a spec-backed change:

1. Define the user outcome, scope, privacy/data boundary, and rollout boundary.
2. Give every acceptance criterion a stable `AC-01` style identifier.
3. Add a failing test or explicit inspection for each criterion.
4. Implement and refactor, then map each criterion to its evidence.
5. Mark a spec `Implemented` only when every criterion is checked and the
   required harness passes.

`pnpm check:docs` enforces the required sections, stable criterion IDs, evidence
mapping, and local Markdown-link validity.

## Documentation Update Rules

When changing graph behavior, update docs in this order:

1. `docs/reference/data-model.md`
2. `docs/reference/api-spec.md`
3. `docs/reference/knowledge-graph-spec.md`
4. `README.md` summary links

When changing `/admin` or its capacity signals, also update:

5. `docs/operations/admin.md`

When changing deployment/runtime scale assumptions, also update:

6. `docs/operations/resource-planning.md`

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

### Public content localization

Japanese (`ja`), Simplified Chinese (`zh-CN`), Spanish (`es`), Arabic (`ar`), and
Hindi (`hi`) public cards and graph taxonomy use cached translation rows. Before
enabling a deployment:

1. Apply `apps/web/drizzle/migrations/0012_multilingual_content.sql` to that
   environment's database (`pnpm --filter @stem-brain/web db:migrate`).
2. Confirm the Cloudflare Workers AI binding is named `AI`. It is declared for
   the base, `preview`, and `prod` environments in `apps/web/wrangler.jsonc`;
   it is a binding, not an environment-variable secret. After changing Worker
   bindings, regenerate the checked-in types from `apps/web` with
   `pnpm exec wrangler types worker-configuration.d.ts --env-interface CloudflareEnv`.
3. Deploy, sign in as the Clerk user identified by `ADMIN_CLERK_USER_ID`, and
   call `POST /api/internal/content-localization-backfill` from the same origin.

Request handlers do not run schema DDL. If migration `0012` is missing, they
return English/shared-taxonomy fallback content and the backfill remains
unavailable until the migration is applied.

Run the node backfill first and then the card backfill for each of the five
target locales so card-related labels reuse the node cache. Node batches are
capped at 8 and card batches at 3. Send the returned `next_cursor` as `after`
until `complete` is `true`; interrupted runs are safe to resume.

The translation tables intentionally do not reference the operational
`knowledge_cards` or `graph_nodes` tables: those practice/graph datasets may be
smaller than the checked-in public catalog. Backfill iterates only the static
`GRAPH_NODES`/`CARD_CONTENT` allowlist, and `source_hash` invalidates cached rows
when that canonical source changes.

```json
{"kind":"nodes","locale":"ja","after":"","limit":8,"retry_failed":false}
```

```json
{"kind":"cards","locale":"ja","after":"","limit":3,"retry_failed":false}
```

All public and practice graph/card reads are cache-only. Only the same-origin,
Clerk-admin-protected backfill endpoint may invoke Workers AI, so an untrusted
cache miss cannot create translation spend. It never accepts arbitrary source
text. Responses retain stable English `domain`/`type` keys and
add localized `domain_label`/`type_label`, aliases, `source_locale`,
`resolved_locale`, and `translation_status`. Missing or rejected translations
fall back to English and include a failure status/code when available. Domain,
type, and level labels use the checked-in shared locale taxonomy as a
deterministic fallback even when the translation database or Workers AI is
unavailable; their stable source keys do not change.

English source cards and graph rows are never overwritten. Translation is
limited to the checked-in public graph/card allowlist: private user notes and
personal knowledge content are not sent to Workers AI. Formulae, code, URLs,
and line structure are protected and a validation mismatch is stored as a
failure instead of caching modified technical content. Rows marked `reviewed`
or `human` are also never replaced or cleared by an automated translation run;
if their English source hash changes, English fallback is served until a
reviewer updates the translation and source hash.

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
