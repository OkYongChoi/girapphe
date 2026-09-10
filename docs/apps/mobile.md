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
  - Topic detail, the private Topics index and Topic Hub, Candidate Inbox,
    Knowledge Data Controls, Sign In, Subscription, and Admin are root-stack
    routes.
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
  controls. A stale edit reloads the owner-scoped active list and installs the
  winning server fields, version, and tags before retry. Cancel or selecting a
  different note advances the editor request identity, so a delayed reload can
  refresh the list but cannot overwrite the user's newer editor choice. Form
  mutation controls are read-only while Save is pending, but Cancel and another
  note's Edit remain available. If the stale item is absent from the refreshed
  active list, its entered fields become an unsaved new-note draft instead of
  being cleared. Create and edit reuse the owner's frequent active-note tags through
  an opt-in picker that renders at most 24 suggestions at once; selected tags
  remain removable chips, while direct, Enter, and comma-separated entry share
  the 12-tag and 48-Unicode-code-point contract with web. My Notes links to the
  private Topics index and accepts an explicitly unsaved draft copied from a
  validated public-node ID for review and editing. React Native receives
  platform-committed text through `onChangeText`/`onSubmitEditing`; unlike the
  web DOM it exposes no equivalent composition-event contract here, so CJK and
  complex-script IME timing remains a physical iOS/Android validation gate.
- Candidate Inbox: quick save-as-new or ignore for explicitly submitted
  current-conversation and selected-export candidates, with their source scope
  labeled separately. A possible duplicate links to the exact detailed web
  review when the configured app base URL is safe. A candidate with proposed
  evidence or any relationship suggestion requires that detailed review and
  cannot use mobile quick approval. Causal relationships retain their more
  specific causal-review reason; evidence and noncausal relationships use the
  provenance-review reason. A stale approve or ignore conflict reloads the
  latest batch and drafts before another attempt. Version freshness is evaluated
  before capability and detailed-review gates, so a stale request always reloads
  before the latest matching draft is routed to detailed review.
- Topics: owner-scoped summaries of active private knowledge, open questions,
  decisions, events, sources, recent sample titles, and update time.
- Topic Hub: compact approved knowledge, open questions, relations, timeline,
  and source-position views. Its mobile projection explicitly includes an
  owner-scoped source for every retained evidence selector, bounds sources and
  selectors, and omits revision and supersession history payloads. References
  and numeric ranges are normalized at the response boundary, and malformed
  legacy selectors are removed. Selector types, quality values, and position
  keys are localized; technical position rows keep left-to-right ordering
  inside Arabic UI.
- Topic detail: explanation plus prerequisite/dependent/related navigation and
  an explicit handoff to review an editable private-copy draft in My Notes.
  Signed-out users resume that handoff after authentication; route-controlled
  title and body text are never trusted as public-concept provenance.
- Ranking: anonymous participant IDs with a localized, highlighted current-user
  row; the legacy display label remains in the API only for installed-client
  compatibility and does not expose account identity.
- Sign In: Clerk Hosted Auth exposes the social and other methods enabled for
  the Clerk instance alongside the existing email flow. It returns through the
  configured app scheme using `ExpoLinking.createURL('hosted-auth-callback')`,
  then consumes the same allowlisted continuation as email sign-in and sign-up.
- Subscription: the server-owned `acquisitionBlocked` state keeps purchase
  plans unavailable while canonical confirmation is unresolved, with an
  explicit status refresh. `duplicateDetected` remains visible as an alert and
  optional support handoff instead of being discarded by the native adapter;
  asynchronous insertion is announced once per current owner and locale on
  both Android and iOS.
- Account / Knowledge Data Controls: an always-visible signed-in entry lists
  active and completed owner-scoped import jobs, their status and counts, and
  bounded previous/next pagination through the authenticated API. A confirmed
  deletion removes that job and its pending candidates while preserving
  approved knowledge and detached hashed provenance. The complete JSON export
  remains a web download reached through a fixed first-party authentication
  handoff; the mobile bearer token is never placed in a URL.

Do not create separate iOS-only or Android-only versions of these flows unless
the interaction model is genuinely platform-specific.

## Data Flow

