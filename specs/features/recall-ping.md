# Recall Ping

Status: Draft

## User outcome

A signed-in user can return to knowledge they explicitly selected and approved
from an AI conversation, reconstruct it before seeing the answer, record their
confidence, compare their attempt with the approved source-backed version, and
see when it will return. A generic mobile notification may start the flow
without exposing the topic, provider, question, or answer on the lock screen.

The selected mobile direction and screen-level behavior are documented in the
[Recall Ping wireflow](../../docs/reference/recall-ping-wireflow.md). The first
validation run is defined in the
[seven-day pilot](../../docs/operations/recall-ping-pilot.md).

### Implemented partial runtime: Manual Recall Review R1

R1 deliberately exposes the already-migrated schedule and attempt lifecycle as
an authenticated, manual web review. It does not activate notification consent,
device registration, delivery jobs, automatic approval enrollment, memory cues,
research collection, or mobile delivery. Production defaults to enrollment
off; turning enrollment off later does not strand an already-enrolled user, who
can still finish or cancel the existing owner-scoped lifecycle.

| R1 criterion | Executable contract |
| --- | --- |
| `R1-01` | Only an explicitly selected eligible item can be enrolled. The server re-checks ownership, current revision, active lifecycle, approved current-conversation provenance, and supported type. One owner may have at most 100 active schedules; enrollment serializes the owner-scoped capacity check and returns a stable capacity result without stranding existing schedules. |
| `R1-02` | The manual route starts or resumes a due D+1/D+7 attempt; rollout controls new enrollment only. |
| `R1-03` | On route/start, stale unresolved D+1 moves to D+7 at 168 hours and unresolved D+1/D+7 moves to ordinary Practice at 192 hours through schedule CAS. |
| `R1-04` | Before reveal, the SQL projection, Server Action result, and DOM omit approved structured content, detailed provenance, source URL, selectors, and next interval. |
| `R1-05` | Free-recall text remains component-local, has no form field name, and is absent from every Server Action request. Confidence is required before reveal. |
| `R1-06` | Reveal re-checks owner, item revision, schedule generation, enrollment anchor, due window, lifecycle, and provenance before returning the current approved bundle and safe source details. |
| `R1-07` | Completion accepts only self-assessed outcome, forces `hintUsed=false`, and derives the next due instant on the server. Cancellation uses item-version, schedule-version, and enrollment-anchor CAS and invalidates a matching active attempt in the same transaction. |
| `R1-08` | The route and Practice entry point are localized in all six supported locales, retain logical-direction layout, and give interactive controls a 44px minimum target. |

The complete `AC-01` through `AC-14` contract remains the product target. R1 is
not evidence that the deferred notification, type-native spatial interaction,
memory-cue, mobile, research-consent, or physical-device requirements are done.

## Scope

In scope:

- authenticated, active, owner-scoped `concept`, `procedure`, and `comparison`
  bundles that were explicitly approved from a current-conversation ingestion
  batch and still have selector-only conversation provenance;
- an explicit in-product opt-in followed by the operating-system notification
  permission, one user-selected local delivery time, timezone handling,
  one-hour snooze, and notification disable controls;
- a generic notification that opens an authenticated Recall Ping route and
  fetches the current due item only after the app is open;
- the sequence `reconstruct -> confidence -> reveal -> self-assess -> correct ->
  reschedule`, with one focused activity at a time;
- type-native reconstruction for the first three bundle types, with a text and
  assistive-technology alternative to every spatial interaction;
- D+1 and D+7 milestones anchored to Recall Ping enrollment time (the approval
  time when the feature is already enabled), with at most one automatic reminder
  per user-local calendar day and a retry path for partial, missed, snoozed, or
  unopened sessions;
- the same authoritative owner-scoped due state for Recall Ping and the existing
  Practice queue, plus an append-only attempt record that stores outcome
  metadata but not the user's recalled answer; and
- a pre-reveal source summary limited to provider, discussion date, and approval
  status after authentication, followed by selector count, optional sanitized
  source link, item version, edit-since-source status, and independent-
  verification status on the correction screen.

Type-native activities:

