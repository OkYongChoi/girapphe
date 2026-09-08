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

Import request IDs and stored conversation/message references are
domain-separated SHA-256 values. Selected text exists only inside the private
pending bundle that the user requested. Approval still atomically creates the
owner-scoped canonical item, private node, provenance, revision, and valid
relationships. Pending candidates do not affect mastery, ranking, context
packs, or either graph.

## Limits and recovery

- file size: 20 MiB;
- conversations inspected: 5,000;
- mapping nodes inspected: 100,000;
- selected exchanges per batch: 12;
- selected question and answer length: 4,000 characters each; and
- first-value list rendered at once: 100 exchanges.

The import request ID is derived from the selected provider IDs, so a retry of
the same selection resolves to the existing owner/provider batch. A failed or
cancelled local parse creates no server record. Batch discard and account
deletion use the existing ingestion lifecycle.

## Release boundary

Apply migration `0019` before enabling the route in Preview or production.
Preview schema preparation includes the same migration. Repository tests prove
parsing, strict consent input, hashed selectors, selected-export scope, and
pending-only persistence; a release still needs a real authorized export fixture
and rendered desktop/mobile-width browser evidence. No provider credential,
background sync, or store activation is involved.
