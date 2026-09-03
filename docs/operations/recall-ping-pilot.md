# Recall Ping Seven-Day Pilot

This protocol tests whether the selected
[Rebuild to Remember wireflow](../reference/recall-ping-wireflow.md) is useful,
understandable, and privacy-safe before broader implementation or rollout. It
does not establish learning efficacy. The governing behavior and data boundary
are in the [Recall Ping feature specification](../../specs/features/recall-ping.md).

## Decision to make

After seven days, decide whether Girapphe should proceed with the first three
type-native Recall Ping activities, revise the journey or notification cadence,
or stop and repair a safety or ownership problem before further testing.

The pilot tests three product hypotheses:

1. A generic reminder can bring users back without creating private lock-screen
   exposure or feeling like an opaque notification.
2. Reconstructing a concept, procedure, or comparison before reveal feels more
   useful than receiving a passive summary.
3. Confidence followed by source-backed correction helps users notice missing
   details without turning the flow into a score or an unverified AI grader.

## Cohort

Recruit 18 signed-in participants who already use GPT, Claude, or Gemini and
agree to select, review, and approve one non-sensitive item from a current
conversation. Recruit to the following target matrix so provider presentation
and type interactions are not confounded completely:

| Primary item | GPT | Claude | Gemini | Total |
| --- | ---: | ---: | ---: | ---: |
| `concept` | 2 | 2 | 2 | 6 |
| `procedure` | 2 | 2 | 2 | 6 |
| `comparison` | 2 | 2 | 2 | 6 |
| Total | 6 | 6 | 6 | 18 |

Provider cells are recruitment targets, not statistical comparison groups.
Within each two-person provider/type cell, recruit one iOS and one Android
participant, producing nine participants per platform. A missing platform cell
is an explicit coverage gap, not a reason to substitute a participant silently.
Exclude participants whose only candidate is sensitive enough that seeing it in
an authenticated research session would be inappropriate. Never ask a
participant to share the full conversation or copy its transcript into research
notes.

Each participant uses one primary approved item for the measured D+1 and D+7
path. Additional due items may remain in normal Practice but are excluded from
the pilot denominator.

Require exactly 18 balanced ITT participants before starting the first
notification window. Recruit additional people only as a pre-enrollment reserve;
never replace an ITT participant after `T0`.

Define the analysis populations before the first notification:

- **Recruited:** consented participants who entered onboarding.
- **Intent to treat (ITT):** recruited participants whose eligible primary item,
  research consent, Recall Ping consent, OS permission result, timezone, and
  selected time were persisted in one completed enrollment transaction. The
  transaction sets `T0`; scheduler and transport failures after it count against
  ITT. All proceed/stop thresholds use the fixed denominator of 18.
- **Technically evaluable:** ITT participants whose test build and transport
  produced at least one accepted notification request. Report this group only to
  explain delivery failures; do not remove technical failures from ITT results.

Record the enrollment timestamp as `T0` and the current primary-item version.
Do not replace an ITT participant or primary item after the first delivery
attempt. A necessary knowledge revision remains allowed and is a useful outcome,
but it makes same-version D+7 recall non-evaluable rather than hiding the edit.

## Schedule

| Window from `T0` | Participant activity | Research check |
| --- | --- | --- |
| Before `T0` | Select one current-conversation item, review/edit it, approve or choose it for enrollment, read and accept the separate research notice, opt into Recall Ping, record the OS permission result, choose a local time, and inspect the exact generic notification preview. Atomically persist enrollment and then set `T0`. | Confirm ownership, eligible type, provider/platform balance, both consent records, permission result, timezone, item version, and that no private field appears in the preview or payload log. |
| 0-23 hours | No pilot notification is eligible. The user may disable or withdraw at any time. | Confirm the scheduler cannot produce an early D+1 attempt. |
| D+1 opens, 24-47 hours | Open the first selected local-time reminder, reconstruct before reveal, choose confidence, self-assess after correction, optionally open the source, optionally save a memory cue, and confirm the D+7 anchor. | Observe completion time and confusion without recording the recalled answer. Ask the diary immediately afterward. |
| D+1 retry, 48-167 hours | Only participants whose D+1 milestone remains partial, missed, snoozed, or unopened receive at most one daily retry. A successful D+1 item receives no extra pilot notification. | Check retry idempotency, fatigue, and whether Recall Ping and Practice expose the same due state. |
| D+7, 168-191 hours | The first selected local time in this window opens D+7. Any unresolved D+1 milestone is finalized as incomplete and cannot suppress or follow D+7. Complete the reconstruction without hints, then the type-specific application prompt, and choose whether to keep notifications enabled. | Repeat the diary, conduct a 10-minute interview, and record content-free application and intentional-reuse signals. |
| Decision review, after 192 hours | No additional attempt can change the pilot's D+1 or D+7 result. The ordinary Practice queue may continue after the pilot. | Reconcile all ITT records, version changes, platform gaps, and stop criteria before deciding proceed, revise, or stop. |