| Type | D+1 reconstruction | Source-backed correction | D+7 application prompt |
| --- | --- | --- | --- |
| `concept` | Rebuild a definition, key points, example, and misconception outline from the central question. | Reveal the approved fields and highlight fields the user marks as remembered, partial, or missed. | Give a new example or correct a plausible misconception in the user's own words. |
| `procedure` | Put approved step titles in order; recall branches, failure responses, and completion conditions. | Reveal the canonical order as a directional flow and show omitted branches or failure handling. | Explain how the procedure changes under one user-chosen condition. |
| `comparison` | Restore one comparison criterion across the approved targets before revealing the matrix. | Reveal the approved matrix, commonalities, differences, and choice guide. | Choose a target for a new user-supplied situation and explain the criterion used. |

The application prompt asks the user to generate or apply knowledge; it does
not generate a new factual answer or grade semantic correctness in version one.
If a bundle lacks the fields required for its native activity, the flow falls
back to the central question and an unstructured private recall area rather
than inventing missing content.

Milestone state machine:

| State | Transition | Authoritative scheduling result |
| --- | --- | --- |
| Not enrolled | An eligible item is approved while Recall Ping is enabled, or the user explicitly enrolls an older eligible item. | Set `d1_pending`; choose the first selected local delivery time at or after 24 and before 48 elapsed hours after enrollment. |
| `d1_pending` or `d1_retry` | Remembered at or after 24 and before 168 elapsed hours. | Map to `known/review`, retain the D+7 anchor, and set the single `due_at` to the first selected local time at or after 168 and before 192 elapsed hours. |
| `d1_pending` or `d1_retry` | Partial, missed, snoozed, or unopened at or after 24 and before 168 elapsed hours. | Map an assessed partial/missed result to `saved/learning`; keep unassessed delivery state unchanged; set the single `due_at` to the next allowed local time before 168 hours. |
| Any unresolved D+1 state | The 168-hour D+7 window opens. | Finalize D+1 as incomplete when necessary, activate `d7_pending`, and give D+7 precedence over every D+1 retry without creating another due timestamp. |
| `d7_pending` | Remembered at or after 168 and before 192 elapsed hours. | Map to `known/review` and set the shared Practice `due_at` to 14 days after completion. |
| `d7_pending` | Partial or missed at or after 168 and before 192 elapsed hours. | Map to `saved/learning`, record the terminal assessed outcome, and set the shared Practice `due_at` to the 192-hour close so it becomes available after the pilot without reporting D+7 success. |
| `d7_pending` | Still unopened, or a snooze reaches the 192-hour close. | Record terminal `unassessed`, preserve the existing coarse Practice projection, and set the shared Practice `due_at` to the 192-hour close without reporting D+7 success. |

The current private Practice query must be extended so a due `known/review`
item can return at D+7 and later intervals. Attempt history distinguishes
partial from missed; the existing private Practice status remains the coarse
`known` or `saved` projection.

Out of scope:

- automatic conversation-history capture, archive import, background scraping,
  raw transcript retention, or automatic approval;
- pending, ignored, archived, deleted, superseded, foreign-owned, legacy
  untyped, or manually created knowledge in the Recall Ping pilot;
- lock-screen topic previews, provider names, questions, answers, source URLs,
  or user-configurable private notification text;
- automatic fact verification, LLM grading, generated model answers, or
  presenting conversation provenance as independent verification;
- streaks, leaderboards, points, punitive overdue counts, or notification-volume
  goals;
- email, SMS, browser push, team assignments, or public-graph changes;
- the remaining seven bundle types, adaptive scheduling beyond the initial
  milestones, and claims of learning efficacy; and
- storing the free-recall response, reconstructed ordering, or application
  response as analytics or canonical knowledge.

## Acceptance criteria

- [ ] `AC-01`: Eligibility requires the current actor to own an active,
  non-superseded version-one `concept`, `procedure`, or `comparison` bundle with
  an approved current-conversation draft, a `partial` or `approved` conversation
  batch, and owner-matched selector-only provenance. Recall-specific eligibility
  remains narrower than the existing Practice predicate. All excluded lifecycle
  and ownership states return no private content and create no notification work.
