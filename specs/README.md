# Feature Specifications

Feature specs connect product intent to executable evidence. They are not a
second backlog and should stay small enough to review with the implementation.

## When a spec is required

Create or update `specs/features/<feature>.md` for:

- a new user journey or material behavior change;
- an API, database, serialized-data, or compatibility contract;
- authentication, privacy, payment, ownership, or retention behavior;
- cross-platform behavior that web and mobile must preserve together; or
- a significant architecture or rollout decision.

A narrow bug fix normally needs a regression test and PR explanation, not a new
spec. Use [`features/_template.md`](./features/_template.md) when a spec is
required.

## Lifecycle

`Status` is one of `Draft`, `Active`, `Implemented`, or `Superseded`.

1. Describe the user outcome, explicit scope, and privacy/data boundary.
2. Give every acceptance criterion a stable `AC-01` style identifier.
3. Map every criterion to a test, inspection, or deployment check in
   `Verification`.
4. Keep criteria unchecked until their evidence passes. An `Implemented` spec
   must have every criterion checked.
5. Record migrations, compatibility, activation, and rollback boundaries in
   `Rollout`.

`pnpm check:docs` validates local Markdown links and this minimum structure.
`pnpm harness` includes that check so documentation drift fails before review.
