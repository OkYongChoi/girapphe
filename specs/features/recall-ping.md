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
  superseded, or moved to another lifecycle state is invalidated before reveal.
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
  delivery records expire after 30 days, attempt records after 365 days or an
  earlier all-progress reset, and memory cues when the user deletes the cue,
  knowledge item, or account. Queued external delivery identifiers are
  invalidated before database deletion.
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

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/src/lib/recall-persistence.test.ts` exercises a separate owner-scoped predicate for current-version typed items, approved current-conversation drafts/batches, matching conversation provenance, lifecycle exclusions, and content-free results. Approval/enrollment runtime wiring remains planned. |
| `AC-02` | Planned mobile settings tests cover consent-before-OS-permission, timezone selection, preview, snooze, disable, and device revocation; real-device permission denial and recovery remain rollout evidence. |
| `AC-03` | Planned notification-contract tests recursively reject private fields in title, body, data payload, logs, and error metadata; a deep-link integration test proves auth occurs before the due-item fetch. |
| `AC-04` | Planned web/mobile component tests and focused browser coverage prove answer/source/interval absence before confidence and reveal, including the `I don't know` path. |
| `AC-05` | Planned shared activity-builder tests cover all three bundle types and missing-field fallback; mobile accessibility tests plus VoiceOver/TalkBack inspection cover non-drag ordering and non-color meaning. |
| `AC-06` | Migration `0019_recall_ping_persistence.sql` and ingestion tests bind every newly created conversation source to its exact immutable item revision while leaving historical sources null. Correction-view rendering and edited-after-source labeling remain planned. |
| `AC-07` | Planned persistence tests prove free responses and ordering never enter requests, storage, analytics, or logs; memory-cue tests prove explicit save, owner scope, edit/delete, and exclusion from projections. |
| `AC-08` | `packages/shared/src/recall-schedule.test.mjs` proves the runtime-inert 24/48/168/192-hour boundaries and transition decisions. `apps/web/src/lib/recall-persistence.test.ts` plus `apps/web/scripts/recall-persistence-postgres.test.mjs` prove atomic snapshot persistence and honest assessed/unassessed projections. Attempts and approval/runtime wiring remain planned. |
| `AC-09` | The shared schedule tests, migration `0019`, repository CAS tests, and live PostgreSQL concurrency test prove one persisted `due_at`, idempotent enrollment/replay, and stale-snapshot rejection. Practice due-query integration, active attempts, delivery operations, daily caps, and durable snooze consumption remain planned. |
| `AC-10` | Planned schema, request-shape, telemetry allowlist, and log-redaction tests prove the attempt metadata ceiling and absence of private content. |
| `AC-11` | Recall repository tests re-check owner, current version, active lifecycle, supersession, and source eligibility on reads and writes; cancellation preserves an assessed Practice projection or removes an unassessed row, and its item-version/enrollment-anchor/schedule-version CAS rejects delayed cancellation from an earlier enrollment generation. Practice removal/reset wiring, disable/sign-out/token behavior, and prepared-session invalidation remain planned. |
| `AC-12` | `pnpm --filter @stem-brain/mobile check`, `pnpm harness`, Preview checks, and separate physical iOS/Android notification/deep-link smoke provide repository and device evidence. |
| `AC-13` | This persistence slice adds no standalone preference, token, delivery, attempt, milestone, or cue records. Its schedule snapshot remains on the existing explicitly deleted private-state row; source/revision deletion ordering is covered by account-deletion tests. Retention and provider cancellation remain requirements for the later tables that need them. |
| `AC-14` | Planned consent-version, decline, withdrawal, export-deletion, account-deletion propagation, and sink-allowlist tests plus a reviewed participant notice prove research and product consent remain separate. |

The shared scheduling contract and persistence repository are executable but
deliberately disconnected from production runtime. Unchecked criteria remain
end-to-end requirements, not claims that Recall Ping, notification delivery,
approval enrollment, Practice integration, or visible behavior is active.

## Rollout

Implementation requires additive checked-in Drizzle migrations. The first
persistence slice extends `user_private_card_states` with a content-free current
schedule snapshot, while `user_private_card_states.due_at` remains the single
scheduling authority. Preference, delivery, attempt, device-token, milestone,
and optional memory-cue records are intentionally deferred until their
enrollment-generation, claim/lease, idempotency, and retention contracts are
specified with the lifecycle stage that uses them.
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
3. Add the mobile notification adapter, OS permission UI, and authenticated
   deep link behind a default-off feature flag.
4. Verify generic payloads, token revocation, stale versions, retries, and real
   notification taps on physical iOS and Android devices.
5. Run the documented seven-day closed pilot before enabling a broader cohort.

Rollback disables scheduling and delivery, revokes outstanding device delivery
work, and returns users to the existing Practice entry point without deleting
knowledge or attempt history. Additive columns/tables remain dormant until a
separate reviewed cleanup migration is safe.

Repository checks cannot prove APNs/FCM or notification-provider credentials,
OS permission presentation, background delivery, device timezone behavior,
store entitlements, or a real lock-screen payload. Those are separately gated
device/provider activation steps and must not be reported as deployed merely
because the code or migration exists.
