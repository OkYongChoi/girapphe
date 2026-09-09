# ChatGPT Export Import

Girapphe provides an authenticated web adapter at
`/knowledge-inbox/import` for user-initiated historical import. It is separate
from MCP ingestion: MCP remains limited to explicit selections from the current
conversation, while this adapter accepts explicit selections from a locally
opened ChatGPT export.

## Supported input

The first adapter accepts an extracted `conversations.json` file up to 20 MiB.
It reads text-only user and assistant messages from at most 5,000 conversations
and 100,000 mapping nodes. Images, attachments, tool output, system messages,
hidden messages, incomplete turns, zip files, and unsupported export shapes are
ignored or rejected.

When an export identifies `current_node`, Girapphe follows only that node's
parent chain. A non-string current node, a missing node or parent, an invalid
parent value, or a cycle rejects the file instead of falling back to every
mapping branch and accidentally including an abandoned regenerated response.
An older flat fixture may omit `current_node` only when its mapping also has no
parent-chain data; a branched mapping without an active node is rejected.

Provider export formats are external contracts and may change. Parser fixtures
must be refreshed against an export the user is authorized to inspect before a
release claims current compatibility.

## Privacy flow

1. The browser reads and parses the selected file. The archive is not uploaded.
2. Girapphe shows local aggregate topic/date signals and reviewable Q&A turns.
3. Nothing is selected by default. The user chooses at most 12 exchanges and
   confirms an explicit consent statement.
4. Only the selected, bounded question, answer, title, opaque source IDs, and
   date cross the authenticated Server Action boundary.
5. The server hashes provider IDs and creates one `selected_export` batch of
   private pending `question` bundles through the existing ingestion service.
6. The original archive, unselected messages, filename, credentials, and tool
   output are not persisted or sent to analytics.

The first release performs no model call and makes no claim that a selected
answer is a verified fact. It creates an editable answered-question candidate;
the user must review, revise, merge/update, save as new, or ignore it.

## Persistence contract

Migration `0019_selected_export_ingestion.sql` widens
`knowledge_ingestion_batches.scope` from only `current_conversation` to
`current_conversation | selected_export`. The default remains
`current_conversation`, and MCP-token-backed writes reject any other scope.
Migration `0023_knowledge_ingestion_request_tombstones.sql` adds a content-free,
owner/provider-scoped retry guard and scopes the ingestion request uniqueness
key by ingestion scope. A client-supplied current-conversation request ID can
therefore never capture or block a generated selected-export request with the
same opaque value. Deleting an import job retains only its
opaque request and import-session identities so an arbitrarily delayed
transport retry cannot restore the deleted selection. A session compatibility
identity is also retained when deleting a pre-rollout ChatGPT batch whose batch
ID was the import-session ID, so an old open tab cannot bypass the new request
format. Each live selected-export batch reserves two identity slots, and the
combined live-batch reservations plus durable tombstones are capped at 40,000
per owner. Deletion swaps the live reservation for at most two tombstones, so
repeated create/delete cycles cannot grow the guard table without bound. The
guard contains no selected text or raw provider identifier, is not an import
job, and full account deletion removes it. The database batch-delete trigger
also creates the same opaque tombstones, so a deletion served by a draining
pre-rollout Worker remains final. A database trigger makes every selected-export
batch insert or delete take the stable owner lifecycle lock before checking the
guard, including raw mixed-version statements. A permanent account-deletion fence suppresses
that trigger write while the owner-wide purge removes both batches and existing
tombstones.

The base import fingerprint hashes a versioned JSON encoding of sorted
`[conversationRef, messageRef]` tuples, so selection order is irrelevant while
identifier delimiters cannot make distinct selections share an idempotency
key. The server request ID combines that fingerprint with the validated local
import-session ID: transport retries from one confirmation remain idempotent,
while a later explicit selection can prepare a source that the user previously
discarded. The server assigns each persisted batch an independent opaque ID, so
changing the selected set after a lost response cannot collide with a prior
batch that used the same local session. For a pre-rollout ChatGPT batch whose
batch ID was the import-session ID, the server recognizes that legacy session
only when its selection fingerprint and the complete multiset of stored legacy
draft identities both match, before considering rejected drafts novel. The
second check also rejects the reverse delimiter-collision case where one old
tuple and two current tuples share the same v1 text encoding. A delayed old-tab
retry therefore resolves to the existing batch after ignore, while selection
growth in the same session can still prepare its new sources and a fresh
session may select an ignored source again. The local selection list also uses a collision-free tuple encoding,
so selecting one delimiter-shaped provider ID cannot select a second exchange.
Stored conversation/message references use the same versioned,
domain-separated encoding before one-way SHA-256 hashing. New candidates whose
provider references do not contain the old colon delimiter also carry a
transient legacy source-id alias, so unambiguous pre-v2 imports remain
deduplicated without retaining a raw provider identifier. Ambiguous legacy
aliases are not used because they could suppress a distinct source.
For one owner and provider, a selected-export source that already has a pending
or approved candidate is removed from a later overlapping import inside the
serialized ingestion transaction. Approval stores the opaque selected-source
fingerprint on the owner-scoped source record independently of user-editable
evidence. Import-job deletion promotes the previous hashed client ID for
pre-deployment source rows before removing job/draft links, so clearing all
evidence cannot accidentally enable a duplicate canonical item. Migration
`0023` backfills that opaque fingerprint on still-linked approved rows and a
source-detach trigger performs the same promotion when a draining pre-rollout
Worker runs its older deletion query. Rows whose job
and all evidence were already deleted before this release have no remaining
identity to backfill. Ignore, discard, import-job deletion, and import creation
take the same account and ingestion locks, making the active-candidate decision
atomic. Another owner's source never suppresses
the current owner's candidate, and relationships to an omitted duplicate are
also removed rather than left dangling. Selected text exists only inside the
private pending bundle that the user requested. Approval still atomically
creates the owner-scoped canonical item, private node, provenance, revision,
and valid relationships. Pending candidates do not affect mastery, ranking,
context packs, or either graph.

