# Mobile App Architecture

## Purpose

`apps/mobile` is the shared Expo application for both iOS and Android. The
platform apps should not diverge into separate product architectures unless a
native platform requirement forces it.

The mobile app should follow the same graph, card, and knowledge-state contract
as the web app. Platform-specific work should stay at the shell, navigation,
permissions, build, and device capability layers.

## Current Shape

- Framework: Expo, React Native, and Expo Router.
- Entry point: `expo-router/entry`, configured in `apps/mobile/package.json`.
- Route shell:
  - `app/_layout.tsx` defines the root stack.
  - `app/(tabs)/_layout.tsx` exposes Home, Browse, Practice, My Notes, and
    Account tabs.
  - Progress, Review, and Ranking are hidden tab routes reached from the app's
    signed-in surfaces.
  - Topic detail, private Topic Hub, Candidate Inbox, Sign In, Subscription,
    and Admin are root-stack routes.
- iOS and Android are produced from the same source tree:
  - `pnpm --filter @stem-brain/mobile ios`
  - `pnpm --filter @stem-brain/mobile android`
  - `pnpm --filter @stem-brain/mobile build`

## Shared Contracts

The mobile app's primary source of truth is `@stem-brain/graph-engine`.

Mobile imports from this package for:

- graph node and edge data
- graph and knowledge-state types
- card content
- domain color mapping
- prerequisite, dependent, and related-topic relationships

The relevant exports are centralized in `packages/graph-engine/src/index.ts`.
When a field, relationship type, or knowledge-state value changes, update the
graph engine first and then adjust app surfaces.

`@stem-brain/shared` is reserved for constants, API client types, and utilities
that are shared across web, mobile, and future app targets. Its canonical tag
contract keeps localized comma parsing, Unicode normalization, and code-point
bounds identical across the native editor and web API.

## Feature Boundaries

Mobile feature code should be organized around user flows, not platform names:

- Home: high-level map and featured topic entry points.
- Browse: searchable and filterable topic discovery.
- Practice: guest/local fallback plus authenticated, server-synced review using
  tri-state ratings. Authenticated Review entry follows the server-owned
  `reviewable` count. Synced traversal carries one bounded opaque cursor
  across deterministic public/private keyset lanes instead of growing rated or
  skipped ID arrays. Skips advance the frontier and advertising cadence but not
  Reviewed, may reappear after a requested wrap, and only transient reads retry
  once. A missing app base URL is a permanent local configuration error and is
  never wrapped or retried as a network failure.
- My Notes: quick notes plus full-field version-one concept, procedure,
  comparison, mechanism, structure, claim/evidence, question, decision, and
  event and expression bundles. Active, Archive, and Trash are distinct views;
  active knowledge supports tag-aware search plus topic, type, date, and sort
  controls. Tag entry recognizes ASCII, Arabic, and fullwidth commas; the API
  independently applies the shared Unicode-normalized tag limits.
- Candidate Inbox: quick save-as-new or ignore for explicitly submitted
  current-conversation and selected-export candidates, with their source scope
  labeled separately. A possible duplicate links to the exact detailed web
  review when the configured app base URL is safe.
- Topic Hub: compact approved knowledge, open questions, relations, timeline,
  and source-position views.
- Topic detail: explanation plus prerequisite/dependent/related navigation.

Do not create separate iOS-only or Android-only versions of these flows unless
the interaction model is genuinely platform-specific.

## Data Flow

The app keeps public graph browsing and guest practice available locally, while authenticated
notes, progress, review, ranking, private graph state, and subscriptions use the deployed API:

```text
@stem-brain/graph-engine
    -> apps/mobile/src/knowledge.ts
    -> Expo Router guest/public screens

Clerk token cache (Expo SecureStore)
    -> apps/mobile/src/api.ts
    -> https://www.girapphe.com/api/mobile
    -> owner-scoped Postgres data
```

