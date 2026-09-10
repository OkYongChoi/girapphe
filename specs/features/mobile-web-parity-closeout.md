# Mobile Web Parity Closeout

Status: Implemented

Protected release, provider activation, and physical-device evidence remain
separate rollout gates.

## User outcome

A signed-in user gets the same review intent, due-queue meaning, learning
context, basic personal-knowledge organization, and conversation-source
labeling in the shared iOS and Android app as on the web. Starting a populated
Review queue must not silently open new-card Practice, and a ChatGPT-export
batch must not be described as if it came from the current conversation.
Practice traverses a deterministic, bounded cursor without growing card-ID
arrays, skips do not inflate the visible Reviewed count, and a possible
duplicate or provenance-sensitive candidate provides an actionable handoff to detailed web
review. Mobile users can also rediscover all approved private topics, identify
their own anonymous leaderboard row, reuse their private tags, and start an
editable private-note draft from a public concept without saving it implicitly.
Authentication returns to the requested protected journey, including from Clerk
Hosted Auth; canonical billing conflicts stay visible; source positions are
reviewable in Topic Hub; and Account exposes owner-scoped import-job controls
without moving private credentials into browser URLs.

## Scope

In scope:

- carry an explicit `new` or `review` intent into mobile Practice and use the
  server-owned `reviewable` count, rather than saved-card list length, for due
  work and Review entry intent;
- carry one bounded opaque cursor through alternating deterministic public and
  owner-private keyset lanes, retry a failed read once, and let the server reset
  an exhausted traversal exactly once;
- count distinct rated cards inside the capped recent-history window as
  Reviewed, count an immediate previous-card replacement once, and keep all
  successful forward actions, including skips, in the existing advertising
  cadence;
- let a user reopen the previous synced card for re-evaluation without
  pretending to undo the already-persisted rating or successful-advance count;
- show the prerequisite state already returned by the mobile API and the last
  learning time already returned for saved cards;
- distinguish `current_conversation` and `selected_export` batches throughout
  the mobile Candidate Inbox;
- give a possible duplicate an encoded link to that exact candidate's
  owner-scoped detailed web review;
- require every candidate with proposed evidence or a relationship suggestion
  to use that same detailed review handoff instead of offering a mobile quick
  approval that could clear provenance; retain a specific causal reason for
  causal relations;
- surface the existing active, archived, and trashed personal-knowledge
  lifecycle in My Notes with optimistic-version archive/restore requests;
- match web organization basics with tag-aware search plus knowledge-type and
  local-calendar date filters;
- reuse the owner's frequent active-note tags in create and edit, with the same
  normalization, limits, removable chips, and bounded opt-in suggestions as
  the web form;
- expose the owner-scoped private Topics index, including its counts, sample
  titles, recency, and exact Topic Hub navigation;
- render Topic Hub evidence selector positions and metadata while explicitly
  omitting revision and supersession history from the bounded mobile projection;
- preserve anonymous leaderboard participant IDs and identify the signed-in
  user's row while retaining the legacy display label for installed clients;
- prefill, but never automatically persist, a reviewable My Notes draft from a
  public concept;
- resume every protected native route after authentication through an enumerated
  destination, and allow first-party mobile browser handoffs to resume web
  Subscription or knowledge-data controls without accepting an arbitrary URL;
- remount protected private content when the signed-in Clerk owner changes;
- expose Clerk Hosted Auth for methods enabled by the provider, use one fixed
  app-scheme callback, and preserve the native email continuation contract;
- keep canonical billing `acquisitionBlocked` and `duplicateDetected` state in
  the mobile view model, suppress acquisition while blocked, and offer refresh
  and duplicate-recovery guidance;
- route new note creation and update through a qualified, bounded 6 MiB
  knowledge-mutation resource while retaining the 16 KiB general mutation cap;
- add signed-in native knowledge-data controls with bounded import-job
  pagination and confirmed owner-scoped deletion;
- preserve approved knowledge and hashed provenance when an import job is
  deleted, and hand complete JSON export to a fixed first-party web route
  without putting a mobile bearer token in the URL or export JSON in native memory;
