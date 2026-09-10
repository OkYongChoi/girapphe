# AI Thinking History Layer

Status: Active

The repository-owned implementation is complete. The spec remains Active until
current provider compatibility and the expanded credentialed release evidence
pass their separate gates.

## Product thesis

Girapphe should help an individual see how their thinking developed across AI
conversations and reuse the resulting knowledge in later work. It is not a
general note editor, a raw conversation archive, or a replacement for a model
provider's memory.

The product loop is:

```text
AI conversation
  -> explicit import selection
  -> private knowledge candidates
  -> review and approval
  -> change, contradiction, and rediscovery signals
  -> selected context pack
  -> reuse in the user's AI tool
```

The strategic roles of the main surfaces are:

```text
Visualization attracts.
Memory retains.
Context reuse monetizes.
```

## User outcome

An AI power user can bring selected material from a ChatGPT export into
Girapphe, review it as source-backed private knowledge, and receive useful
signals about how their ideas changed, which older ideas became relevant
again, and which approved items should be reused in a new AI conversation.

The first meaningful moment is not merely seeing a graph. It is recognizing an
important prior idea that the user had forgotten, or seeing a defensible change
in their thinking, and then reusing that knowledge.

## Target user and job

Initial user:

- an individual developer, researcher, founder, product manager, consultant,
  analyst, or intensive student;
- uses an AI assistant several times per day and develops the same topic over
  multiple conversations; and
- is willing to review important knowledge but does not want to manually
  organize another general-purpose note system.

Primary job:

> When my AI conversations have accumulated over time, help me recover the
> useful ideas, understand how they evolved, and carry the right context into
> my next conversation without surrendering ownership of my raw history.

## Product principles

- Conversation-native: organize around thoughts, conversations, and concept
  evolution instead of pages or folders.
- Evidence before inference: every claimed change, contradiction, or connection
  must link to the approved knowledge and source selectors that support it.
- Review before memory: generated candidates remain pending until the user
  edits and explicitly approves them.
- Reuse over collection: success is measured by knowledge applied again, not by
  the volume of imported text or graph nodes.
- Provider-neutral core: provider adapters may differ, but approved knowledge,
  provenance, intelligence, and context packs use shared contracts.
- User-owned and private: no raw archive retention, no training on user data,
  complete export, and complete deletion.

## Scope

In scope:

- an opt-in upload of one extracted ChatGPT `conversations.json` file as the
  first historical source adapter;
- local archive parsing, validation, date/topic preview, and explicit
  conversation or snippet selection before any server-side processing;
- bounded transformation of selected material into the existing typed,
  source-backed, pending knowledge-bundle flow;
- a first-value view showing candidate topics, chronology, and relationships
  without presenting pending content as canonical knowledge;
- explicit review, edit, approve, merge/update, and ignore actions through the
  existing Knowledge Inbox contract;
- private intelligence derived from approved knowledge: topic emergence,
  material changes in a user's view, supported contradictions, forgotten-item
  resurfacing, and non-obvious connections;
- an evidence view for each intelligence signal, including an uncertainty label
  and dismiss action;
- explicit selection of approved items into a portable context pack for reuse
  in another AI tool;
- privacy-safe product analytics for activation, retention, intelligence use,
  and context reuse; and
- a provider-neutral ingestion boundary that can accept a future independently
  verified adapter without changing the canonical knowledge model.

Out of scope:

- background collection, account scraping, credential capture, or persistent
  synchronization with an AI provider;
- storing or searching a raw conversation archive;
- inferring from an entire export without an explicit user selection;
- automatic approval, automatic merge, or writes to the public knowledge graph;
- a generic chatbot over conversation history;
- a note editor, document editor, task manager, calendar, team workspace, or
  general-purpose PKM replacement;
- direct write access to a provider's private memory;
- ZIP archives, split or numbered conversation files, and provider adapters
  beyond the single-file ChatGPT format in the first release;
- email or push briefings, team intelligence, and enterprise connectors; and
- a new quiz engine or changes to public mastery and ranking behavior.

## Core journey

1. The user chooses **Import ChatGPT export** and receives a plain-language
   explanation of local parsing, selected-content processing, retention, and
   deletion before choosing a file.