The participant experience spans the seven-day learning interval, but the
decision review occurs only after every 168-to-192-hour D+7 window closes. This
prevents a chosen local time or timezone transition from turning D+7 into an
earlier calendar-day test. Retries never create a second `due_at` or move the
D+7 anchor.

## Participant diary

Ask the same questions without requesting the answer content:

1. "Did the notification reveal anything you would not want visible to another
   person?"
2. "Which part helped most or got in the way: reconstructing, confidence,
   correction, source, or scheduling?"
3. "Would a passive summary have been more useful, less useful, or equally
   useful at this moment, and why?"
4. "What did the correction do?" Record exactly one of: clarified something
   missed, confirmed nothing was missing, did not help, or was confusing.
5. "Does the conversation-source label mean Girapphe independently fact-checked
   this knowledge?" Record yes/no/not sure; the understood answer is no.

During D+7, add: "Did you apply this knowledge to a new situation in this
activity?" Record applied/not applied/not sure and new/same situation. Ask
separately whether they deliberately reused it in another AI conversation,
decision, or task, recording only yes/no and a broad category unless they
explicitly consent to a separate qualitative note.

## Measurement plan

The pilot's primary product measure is **Weekly Remembered & Applied
Knowledge**: the
deduplicated number of primary items whose unchanged version satisfies both of
these conditions between `T0` and the end of its 192-hour window:

1. the participant completes D+7 without a hint and self-assesses the item as
   remembered; and
2. the participant completes the type-specific application prompt and reports
   that they applied the knowledge to a new situation during the D+7 activity.

An owner-scoped `Reused` lifecycle event from `get_topic_context` is reported as
an **intentional retrieval proxy** only. The current event proves that an item
was returned for context reuse, not that it was applied correctly, and it does
not independently qualify an item for the primary measure. Report D+7 recall,
application completion, the combined measure, and retrieval proxies separately.
Because all are self-assessed and there is no blinded rubric, do not label any
of them an objective memory score. The longer-term candidate metric Weekly
Remembered & Reused Knowledge remains separate until Girapphe can distinguish
successful application from context retrieval.

Secondary measures:

- notification accepted by the transport, opened, activity started, answer
  revealed, and session completed funnel;
- D+1 and D+7 remembered/partial/missed outcomes by activity type;
- confidence distribution and high-confidence missed/partial rate;
- median and 90th-percentile time from activity start to reveal and completion;
- `I don't know`, hint, text fallback, snooze, source-open, memory-cue save,
  revision, and notification-disable rates;
- due-state consistency between Recall Ping and Practice;
- automatic-reminder daily-cap and one-time snooze consistency;
- deliberate cross-AI reuse reported during D+7; and
- qualitative preference versus a passive summary;
- post-correction clarification; and
- correct understanding that conversation provenance is not independent fact
  verification.

Transport acceptance is not proof that an operating system displayed a
notification. Record app-open attribution separately and use observed physical-
device checks for the delivery claim.

## Event and data boundary

Use an explicit event allowlist. Suggested event names are:

- `recall_research_consent_granted`, `recall_research_consent_withdrawn`;
- `recall_opted_in`, `recall_permission_result`, `recall_scheduled`;
- `recall_transport_accepted`, `recall_opened`, `recall_snoozed`;
- `recall_activity_started`, `recall_confidence_selected`;
- `recall_i_dont_know_selected`, `recall_text_fallback_used`;
- `recall_answer_revealed`, `recall_outcome_selected`;
- `recall_correction_assessed`, `recall_source_opened`;
- `recall_application_started`, `recall_application_completed`;
- `recall_memory_cue_saved`, `recall_revision_started`;
- `recall_session_completed`, `recall_notifications_disabled`; and
- `recall_delivery_failed` with a bounded, non-content reason code.

Allowed properties are limited to opaque participant/user and delivery IDs,
owner-scoped item ID inside Girapphe only, item version, bundle type, provider
enum, milestone, exercise type, confidence, self-assessed outcome, hint use,
coarse duration bucket, timestamps, timezone identifier, platform/app version,
entry source (`notification` or `practice`), whether the application situation
was new, application result (`applied`, `not_applied`, or `not_sure`), correction
result (`clarified`, `nothing_missing`, `not_helpful`, or `confusing`),
verification-understood enum, consent-notice version, and bounded failure code.

The server transaction allows only one active attempt per participant, primary
item, item version, and milestone. A second device reuses that attempt or sees
its terminal state. An assessed failed attempt closes before a later due retry
creates a new attempt. Events are idempotent on attempt ID and event name;
delivery events additionally use the opaque delivery ID, while the milestone
transition has a separate unique owner/item-version/milestone key. This dedupes
double taps and cross-device completion without erasing legitimate retry history.
Only automatic reminders count toward the one-per-local-date cap. A participant-
initiated one-hour snooze is one idempotent exception for its delivery, cannot be
snoozed again, and is cancelled rather than crossing the 168-hour milestone.

Never collect the title, topic, central question, approved answer, recall text,
reconstructed order, application response, memory-cue text, selector, source
URL, conversation reference, transcript, notification token, or authentication
material in analytics, research exports, screenshots, recordings, or support
logs. Disable session replay and full-screen research recording for the pilot.

The operational team may inspect the participant's own authenticated screen only
with contemporaneous consent. Delete participant-level pilot exports within 30
days after the decision review; retain only aggregate counts and de-identified
themes. This pilot rule does not change the application's separately governed
account-data lifecycle.

## Research consent and withdrawal

Notification consent, OS permission, and research consent are three separate
decisions. Before `T0`, show a versioned research notice that names the study
purpose, the event/property allowlist above, first-party operational storage,
participant-linked research export, retention periods, the absence of response
content and screen recording, a contact, and how to withdraw. Do not send pilot
events to a third-party analytics sink unless its deletion API and account-
deletion propagation have been tested and named in that notice.

On research withdrawal, atomically disable pilot delivery and future pilot-event
collection, keep approved knowledge untouched, and delete participant-linked
research analytics and exports within seven days. Authoritative account data
that also powers the product—knowledge, Practice state, attempts, and an
explicitly saved memory cue—follows the product retention and user-deletion
contract explained in the notice. If the participant also deletes the account,
the account-deletion fence removes those product records, invalidates queued
delivery identifiers first, and propagates a deletion tombstone to every named
research sink and export.

Calculate decision measures from this fixed contract:

| Measure | Numerator | Denominator and window | Evidence |
| --- | --- | --- | --- |
| D+1 and D+7 completion | ITT participants with one `recall_session_completed` at or after 24 and before 168 hours and one at or after 168 and before 192 hours. | All ITT participants; dedupe by participant, item version, and milestone. | Server session records, not client-only analytics. |
| D+7 unhinted remembered | Same-version D+7 completions with no hint and `remembered`. | All ITT participants through 192 hours; necessary revisions remain visible as non-evaluable. | Attempt outcome allowlist. |
| Weekly Remembered & Applied Knowledge | Items meeting D+7 unhinted remembered plus `recall_application_completed` with new-situation and `applied`. | All ITT primary items through 192 hours; one item maximum per participant. | Attempt and application events for the same item version. |
| Retrieval proxy | Primary items with an owner-scoped `Reused` lifecycle event and no intervening revision. | All ITT primary items from `T0` through 192 hours. | Existing lifecycle activity joined to revision timestamps; never described as successful application. |
| Correction usefulness | Participants choosing `clarified` or `nothing_missing` at D+1 or D+7. | All ITT participants who reached correction; also report against all ITT. | `recall_correction_assessed`. |
| Correction clarification | Participants choosing `clarified`. | Participants who self-assessed partial/missed or chose low/medium confidence and reached correction; report the count when fewer than six qualify. | `recall_correction_assessed`. |
| Verification comprehension | Participants answering no to the independent-fact-check question at final D+7. | All ITT participants, with missing/not-sure reported separately. | `recall_correction_assessed`. |
| Notification funnel | Unique accepted delivery, attributed open, activity start, reveal, and completion. | Accepted deliveries in each milestone window; report iOS and Android separately. | Delivery ID plus attempt ID. |
| Disable rate | Participants disabling Recall Ping before their final D+7 choice. | All ITT participants through 192 hours. | `recall_notifications_disabled`. |