- keep the current Expo navigation and architecture documentation accurate;
- add the owner-first private-card cursor index used by the mobile server
  adapter without changing stored user data.

Out of scope:

- changing the persisted Practice rating or scheduling transaction,
  advertising cadence, the public/private graph boundary, or the existing web
  and legacy GET smart-card selection;
- native ChatGPT archive parsing, detailed candidate editing/merge, Thinking
  History signal generation, and context-pack export, which remain documented
  web-owned workflows;
- Recall Ping notification delivery or its reconstruction UI, whose feature
  specification remains Draft; and
- EAS builds, store submission, provider activation, or physical-device
  VoiceOver/TalkBack and Hosted Auth callback evidence.

## Acceptance criteria

- [x] `AC-01`: Opening Practice from a populated Review queue requests
  `review` mode based on the authoritative `reviewable` count rather than the
  number of saved cards, while a truly empty queue can recover into `new` mode.
  An explicit supported route value is consumed once; initial missing or explicit
  invalid input defaults to `new`, and absent intent thereafter preserves the
  manual mode. Failed focus or mode-transition requests never render a card
  from the previous mode. When a database is configured, saved-card or stats
  failures surface as request failures rather than fabricated mock account
  state.
- [x] `AC-02`: Mobile displays the server-owned `reviewable` count for due
  review work instead of treating every `unclear` card as immediately due.
- [x] `AC-03`: After advancing a synced Practice card, the user can reopen the
  immediately previous card and submit a replacement rating; this does not
  decrement the successful-advance counter, rewind the current frontier cursor,
  or claim that the first server mutation was rolled back. The Previous control
  remains available after the last card advances into the terminal empty state.
- [x] `AC-04`: Synced Practice renders each returned prerequisite and its
  knowledge state, while Review renders `last_seen` when the server supplies
  it; both retain accessible text alternatives.
- [x] `AC-05`: Candidate Inbox accepts both supported ingestion scopes and
  visibly distinguishes a current-conversation batch from an explicitly
  selected ChatGPT-export batch without retaining or displaying raw transcript
  history.
- [x] `AC-06`: My Notes exposes Active, Archive, and Trash as distinct views;
  archive and unarchive use the item's current version and surface stale
  conflicts; search includes tags; and type plus today/week/month/all date
  filters use local calendar boundaries without changing stored timestamps.
  Mobile tag entry recognizes ASCII, Arabic, and fullwidth commas. The API
  normalizes tags before enforcing the 12-tag and 48-Unicode-code-point bounds,
  so astral letters are not counted as two UTF-16 units. A stale edit reloads
  the active owner-scoped notes and replaces the editor, including version and
  tags, with the winning server note before the user can retry. If the user
  cancels or selects another note while that reload is pending, the newer
  editor identity wins and the delayed response cannot replace it. Editable
  controls are locked during the save request, while Cancel and selecting
  another note remain available. If the stale note is no longer active, all
  entered fields are preserved as an unsaved new-note draft instead of reset.
  Create retries keep one idempotency key with the current unsaved editor until
  confirmed success or an intentional reset. An already-committed retry cannot
  create a duplicate; newer edits remain as a separate unsaved draft after a
  replay, and a quota rejection is explicit and does not clear or consume the
  draft request.
- [x] `AC-07`: The mobile architecture document names the current tabs,
  hidden routes, My Notes terminology, expression bundle, dynamic Expo config,
  and the exact intentional web-only boundary. The mobile check and both iOS
  and Android export gates pass from the same source tree.
- [x] `AC-08`: New mobile Practice reads send JSON `{ mode, cursor,
  cycleOnEmpty }` in a body capped at 2 KiB. `cursor` is null or a versioned
  opaque string of at most 1,024 characters, and the response supplies
  `nextCursor`. The server returns private no-store data, alternates public and
  owner-private lanes, traverses IDs deterministically within each lane with
  database candidate queries capped at `LIMIT 1`; the private lane applies
  canonical eligibility before that limit, distinguishes no approved ingestion
  draft from one complete eligible conversation chain, seeks by raw item ID,
  and has a checked-in `(user_id, id)` index. It wraps at most once only for a
  non-null cursor with `cycleOnEmpty: true`. Neither client nor server keeps a
  growing card-ID array or request-global traversal state. Legacy GET reads
  reject invalid IDs and more than 100 exclusions explicitly instead of
  silently dropping IDs.
