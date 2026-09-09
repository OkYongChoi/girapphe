# Mobile Web Parity Closeout

Status: Implemented

## User outcome

A signed-in user gets the same review intent, due-queue meaning, learning
context, basic personal-knowledge organization, and conversation-source
labeling in the shared iOS and Android app as on the web. Starting a populated
Review queue must not silently open new-card Practice, and a ChatGPT-export
batch must not be described as if it came from the current conversation.

## Scope

In scope:

- carry an explicit `new` or `review` intent into mobile Practice and use the
  server-owned `reviewable` count for due work;
- let a user reopen the previous synced card for re-evaluation without
  pretending to undo the already-persisted rating or successful-advance count;
- show the prerequisite state already returned by the mobile API and the last
  learning time already returned for saved cards;
- distinguish `current_conversation` and `selected_export` batches throughout
  the mobile Candidate Inbox;
- surface the existing active, archived, and trashed personal-knowledge
  lifecycle in My Notes with optimistic-version archive/restore requests;
- match web organization basics with tag-aware search plus knowledge-type and
  local-calendar date filters; and
- keep the current Expo navigation and architecture documentation accurate.

Out of scope:

- changing the Practice scheduler, persisted rating transaction, advertising
  cadence, or public/private graph boundary;
- native ChatGPT archive parsing, detailed candidate editing/merge, Thinking
  History signal generation, and context-pack export, which remain documented
  web-owned workflows;
- Recall Ping notification delivery or its reconstruction UI, whose feature
  specification remains Draft; and
- EAS builds, store submission, provider activation, or physical-device
  VoiceOver/TalkBack evidence.

## Acceptance criteria

- [x] `AC-01`: Opening Practice from a populated Review queue requests
  `review` mode, while a truly empty queue can recover into `new` mode. An
  explicit supported route value is consumed once; initial missing or explicit
  invalid input defaults to `new`, and absent intent thereafter preserves the
  manual mode. Failed focus or mode-transition requests never render a card
  from the previous mode.
- [x] `AC-02`: Mobile displays the server-owned `reviewable` count for due
  review work instead of treating every `unclear` card as immediately due.
- [x] `AC-03`: After advancing a synced Practice card, the user can reopen the
  immediately previous card and submit a replacement rating; this does not
  decrement the successful-advance counter or claim that the first server
  mutation was rolled back.
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

## Privacy and data boundaries

This change adds no persistence, schema, retention rule, public write, or new
content collection. Ratings continue through the existing owner-scoped mobile
API. Previous-card recovery keeps only the bounded in-memory card object needed
for the current screen session. Candidate scope labels describe server-owned
metadata; they do not fetch an archive or raw conversation text. Signed-out
users retain the existing local public Practice fallback.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | Focused mobile Practice navigation/state tests plus mobile typecheck. |
| `AC-02` | Focused review-count test proves `reviewable` is preferred independently of `unclear`. |
| `AC-03` | Focused synced-history state test and source inspection prove bounded previous-card recovery without decrementing successful advances. |
| `AC-04` | Mobile source-contract tests cover prerequisite statuses and localized `last_seen` rendering. |
| `AC-05` | `apps/mobile/src/candidate-inbox.test.ts` covers both scope values and scope-aware mobile copy. |
| `AC-06` | `apps/mobile/src/my-notes-view.test.ts` and a mobile API source-contract test cover lifecycle views, optimistic versions, tags, types, and local date boundaries. |
| `AC-07` | `pnpm check:docs`, `pnpm --filter @stem-brain/mobile check`, `pnpm --filter @stem-brain/mobile build`, `pnpm harness`, and `git diff --check`. |

## Rollout

The response fields, batch scope values, and owner-scoped archive lifecycle
already exist on the web. The mobile API adds a backward-compatible adapter for
that lifecycle; there is no migration or provider activation. Older app builds
keep their existing behavior. Rollback is a code rollback. Static Expo export
proves that both platform bundles contain the change; interaction,
accessibility, signing, and store availability still require separate
physical-device and EAS evidence.
