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
- count distinct rated cards as Reviewed while keeping all successful forward
  actions, including skips, in the existing advertising cadence;
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
- keep the current Expo navigation and architecture documentation accurate.

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
  from the previous mode.
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
- [x] `AC-07`: The mobile architecture document names the current tabs,
  hidden routes, My Notes terminology, expression bundle, dynamic Expo config,
  and the exact intentional web-only boundary. The mobile check and both iOS
  and Android export gates pass from the same source tree.
- [x] `AC-08`: New mobile Practice reads send JSON `{ mode, cursor,
  cycleOnEmpty }` in a body capped at 2 KiB. `cursor` is null or a versioned
  opaque string of at most 1,024 characters, and the response supplies
  `nextCursor`. The server returns private no-store data, alternates public and
  owner-private lanes, traverses IDs deterministically within each lane with
  database candidate queries capped at `LIMIT 1`, and wraps at most once only
  for a non-null cursor with `cycleOnEmpty: true`. Neither client nor server
  keeps a growing card-ID array or request-global traversal state. Legacy GET
  reads reject more than 100 exclusions explicitly instead of silently
  dropping IDs.
- [x] `AC-09`: A skip remains a successful forward action for advertising
  cadence and history but does not increase the distinct Reviewed count in
  synced or guest/local Practice. A synced skip advances the frontier cursor;
  the card may reappear only after a requested wrap. Exhausting both lanes
  starts at most one reset. Previous-card recovery does not rewind the frontier.
  Review progress exposes an accessible progress value and traversal-complete
  announcement. Transient reads retry once, while permanent client errors do
  not retry.
- [x] `AC-10`: A candidate with duplicate suggestions offers a 44-point,
  localized link to its encoded detailed web-review route when the validated
  app base URL is available; a missing or unsafe base fails closed.

## Privacy and data boundaries

This change adds no persistence, schema, retention rule, public write, or new
content collection. Ratings continue through the existing owner-scoped mobile
API. Previous-card recovery keeps only the bounded in-memory card object needed
for the current screen session. The transient opaque cursor contains bounded
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
| `AC-01` | `apps/mobile/src/practice-parity.test.ts` and `apps/mobile/src/mobile-practice-api-contract.test.ts` cover authoritative Review entry, route intent, and stale-response rejection. |
| `AC-02` | `apps/mobile/src/practice-parity.test.ts` proves `reviewable` is preferred independently of `unclear`; `apps/web/src/lib/mobile-practice-contract.test.ts` proves that count reuses the selectable-card predicate. |
| `AC-03` | Focused synced-history state test and source inspection prove bounded previous-card recovery without decrementing successful advances. |
| `AC-04` | Mobile source-contract tests cover prerequisite statuses and localized `last_seen` rendering. |
| `AC-05` | `apps/mobile/src/candidate-inbox.test.ts` covers both scope values and scope-aware mobile copy. |
| `AC-06` | `apps/mobile/src/my-notes-view.test.ts` and a mobile API source-contract test cover lifecycle views, optimistic versions, tags, types, and local date boundaries. |
| `AC-07` | `pnpm check:docs`, `pnpm --filter @stem-brain/mobile check`, `pnpm --filter @stem-brain/mobile build`, `pnpm harness`, and `git diff --check`. |
| `AC-08` | `packages/shared/src/mobile-practice.test.mjs`, the focused web cursor/contract/handler/selector tests, `apps/mobile/src/mobile-practice-api-contract.test.ts`, the unauthenticated Practice POST browser smoke, and `pnpm harness:deploy` cover bounds, deterministic alternating keyset lanes, `LIMIT 1`, one-wrap behavior, legacy rejection, authentication ordering, private POST wiring, and the Cloudflare build. |
| `AC-09` | `packages/shared/src/mobile-practice.test.mjs`, `apps/mobile/src/practice-parity.test.ts`, and focused desktop Practice browser smoke distinguish ratings from skips and cover frontier advancement, cadence preservation, previous-card behavior, retry classification, progress, cycle wiring, and rendered controls. |
| `AC-10` | `apps/mobile/src/candidate-inbox.test.ts` covers encoded URL construction, unsafe-base rejection, the 44-point accessible link source contract, and `pnpm --filter @stem-brain/mobile build` exports that source into both platform bundles. |

## Rollout

The response fields, batch scope values, and owner-scoped archive lifecycle
already exist on the web. The mobile API adds a backward-compatible adapter for
that lifecycle plus an additive `stats` field on saved-card responses. The
Practice POST endpoint must deploy before a binary that calls it. Legacy
Practice GET remains available for older builds and fails explicitly only if a
caller exceeds its historical 100-ID bound. There is no migration or provider
activation. Rollback must keep the server adapter until updated binaries are no
longer in use. Static Expo export proves that both platform bundles contain the
change; interaction, accessibility, signing, and store availability still
require separate physical-device and EAS evidence.