`apps/mobile/src/knowledge.ts` is the mobile adapter over graph-engine data. It
is allowed to provide mobile-specific filtering, featured-topic selection, and
view-model helpers. It should not redefine graph schema, edge semantics, or
knowledge-state rules.

## API Integration Path

The web app already exposes the server contract documented in
`docs/reference/api-spec.md`.

Mobile synchronization preserves this direction:

```text
Expo screen
    -> mobile API/client adapter
    -> documented HTTP API
    -> graph-engine-compatible response types
```

Shared request/response types should move into `@stem-brain/shared` only when they are used by
more than one app target. Keep the guest/local fallback explicit; never silently present it as
account-synced state.

New clients read Practice through `POST /api/mobile?resource=practice`, with
`mode`, a null or opaque `cursor` of at most 1,024 characters, and
`cycleOnEmpty` in a JSON body capped at 2 KiB. The server alternates public and
owner-private lanes while traversing IDs deterministically within each lane;
database branches fetch at most one candidate per lane with `LIMIT 1`. A
non-null cursor may wrap to a fresh round exactly once only when
`cycleOnEmpty` is true. The response supplies `card`, `stats`, `nextCursor`,
and `cycled` under `private, no-store`. The client keeps `nextCursor`, a capped
100-entry previous-card history, and constant-size round counters; it does not
grow a card-ID collection or rewind the frontier when reopening the previous
card. The synced Reviewed tile counts distinct rated IDs inside that recent
history window, while advertising cadence uses a separate monotonic
successful-advance counter. The server keeps no request-global traversal
state. Saved-card reads
also return authoritative stats so Review navigation never infers due work
from list length. When a database is configured, failures propagate instead
of being presented as empty or mock account state. Review and Practice use
latest-request guards so stale focus or mutation loads cannot overwrite
current state. The bounded legacy GET remains only for already-installed
clients.

Typed personal items retain the flat note fields for compatibility. Mobile
renders their type badge and central question, supports full-field create/edit
and explicit legacy-note conversion, filters personal graph nodes by type, and
reuses the existing reveal/rating/review schedule with a type-specific recall
prompt.

Candidate review is intentionally split by interaction depth. Mobile supports
quick save-as-new and ignore; a possible duplicate links to the web review
surface. Web owns side-by-side comparison, full editing, merge/update, evidence
selection, advanced canonical lifecycle actions, local graph/history, native
ChatGPT archive parsing, Thinking History signal generation, and context-pack
export. Basic archive, restore, and trash organization is available in mobile
My Notes. Mobile Topic Hub views remain compact while consuming the same
owner-scoped canonical data. Neither app retains raw conversation text:
provenance is selector-only.

The web Settings connection guide and Context Pack format are browser-local
presentation preferences, so they do not create a mobile API contract or a new
mobile navigation destination. Mobile retains its existing Account adapter;
MCP connection management and those reusable-context defaults remain web-owned.

## Platform Rules

- Keep product behavior shared between iOS and Android by default.
- Keep static identifiers and defaults in `apps/mobile/app.json`; production
  environment validation and plugin composition live in
  `apps/mobile/app.config.ts`.
- Put platform branches behind narrow adapters, for example push notifications,
  deep links, secure storage, camera, or haptics.
- Avoid importing web-only code from `apps/web` into mobile. Shared logic should
  move into `packages/*`.

## Documentation Ownership

Use these documents together:

- `docs/architecture/overview.md`: product and system architecture.
- `docs/reference/data-model.md`: canonical data model.
- `docs/reference/api-spec.md`: HTTP API contract.
- `docs/reference/knowledge-graph-spec.md`: graph semantics and governance.
- `docs/apps/mobile.md`: mobile app architecture and platform guidance.

If mobile behavior differs from the shared architecture, document the reason in
this file and keep the implementation scoped to `apps/mobile` or a shared
package with an explicit contract.
