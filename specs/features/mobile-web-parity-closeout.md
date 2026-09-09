# Mobile Web Parity Closeout

Status: Implemented

## User outcome

A signed-in user gets the same review intent, due-queue meaning, learning
context, basic personal-knowledge organization, and conversation-source
labeling in the shared iOS and Android app as on the web. Starting a populated
Review queue must not silently open new-card Practice, and a ChatGPT-export
batch must not be described as if it came from the current conversation.
Practice traverses a deterministic, bounded cursor without growing card-ID
arrays, skips do not inflate the visible Reviewed count, and a possible
duplicate provides an actionable handoff to detailed web review.

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
- surface the existing active, archived, and trashed personal-knowledge
  lifecycle in My Notes with optimistic-version archive/restore requests;
- match web organization basics with tag-aware search plus knowledge-type and
  local-calendar date filters; and
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
  VoiceOver/TalkBack evidence.

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
  or claim that the first server mutation was rolled back.
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
  so astral letters are not counted as two UTF-16 units.
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
  the network catch and therefore is never retried.
- [x] `AC-10`: A candidate with duplicate suggestions offers a 44-point,
  localized link to its encoded detailed web-review route when the validated
  app base URL is available. Its visible and accessibility label identifies the
  specific candidate title; a missing or unsafe base fails closed.

## Privacy and data boundaries

This change adds no persisted user field, retention rule, public write, or new
content collection. Migration 0025 adds only an owner-first read index and does
not rewrite user data. Ratings continue through the existing owner-scoped mobile
API. Previous-card recovery keeps only a capped 100-entry in-memory history for
the current screen session. The transient opaque cursor contains bounded
traversal metadata, never an actor identity, card content, or rating list; the
server always derives the owner from authentication. The cursor is sent only to
the authenticated no-store Practice endpoint and is not persisted by this
change. No rated/skipped ID array or request-global server cursor state is
introduced. Candidate scope labels and the detailed-review handoff open only
the configured first-party web route, where authentication and owner scoping
are enforced; they do not fetch an archive or raw conversation text into the
app. Signed-out users retain the existing local public Practice fallback.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/mobile/src/practice-parity.test.ts`, `apps/mobile/src/mobile-practice-api-contract.test.ts`, and `apps/web/src/lib/mobile-practice-contract.test.ts` cover authoritative Review entry, configured-database failure propagation, route intent, and stale-response rejection. |
| `AC-02` | `apps/mobile/src/practice-parity.test.ts` proves `reviewable` is preferred independently of `unclear`; `apps/web/src/lib/mobile-practice-contract.test.ts` proves that count reuses the selectable-card predicate. |
| `AC-03` | Focused synced-history state test and source inspection prove bounded previous-card recovery without decrementing successful advances. |
| `AC-04` | Mobile source-contract tests cover prerequisite statuses and localized `last_seen` rendering. |
| `AC-05` | `apps/mobile/src/candidate-inbox.test.ts` covers both scope values and scope-aware mobile copy. |
| `AC-06` | `apps/mobile/src/my-notes-view.test.ts`, `apps/mobile/src/mobile-tag-contract.test.ts`, `packages/shared/src/knowledge-tags.test.mjs`, and the web normalization tests cover lifecycle views, optimistic versions, localized separators, canonical tags, Unicode/astral bounds, types, and local date boundaries. |
| `AC-07` | `pnpm check:docs`, `pnpm --filter @stem-brain/mobile check`, `pnpm --filter @stem-brain/mobile build`, `pnpm harness`, and `git diff --check`. |
| `AC-08` | `packages/shared/src/mobile-practice.test.mjs`, focused web cursor/contract/handler/selector/private-card tests, the checked-in migration/schema assertions, `apps/mobile/src/mobile-practice-api-contract.test.ts`, and the unauthenticated Practice POST browser smoke cover request bounds, alternating keyset lanes, pre-limit eligibility, raw-ID seek/index wiring, one-wrap behavior, legacy rejection, authentication ordering, and private POST wiring. `pnpm harness:deploy` covers the Cloudflare build and size, not live Postgres execution; Preview migration and `EXPLAIN` evidence remains a release-time gate. |
| `AC-09` | `packages/shared/src/mobile-practice.test.mjs`, `apps/mobile/src/mobile-api-errors.test.ts`, executable mixed rating/skip round tests in `apps/mobile/src/practice-parity.test.ts`, and focused desktop Practice browser smoke cover bounded history, frontier advancement, cadence preservation, configuration-versus-network retry classification, progress, cycle wiring, iOS announcement wiring, and rendered controls. |
| `AC-10` | `apps/mobile/src/candidate-inbox.test.ts` covers encoded URL construction, unsafe-base rejection, candidate-specific localized labels, the 44-point accessible link source contract, and `pnpm --filter @stem-brain/mobile build` exports that source into both platform bundles. |

## Rollout

The response fields, batch scope values, and owner-scoped archive lifecycle
already exist on the web. The mobile API adds a backward-compatible adapter for
that lifecycle plus an additive `stats` field on saved-card responses. The
Practice POST endpoint must deploy before a binary that calls it. Legacy
Practice GET remains available for older builds and fails explicitly for an
invalid exclusion ID or when a caller exceeds its historical 100-ID bound.
Migration 0025 adds the private Practice `(user_id, id)` cursor and
approved-draft lookup indexes and must run through the protected main Drizzle
step before the production Worker is activated; test it on an isolated Neon
branch with a direct connection and retain live `EXPLAIN` evidence. It is
additive and safe to retain during rollback. No provider activation is needed.
Rollback must keep the server adapter until updated binaries are no longer in
use. Static Expo export proves that both platform bundles contain the change;
interaction, accessibility, signing, and store availability still require
separate physical-device and EAS evidence.