- [x] `AC-09`: A skip remains a successful forward action for advertising
  cadence and history but does not increase the Reviewed count in synced or
  guest/local Practice. Synced Practice derives a distinct-card count from its
  capped 100-action recent history, while reopening then replacing the
  immediately previous rating contributes only one. A synced skip advances the
  frontier cursor; the card may reappear only after a requested wrap. Exhausting
  both lanes starts at most one reset. Previous-card recovery does not rewind
  the frontier. Review progress counts only actual ratings in the current
  round, keeps traversal completion separate, and exposes an accessible
  progress value plus an iOS and Android traversal-complete announcement.
  Transient reads retry once, while permanent client errors do not retry. A
  missing mobile API base URL remains a distinct configuration error outside
  the network catch and therefore is never retried. If a rating mutation
  succeeds but both next-card reads fail, retrying the recovered card remains a
  replacement rating and does not inflate progress.
- [x] `AC-10`: A candidate with duplicate suggestions or a candidate requiring
  detailed causal review offers a 44-point, localized link to its encoded
  detailed web-review route when the validated app base URL is available. Its
  visible and accessibility label identifies the specific candidate title; a
  missing or unsafe base fails closed. Detailed-review candidates cannot use
  mobile save-as-new, and the server's causal-review conflict has localized
  recovery copy. A stale approve or ignore conflict reloads the latest batch
  and drafts before retry, and both server race paths return the structured
  `CANDIDATE_STALE` code. The requested draft version is checked before
  capability or causal gates, so a stale noncausal v1 request whose latest
  draft is causal v2 first reloads v2 and only that matching version requires
  detailed review.
- [x] `AC-11`: Mobile exposes an authenticated, private no-store Topics index
  over the same owner-scoped summaries as web. Each summary shows knowledge,
  open-question, decision, event, source, sample-title, and recency context and
  opens the exact private Topic Hub. My Notes has an accessible entry point.
- [x] `AC-12`: Mobile Ranking preserves the server's anonymous participant ID,
  identifies and highlights the current user with localized labels, retains the
  legacy API label for installed clients, and remains private no-store data.
- [x] `AC-13`: A public concept can prefill a bounded quick-note draft in My
  Notes. Only its one-time key and validated accessible public-node ID cross the
  route boundary; My Notes derives displayed draft content from trusted app
  catalog/current-locale public content, including after authentication. The
  user sees that the copy is unsaved, may review and edit it, and must explicitly
  use the existing Add note action; opening the draft performs no persistence.
- [x] `AC-14`: Mobile My Notes derives up to 500 frequent-tag suggestions only
  from the signed-in owner's loaded active notes, keeps the native suggestion
  panel closed until requested, renders at most 24 matches, and uses the shared
  12-tag and 48-Unicode-code-point normalization contract. Direct entry,
  comma-separated entry, removable 44-point chips, create, and edit all submit
  the same normalized values, including a valid uncommitted draft. This is a
  committed-text source contract; physical native IME composition evidence is
  tracked separately by the My Notes tag-selection specification.
- [x] `AC-15`: Every route guarded by the mobile `AuthRequired` boundary sends
  only an enumerated continuation identifier, with a separately bounded topic
  for the dynamic Topic Hub, and returns there after sign-in or sign-up. The
  provenance-sensitive public-concept copy continuation keeps priority.
  Protected content is keyed by Clerk user ID and remounts on a direct switch
  between signed-in owners. Web login and signup accept only exact first-party
  `returnTo` values for Practice, Subscription, Account deletion, and the
  data-controls confirmation handoff, localize the accepted pathname, and fall
  back to Practice for arbitrary, ambiguous, or modified values.
