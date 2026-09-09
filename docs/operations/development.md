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
pnpm check:plugin
pnpm verify:image-size-hardening
pnpm --filter @stem-brain/web check:env:examples
pnpm --filter @stem-brain/web build
```

`pnpm check` runs each package's `check` task through Turborepo, including lint
and type checks for the web and mobile apps plus type checks for shared
workspace packages. `pnpm check:docs` validates local Markdown links and the
minimum feature-spec structure described in `specs/README.md`.
`pnpm check:plugin` verifies the public Codex and Claude Code marketplace
metadata, keeps their plugin identity metadata synchronized, and requires the
packaged plugin skills to match their project-local source copies exactly.

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
Worker, and checks its uncompressed upload against the guarded release-size budget.

Mobile Practice private keyset reads depend on migration
`0025_mobile_practice_owner_cursor.sql`, which adds the owner-first
`(user_id, id)` seek index plus the approved-draft item/owner lookup index. The
protected `main` workflow runs checked-in Drizzle
migrations before activating the production Worker. The protected Preview job
accepts the configured pooled or direct Neon `DATABASE_URL_PREVIEW`, derives a
direct connection in memory using Neon's `-pooler` hostname convention, and
uses repository variable `NEON_PREVIEW_BRANCH_ID` to prove that the resolved
connection points to the intended isolated branch. It then captures sanitized
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence for both new and review modes
through the same production query builder. It verifies
both exact 0025 index definitions and fails unless the latency-critical
owner-cursor index appears in each plan. PostgreSQL may correctly prefer a
sequential scan for the approved-draft predicate while that table is small; its
partial index remains definition-gated for growth. A failed plan assertion
still leaves the sanitized artifact for diagnosis. To reproduce that gate
manually from `apps/web`, set `NEON_PREVIEW_DATABASE_URL` to a pooled or direct
Preview URL and provide the expected branch plus revision:

```bash
export NEON_PREVIEW_DATABASE_URL='<preview-postgres-url>'
export EXPECTED_NEON_PREVIEW_BRANCH_ID='br-...'
export EXPECTED_HEAD_SHA='<40-character-pr-head-sha>'
NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test scripts/mobile-practice-index-postgres.test.mjs
```

Local
`harness:deploy` validates code, the Worker build, and size only; it does not
execute migrations or prove a live Postgres query plan.

Browser smoke checks use Playwright and start the web dev server automatically:

```bash
pnpm browser:smoke
pnpm harness:browser
```

### Authenticated graph overlay evidence

The authenticated overlay suite is deliberately separate from `browser:smoke`,
`harness:browser`, and normal CI. It creates or reuses one marker-named Clerk
synthetic user, idempotently seeds four private nodes and two independent
private edges, and adds a public-to-private link when a public graph node
exists. Two independent pairs let desktop and mobile dismiss one Thinking
History signal each without making the projects order-dependent. It measures the
Server Action that runs only after Graph is opened from `/grid`. Schema-only
Preview databases may have no public graph rows; there the required fixture
remains four private nodes and two private edges, and the reported public-link
count is zero.

The same opt-in authenticated run checks Settings on desktop and mobile. It
opens the hash-targeted AI-connections disclosure, exercises keyboard toggling,
restores validated browser-local AI-app and Context Pack choices, verifies the
Preview Thinking History default when that surface is enabled, checks Arabic
RTL/mobile containment and 44 px interaction targets, and saves synthetic
success screenshots. Only when the testing-token auth mode, marker-owned email,
PR Preview Worker hostname, and `E2E_REQUIRE_MCP_PAT_CLOSEOUT=true` all match,
fixture setup deletes `mcp_access_tokens` rows, their token-specific rate rows,
and the derived aggregate MCP-token creation buckets for the validated
synthetic owner inside the same fixture transaction. It acquires the
account-lifecycle and MCP token advisory locks in application order before that
reset. The desktop project
runs each PAT-mutating provider
test once; mobile and Arabic provider coverage remain read-only. Each created
token label embeds
`authenticated-overlay-e2e:mcp-pat:<random UUID>`. The normal check captures
the one-time value and immediately hides that surface,
proves the copied OpenAI and Claude snippets retain `GIRAPPHE_MCP_TOKEN` while
omitting the captured value, clears the clipboard with readback, revokes the
PAT in Settings, proves revoked rows are hidden until explicitly revealed,
reloads, and verifies the locked exact database row has zero active matches.
It then permanently deletes that exact revoked row, reloads to prove absence,
and only then captures a durable success screenshot. If the normal create
attempt commits but the one-time value cannot be captured, the locked exact
owner/label/random-marker fallback revokes that row and the run still fails
without accepted evidence. Before Create, the test extends its enclosing
timeout with a separate cleanup reserve while the evidence step retains the
original 60-second budget, so exhausting evidence time cannot prevent the
`finally` cleanup from starting. The PAT specs disable
Playwright's automatic failure screenshots, and the authenticated runner
disables automatic screenshots, AI-oriented accessibility page snapshots, and
Git author metadata. Tests retain only explicit post-deletion success
screenshots and sanitized JSON. If the suite fails, CI removes Playwright error
context and any image, trace, or video before uploading a diagnostics-only
artifact; it does not upload the HTML report for that failed run.

The rolling token-creation guard depends on migration
`0026_mcp_token_creation_rate_buckets.sql`. It adds only the partial stale-bucket
cleanup index; Preview and production migration steps must apply it before the
Worker version that writes `token-creation:*` buckets is activated.

A separate Preview-only fault check ignores Clerk and other background traffic,
then intercepts only the exact same-origin Settings Server Action POST whose
form payload contains that run's random marker. It lets that create POST commit,
captures and redacts the PAT from the fulfilled response, then faults both UI
cleanup paths.
The locked database fallback is a mandatory post-capture safety control even if
clipboard or UI assertions fail: it matches owner, exact label, unique run marker,
and SHA-256 hash, revokes that row, and verifies `active=0`. If the create commits
but the one-time response cannot be captured, an emergency fallback uses the
same locked owner, exact label, and random run marker so the credential is still
revoked; that run fails and produces no accepted evidence. Evidence is accepted
only when PAT/hash capture succeeds, both intended UI paths fault, and the
original sentinel Error object is re-thrown unchanged. Provider evidence JSON uses exact
versioned kind, project, and filename contracts; the Preview summarizer rejects
combined, misnamed, unknown-field, or wrong-schema mutation artifacts. Its job
summary contains counts and booleans only. This reset is intentionally destructive
only for the marker-validated synthetic account; its exact owner predicate does
not relax the application's token quotas or permit cleanup of a normal account.
Both PAT journeys resolve and validate that Clerk synthetic owner before Create;
post-create cleanup reuses the cached owner and therefore cannot spend its
reserved cleanup window waiting on an unbounded Clerk response. Immediately
before Create, each journey accounts for elapsed setup work and adds a bounded
evidence budget plus a separate 180-second cleanup reserve to the test timeout.
The exact marker-bearing Create request is proxied through `route.fetch()` and
tracked through response fulfillment. During the reserve, cleanup retries the
exact owner/full-label/run-marker predicate, adds hash verification when the PAT
was captured, and requires another successful exact cleanup after the Create
action and request are quiescent. An absent row or failed/unknown transport is
never accepted as closeout; retryable visibility, lock, and sanitized connection
failures continue to the deadline, while invalid owner or marker input fails
immediately. Per-operation database timeouts shrink with the remaining reserve.

The Thinking History project begins from a fixture-verified zero import-event
baseline. Local file parsing, candidate selection, and the consent checkbox must
produce neither a same-origin POST nor a server event row. The selected-content
submission then records started, parsed, confirmed, and candidates-ready once;
the complete session funnel remains idempotent across submission retries. The
memory and live-PostgreSQL regressions simulate a failed first best-effort
finalization, require the exact canonical request retry to restore all four
events, and separately prove that a new duplicate-only session cannot claim
candidates ready.

Preview evidence also exercises Manual Recall Review for the same dedicated
synthetic owner. Each desktop and mobile run creates or resets one deterministic,
eligible typed item and one due D+1 schedule for only that owner/item pair. The
browser proves the approved bundle is absent before reveal,
the local recall draft is absent from all four Server Action requests, the
approved bundle appears after reveal, and completion persists a matching D+7
schedule and completed attempt. Per-stage status, response-header timing,
decoded/transfer bytes, browser errors, and pre-reveal/post-reveal/completion
screenshots are included in the artifact summary. A `finally` cleanup removes
only the deterministic Recall IDs owned by that synthetic account.

Runtime inputs are injected temporarily; do not copy their values into tracked
files:

```text
PLAYWRIGHT_BASE_URL
CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
DATABASE_URL
E2E_CLERK_USER_EMAIL
E2E_CLERK_AUTH_MODE
PLAYWRIGHT_RUNS
```

`E2E_RECALL_ENABLED=true` is a workflow-owned Preview gate, not a value to put
in a production environment. `wrangler.jsonc` keeps production Recall
enrollment off and Preview in `allowlist` mode. Before the Preview Worker is
uploaded, the deployment workflow validates the marker-named Clerk account and
injects only that synthetic user ID as `RECALL_RUNTIME_USER_IDS`; it never opens
Recall enrollment to all Preview users.

`E2E_CLERK_USER_EMAIL` must contain the exact
`+clerk_test_girapphe_overlay_e2e` marker. Setup rejects an existing account
unless its Clerk public metadata marks it for `authenticated-overlay-e2e`, so a
normal user cannot become the fixture owner accidentally. Preview authentication
uses Clerk's Playwright testing token and `clerk.signIn()` by email address.
Production cannot mint testing tokens, so its explicitly confirmed one-shot run
uses a five-minute backend sign-in token for the same marked synthetic owner.
When `E2E_CLERK_AUTH_MODE` is omitted, the suite uses the same resolver in setup
and provider tests: a test Clerk secret selects `testing-token`, while a live
secret selects `sign-in-token`. Production sign-in-token runs neither reset MCP
token rows nor execute the PAT creation/revocation evidence; those mutations
remain Preview-only. Both paths write only an ignored `playwright/.clerk/`
storage-state file. See
Clerk's current
[Playwright testing guide](https://clerk.com/docs/guides/development/testing/playwright/overview)
and [authentication-state reuse guide](https://clerk.com/docs/guides/development/testing/playwright/test-authenticated-flows),
plus the [backend sign-in token reference](https://clerk.com/docs/reference/backend-api/tag/Sign-in-Tokens#operation/CreateSignInToken).

With the matching environment supplied securely, run:

```bash
pnpm browser:authenticated-overlay
```

The command uses fresh browser contexts and writes per-run JSON, explicit
post-cleanup success screenshots, and `summary.md` under
`test-results/authenticated-overlay-performance/`. The summary reports median
and worst Graph-click-to-canvas time, overlay request-to-response-headers time,
and decoded/transfer bytes received through canvas display. CDP collects those
network values without waiting for a streaming production RSC response to close.
The authenticated graph overlay response is intentionally canvas-shaped: private
nodes retain only graph identity/display fields, private edges retain only
rendered edge fields, and link targets contain only public endpoints used by a
private edge. Rich private bundle content remains on the owner-scoped knowledge
item surface instead of being serialized a second time for graph activation.
The suite also requires HTTP 200, exactly one no-argument overlay request, at
least two final fixture-filtered private canvas nodes, at least one final private
canvas edge, and zero console/page errors.
On testing-token Preview runs, the Pixel 7 project also performs one deployed
mobile API journey covering private Notes lifecycle, Topics and Topic Hub,
anonymous Ranking, private new/review Practice, and Candidate approve, ignore,
and stale-version responses. The create journey repeats one request ID with an
edited payload and requires `replayed` plus exactly one note containing only the
first payload. Every authenticated response must be
`private, no-store`. The fixture adds only marker-owned rows for the dedicated
synthetic account, removes the exact batch, items, event hashes, private
mastery, and ranking row. Exact-marker note cleanup is owner-bounded and removes
all rows so even a duplicate-create regression leaves no synthetic residue. The
journey writes only counts and booleans to the Mobile API
summary section. Body failures and cleanup failures are preserved separately;
the command still attempts to write the sanitized summary and returns the
original Playwright failure status.
Before Graph is clicked, the suite waits for the page load event plus a
three-second idle observation and fails on any Server Action request.
After the desktop and mobile evidence projects finish, a dependency-final
desktop regression signs out the synthetic browser session exactly once. It
requires the localized home page to show signed-out navigation immediately and
the private mobile API to return `401`; keep it last because it revokes the
shared synthetic session used by the earlier checks.
Authenticated traces and videos stay disabled because they can retain session
headers; the ignored storage state is never uploaded with evidence artifacts.

Prefer the manual **Authenticated overlay performance** GitHub workflow:

1. Configure `AUTHENTICATED_OVERLAY_E2E_USER_EMAIL_PREVIEW` as a repository
   variable using the required marker before the PR Preview deployment. The
   deployment uses it to prepare the exact Recall runtime allowlist without
   printing the Clerk user ID.
2. After the PR Preview deploy succeeds, apply the `authenticated-performance`
   label to run the opt-in preview job from that PR, or dispatch
   `target=preview` with an open `preview_pr_number`. The workflow rejects closed
   and fork PRs, resolves the exact same-repository PR head SHA through GitHub,
   checks out that SHA, and waits until `/api/health` reports the same deployed
   revision. Desktop and mobile each run three times against that PR's Preview
   Worker, preview Clerk instance, and preview database. The validated Preview
   synthetic owner's prior MCP token rows are reset under the account-lifecycle
   and token locks before provider evidence. The same explicit Preview closeout
   gate is shared by setup and both PAT tests.
   The desktop PAT tests each run once regardless of the overlay measurement
   count; the normal UI path finishes with exact permanent deletion, while the
   deterministic route-fault fallback finishes at zero active exact matches.
   Mobile and Arabic provider checks do not
   mutate PATs. The mobile API mutation journey is testing-token Preview-only,
   and its summary is deployed browser evidence, not physical-device,
   accessibility, signed-binary, or store-release evidence.
   Each device also runs one destructive-but-cleaned Recall lifecycle against
   the deterministic synthetic fixture.
3. Review the uploaded summary before changing performance code. Separate
   Clerk, Worker-to-Neon, private-graph, and link-target time if the result is
   slow.
4. Configure the independently owned production variable
   `AUTHENTICATED_OVERLAY_E2E_USER_EMAIL` only when production evidence is
   desired. Dispatch `target=production` with the exact confirmation
   `RUN_PRODUCTION_SYNTHETIC` from the protected `main` branch; the workflow
   rejects every other ref before exposing production credentials. Desktop and
   mobile each run once against `https://www.girapphe.com`, after its health
   revision matches the checked-out `main` SHA. This sign-in-token path does not
   reset, create, revoke, or permanently delete MCP tokens. Recall evidence
   remains skipped there
   because production enrollment is default-off and has no E2E allowlist
   activation.