## Limits and recovery

- file size: 20 MiB;
- conversations inspected: 5,000;
- mapping nodes inspected: 100,000;
- selected exchanges per batch: 12;
- selected question and answer length: 4,000 characters each; and
- first-value list rendered at once: 100 exchanges.

The import request ID combines the selected-provider fingerprint with the
validated local import-session ID, so a transport retry of the same confirmed
request resolves to its existing owner/provider batch. A fresh explicit import
uses a new session ID. Overlapping selections create candidates only for
sources that are not already pending or approved; a previously ignored source
may therefore be selected again without duplicating an active candidate.
For a pre-v2 batch whose provider references contain none of the historical
delimiter characters, the server separately reproduces the v1 request hash and
uses it only together with the exact owner, provider, selected-export scope,
and legacy session/batch ID. Ambiguous legacy references fail closed into the
current collision-free path; the v1 encoding is never reused as the current
request identity.
If the user deletes a pending import while its request is still in flight, the
content-free retry guard permanently prevents that exact request from restoring
selected text. A later explicit import has a new session ID and is not blocked.
Post-commit analytics remain best-effort and cannot turn a successfully
persisted import into a failed response. Completion takes the shared
account-to-ingestion-to-import lock order, verifies the exact owner/provider/
selected-export batch, and performs started/parsed reassignment plus completion
insertion in one transaction. Started/parsed reassignment happens even when the
owner event quota has no room for new completion events, so every event already
associated with the import remains deletable with the batch. Import-job deletion takes the same locks and
purges that batch subject inside its deletion transaction. Completion therefore
either precedes deletion and is purged, or follows deletion and writes nothing;
it cannot recreate orphan telemetry for a deleted job. When ingestion resolves
either a created or duplicate-only import to a live batch ID that differs from
the local session ID, the content-free started/parsed events are reassigned to
the batch subject rather than deleted, preserving one deletable import funnel
without storing either raw identifier.
If deduplication resolves to a deleted-job tombstone or an approved source whose
import job is already detached, the result explicitly has no persisted batch.
Only started/parsed events for that local session are then removed and no
confirmation event is written; unrelated events sharing the opaque session
subject remain untouched.
`conversation_import_candidates_ready` is emitted only when the ingestion
transaction creates a batch, not for an idempotent retry. A failed or cancelled
local parse creates no server record. Batch discard and account deletion use
the existing ingestion lifecycle.

## Release boundary

Apply migrations `0019` and `0023` before enabling the route in Preview or
production. Preview schema preparation includes both migrations, and production
deployment runs migrations before publishing the Worker. Migration `0023`
installs an expand/contract bridge: a selected-export batch-insert trigger
rejects old-Worker retries covered by an owner-scoped request or session
tombstone, a statement-level batch-delete trigger writes those tombstones for
draining-Worker deletions and purges every batch-subject event, and event
insert/reassignment triggers reject or remove late telemetry
unless its owner-scoped batch is still live. A source-detach trigger preserves
the approved selection fingerprint before an older Worker removes its transient
batch, draft, and client-card locator keys. A preceding insert/delete trigger
serializes the bridge on the same account lifecycle lock used by every deployed
Worker generation, closing both commit orders of the absent-tombstone race.
Keep those triggers installed throughout any Worker rollback or old-request
drain window; removing the database half first reopens the mixed-version race.
Drizzle declares the supporting indexes, while the trigger definitions are
authoritative in the migration and `schema.sql`. Repository tests prove
parsing, fail-closed active-branch traversal, strict consent input, canonical
selection hashing, owner-scoped overlapping-import deduplication, telemetry
isolation, selected-export scope, and pending-only persistence. A release still
needs a real authorized export fixture, live PostgreSQL concurrency evidence,
and rendered desktop/mobile-width browser evidence. No provider credential,
background sync, or store activation is involved.
