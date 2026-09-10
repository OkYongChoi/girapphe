# Authenticated Thinking History Evidence

Status: Implemented. Release evidence is accepted only when the manually
dispatched authenticated workflow verifies the exact open-PR or protected-main
revision and every enabled desktop/mobile project, cleanup step, and privacy
summary passes together.

## Scope

The authenticated synthetic test uses the dedicated marker-named Clerk fixture
account and owner-scoped PostgreSQL data. Setup seeds four approved private
nodes and two independent private relationships so desktop and mobile projects
can each dismiss one signal without sharing a destructive dependency. It then
uses a generated ChatGPT-shaped file whose marker text exists only for that
test. Setup also requires the synthetic owner to begin with zero ChatGPT import
submission events. Before reseeding, it deletes reuse activity only for that
synthetic owner and the four deterministic fixture item IDs, keeping repeated
context-pack runs bounded without touching another owner or item. No real user
content belongs in fixtures or artifacts.

The test asserts:

- the localized Thinking History and importer assets return `200`;
- no context-pack request occurs before explicit evidence selection;
- an intelligence signal renders for each project's private relationship;
- evidence view, approved-item navigation, and signal dismissal record only
  privacy-safe `204` operations;
- at least two private evidence items can be explicitly selected;
- JSON, YAML, and Markdown can each be copied and downloaded, producing six
  successful `200` context responses with synthetic approved knowledge and no
  raw-conversation or credential-shaped content;
- before import consent and again after local selection/consent but before
  submission, no same-origin POST occurs and the owner export contains zero
  started/parsed/confirmed/candidates-ready import events;
- after submission, only the two explicitly selected exchanges cross the
  Server Action boundary, while a third unselected marker never does, and the
  four expected import events each exist exactly once with aggregate counts;
- pending candidates show their source-evidence selectors, one candidate can
  be ignored, and whole-import discard removes the remaining pending candidate;
- the full owner export contains selected pending content before import-job
  deletion and contains none of the synthetic import markers afterward;
- desktop and mobile runs have no browser console or page errors; and
- JSON metrics and a synthetic-only screenshot are attached to CI artifacts;
  the same evidence is rendered as a separate table in the CI job summary.

Evidence interactions are scoped from the stable `.thinking-card` article,
because opening a signal changes the toggle's accessible name. The My Notes
mutation check waits until the tag picker exposes its enhanced hidden form value
before typing, then keeps `fill` and `Enter` adjacent so the same-tick input/event
regression remains exercised rather than hidden behind an extra state wait.
After returning to the insights feed, the test waits for a rendered signal,
captures that expanded card's server-owned signal identifier, and requires both
that same card identity to disappear and the overall card count to decrease.
The local import preview is scoped through each exchange checkbox's accessible
name, then requires one visible list row containing the exact synthetic question;
selection reuses that same row instead of depending on incidental text-node
boundaries around the localized Question and Answer labels.
Because the owner export can briefly lag the completed Server Action across
separate Worker database connections, the test polls for exactly four committed
import events with a 30-second bound. Import deletion must then return that count
to zero before the next desktop or mobile project can begin. The submitted batch
ID is captured only after an exact UUID detail route replaces the local `/import`
route and before that poll. The same owner-scoped deletion UI runs from a
`finally` block even when a later evidence assertion fails; if the client
redirect itself fails after the server commit, the unique synthetic marker
recovers the batch ID from the owner export first. One project therefore cannot
satisfy or contaminate the other's privacy evidence.

On the mobile long-form review page, the site header and batch action bar are
static. The candidate grid must stay within the visual viewport even when a
title, source reference, identifier, notation example, or form control has a
large intrinsic width. With smooth scrolling temporarily disabled, the test
centers the resolution link and requires unchanged bounds across two animation
frames plus a midpoint whose browser hit target is the link. Playwright then
performs one real unforced locator `tap({ scroll: "none" })`: its visibility,
stability, enabled-state, and final hit-target checks remain active, but it
cannot perform a second internal scroll after the deterministic centering.
Desktop uses the same centering and hit-test precondition, then separately
performs a trial actionability check and activates the link with focused-keyboard `Enter`;
coordinate-level page input, forced clicks, and DOM-dispatched clicks are not
accepted as evidence. Confirm-driven mobile controls use the same stable-center
and hit-target precondition, register the browser dialog first, and perform one
unforced `tap({ scroll: "none" })`. The href must be the same-origin, exact batch
and draft resolution route. Request observers start only after the
pre-activation checks so a prefetch cannot masquerade as the real activation. A committed exact URL
is accepted only when the client router used its cache without a request or the
observed request completed with a successful response. Otherwise the harness
separately reports no request, a request without a response, failed request,
destination HTTP error, redirect without a commit, or a successful target
response that never committed navigation. The hit-test and navigation
observation are bounded, so an actionability regression cannot consume the
whole test budget and prevent cleanup from running.

Owner-data navigation permits exactly one retry after a transient Preview error
page; it never enters an unbounded reload loop. If that UI cleanup still fails,
the test dynamically loads a database fallback that first revalidates the one
existing Clerk fixture account's synthetic-purpose marker. The transaction is
restricted to the exact owner, UUID batch, ChatGPT selected-export scope, and
unique generated central-question marker. It refuses approved drafts, foreign
draft ownership, or linked knowledge sources, follows the account-lifecycle and
ingestion lock order, removes every event (including candidate-resolution
events) under only the exact session and batch subject hashes, and verifies that
the exact batch, drafts, and both event subjects are gone. A verified fallback
prevents the next serial browser project from inheriting residue, but never
converts the failed UI evidence into a pass.

Authenticated traces remain disabled because they can retain session headers.
The structured fallback and browser-error summary records only stable
route/outcome codes, HTTP status, counts, and short error fingerprints; it does
not include request or response bodies, headers, or Clerk identity. Optional
layout diagnostics retain bounded numeric geometry, computed layout properties,
and a numeric class fingerprint instead of raw class names or authored text.
Browser console and page errors are fingerprinted before assertion output. Playwright's
failure HTML and synthetic-only screenshots may still show test-authored marker
strings or opaque route IDs needed to diagnose a failed locator. Those artifacts
contain no real user content, use only the dedicated synthetic account, and are
retained by the protected workflow for 14 days.

The importer assertion is deliberately about one extracted
`conversations.json`. It is not evidence for ZIP archives, numbered/split
exports, or any other provider adapter. The parser is deterministic and makes
no model call.

## Execution boundary

Preview CI sets `E2E_THINKING_HISTORY_ENABLED=true` and uses Preview Clerk and
PostgreSQL secrets already required by the authenticated overlay harness.

Production remains separately gated. The test skips unless that variable is
explicitly enabled after the dedicated production synthetic user is included
in the Thinking History rollout allowlist. A passing Preview run must not be
reported as production activation.

The selected-export concurrency and deletion fixture runs against the isolated
Preview PostgreSQL database before deployment. The authenticated fixture also snapshots the synthetic
owner's canonical knowledge, private/public graph, mastery, and ranking state
before submission, then asserts immediately before approval that the snapshot
is unchanged and that the exact pending batch has zero activation-linked rows.
Passing source or local fallback tests alone is not production or Preview proof;
the workflow must exercise these boundaries against the revision it reports.

Run the same project locally only with an isolated environment:

```bash
PLAYWRIGHT_BASE_URL=https://preview.example \
E2E_THINKING_HISTORY_ENABLED=true \
pnpm browser:authenticated-overlay
```

Implementation: `apps/web/e2e-authenticated/authenticated-thinking-history.spec.ts`
and `playwright.authenticated.config.ts`.