The deployment workflow attaches `GIRAPPHE_REVISION` atomically to each uploaded
Worker version. Production bulk-secret synchronization intentionally excludes
it, so a failed code upload cannot advance the revision reported by health.

The workflow is opt-in and never becomes a required release check merely by
being present. A failed measurement is evidence for a separate investigation;
it does not reopen PR #158's already-verified public-route work automatically.

If Chromium is not installed locally yet, run:

```bash
pnpm exec playwright install --with-deps chromium
```

GitHub-hosted runners first use the same dependency-aware install. If an
unrelated third-party APT index refresh fails, the workflows retry only the
Playwright-managed Chromium download against the runner's preinstalled system
dependencies; the subsequent browser test still fails closed if those
dependencies are insufficient.

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

The Preview deploy job runs the bounded, idempotent migration subset in
`apps/web/scripts/apply-preview-schema.mjs` before its database-semantic tests.
That subset also reapplies additive legacy table creation when a long-lived
Preview database predates the corresponding migration journal entry; every
such repair must remain `CREATE ... IF NOT EXISTS` and pass the safe-statement
allowlist. A dependent legacy upgrade may use only the exact checked-in,
idempotent `ADD COLUMN`/constraint and bounded backfill statements that its
base migration requires; each statement is parsed separately and must match
the explicit safe-statement allowlist.
Local bootstrap remains a development convenience. Any production data or
schema change must still be represented by a checked-in Drizzle migration; a
runtime bootstrap query is not deployment evidence.

