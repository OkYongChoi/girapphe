# Authenticated Thinking History Evidence

Status: Preview harness implemented; a credentialed Preview run is required for
remote evidence.

## Scope

The authenticated synthetic test opens `/my-knowledge?view=insights` with the
dedicated Clerk fixture account and its owner-scoped PostgreSQL knowledge. It
proves the private rendered path without placing real user content in fixtures
or artifacts.

The test asserts:

- the localized Thinking History asset is requested once and returns `200`;
- no context-pack request occurs before explicit evidence inspection;
- an intelligence signal renders for the synthetic private relationship;
- expanding evidence records exactly one privacy-safe `204` viewed event;
- at least two private evidence items can be explicitly selected;
- context reuse makes exactly one `200` request and downloads Markdown;
- the Markdown includes synthetic approved knowledge, not raw conversation or
  credential-shaped content;
- desktop and mobile runs have no browser console or page errors; and
- JSON metrics and a synthetic-only screenshot are attached to CI artifacts;
  the same evidence is rendered as a separate table in the CI job summary.

## Execution boundary

Preview CI sets `E2E_THINKING_HISTORY_ENABLED=true` and uses Preview Clerk and
PostgreSQL secrets already required by the authenticated overlay harness.

Production remains separately gated. The test skips unless that variable is
explicitly enabled after the dedicated production synthetic user is included
in the Thinking History rollout allowlist. A passing Preview run must not be
reported as production activation.

Run the same project locally only with an isolated environment:

```bash
PLAYWRIGHT_BASE_URL=https://preview.example \
E2E_THINKING_HISTORY_ENABLED=true \
pnpm browser:authenticated-overlay
```

Implementation: `apps/web/e2e-authenticated/authenticated-thinking-history.spec.ts`
and `playwright.authenticated.config.ts`.