- [x] `AC-16`: Signed-in Account always links to a shared iOS and Android data
  controls screen. The authenticated mobile adapter returns at most 50 active or
  completed jobs per page from the current owner's batches, shows each supported
  status and count, accepts only pages 1 through 400, projects no source locator,
  request ID, source URL, or conversation reference, and marks responses private
  and no-store. Deletion requires a destructive confirmation, is owner-scoped
  and retry-safe, removes pending job state, tombstones selected-export replay,
  and preserves approved knowledge plus detached sanitized/hash provenance.
  Pagination and retry controls remain disabled during deletion, and a guarded
  deletion refresh cannot overwrite a newer explicit page intent. Complete
  export opens only a validated HTTP(S) first-party handoff; signed-in browsers
  show their current identity and require explicit confirmation before
  continuing to the localized knowledge-data anchor, while signed-out browsers
  use the fixed allowlisted `returnTo`. No bearer token appears in a URL, and all
  new UI copy exists in the six supported mobile locales with accessible states;
  the browser handoff document title and description are localized as well.
- [x] `AC-17`: Configured mobile sign-in and sign-up offer Clerk Hosted Auth
  alongside email. The Hosted Auth mode follows the visible form mode, returns
  through the configured app-scheme URL built by
  `ExpoLinking.createURL('hosted-auth-callback')` rather than an HTTP redirect,
  uses an ephemeral browser session, and invokes the common post-authentication
  continuation only after Clerk creates a session. The control is at least 44
  points and its copy exists in all six mobile locales.
- [x] `AC-18`: Mobile retains the canonical entitlement response's
  `acquisitionBlocked` and `duplicateDetected` booleans. A block never exposes
  purchase plans, uses the pending-confirmation state, and offers a canonical
  refresh; a duplicate is an accessible visible alert with support recovery
  when a safe support URL is configured. Its asynchronous arrival is announced
  once for the current owner and locale on Android and iOS, and account or
  locale changes cannot reuse a stale announcement identity. Neither state is
  inferred from store callbacks or local purchase state.
- [x] `AC-19`: Candidate batch responses set `requires_detailed_review` and a
  reason of `causal_relations` or `provenance` whenever a pending draft has
  proposed evidence or any relation. Mobile disables quick save-as-new and
  provides localized web-review recovery. The server checks version freshness
  first, then rejects causal and provenance quick approval with distinct `409`
  codes before its compatibility path can clear evidence or relationships.
- [x] `AC-20`: The mobile Topic Hub response uses an explicit projection that
  includes an owner-scoped source for every retained evidence selector plus its
  polarity, quality, origin, and confirmation metadata. The response caps items
  at 200, sources and activity at 500 each, relations at 500, selectors at
  1,000, and retained selector references per relation at 24. Native Topic Hub
  renders only fixed, key-specific, bounded source-position values and
  allowlists those keys again on-device. Malformed legacy selectors and their
  relation references are omitted. Native localizes selector types, quality
  values, and position keys in all six locales, and preserves left-to-right
  technical rows in RTL UI.
  Revision and supersession collections remain web-owned and are absent from
  the mobile response.
- [x] `AC-21`: New My Notes create and update calls use
  `POST /api/mobile?resource=notes`, which accepts only those two actions and is
  capped at 6,291,456 bytes. A maximally populated valid native expression,
  including parser-valid text that requires JSON escaping, fits below that cap;
  oversize returns the dedicated `413 MOBILE_KNOWLEDGE_REQUEST_TOO_LARGE`
  recovery. Every other mobile mutation, including the backward-compatible
  unqualified path, remains capped at 16,384 bytes.

## Privacy and data boundaries