- [ ] `AC-02`: Recall Ping remains disabled until Girapphe records explicit
  consent and the operating system grants notification permission. The user can
  preview the generic copy, choose a local time, snooze one delivery once for
  one hour, disable notifications, and revoke a device without changing or
  deleting knowledge. A repeated snooze request is idempotent, and a snooze that
  reaches the D+7 boundary is cancelled in favor of the D+7 milestone.
- [ ] `AC-03`: The notification title, body, and transport payload contain no
  knowledge title, topic, question, answer, provider, source locator, source
  URL, knowledge-item ID, or user-entered text. A tap opens a generic Recall
  route; authentication and an owner-scoped server read are required before any
  private content appears.
- [ ] `AC-04`: Before reveal, the user sees the current central question, type
  marker, a non-answer source summary limited to provider, discussion date, and
  approval status, type-native reconstruction controls, an `I don't know` path,
  and a required low/medium/high confidence choice. The approved answer,
  correctness hints, selectors, source link, verification status, and next
  interval remain hidden.
- [ ] `AC-05`: Procedure ordering, concept reconstruction, and comparison
  reconstruction derive only from the current approved structured bundle.
  Reordering has keyboard, screen-reader, and explicit move-control alternatives;
  meaning is never communicated by color, position, or drag gestures alone.
- [ ] `AC-06`: After reveal, the correction screen compares the attempt with the
  current approved bundle, labels remembered/partial/missed without a score, and
  exposes provider, discussion date, selector count, optional sanitized source
  link, and independent-verification status without raw transcript text.
  Provenance is bound to the revision it actually supports: a later owner edit
  is labeled `Edited after this conversation`, and historical conversation
  provenance is never presented as support for the changed current version.
- [ ] `AC-07`: Free-recall text, reconstructed order, and application responses
  remain ephemeral and are cleared when the session ends. The user may
  explicitly save a separate short memory cue after reveal; that cue is
  owner-scoped, editable, excluded from canonical knowledge and provenance, and
  never exposed to the public graph or notification payload.
- [ ] `AC-08`: An eligible approval made while Recall Ping is enabled, or an
  explicit enrollment of an older eligible item, creates the state-machine
  transitions documented above. D+1 begins no earlier than 24 elapsed hours,
  D+7 takes precedence at 168 elapsed hours, and every outcome maps atomically
  to the coarse Practice state, current milestone, attempt record, and one
  resulting `due_at`.
- [ ] `AC-09`: Recall Ping and Practice read and update one authoritative
  owner-scoped `due_at`; a second scheduling column or independent queue is not
  permitted. The Practice due query includes eligible due `known/review` and
  `saved/learning` states. Delivery, open, reveal, and completion operations are
  idempotent. A transaction permits only one active attempt for an owner, item
  version, and milestone across devices, and the milestone transition is unique
  even though a later scheduled retry may create a new attempt. At most one
  automatic notification is attempted per user-local calendar day. One explicit
  one-hour snooze may create one additional attempt on that local day; it never
  chains into another snooze or crosses a milestone boundary.
- [ ] `AC-10`: Attempt persistence is limited to owner, item and item version,
  milestone, exercise type, confidence, self-assessed outcome, hint use,
  coarse response duration, timestamps, and the resulting due time. Analytics,
  logs, error reports, and notification providers receive no private knowledge
  content or source locator.
- [ ] `AC-11`: A prepared session whose item was revised, archived, deleted,
  superseded, moved to another lifecycle state, or loses its qualifying
  current-conversation provenance through batch discard or import deletion is
  invalidated before reveal.
  The app fetches the latest eligible version or shows a generic unavailable
  state; it never reveals a stale answer. Disabling notifications, signing out,
  revoking a device, or deleting the account cancels future delivery work.
  Removing an enrolled private item from Practice cancels that item's milestone
  and pending delivery before removing its state. Resetting all card progress
  does the same for every enrolled item and deletes product attempt history,
  while both actions preserve approved knowledge and the global notification
  preference and do not silently re-enroll old items.
- [ ] `AC-12`: Mobile owns notification permission and delivery behind a narrow
  platform adapter, while the scheduling and attempt contracts remain
  dependency-light and shared. Android and iOS use the same visible journey and
  due state; provider/device-specific delivery limitations are reported rather
  than silently treated as success.