2. Girapphe validates and parses the export locally, then shows conversation
   counts, date coverage, and a topic/date chooser. Raw text is not uploaded at
   this stage.
3. The user explicitly selects conversations or narrower snippets and confirms
   that the selection may be processed into private draft knowledge.
4. Girapphe deterministically creates bounded, typed candidates with central
   questions, source-selector provenance, dates, topics, and proposed
   relationships in one server transaction. The first release makes no model
   call and has no background job to leave running.
5. A first-value view summarizes candidate topic clusters and chronology. It
   clearly distinguishes unreviewed candidates from approved knowledge.
6. The user reviews candidates and chooses save as new, merge/update, edit, or
   ignore, and can discard the remaining batch. Only approval changes private
   canonical knowledge. Ignored candidates leave active review but remain in
   the owner-scoped import record until the user deletes that import.
7. Girapphe derives evidence-linked intelligence from approved knowledge and
   surfaces the highest-value changes, contradictions, connections, and
   forgotten items.
8. The user selects useful items, creates a bounded context pack, and copies or
   downloads it for a new ChatGPT, Claude, Gemini, Codex, or other AI session.

## Functional requirements

### Import

- `FR-01`: Accept one extracted `conversations.json` file through file upload.
  Reject ZIP, split/numbered, malformed, encrypted, and over-limit inputs before
  processing.
- `FR-02`: Parse the archive in the browser and expose only metadata required
  for selection until the user confirms a bounded content selection.
- `FR-03`: Support pre-confirmation cancellation, transport retry, duplicate
  detection, candidate ignore, and whole-import discard without silently
  expanding the user's selection. Ignore and discard mark affected candidates
  rejected and remove them from active review, while **Delete import** removes
  their retained owner-scoped import content and events immediately. None of
  these actions deletes separately approved knowledge.

### Transformation and review

- `FR-04`: Convert selected material into the existing versioned knowledge
  bundle contract, preserving one central question, one primary type, topic,
  dates when available, and selector-only provenance.
- `FR-05`: Reuse the pending review and owner-scoped approval lifecycle defined
  by [MCP card-draft ingestion](../../docs/reference/mcp-card-ingestion.md).
- `FR-06`: Keep a candidate visualization ephemeral or pending. It must never
  imply that a candidate is approved, learned, or part of the public graph.

### Intelligence

- `FR-07`: Rank intelligence signals by expected usefulness and show no more
  than a small, bounded set in a visit. Each signal must identify its type,
  evidence, date range, and confidence or uncertainty.
- `FR-08`: A thought-change signal must compare at least two approved items or
  revisions from different times and explain the material difference.
- `FR-09`: A contradiction signal must distinguish a likely contradiction from
  a changed scope, uncertainty, or a superseded view. The user can dismiss or
  correct it.
- `FR-10`: A rediscovery signal must surface an older approved item because it
  is relevant to a recent approved topic, not merely because it is old.

### Context reuse

- `FR-11`: Context creation requires explicit item selection or a visible,
  bounded topic selection and includes only active, approved, owner-scoped
  knowledge.
- `FR-12`: Context packs remain portable rather than provider-locked, expose
  provenance without transcript text, and record reuse activity.

## Acceptance criteria

- [ ] `AC-01`: A supported ChatGPT export is validated and parsed locally into
  a selectable conversation/date/topic preview; no raw message content leaves
  the browser before the user confirms a bounded selection.
- [ ] `AC-02`: Import consent states what will be processed, retained, and
  deleted. Cancelling before confirmation creates no import job. Ignoring a
  candidate or discarding a batch removes it from active review but retains the
  structured candidate in the owner-scoped import record and export until
  explicit import deletion; **Delete import** then removes pending and ignored
  candidate content and job events immediately with no recovery window.
  Success, failure, and account deletion retain no raw transcript or archive
  file in application storage, logs, analytics, traces, or error reports. The
  deterministic first release has no model call, background job, or timeout
  state.
- [ ] `AC-03`: Processing creates only owner-scoped pending bundles with a
  central question, typed structured content, date metadata when available,
  and selector-only provenance. It does not alter private canonical knowledge,
  mastery, ranking, or public/private graph state before approval.