This change adds no persisted user field, retention rule, public write, or new
content collection. Migration 0025 adds only an owner-first read index and does
not rewrite user data. Tag suggestions are derived locally from the
owner-scoped active-note response; no global tag endpoint or cross-owner
projection is added. Topic summaries, ranking, and administrative reads are
authenticated private no-store responses. Public-concept route state contains
no deep-link title or body: My Notes validates the node against accessible
public data and persists nothing until the user explicitly adds the private
note. Ratings continue through the existing owner-scoped mobile API.
Previous-card recovery keeps only a capped 100-entry in-memory history for
the current screen session. The transient opaque cursor contains bounded
traversal metadata, never an actor identity, card content, or rating list; the
server always derives the owner from authentication. The cursor is sent only to
the authenticated no-store Practice endpoint and is not persisted by this
change. No rated/skipped ID array or request-global server cursor state is
introduced. Candidate scope labels and the detailed-review handoff open only
the configured first-party web route, where authentication and owner scoping
are enforced; they do not fetch an archive or raw conversation text into the
app. Candidate quick approval is content-only: proposed evidence and every
relationship fail closed before the compatibility path could submit empty
evidence or relation arrays. Topic Hub exposes bounded selector positions only
when the matching owner-scoped source is also retained, including for
cross-topic relationship evidence, but not raw source text, revision payloads,
or supersession payloads. Signed-out users retain the existing local public
Practice fallback.
Neither native nor web authentication accepts a free-form post-authentication
redirect. Native route identifiers map to compiled-in Expo routes; the dynamic
topic is capped at 120 characters. Web accepts only exact canonical paths and
localizes them after validation, so absolute, protocol-relative, locale-prefixed,
query-modified, fragment-modified, and duplicate values cannot redirect the user.
Mobile import-job reads and mutations derive the owner only from the Clerk
session, not a request-supplied user ID. Responses omit source locators and
conversation references. The complete export remains the existing browser
attachment because its size is not bounded for native share text; mobile opens
only the fixed handoff URL and never puts its bearer credential in that URL.
The handoff then uses the web session and exact allowlisted data-controls
destination. Hosted Auth returns through the configured app scheme and carries
no mobile bearer credential. The larger qualified note body cap remains finite
and available only to authenticated create/update note actions; it does not
raise the cap for billing, data controls, candidate resolution, or other mobile
mutations.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/mobile/src/practice-parity.test.ts`, `apps/mobile/src/mobile-practice-api-contract.test.ts`, and `apps/web/src/lib/mobile-practice-contract.test.ts` cover authoritative Review entry, configured-database failure propagation, route intent, and stale-response rejection. |
| `AC-02` | `apps/mobile/src/practice-parity.test.ts` proves `reviewable` is preferred independently of `unclear`; `apps/web/src/lib/mobile-practice-contract.test.ts` proves that count reuses the selectable-card predicate. |
| `AC-03` | Focused synced-history state and source tests prove bounded previous-card recovery without decrementing successful advances, including the terminal empty state. |
| `AC-04` | Mobile source-contract tests cover prerequisite statuses and localized `last_seen` rendering. |
| `AC-05` | `apps/mobile/src/candidate-inbox.test.ts` covers both scope values and scope-aware mobile copy. |
| `AC-06` | `apps/mobile/src/my-notes-view.test.ts`, `apps/mobile/src/mobile-notes-api-contract.test.ts`, `apps/mobile/src/mobile-tag-contract.test.ts`, `apps/web/scripts/mobile-note-create-contract.test.mjs`, and shared/web normalization tests cover lifecycle views, optimistic versions, stable create retry IDs, inserted/replayed/quota outcomes, edited-replay preservation, stale-winner editor replacement including tags, delayed-reload cancellation and note-switch identity races, save-time editor locking, missing-winner draft preservation, localized separators, canonical tags, Unicode/astral bounds, types, and local date boundaries. `authenticated-mobile-api.spec.ts` exercises deployed create, replay, edit, archive, unarchive, trash, restore, version, type, and tag behavior against the exact Preview Worker and synthetic owner. |
| `AC-07` | `pnpm check:docs`, `pnpm --filter @stem-brain/mobile check`, `pnpm --filter @stem-brain/mobile build`, `pnpm harness`, and `git diff --check`. |
| `AC-08` | `packages/shared/src/mobile-practice.test.mjs`, focused web cursor/contract/handler/selector/private-card tests, the checked-in migration/schema assertions, `apps/mobile/src/mobile-practice-api-contract.test.ts`, and the unauthenticated Practice POST browser smoke cover request bounds, alternating keyset lanes, pre-limit eligibility, raw-ID seek/index wiring, one-wrap behavior, legacy rejection, authentication ordering, and private POST wiring. The protected Preview workflow then runs `mobile-practice-index-postgres.test.mjs` after migration 0025, derives a direct connection from the configured pooled or direct Neon Preview endpoint, and verifies the exact Preview branch identity before retaining sanitized `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` evidence. It verifies both exact 0025 index definitions and fails unless the owner-cursor index appears in the production-built new and review query plans. The approved-draft partial index remains definition-gated because PostgreSQL can legitimately choose a sequential scan while that table is small. `authenticated-mobile-api.spec.ts` traverses the synthetic owner's deployed private new and review lanes and persists only sanitized no-store/read and closeout evidence. |
| `AC-09` | `packages/shared/src/mobile-practice.test.mjs`, `apps/mobile/src/mobile-api-errors.test.ts`, and executable mixed rating/skip/retry tests in `apps/mobile/src/practice-parity.test.ts` cover bounded history, frontier advancement, cadence preservation, configuration-versus-network retry classification, replacement identity, progress, cycle wiring, terminal Previous, iOS announcement wiring, and rendered controls. |
| `AC-10` | `apps/web/src/lib/mobile-knowledge-capabilities.test.ts` and `apps/mobile/src/candidate-inbox.test.ts` behavior tests cover version-first preflight, stale noncausal v1 to causal v2 convergence, causal mutation blocking, fresh-version reload, structured ignore-race codes, encoded URL construction, unsafe-base rejection, detailed-review routing, localized labels, and the 44-point accessible link contract. `authenticated-mobile-api.spec.ts` additionally proves deployed approve and ignore success plus both exact stale-version 409 paths and exact database cleanup. |
| `AC-11` | `apps/mobile/src/mobile-web-parity-regressions.test.ts` covers the private Topics API, registered route, My Notes entry, accessible list links, and exact Topic Hub navigation. `authenticated-mobile-api.spec.ts` proves the exact synthetic private note appears through both deployed private no-store endpoints. |
| `AC-12` | `apps/mobile/src/mobile-web-parity-regressions.test.ts` covers participant identity, legacy compatibility, current-user labeling/highlighting, localized rendering, and private response wiring. `authenticated-mobile-api.spec.ts` validates every deployed row's anonymous label, participant ID, current-user boolean, private no-store policy, and absence of email-shaped output. |
| `AC-13` | `apps/mobile/src/mobile-web-parity-regressions.test.ts` covers signed-out continuation, public-node validation, rejection of injected or mismatched route content, trusted current-locale overlays, one-time draft consumption, explicit unsaved copy, and the absence of a direct create-note mutation. |
| `AC-14` | `packages/shared/src/knowledge-tags.test.mjs`, `apps/mobile/src/mobile-knowledge-tags.test.ts`, and `apps/mobile/src/mobile-notes-api-contract.test.ts` cover shared Unicode normalization, frequency ranking, direct and separator entry, chip removal, a closed and 24-result-bounded suggestion panel, uncommitted-draft submission, 44-point controls, picker reset wiring, and strict server parsing for create and edit. |
| `AC-15` | `apps/mobile/src/auth-continuation.test.ts` covers every guarded native destination, bounded Topic Hub value, malformed route rejection, public-copy priority, and Clerk-owner keyed remount. `apps/web/src/lib/auth-return-to.test.ts` covers the exact web allowlist, ambiguous value rejection, localization after validation, and Clerk redirect wiring. |
| `AC-16` | `apps/mobile/src/knowledge-data-controls.test.ts` covers the fixed handoff, unsafe-base rejection, Account route, authenticated native screen, bounded owner projection, status/counts, private response headers, destructive confirmation, deletion-time pagination guard, retry-safe API wiring, approved-knowledge notice, and absence of URL credentials. `apps/web/src/lib/knowledge-ingestion.test.ts` exercises owner isolation, preservation, removal, and idempotent retry in memory; `apps/web/src/i18n/messages.test.ts` covers localized handoff content and metadata. |
| `AC-17` | `apps/mobile/src/mobile-hosted-auth.test.ts` covers the Hosted Auth hook, mode mapping, fixed non-HTTP callback, shared continuation, 52-point control, runtime dependencies, and all six locale keys. Static source and export checks do not substitute for a provider-enabled physical-device callback. |
| `AC-18` | `apps/mobile/src/subscription-account-switch.test.ts` covers retention of canonical booleans, visible duplicate alert, Android live-region wiring, iOS announcement transitions, blocked confirmation state, refresh action, and account-bound billing session behavior. Provider webhook, store recovery, physical-device announcement, and purchase evidence remain gates. |
| `AC-19` | `apps/web/src/lib/mobile-knowledge-capabilities.test.ts` covers version-first preflight, causal priority, proposed evidence, and noncausal relations. `apps/mobile/src/candidate-inbox.test.ts` covers DTO projection, localized recovery, disabled quick approval, both `409` codes, and guard ordering before empty evidence/relation submission. |
| `AC-20` | `apps/web/src/lib/topic-knowledge-hub.test.ts` proves owner-scoped cross-topic source retrieval in memory and statically asserts bounded, owner-scoped PostgreSQL query wiring. `apps/web/src/lib/mobile-topic-hub.test.ts` proves explicit response keys, source/selector consistency, response caps, key-specific reference/range normalization, invalid-selector relation pruning, raw-field omission, and omission of revisions/supersessions. `apps/mobile/src/knowledge-topic.test.ts` covers fixed DTOs, defensive source-position validation, six-locale key parity, Japanese/Arabic labels, and RTL technical-row isolation. |
| `AC-21` | `packages/shared/src/mobile-knowledge.test.mjs` builds a maximally populated JSON-escaped native expression payload and proves it fits below 6 MiB. `apps/mobile/src/mobile-notes-api-contract.test.ts` covers qualified create/update, action restriction, separate caps/codes, and localized oversize recovery. |

## Rollout

The mobile API changes are backward-compatible server adapters. Deploy the
Practice POST, qualified note mutation, candidate projection and guards,
explicit Topic Hub projection, and data-controls routes before distributing a
binary that calls them, and keep them available while any such installed binary
is in use. Legacy Practice GET and unqualified note mutations remain bounded
for older builds. The legacy ranking `label` remains while updated clients use
`participantId` and `isCurrentUser`. The fixed export handoff reuses the web
export and Clerk session and never carries a native bearer token.
Migration 0025 adds the private Practice `(user_id, id)` cursor and
approved-draft lookup indexes and must run through the protected main Drizzle
step before the production Worker is activated. The protected Preview job
derives a direct connection from its configured pooled or direct Neon URL,
checks the resolved branch identity, and retains sanitized live `EXPLAIN`
evidence before deployment. It is
additive and safe to retain during rollback. No provider activation is needed.
The protected authenticated Preview suite runs the mobile API journey only in
the Pixel 7 project with the dedicated testing-token synthetic owner, requires
exact cleanup, and adds only sanitized counts and pass/fail fields to the
existing evidence summary. `authenticated-mobile-api-source.test.mjs` keeps
that project, authentication, privacy, and cleanup boundary executable.
Rollback must keep the server adapter until updated binaries are no longer in
use. Static Expo export proves that both platform bundles contain the change;
interaction, accessibility, signing, and store availability still require
separate physical-device and EAS evidence. Native IME composition behavior is
also a physical-device gate and is not proven by browser composition tests or
Expo source/export checks.
Clerk provider activation and a physical-device Hosted Auth callback remain
external gates. Surfacing billing conflicts does not activate Superwall, Apple,
or Google acquisition; keep acquisition disabled until signed webhook,
payment/recovery, account-switch, and physical-device cross-platform evidence
is retained. Protected PR, remote CI, exact deployed SHA, and production
rendered smoke are separate from these local/static checks.