- [ ] `AC-13`: Every new preference, device-token, delivery, attempt, milestone,
  and memory-cue record participates in the account-deletion fence and explicit
  purge transaction. Device tokens and preferences live only while enabled;
  delivery records expire after 30 days, attempt records become purge-eligible
  after 365 days or are deleted by an earlier all-progress reset, and memory
  cues expire when the user deletes the cue, knowledge item, or account. The
  daily purge may physically remove an expired attempt on its next run, up to
  roughly one day later, without extending `retention_expires_at`. Queued
  external delivery identifiers are invalidated before database deletion.
- [ ] `AC-14`: The seven-day pilot requires research consent separate from
  Recall Ping notification consent and OS permission. Before enrollment, the
  participant sees the purpose, exact content-free fields, first-party storage
  and export sinks, retention, withdrawal path, and contact. Withdrawal stops
  pilot collection and deletes participant-linked research events and exports
  within seven days; account deletion also purges the underlying product records
  under `AC-13`. Declining or withdrawing never deletes approved knowledge.

## Privacy and data boundaries

Recall Ping begins only after the existing selection, pending review,
edit/resolve, and explicit approval boundary. It cannot ingest a conversation,
approve a draft, modify provenance, publish knowledge, create a graph edge, or
change another user's state.

The notification is deliberately content-free. A transport provider may receive
an opaque, short-lived delivery identifier and a generic route discriminator,
but it receives no knowledge or source identifier. Device tokens are secrets:
they must be encrypted at rest, masked in logs, scoped to the owning account and
device, and removed on revocation, sign-out, invalid-token response, or account
deletion.

The unsubmitted recall workspace is transient. Only the user's explicit
post-reveal memory cue may persist, separately from canonical knowledge. A cue
does not become evidence, a source excerpt, a search/graph projection, or a fact
verification signal. Conversation provenance and independent verification stay
separate so repeatedly reviewing an inaccurate AI response is not presented as
fact checking.

Conversation provenance is revision-scoped. When the current item was edited
after its sourced revision, the correction screen distinguishes the current
owner-edited content from its historical conversation origin. It may show the
old source as history, but it cannot label changed current content as provider-
backed or independently verified.

Authentication, network, stale-version, and delivery failures show generic
recovery states. No fallback may reveal cached private content on a lock screen,
in a notification log, or to a different signed-in account.

## Verification

Manual R1 evidence:

| R1 criterion | Evidence |
| --- | --- |
| `R1-01` | `recall-action-input.test.ts` rejects caller identity and extra fields; `recall-persistence.test.ts` proves exact owner/version eligibility, content-free enrollment, ordered owner-capacity/item locking, the same 100-active-schedule predicate used by the bounded route, and a stable content-free capacity result. |
| `R1-02` | `recall-actions.ts` exposes authenticated start/resume while `recall-runtime.test.ts` proves only new enrollment is rollout-gated. |
| `R1-03` | `recall-runtime.test.ts`, `recall-persistence.test.ts`, and `packages/shared/src/recall-schedule.test.mjs` cover the 168/192-hour rollover decisions and full-snapshot CAS. |
| `R1-04` | `recall-runtime.test.ts` inspects the pre-reveal SQL projection and serialized result for approved-answer, source-detail, selector, URL, and next-interval absence. `authenticated-recall.spec.ts` asserts the synthetic approved definition is absent from rendered HTML before reveal and visible afterward on desktop and mobile. |
| `R1-05` | `recall-action-input.test.ts` rejects recalled text and `recall-runtime.test.ts` proves the unnamed local textarea value is absent from all action invocations. `authenticated-recall.spec.ts` enters a unique browser-local sentence and proves it is absent from the start, confidence, reveal, and completion request bodies. |
| `R1-06` | `recall-attempts.test.ts` and `recall-runtime.test.ts` cover reveal authorization, stale invalidation, exact current provenance, sanitized URL, and content release only after reveal. |
| `R1-07` | `recall-attempts.test.ts`, `recall-persistence.test.ts`, and `recall-runtime.test.ts` cover server-owned due computation, forced no-hint completion, generation CAS, and transactional attempt invalidation on cancellation. The authenticated Preview spec re-reads the exact owner/item row and requires one completed, high-confidence, remembered, no-hint attempt whose resulting due instant matches the D+7 schedule. |
| `R1-08` | `messages.test.ts` checks all six catalogs; `recall-runtime.test.ts` checks logical-direction classes and 44px controls. `authenticated-recall.spec.ts` is the desktop/mobile rendered Preview gate: it reads safe rollout attributes from the deployed route, requires exact single-owner `allowlist` mode with a distinct candidate denied, asserts measured 44px control bounds plus Arabic RTL direction/containment, and records zero browser errors, action timing/size metrics, and three screenshots per device. The versioned result loader accepts exactly one desktop and one mobile artifact with exact top-level and nested fields, and only after deterministic fixture cleanup reports zero remaining rows. |

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/src/lib/recall-persistence.test.ts` exercises a separate owner-scoped predicate for current-version typed items, approved current-conversation drafts/batches, matching conversation provenance, lifecycle exclusions, and content-free results. Manual R1 wires explicit per-item enrollment through the same predicate; automatic approval enrollment remains planned. |
| `AC-02` | Planned mobile settings tests cover consent-before-OS-permission, timezone selection, preview, snooze, disable, and device revocation; real-device permission denial and recovery remain rollout evidence. |
| `AC-03` | Notification payload and deep-link coverage remain planned. Manual R1 has no delivery payload and requires authentication before its owner-scoped route read. |
| `AC-04` | `recall-runtime.test.ts` proves the pre-reveal SQL projection and response omit approved content, detailed provenance, source URL, selectors, and next interval. It also verifies the client sends no recall text and includes the `I don't know` path. Authenticated rendered-browser evidence remains a release gate. |
| `AC-05` | Planned shared activity-builder tests cover all three bundle types and missing-field fallback; mobile accessibility tests plus VoiceOver/TalkBack inspection cover non-drag ordering and non-color meaning. |
| `AC-06` | Migration `0022_recall_ping_persistence.sql` and ingestion tests bind every newly created conversation source to its exact immutable item revision while leaving historical sources null. Manual R1 reveals only an exact current-revision source, selector count, sanitized link, and `not recorded` independent-verification label. Edited-after-source history remains planned. |
| `AC-07` | `recall-action-input.test.ts` and `recall-runtime.test.ts` prove Manual R1 free-response text has no action field and never enters its requests; the component clears that local state at session boundaries. Optional persisted memory cues and their lifecycle tests remain planned. |
| `AC-08` | `packages/shared/src/recall-schedule.test.mjs` proves the 24/48/168/192-hour boundaries and transition decisions. `apps/web/src/lib/recall-persistence.test.ts`, `recall-attempts.test.ts`, `recall-runtime.test.ts`, and `apps/web/scripts/recall-persistence-postgres.test.mjs` cover schedule persistence, the owner-serialized 100-active-schedule enrollment cap, manual stale-window reconciliation, and atomic completion. R1 adds explicit older-item enrollment only; approval-time auto-enrollment remains deferred. |
| `AC-09` | The shared schedule tests, migrations `0022` and `0024`, repository CAS tests, and `recall-persistence-postgres.test.mjs` prove one persisted `due_at`, idempotent enrollment, stale-snapshot rejection, and executable Practice due/rating SQL. `recall-attempts.test.ts` and the live PostgreSQL test prove serialized start/resume permits one active owner/item-version/milestone attempt across devices, then concurrent completion converges to `completed` plus `unchanged` for the same outcome/hint or `completed` plus `conflict` for different semantics. A completed replay remains immutable even after the schedule advances. `private-practice-cards.test.ts` and `stabilization.test.ts` prove due terminal private `known/review` selection without admitting public or guest known cards, keep future unassessed and active Recall milestones out of generic Practice, make the legacy rating path fail closed without erasing terminal D+7 metadata, and derive the review-pool count from the same due predicate. Delivery operations, daily caps, and durable snooze consumption remain planned. |
| `AC-10` | Migration `0024` constrains the attempt table to identifiers, exact schedule binding, milestone/exercise enums, confidence, outcome, hint use, a coarse duration bucket, lifecycle timestamps, resulting due time, and retention. `recall-attempts.test.ts`, `apply-preview-schema.test.mjs`, and the live PostgreSQL test prove the completion input accepts only outcome and hint use, all returned fields remain content-free, server timestamps derive completion and duration, and completion never extends retention. The telemetry allowlist and log redaction remain planned. |
| `AC-11` | Recall schedule repository tests re-check owner, current version, active lifecycle, supersession, and source eligibility on reads and writes; Manual R1 cancellation preserves an assessed Practice projection or removes an unassessed row, invalidates the exactly matching active attempt, and uses item-version/enrollment-anchor/schedule-version CAS to reject an earlier generation. `recall-lifecycle-cleanup.test.ts` proves every knowledge-version, Trash lifecycle, batch-discard, and import-deletion mutation shares ordered Recall item locks and atomically invalidates active stale attempts, removes unassessed state, or clears only Recall fields on assessed Practice; alternate qualifying current-conversation provenance preserves the enrollment. The live PostgreSQL test proves both projections can enroll the new eligible version again after revision or restore and proves provenance removal preserves canonical knowledge and assessed Practice without stranding Recall state. `recall-attempts.test.ts` and `recall-persistence-postgres.test.mjs` prove resume, confidence, and reveal invalidate mismatched item revisions, schedule generations, lifecycle states, and provenance before returning an active session. Private Practice removal takes the Recall item lock and invalidates the active attempt before deleting its row, while all-progress reset locks every schedule/attempt item and deletes attempt history before owner rows in one account transaction; the live PostgreSQL test executes both paths against isolated synthetic rows. Disable/sign-out/token behavior remains planned. |
| `AC-12` | `pnpm --filter @stem-brain/mobile check`, `pnpm harness`, Preview checks, and separate physical iOS/Android notification/deep-link smoke provide repository and device evidence. |
| `AC-13` | Migration `0024`, `recall-attempts.test.ts`, the scheduled private-product purge, and account-deletion source tests prove attempt retention is capped at 365 days, all-progress reset may delete it earlier, and full account deletion removes attempts before Practice state and knowledge. No preference, device-token, delivery, standalone milestone, or cue record exists yet; provider cancellation remains a requirement for the later delivery tables. |
| `AC-14` | Planned consent-version, decline, withdrawal, export-deletion, account-deletion propagation, and sink-allowlist tests plus a reviewed participant notice prove research and product consent remain separate. |