## Success and stop criteria

Proceed to a broader closed alpha only if all safety gates and the minimum value
signals pass:

- zero private-notification-content, foreign-owner, raw-transcript, or stale-
  answer disclosure incidents;
- at least 10 of 18 participants complete both the D+1 and D+7 sessions;
- at least 3 of 6 participants in each bundle type and 4 of 9 on each platform
  complete both milestones, with no unresolved type- or platform-specific blocker;
- at least 3 of 6 participants for each provider complete both milestones, with
  no unresolved provider-specific blocker;
- at least 9 of 18 participants complete D+7 unhinted and self-assess remembered;
- at least 6 of 18 primary items count toward Weekly Remembered & Applied
  Knowledge, with every bundle type represented;
- no more than 3 of 18 participants disable notifications before the D+7
  choice; and
- at least 10 of 18 participants describe reconstruction as more useful than a
  passive summary in their final D+7 response;
- at least 10 of 18 report `clarified` or `nothing_missing` for correction
  usefulness, no more than 2 report `confusing`, and at least 70% of the
  applicable partial/missed or low/medium-confidence group reports `clarified`
  when six or more participants qualify; and
- at least 16 of 18 correctly understand at final D+7 that conversation
  provenance does not mean independent fact verification.

If every safety and value gate passes, proceed to the broader closed alpha. If
safety remains intact but any completion, recall, application, preference,
correction, comprehension, disablement, provider, type, or platform gate fails,
revise and repeat; a provider-specific failure may instead scope the next alpha
to providers that passed while that adapter is repaired. Stop delivery
immediately and repair before any further
participant exposure if private notification content, cross-owner content,
stale-answer disclosure, transcript retention, or unrevoked delivery after
account/device revocation occurs.

The sample has no control group and is intentionally too small for a learning-
effect claim. Do not infer provider superiority, bundle-type superiority, D+30
retention, or causal improvement over passive summaries from these thresholds.
The thresholds are majority and safety gates for deciding whether a small closed
alpha is worth the next build cycle; they are not statistical significance,
effect-size, or market-demand thresholds.

## Operational checklist

Before Day 0:

- use an isolated Preview environment and test build with the exact revision
  recorded;
- freeze the ITT rules, `T0`, primary item, item version, metric formulas, and
  event allowlist before the first delivery attempt;
- publish the versioned research notice, withdrawal control, sink inventory,
  seven-day research-deletion path, and account-deletion propagation check;
- verify migrations, feature flag, notification credentials, generic payload
  snapshot, analytics allowlist, log redaction, and token encryption;
- run owner, wrong-account, revised, archived, deleted, superseded, snooze,
  duplicate-open, offline, opt-out, invalid-token, sign-out, and account-deletion
  scenarios;
- complete physical-device notification and authenticated deep-link checks on at
  least one supported iOS and Android version; and
- give participants a visible contact and immediate opt-out path.

During the pilot:

- review only aggregate health and bounded failure codes each day;
- contact a participant only for a failed scheduled session or their requested
  support, without asking for content; and
- pause the affected platform or whole pilot when a stop criterion is suspected.

After every 192-hour window closes:

- reconcile scheduled, transport-accepted, opened, completed, and Practice due
  records without treating transport acceptance as delivery;
- review outcomes by type and provider cell only for product friction, not
  statistical ranking;
- document the proceed, revise, or stop decision and its evidence; and
- delete participant-level exports on the stated schedule.