All pull-request Preview deploy jobs share `DATABASE_URL_PREVIEW` and the same
Preview Worker settings. The deploy job and authenticated Preview evidence job
therefore use the constant `girapphe-preview-shared-state-v1` concurrency group.
Different PRs and authenticated evidence runs wait in a queue of up to 100
entries (`queue: max`) while schema preparation, all live PostgreSQL semantic
checks, Worker mutation, and synthetic-fixture use run one at a time. Dispatch
authenticated evidence only after its target Preview deploy has passed.

The workflow-level concurrency rule never cancels an in-flight workflow. It
retains only the latest pending revision for the same PR or `main`, so repeated
pushes replace stale waiting work without interrupting a stateful job. Before a
Preview deployment, authenticated fixture run, or production deployment makes
its first shared-state mutation, it also compares the event SHA with the
current GitHub PR or `main` head and fails closed if the PR was closed, became
foreign, or its revision was superseded. The authenticated job repeats this
check after acquiring the shared Preview group, rather than trusting its
earlier dispatch validation. A revision that already passed its in-job guard
completes its stateful sequence; the latest pending workflow runs next.
Keep schema preparation, all live PostgreSQL semantic checks, and the Worker
upload inside the serialized deploy job and in that order.

Because production migrations run before the replacement Worker is deployed,
changing or removing a unique constraint used as an explicit `ON CONFLICT`
arbiter requires an expand/contract release. First deploy conflict handling
that works with both the old and new constraints and verify that production
SHA. Its retry lookup must already use the expanded key so the compatibility
Worker cannot resolve a retry to another scope after the later migration.
Change the constraint only in a later protected release; otherwise the
still-running Worker can fail every affected write if deployment is slow or
stops after migration.

Recall schedule and prepared-attempt persistence are checked against a real
Preview PostgreSQL database after migration preparation. This includes the
partial active-attempt uniqueness constraint, cross-device start/resume,
confidence-before-reveal, stale-revision invalidation, and Practice
remove/reset behavior. To run the same test against an isolated non-production
database without printing its URL:

```bash
cd apps/web
LIVE_POSTGRES_TEST_DATABASE_URL="$DATABASE_URL" \
  NODE_OPTIONS=--conditions=react-server \
  pnpm exec tsx --test scripts/recall-persistence-postgres.test.mjs
```

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