The shared scheduling, persistence, content-free attempt repositories, and
manual web actions are executable. The existing private Practice queue
recognizes due terminal assessed Recall rows. Active milestones stay outside
generic Practice until the prepared-session action advances them; start/resume,
confidence, reveal authorization, completion, stale invalidation, item removal,
reset, retention, cancellation, and account deletion use the same owner/item
scope and schedule generation. R1 adds no approval hook or notification
delivery. The authenticated scheduled-purge route invokes only its bounded
retention cleanup. Unchecked criteria remain end-to-end requirements, not
activation claims.

## Rollout

The additive persistence migration `0022_recall_ping_persistence.sql` and
[0024_recall_prepared_attempts.sql](../../apps/web/drizzle/migrations/0024_recall_prepared_attempts.sql)
already provide the content-free schedule and
attempt records used by Manual R1; R1 adds no migration.
`user_private_card_states.due_at` remains the single scheduling authority.
Preference, delivery, device-token,
standalone milestone, and optional memory-cue records remain deferred until
their enrollment-generation, claim/lease, idempotency, and retention contracts
are specified with the lifecycle stage that uses them.
The existing `known -> 14 days` and `saved -> now` behavior must be migrated or
adapted explicitly rather than shadowed by a Recall Ping-only queue.

The first persistence migration also adds nullable revision-to-source binding so
the correction view can eventually distinguish sourced content from later owner
edits. Historical sources remain null rather than being guessed. Each future
standalone record must enter the explicit account-deletion path and receive its
bounded retention cleanup in the same PR that introduces that record.

Planned implementation PR boundaries:

