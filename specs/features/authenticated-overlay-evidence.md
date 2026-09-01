# Authenticated graph overlay evidence

Status: Active

## User outcome

Girapphe can prove that a signed-in user's private knowledge overlay remains
deferred until the user opens the graph, then reaches the rendered graph without
errors. The evidence records the interaction and overlay costs separately from
the already-verified public `/grid` route performance.

## Scope

In scope:

- Create or reuse one dedicated Clerk synthetic user.
- Seed two owner-scoped private nodes and one private edge idempotently in the
  matching database. Add one public-to-private link when that environment has a
  seeded public graph node.
- Measure the authenticated `/grid` overlay on desktop and mobile without adding
  an external-provider dependency to normal CI.
- Save per-run metrics plus median and worst values for graph display latency,
  overlay request latency, and overlay response size.

Out of scope:

- Reopening the public-route, prefetch, or render-budget optimizations from PR
  #158.
- Establishing performance budgets before representative measurements exist.
- Storing a raw conversation, publishing synthetic knowledge, or using a real
  user account as a fixture owner.

## Acceptance criteria

- [ ] `AC-01`: Setup creates or reuses only a marker-named Clerk synthetic user
  and idempotently leaves at least two active private nodes and one active
  private edge owned by that user. It also leaves one public-to-private link
  when the target database contains a public graph node.
- [ ] `AC-02`: A signed-in `/grid` load sends no overlay Server Action request;
  one Graph click receives exactly one overlay response with HTTP 200.
- [ ] `AC-03`: After the click, the 3D canvas input contains the two fixture nodes
  and their private edge, with no uncaught page or console errors.
- [ ] `AC-04`: Preview evidence contains three fresh-context runs for desktop and
  mobile and reports median and worst graph-display time, overlay time, and
  response bytes.
- [ ] `AC-05`: The evidence suite is absent from normal CI and is available only
  through an explicit authenticated-performance command or manual workflow;
  production requires an additional explicit confirmation and runs once.

## Privacy and data boundaries

The fixture accepts only an email containing the dedicated
`+clerk_test_girapphe_overlay_e2e` marker. Database IDs are derived from a
one-way hash of the Clerk user ID, and every insert and verification query is
bound to that owner. The fixture contains synthetic titles and summaries only.
It never reads, clones, logs, or exports another user's private knowledge or any
raw conversation. Clerk and database secrets remain runtime inputs and are not
written to the repository or Playwright artifacts.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/scripts/authenticated-overlay-fixture.test.mjs` and the setup result in the manual workflow. |
| `AC-02` | `apps/web/e2e-authenticated/authenticated-overlay-performance.spec.ts`. |
| `AC-03` | `apps/web/e2e-authenticated/authenticated-overlay-performance.spec.ts` plus `data-visible-private-*` canvas-input counts. |
| `AC-04` | `pnpm browser:authenticated-overlay` and its `test-results/authenticated-overlay-performance/summary.md` artifact. |
| `AC-05` | Inspection of `.github/workflows/authenticated-performance.yml`, `playwright.authenticated.config.ts`, and the normal `playwright.config.ts`. |

## Rollout

The first automated run targets a deployed PR Preview Worker, preview Clerk
instance, and schema-only preview database. It is manually dispatched and is
not a required PR or deployment check. After preview evidence passes, production
may be dispatched once with the dedicated production synthetic account and the
exact confirmation string documented in `docs/operations/development.md`.

The fixture uses existing tables and requires no migration. Rollback is removal
of this opt-in workflow and test harness; the deterministic synthetic rows can
be deleted separately by their hashed fixture IDs if the synthetic account is
retired. A failed or slow measurement opens a separate investigation that first
separates Clerk, Worker-to-database, private graph, and link-target time; it does
not by itself change the public-route performance code.