- [ ] `AC-04`: The first-value view presents candidate topics, chronology, and
  proposed relationships with a visible pending state and direct entry into
  review; a user can trace every displayed candidate insight to its selected
  source location.
- [x] `AC-05`: The user can edit and independently save as new, merge/update,
  or ignore each candidate, and can discard an import to reject all remaining
  pending candidates. Ignored candidates remain exportable until explicit
  import deletion. Approval atomically preserves ownership, provenance,
  revision history, and valid private relationships under the existing
  knowledge lifecycle.
- [x] `AC-06`: Every thought-change, contradiction, connection, or rediscovery
  signal is private, bounded, uncertainty-labelled, and backed by at least two
  eligible approved knowledge items or revisions where the signal type
  requires comparison. Unsupported signals fail closed and are not shown.
- [ ] `AC-07`: A user can inspect evidence, dismiss a false signal, and open the
  underlying approved knowledge without exposing another owner's content or
  raw transcript text.
- [ ] `AC-08`: A user can explicitly select surfaced approved knowledge and
  create a bounded JSON, Markdown, or YAML context pack that can be copied or
  downloaded, contains no pending/archived/foreign item, and records a reuse
  activity for each included item.
- [x] `AC-09`: The ChatGPT adapter depends only on a shared provider-neutral
  import result contract; adding a future provider adapter does not change the
  canonical bundle, approval, intelligence, or context-pack contracts.
- [x] `AC-10`: Product events measure the defined funnel and reuse outcomes
  using opaque user/job/item identifiers and aggregate counts only. Event
  payloads contain no message text, knowledge content, title, topic, source URL,
  exported context, or archive filename. After a failed best-effort finalization,
  the exact canonical-request retry converges on the same four deterministic
  import events; a new duplicate-only session does not claim candidates ready.
- [ ] `AC-11`: A user can export all approved Girapphe knowledge and delete the
  import job, pending candidates, intelligence feedback, reuse records, and
  approved private knowledge they own; deletion behavior and any recovery
  window are visible before confirmation.
- [x] `AC-12`: Import and processing limits are enforced per owner, and the
  first release's model-cost ceiling is zero. The deterministic transaction is
  atomic rather than partially processed; oversized, malformed, duplicated, or
  retried imports cannot create an unbounded retry loop, duplicate canonical
  knowledge, or cross-owner data access.

## Success metrics

The initial product decision should use behavior, not graph generation volume.
Targets are hypotheses for the private beta and must be segmented by archive
size and user cohort.

| Metric | Definition | Initial signal |
| --- | --- | --- |
| Import activation | Users who view the first-value screen / users who confirm an import selection | at least 60% |
| Review activation | Users who approve or intentionally dismiss at least one candidate / users who view candidates | establish baseline, then improve |
| D7 retained | Activated users with a meaningful return action on days 7-13 / activated users | at least 20% |
| D30 retained | Activated users with a meaningful return action on days 30-44 / activated users | at least 15% |
| Knowledge Reuse Rate | Surfaced intelligence items that lead to a context pack containing supporting knowledge / surfaced intelligence items opened | primary leading indicator |
| Paid conversion | Paying users / activated eligible users after the paywall experiment | 5-10% is a strong early signal |

A meaningful return action is reviewing knowledge, opening evidence for an
intelligence signal, correcting/dismissing a signal, or creating a context
pack. Merely opening the app or moving the graph does not qualify.

Guardrails:

- raw transcript retention incidents: zero;
- cross-owner data incidents: zero;
- unsupported intelligence shown as fact: zero in reviewed fixtures;
- import and inference cost per activated user: measured before pricing; and
- candidate approval and signal-dismissal rates: monitored for quality, not
  optimized by hiding review friction.

## Event contract

The minimum privacy-safe funnel events are:

| Event | Trigger |
| --- | --- |
| `conversation_import_started` | A user submits an explicitly selected and consented import. |
| `conversation_import_parsed` | The same submission records that local validation produced a selectable preview, with only its aggregate exchange count. |
| `conversation_import_confirmed` | A user confirms a bounded selection and consent. |
| `conversation_import_candidates_ready` | Processing produces pending candidates. |
| `conversation_import_first_value_viewed` | The candidate topic/timeline view becomes visible. |
| `knowledge_candidate_resolved` | A candidate is approved, merged/updated, ignored, or cancelled. |
| `knowledge_signal_viewed` | A private intelligence signal and its type become visible. |
| `knowledge_signal_evidence_opened` | The user opens supporting approved knowledge. |
| `knowledge_signal_dismissed` | The user marks a signal unhelpful or incorrect. |
| `knowledge_context_created` | A context pack is created from an explicit selection. |