The app keeps public graph browsing and guest practice available locally, while authenticated
notes, progress, review, ranking, private graph state, and subscriptions use the deployed API.
When one of these protected native routes requests sign-in, it passes an enumerated destination
identifier instead of a free-form path and resumes that exact route after authentication. The
dynamic Topic Hub continuation carries only its bounded topic value. The public-concept copy
continuation keeps priority because it also carries the provenance-safe draft key and source ID.
Hosted Auth uses a fixed app-scheme callback, and successful Hosted Auth, email sign-in, and
email sign-up all use that same continuation resolver. Protected content is keyed by the current
Clerk user ID so a direct switch between signed-in owners remounts private screen state instead
of displaying the previous owner's in-memory result.

Browser handoffs use a separately allowlisted web `returnTo` value for Practice, Subscription,
Account deletion, or the data-controls confirmation page; arbitrary, modified, locale-prefixed,
or duplicated values fall back to Practice. The data-controls confirmation page shows the
browser's signed-in identity, uses localized document metadata, and requires an
explicit continue before opening the localized `/account/delete#knowledge-data`
section:

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

New My Notes create and update requests use
`POST /api/mobile?resource=notes`. That qualified resource accepts only those
two actions and has a bounded 6 MiB body limit so a valid, fully populated
version-one bundle fits. Other mobile mutations, including legacy unqualified
note writes, retain the general 16 KiB limit. The client gives the 6 MiB `413`
response its own localized recovery message rather than presenting it as a
network failure.

Candidate review is intentionally split by interaction depth. Mobile supports
quick save-as-new and ignore for content-only candidates; a possible duplicate
links to the web review surface, and evidence-bearing or relationship-bearing
candidates disable quick approval. After the latest version check, the server
independently rejects them with `CAUSAL_REVIEW_REQUIRED` or
`PROVENANCE_REVIEW_REQUIRED` before empty evidence or relationship selections
could be submitted. Web owns side-by-side comparison, full editing,
merge/update, evidence selection, advanced canonical lifecycle actions, local
graph/history, native ChatGPT archive parsing, Thinking History signal
generation, and context-pack export. The full private-knowledge JSON export is
also generated by the web endpoint because its size is not bounded for a native
share-text payload; mobile uses a fixed authenticated handoff rather than
loading private export JSON into React Native memory. Basic archive, restore,
and trash organization remains available in mobile My Notes. Mobile Topics and
Topic Hub views consume the same owner-scoped canonical data. The Topic Hub
response projects only topic metadata, at most 200 compatible items, 500
sources, 500 activity entries, 500 compatible relations, and 1,000 evidence
selectors, with no more than 24 retained selector references per relation.
Cross-topic relationship evidence is returned only with its current owner's
matching source so every retained selector is inspectable. Revision and
supersession collections remain web-owned. Source-position projection accepts
only fixed, key-specific, bounded reference and numeric values and never raw
transcript text. Native rendering allowlists those same keys again. Opening a
public-concept copy passes only a bounded public-node ID and one-time key;
My Notes resolves the title and body from trusted public catalog/current-locale
content. The draft is
not private knowledge until the user explicitly submits the form. Neither app
retains raw conversation text: provenance is selector-only.

My Notes derives frequent-tag suggestions locally from the current owner's
already-loaded active-note response. The shared normalization utility is used
by web, the native editor, and the mobile server adapter; no public or global
tag-suggestion endpoint is part of the mobile contract.

The web Settings connection guide and Context Pack format are browser-local
presentation preferences, so they do not create a mobile API contract or a new
mobile navigation destination. Mobile Account exposes native import-job
controls and the secure complete-export handoff. MCP connection management and
those reusable-context defaults remain web-owned.

## Platform Rules

- Keep product behavior shared between iOS and Android by default.
- Keep static identifiers and defaults in `apps/mobile/app.json`; production
  environment validation and plugin composition live in
  `apps/mobile/app.config.ts`.
- Put platform branches behind narrow adapters, for example push notifications,
  deep links, secure storage, camera, or haptics.
- Avoid importing web-only code from `apps/web` into mobile. Shared logic should
  move into `packages/*`.

## Release Evidence Boundary

Focused source-contract tests, mobile checks, and static Expo exports prove that
the shared code and dependencies are included in both iOS and Android bundles.
They do not prove that a Clerk social provider is enabled for the production
instance, that its callback completes on a physical device, that billing or
store providers are activated, or that a signed EAS binary is linked and
available in either store. Physical-device Hosted Auth, account switching,
VoiceOver/TalkBack, billing recovery, signing, and store availability remain
separate release evidence.

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