1. **Shared contract:** add runtime-inert, dependency-light milestone, window,
   Practice-projection, scheduling, and one-time-snooze decisions with injected
   instants and exhaustive boundary tests. Do not hook approval, write a row, or
   send a notification in this slice.
2. **Persistence:** add the checked-in migration and owner-scoped repositories.
   The current Practice row permits only assessed `known/review` or
   `saved/learning`; this slice must introduce an honest nullable unassessed
   projection and nullable `last_seen` rather than marking enrollment as
   `saved`. It must keep `user_private_card_states.due_at` as the single due
   instant, bind new conversation sources to exact item revisions, serialize
   per-item writes, and use full-snapshot compare-and-swap updates. It does not
   add attempt, milestone, delivery, preference, device-token, snooze-consumption,
   or memory-cue records, and it does not connect a production lifecycle hook.
3. **Server lifecycle:** connect approval/enrollment, attempt creation, reveal,
   completion, retries, Practice ratings, and stale-version invalidation in one
   transactional state machine. Make item removal and all-progress reset cancel
   Recall work before state deletion. Update both SQL selection and the later
   in-memory Practice filter so due `known/review` can return without making
   ordinary public or guest known cards reappear.
   The Practice compatibility sub-slice (terminal due selection, exact review
   count, active-milestone rating guard, and locked removal/reset) landed first.
   The prepared-session sub-slice adds a content-free attempt table and
   disconnected server repository for due-only start/resume,
   confidence-before-reveal, stale invalidation, retention, and deletion wiring.
   Its completion sub-slice atomically applies D+1 retry/D+7/Practice decisions
   and immutable outcome metadata without adding an HTTP or UI caller.
   Approval/enrollment hooks and production runtime actions remain in this stage.
4. **Mobile delivery:** add default-off notification settings, device-token
   lifecycle, generic payloads, scheduler claims, one-time snooze, and the
   authenticated deep link behind platform adapters.
5. **Recall experience:** implement the three type-native reconstruction and
   correction surfaces, ephemeral response handling, optional private memory
   cues, accessibility alternatives, and localization.
6. **Pilot readiness:** add the content-free telemetry allowlist, separate
   research-consent controls, exports/deletion workflow, physical-device smoke,
   and Preview-only cohort operations required by the seven-day protocol.

Activation order:

1. Land the shared scheduling contract and boundary tests with no runtime hook.
2. Apply the additive migration to an isolated Preview database and verify that
   existing Practice states keep their current due behavior.
3. Keep Manual R1 enrollment production-default-off, validate its authenticated
   route against isolated Preview data, then separately add the mobile
   notification adapter, OS permission UI, and authenticated deep link behind a
   default-off feature flag.
4. Verify generic payloads, token revocation, stale versions, retries, and real
   notification taps on physical iOS and Android devices.
5. Run the documented seven-day closed pilot before enabling a broader cohort.

Manual R1 rollback sets `RECALL_RUNTIME_ROLLOUT=off`, which prevents new
enrollment while preserving completion and cancellation for existing schedules.
A checked-in Preview deployment uses `allowlist`, populated only with the
marker-validated authenticated E2E synthetic owner; production remains `off`
and the production authenticated workflow does not enable the Recall spec.
The Preview workflow sets `E2E_REQUIRE_RECALL_CLOSEOUT=true`; setup, desktop and
mobile execution, and the summarizer share that fail-closed requirement. A
successful closeout requires exactly the two project-matched Recall JSON files,
actual deployed rollout evidence, the four ordered 200 Server Actions, rendered
privacy/accessibility gates, the D+7 persistence result, and zero owner-and-ID-
scoped fixture rows after cleanup. Raw allowlists, user IDs, and private content
are not accepted artifact fields.
A later delivery rollback also disables scheduling/delivery, revokes outstanding
device work, and returns users to the existing Practice entry point without
deleting knowledge or attempt history. Additive columns/tables remain dormant
until a separate reviewed cleanup migration is safe.

Repository checks cannot prove APNs/FCM or notification-provider credentials,
OS permission presentation, background delivery, device timezone behavior,
store entitlements, or a real lock-screen payload. Those are separately gated
device/provider activation steps and must not be reported as deployed merely
because the code or migration exists.
