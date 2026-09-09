# Private Knowledge Intelligence

Girapphe's Thinking History surface turns approved private knowledge into a
small evidence-linked briefing. It does not read raw conversation archives,
pending candidates, public graph content, or another owner's records.

The authenticated surface is the `Thinking History` view at
`/my-notes?view=insights`.

Its authenticated, client-only panel loads the selected locale's bounded UI
copy from the cacheable static `thinking-history-messages.json` asset. The
server emits only a localized loading shell before hydration. Private signals
and evidence remain in the owner-scoped RSC payload and are never written to
that public asset.

## Eligibility boundary

The web adapter loads at most 240 active private knowledge items through the
existing owner-scoped private graph contract. An item is ineligible when it is
pending, archived, deleted, inside its purge window, or superseded.

Eligible supporting records are immutable approved revisions, confirmed
private-to-private graph relationships, source-selector counts without source
text, and reuse activity timestamps.

The shared generator receives a provider-neutral corpus. It has no database,
web, ChatGPT, or Clerk dependency. The web adapter proves ownership and
eligibility before creating that corpus.

## Signal rules

Each visit returns at most six signals and at most two signals of one type.
Signals have deterministic opaque IDs, a private marker, a date range,
confidence, an uncertainty reason, and explicit approved evidence.

### Thought change

A thought-change signal requires two immutable revisions of the same approved
item. The normalized content must differ materially. Cosmetic or highly
similar edits do not produce a signal.

### Contradiction

A contradiction signal requires an already confirmed `contradicts` private
graph relationship between two active items in the same topic. Girapphe does
not infer contradiction from negative words or general text similarity.

The UI calls this a tension to review. The owner can classify it as incorrect,
unhelpful, or a scope difference. Feedback hides the signal without changing
or deleting either knowledge item.

### Connection

A connection requires a confirmed private relationship such as `related`,
`supports`, `derived_from`, or a causal relation. Unconfirmed model suggestions
are ineligible.

### Rediscovery

Rediscovery pairs an active item from the last 21 days with an item at least 60
days old in the same topic. The pair must share a tag or at least two meaningful
terms. An old item reused in the last 45 days is not resurfaced. Existing
explicit relationships are excluded so the signal adds a new retrieval cue.

### Topic emergence

Topic emergence requires at least two recently approved items and no active
item in that topic older than 30 days.

These deterministic rules are intentionally conservative. Unsupported signals
fail closed rather than being presented as facts.

## Evidence and context reuse

Opening a signal shows the exact approved item or immutable revision used by
the rule, its date, and the number of source selectors. A link opens the
owner-scoped Topic Hub at the approved item. No transcript excerpt is exposed.

Context creation is a second explicit selection. The user checks one or more
supporting active items and chooses Markdown, YAML, or JSON. Topic Context and
Thinking History initialize that choice from the saved Settings format, while
still allowing the user to override it for the current context pack. The
existing `POST /api/knowledge/context-pack` contract revalidates:

- same-origin authenticated POST;
- current signal ownership and signal membership when `signalId` is supplied;
- topic and selected-item membership;
- active, approved, non-superseded status;
- the 100-item and 256 KiB limits; and
- complete `reused` activity recording for every included item.

The result can be copied or downloaded and is provider-neutral. It contains
approved canonical knowledge and provenance metadata, not pending candidates
or source transcripts.

Signal views, evidence opens, and dismissals use the same endpoint's bounded
owner-validated `POST` operation. It regenerates the current signal set
before accepting an opaque event and never accepts knowledge text from the
client.

## Privacy-safe events

Event names and metric formulas live in
`packages/shared/src/ai-thinking-history.ts`. Input validation rejects unknown
fields. Persistence stores only the event allowlist value, schema version, a
SHA-256 subject hash scoped to the owner, optional bounded enums/count, and the
timestamp.

The table has no columns for message text, knowledge content, title, topic,
filename, source URL, archive data, or exported context. Client import events
send a random local session identifier and aggregate exchange count only.

The per-owner limit is 120 events per hour and 50,000 retained events. One
request can contain at most 10 events. Analytics failure never expands an
import selection and does not place authored text into logs.

The shared formulas compute import activation, review activation, D7 and D30
meaningful return rates, and Knowledge Reuse Rate from versioned events. A
context event counts toward Knowledge Reuse Rate only when its opaque subject
matches a previously opened intelligence signal for the same actor.

## Persistence and deletion

Migration `0020_knowledge_intelligence_events.sql` creates
`knowledge_product_events` and its owner/time and dismissed-signal indexes.
Production request handlers do not create or alter this schema.

Full account deletion explicitly removes these events in the same private-data
purge transaction as drafts, knowledge, revisions, activity, provenance, and
graph records. Dismissing one signal deletes no knowledge and creates no public
state.

## Verification

- `packages/shared/src/ai-thinking-history.test.mjs` covers provider-neutral
  imports, deterministic signal boundaries, fail-closed contradiction, event
  payload rejection, and metric recomputation.
- `apps/web/scripts/knowledge-product-events.test.mjs` covers hashed subjects,
  bounded event batches, and cross-owner dismissal isolation.
- `apps/web/scripts/apply-preview-schema.test.mjs` asserts the migration has no
  authored-content columns or data mutation.
- Existing Topic Hub, MCP, request-helper, and PostgreSQL suites retain context
  authorization and complete reuse-recording coverage.

Live PostgreSQL ownership and account-deletion evidence still requires an
isolated Preview database. Authenticated rendered evidence requires a dedicated
Clerk test user rather than a production user session.