No event may include user-authored or model-authored text. Metric definitions
and event versioning must be shared by implementation and analysis so a UI
rename cannot silently change the funnel.

## Pricing experiment

Start with one paid tier rather than optimizing plan segmentation before value
is proven:

- Free: one bounded import experiment, pending review, basic candidate
  visualization, and a small number of intelligence/context actions.
- Pro hypothesis: USD 10-15 per month for longer approved history, recurring
  intelligence, larger context packs, and future multiple-source adapters.

The paywall should be tested only after users reach first value. Raw-data
export, account deletion, candidate review, and correction of generated content
must not be paywalled.

## Privacy and data boundaries

The import feature is a separate, explicit adapter and does not loosen the
existing MCP rule that connectors may process only material selected in the
current conversation. It never gives a connector permission to revisit history.

For archive import, the user initiates each file operation and sees a local
preview before selecting content. The archive and raw messages are transient
inputs, not Girapphe records. Only the bounded selection and content-free
aggregate preview count cross the server boundary after explicit consent and
submission. The first release transforms it with a
deterministic parser and makes no model-service request. Application persistence
contains only pending or approved structured knowledge, opaque selectors,
minimal source metadata, job state, and privacy-safe aggregate events.

All derived content remains owner-scoped and private. Pending bundles do not
enter canonical search, context packs, mastery, ranking, or either graph until
the user explicitly approves them. Approved private relationships may point to
valid public nodes but do not mutate public content. Intelligence jobs read only
eligible owner-scoped approved knowledge and must fail closed if ownership or
eligibility cannot be proven.

The user can inspect, edit, export, archive, and delete their knowledge. The UI
must distinguish deleting an import job or pending candidates from deleting
approved knowledge and must disclose any trash/recovery period. Secrets,
provider credentials, raw archive names, and content never enter analytics.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `chatgpt-export.test.mjs` covers the supported single-file parser and fail-closed active-branch traversal. The expanded authenticated browser test requires zero same-origin POSTs and zero import-event rows both before consent and before submission, inspects every outbound request URL/body for selected and raw markers, then uploads only two selected synthetic exchanges. It still needs a credentialed Preview run and a current authorized provider export fixture before this criterion can close. |
| `AC-02` | Parser, event, ingestion, migration, and live PostgreSQL tests cover transient input, content-free analytics, idempotent submission telemetry, deletion/retry ordering, and account purge. The expanded authenticated test asserts that the raw filename and unselected message never cross the boundary, verifies the four post-consent import events once each, then verifies explicit import deletion removes retained selected candidate content from the full export. Its credentialed run is still required; application logs and traces must remain disabled or separately inspected without retaining private input. |
| `AC-03` | Unit tests cover owner-scoped pending bundles, hashed selectors, dates, and approval-only promotion. `chatgpt-export-postgres.test.mjs` now asserts zero canonical knowledge, graph, mastery, and ranking rows immediately before approval; a new isolated Preview PostgreSQL run is required for that assertion. |
| `AC-04` | `DraftReviewPanel` implements pending labels, topic/timeline grouping, source evidence, relationship counts, and direct review. The expanded desktop/mobile authenticated path exercises those elements but has not yet run against a deployed commit. |
| `AC-05` | Knowledge lifecycle and selected-export tests cover edit, save as new, merge/update, individual ignore, whole-import discard, atomic approval, provenance, revisions, and valid relationships. Import work is synchronous: ignore/discard marks candidates rejected and removes them from active review; explicit import deletion removes their retained owner-scoped content. |
| `AC-06` | `packages/shared/src/ai-thinking-history.test.mjs` exercises material revisions, confirmed contradiction/connection relations, rediscovery relevance, bounds, and fail-closed unsupported contradiction; `knowledge-intelligence.ts` limits the corpus to owner-scoped active graph items. |
| `AC-07` | Source and event tests validate owner-scoped evidence and opaque feedback. Authenticated Preview run `34038249111` established the prior private evidence surface; the expanded test adds underlying-knowledge navigation and dismiss/removal assertions and still needs a new credentialed run. |
| `AC-08` | The context endpoint revalidates explicit selection, signal and active Topic Hub membership, payload size, and per-item reuse recording. Run `34038249111` established Markdown download; the expanded test asserts JSON, YAML, and Markdown copy plus download content, and still needs a new credentialed run. |
| `AC-09` | `SelectedConversationImportResult` is consumed by the provider-neutral batch builder; shared tests pass a synthetic provider through the same contract and reject raw archive fields. No second provider is claimed or enabled. |
| `AC-10` | Event-schema, migration, memory-store, and metric tests reject content fields, keep opaque owner-scoped subjects, recompute activation, meaningful return, and reuse metrics, and exercise failed-finalization recovery through actual memory and live-PostgreSQL ingestion retries without a false duplicate-only `candidates_ready` event. |
| `AC-11` | The account surface exports owner-scoped data and separates immediate import deletion, 14-day knowledge Trash, and irreversible account deletion. Live PostgreSQL run `34305134986` established selected-export lifecycle coverage; the expanded authenticated test adds pre/post deletion export assertions and still needs a new credentialed run. |
| `AC-12` | Parser and ingestion tests cover hard limits, collision-free identities, idempotent retries, owner isolation, active-source deduplication, durable tombstones, mixed-version races, and bounded retry guards. The first release makes no model call, and selected-export creation is one serialized transaction, so model cost is zero and there is no partial background job or unbounded retry loop. Preview PostgreSQL run `34305134986` passed the live concurrency/deletion fixture. |

