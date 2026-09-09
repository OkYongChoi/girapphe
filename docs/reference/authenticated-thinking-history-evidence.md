# Authenticated Thinking History Evidence

Status: The earlier authenticated Preview path passed in run `34038249111`.
The expanded import, three-format reuse, dismissal, and deletion path is
implemented in the harness but still requires a credentialed Preview run on
the exact new commit.

## Scope

The authenticated synthetic test uses the dedicated marker-named Clerk fixture
account and owner-scoped PostgreSQL data. Setup seeds four approved private
nodes and two independent private relationships so desktop and mobile projects
can each dismiss one signal without sharing a destructive dependency. It then
uses a generated ChatGPT-shaped file whose marker text exists only for that
test. Setup also requires the synthetic owner to begin with zero ChatGPT import
submission events. No real user content belongs in fixtures or artifacts.

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

Live PostgreSQL run `34305134986` passed the prior selected-export concurrency
and deletion fixture. The current fixture additionally asserts immediately
before approval that canonical knowledge, private/public graph state, mastery,
and ranking rows are all zero. That new assertion is source-only until the
isolated Preview PostgreSQL workflow passes on the exact new commit.

Run the same project locally only with an isolated environment:

```bash
PLAYWRIGHT_BASE_URL=https://preview.example \
E2E_THINKING_HISTORY_ENABLED=true \
pnpm browser:authenticated-overlay
```

Implementation: `apps/web/e2e-authenticated/authenticated-thinking-history.spec.ts`
and `playwright.authenticated.config.ts`.
