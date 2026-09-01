# Authenticated graph overlay evidence

Status: Implemented

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

- [x] `AC-01`: Setup creates or reuses only a marker-named Clerk synthetic user
  and idempotently leaves at least two active private nodes and one active
  private edge owned by that user. It also leaves one public-to-private link
  when the target database contains a public graph node.
- [x] `AC-02`: After the signed-in `/grid` load event and a three-second idle
  observation, no overlay Server Action request has started; one Graph click
  sends exactly one overlay request and receives exactly one overlay response
  with HTTP 200.
- [x] `AC-03`: After the click, the 3D canvas input contains the two fixture nodes
  and their private edge, with no uncaught page or console errors.
- [x] `AC-04`: Preview evidence contains three fresh-context runs for desktop and
  mobile and reports median and worst graph-display time, overlay time, and
  response bytes.
- [x] `AC-05`: The evidence suite is absent from normal CI and is available only
  through an explicit authenticated-performance command or manual workflow;
  Preview resolves and checks out the exact head of an open same-repository PR;
  each target's health revision must match that checked-out SHA before seeding;
  production requires an additional explicit confirmation, uses a short-lived
  backend sign-in token instead of a development-only testing token, is limited
  to the protected `main` branch, and runs once.

The deployment workflow attaches the revision to the Worker version upload. It
does not update the production revision in the earlier bulk-secret step, so a
failed code deployment cannot make stale production code claim the incoming SHA.

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
| `AC-02` | `apps/web/e2e-authenticated/authenticated-overlay-performance.spec.ts`, including request-event counting by overlay action ID. |
| `AC-03` | `apps/web/e2e-authenticated/authenticated-overlay-performance.spec.ts` plus `data-visible-private-*` canvas-input counts. |
| `AC-04` | `pnpm browser:authenticated-overlay` and its `test-results/authenticated-overlay-performance/summary.md` artifact. |
| `AC-05` | Inspection of `.github/workflows/authenticated-performance.yml`, `.github/workflows/deploy-cloudflare.yml`, `playwright.authenticated.config.ts`, and the normal `playwright.config.ts`; `apps/web/scripts/verify-deployment-revision.test.mjs`. |

Preview workflow run
[`33466410279`](https://github.com/OkYongChoi/girapphe/actions/runs/33466410279)
passed against PR #160 on 2026-09-01. The schema-only Preview database had no
public graph row, so setup reported two private nodes, one private edge, and
zero optional public links. Every measured run had HTTP 200, a 2,406-byte
decoded overlay body, two private nodes, and one private edge. The click-to-
canvas / overlay median and worst values were:

| Device project | Click to canvas median / worst | Overlay median / worst | Transfer body median / worst |
| --- | ---: | ---: | ---: |
| Desktop | 2,282.7 ms / 2,577.9 ms | 963.6 ms / 980.2 ms | 1,380 B / 1,382 B |
| Mobile | 1,985.2 ms / 2,029.9 ms | 802.4 ms / 870.2 ms | 1,377 B / 1,382 B |

Each click produced the expected public-snapshot and private-overlay Server
Actions; exactly one response contained the owner-scoped fixture. No overlay
Server Action ran before the click.

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