Before the expanded closeout gate can be marked passed, run the focused tests,
`pnpm harness`, browser-visible coverage, and Cloudflare/runtime coverage on the
exact commit. The authenticated import/intelligence flow requires a deployed
Preview plus the isolated synthetic Clerk/Database fixture, and the new
pre-approval database assertions require an isolated Preview database. Local
fallback is not production evidence.

## Rollout

1. Prototype the local parser and first-value presentation with synthetic
   exports. No production data, schema change, or provider credential is needed.
2. Freeze the provider-neutral import-result contract, transient-data threat
   model, limits, event schema, and model-processing policy before adding a
   server endpoint or migration.
3. Implement behind an account-level feature flag with checked-in Drizzle
   migrations for any persisted job, feedback, or metric state. Production
   request handlers must not mutate schema.
4. Run an internal dogfood cohort, then an opt-in private beta. Review import
   completion, candidate quality, false-signal dismissals, cost, D7 retention,
   and Knowledge Reuse Rate before widening access.
5. Test a single Pro paywall only after first value and only if repeated reuse
   exists. Do not use graph generation or total imported conversations as the
   monetization gate.
6. Add another provider adapter only after the ChatGPT adapter proves that the
   shared downstream contracts do not require provider-specific fields.

Rollback disables new imports and intelligence generation while preserving the
existing review, approved knowledge, export, deletion, and context-pack paths.
There is no queued import or model work in the first release. A rollback must
not strand pending candidates or make already approved owner-scoped knowledge
inaccessible; existing review and deletion stay available. Keep migration
`0023`'s telemetry and source-detach
compatibility triggers through the old-Worker drain window; contracting them is a separate
post-rollout change.

Provider export formats, model data-retention terms, account plans, and region
availability are external activation dependencies. They must be revalidated at
implementation and release time; repository checks alone cannot prove them.

## Go/no-go checkpoints

- Go from prototype to private beta only if zero-retention behavior is proven,
  candidate provenance is reviewable, and at least 60% of dogfood users who
  confirm a selection reach first value.
- Continue the intelligence investment only if users open evidence and either
  reuse or deliberately correct surfaced knowledge; graph exploration alone is
  insufficient.
- Rework positioning or stop the initiative if D30 meaningful retention remains
  below 15% after the major import and signal-quality issues are addressed.
- Expand beyond ChatGPT only when a second adapter strengthens cross-provider
  reuse without weakening consent, provenance, or canonical bundle contracts.
