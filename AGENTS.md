# Girapphe Agent Contract

These instructions apply to the whole repository. More specific `AGENTS.md`
files may add rules for a subtree but must not weaken this contract.

## Before changing files

1. Confirm the checkout and compare `HEAD` with `origin/main`. When `main` is
   checked out in another worktree, create a short-lived `codex/...` branch in
   the current worktree; do not move the other worktree.
2. Read `README.md`, `docs/operations/development.md`, and the documentation
   owned by the capability being changed.
3. For a meaningful feature, read or create its file in `specs/features/`
   before implementation. Use `specs/features/_template.md` and keep stable
   acceptance-criterion IDs mapped to verification evidence.

A feature spec is required for a new user journey, API or database contract,
auth/privacy/payment/ownership behavior, cross-platform behavior, or a
significant architectural decision. A narrow bug fix may use a regression test
plus a concise PR description instead.

## Implementation boundaries

- Keep web and mobile as adapters over dependency-light shared contracts. Do
  not import web-only or database-row types into mobile or shared packages.
- Preserve owner scoping and the private/public graph boundary. Conversation
  knowledge must stay selected, pending, reviewable, editable, and private
  until explicit approval; never retain raw conversation history.
- Production request handlers do not mutate schema. Put schema changes in a
  checked-in Drizzle migration and keep Preview/production activation steps
  explicit.
- Add or update the smallest regression test that proves each changed behavior.
  Update reference and operations docs in the same change when a contract,
  workflow, environment, or release assumption changes.

## Validation contract

Run the smallest relevant focused check while iterating, then the appropriate
repository gate before handoff:

| Change | Required validation |
| --- | --- |
| Documentation or feature spec only | `pnpm check:docs` and `git diff --check` |
| Narrow web or mobile behavior | the affected package test/check, then `pnpm harness` |
| Shared contract, API, build config, or CI workflow | `pnpm harness` |
| Browser-visible behavior | focused Playwright coverage plus `pnpm harness:browser` when local browser prerequisites are available |
| Cloudflare/runtime/release behavior | `pnpm harness:deploy` |
| Mobile store configuration | `pnpm --filter @stem-brain/mobile check` and the applicable release/build check |

`pnpm harness:ci` is the CI quality contract after a frozen-lockfile install.
It includes the local harness and iOS/Android export builds. DB-backed tests may
require Preview credentials; report any skipped live-database coverage instead
of presenting local fallback tests as production proof.

## Delivery

Keep commits scoped, inspect the final diff, and do not discard unrelated user
changes. For a release request, use a protected PR, resolve actionable review
threads, verify merge ancestry and the exact deployed SHA, then perform rendered
smoke checks against `https://www.girapphe.com`.
