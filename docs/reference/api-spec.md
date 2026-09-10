# API Specification

## Base

- Runtime: Next.js Route Handlers
- Content type: endpoint-specific (`application/json` by default; form posts, redirects, and
  raw signed webhook bodies are documented where used)

## GET `/api/graph`

Returns full graph for a user, including knowledge overlays and aggregate stats.

### Query params

- `user_id` (optional): user identifier for personalized graph view.

### Response `200`

```json
{
  "nodes": [
    {
      "id": "gradient_descent",
      "label": "Gradient Descent",
      "domain": "Optimization",
      "level": 2,
      "difficulty": 3,
      "type": "algorithm",
      "knowledge": 0.7,
      "confidence": 0.85,
      "growth_daily": 0.02,
      "growth_weekly": 0.1,
      "growth_monthly": 0.3
    }
  ],
  "links": [
    {
      "source": "partial_derivatives",
      "target": "gradient_descent",
      "type": "prerequisite",
      "weight": 0.8
    }
  ],
  "stats": {
    "total_nodes": 247,
    "known": 35,
    "partial": 42,
    "unknown": 170,
    "avg_knowledge": 0.28,
    "domains": {}
  }
}
```

## POST `/api/quiz_result`

Submits the result of an assessment for a single node.

### Request body

```json
{
  "user_id": "u123",
  "node_id": "gradient_descent",
  "result": 1
}
```

### Validation

- `node_id` is required.
- `result` is required.
- `result` must be one of: `0`, `0.5`, `1`.

### Backend processing flow

1. Direct node update
2. Local propagation to adjacent nodes
3. Global diffusion pass
4. Timestamp updates (`last_updated`, optional `first_known_at`)

### Response `200`

```json
{
  "success": true,
  "node": {
    "id": "gradient_descent",
    "knowledge": 1,
    "confidence": 0.9
  },
  "knowledge_state": 1,
  "confidence": 0.9,
  "propagated_count": 5,
  "first_known_at": "2026-02-18T01:00:00.000Z"
}
```

### Error responses

- `400`: invalid payload
- `500`: internal error

## GET `/api/health`

Returns service availability and storage mode health.

### Response

- `200` with status `ok` when healthy.
- `503` with status `degraded` when DB-configured mode is unreachable.

## `/api/mcp`

Provider-neutral Streamable HTTP MCP endpoint. It accepts a Girapphe-scoped PAT
or Clerk OAuth bearer token and exposes `create_knowledge_bundle_drafts` plus
the backward-compatible `create_card_drafts`; tool calls create pending private
review batches and cannot approve or publish cards. See
[MCP card-draft ingestion](./mcp-card-ingestion.md) for the strict input schema,
review boundary, and client compatibility notes.

The path is exempt from Clerk cookie authentication because remote MCP clients
do not carry a browser session. The route still verifies its own PAT or OAuth
bearer token before reading a request body. Per-credential and per-user quotas
bound writes; OAuth discovery metadata is public under `/.well-known/`.

## `/api/mobile`

Authenticated mobile `notes`, `graph`, and `practice` payloads preserve the
legacy flat fields and may additionally include `knowledge_type`,
`central_question`, `structured_content`, and `bundle_schema_version`. Mobile
create/update requests accept the same fields, reject invalid version-one
bundles, and keep quick notes untyped. Note tags use the shared canonical tag
contract: at most 12 values are normalized with Unicode NFKC before validation,
each normalized tag is bounded to 48 Unicode code points (including astral
letters as one code point), and invalid tags fail with `400 INVALID_TAGS`.

`GET /api/mobile?resource=notes&view=active|archive|trash` returns the
owner-scoped My Notes lifecycle view requested by the client. Mobile clients
archive or restore an archived item with `POST /api/mobile`, action
`archive-note` or `restore-archived-note`, the item `id`, and its positive
current `version`. A stale optimistic version returns `409 NOTE_STALE`; the
client must reload before retrying. The native editor replaces every editable
field, including `version` and `tags`, with the winning active server item so a
retry cannot repeat the stale payload. That replacement is tied to the editor
request identity: Cancel or selecting another note supersedes an in-flight
reload, which may refresh the list but cannot overwrite the newer editor state.
Editor mutation controls are locked while the save request is pending. If the
stale item is absent from the refreshed active list, the native client detaches
the entered fields into an unsaved new-note draft rather than clearing them.
Moving an item to Trash continues to use `delete-note`, and `restore-note`
restores a trashed item to the lifecycle state it held before deletion.

`create-note` keeps one bounded `requestId` for the lifetime of the current
unsaved editor draft. A newly inserted note returns `201` with
`{ success: true, outcome: "inserted" }`; retrying an already committed request
returns `200` with outcome `replayed`. The native client reuses the request ID
after an ambiguous failure. If the user edited the draft before a replay is
confirmed, the previously saved version is reported and the newer fields stay
in the editor as a new unsaved draft. A quota rejection does not consume the
request ID and returns `409 KNOWLEDGE_ITEM_QUOTA_EXCEEDED`, so the editor remains
intact and can show localized recovery guidance. Account-wide quota counts
trashed rows until their 14-day retention expires, so the client states that
delay instead of implying that moving a note to Trash frees space immediately.

The mobile My Notes editor accepts ASCII comma, Arabic comma (`،`), and
fullwidth comma (`，`) separators. Splitting happens in the shared client
contract, while the API independently normalizes and validates the resulting
array before calling the owner-scoped knowledge action.

Native create and edit derive up to 500 frequent-tag suggestions client-side
from the authenticated owner's already loaded active notes. The picker is
opt-in and renders at most 24 suggestions at once; `/api/mobile` exposes no
global tag-suggestion route. The strict API parser remains authoritative:
malformed, invalid, reserved, overlong, or over-limit arrays return `400
INVALID_TAGS`, with the unique-count limit applied after normalization and
deduplication.

Current iOS and Android clients send create and update to
`POST /api/mobile?resource=notes`. The qualified notes mutation resource accepts
only `create-note` and `update-note` and caps its JSON body at 6,291,456 bytes so
a valid, maximally populated native version-one bundle, including JSON-escaped
control code units, fits within a bounded request. An oversized request returns
`413 MOBILE_KNOWLEDGE_REQUEST_TOO_LARGE`; a different action sent to that
resource returns `400 INVALID_MOBILE_RESOURCE_ACTION`. Other `/api/mobile`
mutations, including backward-compatible unqualified note requests from
installed clients, remain capped at 16,384 bytes and return `413
MOBILE_REQUEST_TOO_LARGE` when oversized. Invalid JSON returns `400
INVALID_JSON` in either path.

`GET /api/mobile?resource=topics` returns `{ topics }` under `Cache-Control:
private, no-store`. Each owner-scoped active-topic summary contains `topic`,
`item_count`, `open_question_count`, `decision_count`, `event_count`,
`source_count`, `last_updated_at`, and at most three `sample_titles`. The client
opens the existing bounded `resource=topic-hub&topic=...` route for details.

`GET /api/mobile?resource=topic-hub&topic=...` accepts one trimmed topic of at
most 120 characters and explicitly projects only `topic`, `generated_at`,
capability-compatible `items`, `sources`, `activity`, capability-compatible
`relations`, and `evidence_selectors`. The projection returns at most 200 items,
500 sources, 500 activity entries, 500 relations, and 1,000 selectors, with at
most 24 retained selector references per relation. A retained selector is
returned only when its owner-scoped matching source is also present, including
for evidence attached to a relationship from another topic. Evidence selectors
retain only key-specific, bounded references or numeric ranges plus polarity,
quality, origin, and confirmation metadata. Malformed legacy selectors are
omitted and removed from relation evidence references. The native view
allowlists the same keys again, localizes their semantic labels, keeps technical
positions left-to-right in RTL UI, and never receives raw transcript text. The
web-only `revisions` and `supersessions` collections are intentionally omitted
from this mobile response rather than leaked through an object spread.

`GET /api/mobile?resource=knowledge-data-controls&page=1` returns active and
completed import jobs for the authenticated owner, newest first. Status is one
of `pending`, `partial`, `approved`, or `discarded`. Pages are limited to 50
jobs, and `page` must be an integer from 1 through 400. Each job projects only
`id`, `provider`, `scope`, `status`, `draft_count`, `pending_count`,
`approved_count`, and `created_at`; request IDs, source locators, source URLs,
and conversation references are not returned. The response includes the
canonical `page` and `hasNextPage` values.

`POST /api/mobile` action `delete-import-batch` accepts one `batchId` bounded to
160 characters and applies the existing owner-scoped import deletion
transaction. It removes the job, its remaining pending candidates, and its
job-level product events while preserving approved knowledge and detaching its
sanitized, hashed provenance from the deleted batch. A selected-export request
is tombstoned so deletion cannot be defeated by replaying the same import.
Missing, already-deleted, and foreign-owner IDs return the same retry-safe
`{ deleted: false, approvedKnowledgePreserved: 0 }` shape without disclosing
existence.

These data-control responses use `Cache-Control: private, no-store`,
`X-Content-Type-Options: nosniff`, and `Vary: Cookie, Authorization`.

`GET /api/mobile?resource=ranking` returns private no-store anonymous rows with
`rank`, stable `participantId`, `isCurrentUser`, `explainable`, and `avgScore`.
The legacy `label` field remains additive for installed-client compatibility;
neither field exposes account identity.

`GET /api/mobile?resource=candidate-batch&batchId=...` includes
`requires_detailed_review` and `detailed_review_reason` on every pending draft.
The reason is `causal_relations` when any causal relation is present, otherwise
`provenance` when proposed evidence or any noncausal relation is present, and
`null` only for a content-only quick-approval candidate. Clients disable quick
save-as-new when detailed review is required and hand off to the exact
owner-scoped web review route. For both approve and ignore, the server compares
the requested `draftVersion` with the latest draft before applying capability or
detailed-review gates. A mismatch returns `409 CANDIDATE_STALE`, and the native
client reloads before another attempt. Only a matching latest approval can
return `409 CAUSAL_REVIEW_REQUIRED` or `409 PROVENANCE_REVIEW_REQUIRED`, before
creating a canonical item or clearing evidence selectors or relationships.

`GET /api/mobile?resource=saved` returns owner-scoped `cards` plus authoritative
`stats` (`explainable`, `unclear`, and `reviewable`). New clients select the
Review or new-card intent from `reviewable`, not from saved-card list length.
With a configured database, a failed cards or stats query fails the request;
mock state is available only in explicit guest/no-database mode.

`POST /api/mobile?resource=practice` accepts JSON `{ mode, cursor,
cycleOnEmpty }`, where `mode` is `new` or `review` and `cursor` is null or a
versioned opaque string of at most 1,024 characters. The request body is capped
at 2 KiB. The cursor is an untrusted seek hint, not authorization: every
request derives the actor from server authentication and reapplies owner
scoping. The server alternates public and owner-private lanes, traverses IDs in
deterministic ascending order within each lane, and uses `LIMIT 1` for each
database candidate query. Private cursors are decoded to the raw knowledge-item
ID for the `(user_id, id)` owner index; record eligibility and canonical ID
shape are applied before `LIMIT 1`. The response is
`{ card, stats, nextCursor, cycled }`;
the client sends `nextCursor` on the next read. Neither side retains a growing
card-ID array or request-global traversal state; the app keeps only bounded
previous-card history and constant-size progress counters alongside the cursor.

Only a non-null cursor with `cycleOnEmpty: true` may wrap to a fresh round, and
that request resets at most once. An initial null cursor does not perform a
second empty lookup. Responses use `Cache-Control: private, no-store` after
authentication. Invalid request shapes return `400 INVALID_PRACTICE_REQUEST`,
an invalid or mode-mismatched cursor returns `400 INVALID_PRACTICE_CURSOR`, an
unsupported locale returns `400 UNSUPPORTED_LOCALE`, and an oversized body
returns `413 PRACTICE_REQUEST_TOO_LARGE`.

`GET /api/mobile?resource=practice&mode=new|review&exclude=...` remains a
backward-compatible read for installed clients. It accepts at most 100
`exclude` values and returns private card and stats data with `cycled: false`;
a larger list returns `400 PRACTICE_EXCLUSIONS_TOO_LARGE` instead of silently
truncating the caller's round, while an empty or oversized ID returns
`400 INVALID_PRACTICE_EXCLUSIONS`.

New mobile clients send
`X-Girapphe-Knowledge-Capabilities: expression-v1,event-chronology-v1,causal-relations-v1`.
When the header is absent, expression bundles are projected to legacy flat
content, structured event chronology is omitted, and causal relation rows are
filtered. This keeps older installed clients compatible without weakening the
server-side version-one validation. An older client receives `409`
`KNOWLEDGE_CAPABILITY_REQUIRED` instead of overwriting an expression or dated
event whose hidden structured fields it cannot preserve.

## Authentication continuations and browser handoffs

Protected Expo routes send an enumerated destination to the native sign-in
screen, never a free-form path. The dynamic Topic Hub is the only continuation
with a value and its topic is capped at 120 characters. Clerk email and Hosted
Auth completion consume the same resolver; Hosted Auth returns through the
configured app scheme created by
`ExpoLinking.createURL('hosted-auth-callback')`. Private protected-route content
is keyed by the current Clerk user ID so a direct signed-in owner switch
remounts screen state before another owner response can render.

Web login and signup accept exactly `/practice`, `/subscription`,
`/account/delete`, or `/account/data-controls-handoff` as `returnTo`. Validation
happens before locale prefixing. Absolute, protocol-relative, locale-prefixed,
query- or fragment-modified, whitespace-modified, and duplicated values fall
back to `/practice`. The fixed data-controls handoff does not accept its own
destination input: it shows the browser's current account, requires explicit
confirmation, and only then links to the localized
`/account/delete#knowledge-data` section. Switching accounts signs out and
returns through the same fixed handoff. Mobile bearer credentials are never
placed in these browser URLs.

## Billing and entitlement endpoints

- `GET /api/billing/entitlement`: authenticated, no-store provider-neutral `ad_free` lookup
  used by web and mobile to honor any valid qualifying provider subscription for the same Clerk
  user. The response also reports provider/plan/management metadata, the independently
  configured web/mobile acquisition gates, and the canonical booleans
  `acquisitionBlocked` and `duplicateDetected`. Mobile must suppress new
  acquisition and offer a canonical refresh while `acquisitionBlocked` is true,
  and must keep `duplicateDetected` visible for support/recovery instead of
  discarding it in its view model.
- `POST /api/billing/checkout`: same-origin, signed-in Creem hosted-checkout creation. The only
  accepted plan is `annual`; the server selects the configured USD 10.00 tax-inclusive product.
  Existing entitlement, an account-deletion marker, an acquisition block, or an unresolved
  checkout prevents a second provider request.
- `POST /api/billing/portal`: same-origin, signed-in Creem customer-portal creation for a mapped
  provider customer. This remains a lifecycle operation when new web acquisition is disabled.
- `POST /api/billing/superwall/identity`: authenticated registration of the current Clerk user as
  a provider account identity. Email and app-authored ownership claims are not accepted.
- `POST /api/billing/superwall/reconcile`: authenticated, bounded authoritative reconciliation
  after mobile initialization, purchase, or restore. The server fetches Superwall state for the
  current Clerk user rather than trusting a purchase payload supplied by the app.
- `POST|DELETE /api/billing/superwall/purchase-operation`: claims or releases an opaque,
  account-scoped mobile purchase fence. It never accepts a purchase or entitlement claim and
  never invokes the store itself.
- `POST /api/webhooks/creem`: raw-body `creem-signature` verification, idempotent event leasing,
  authoritative subscription retrieval, and order-safe reconciliation.
- `POST /api/webhooks/superwall`: raw-body Svix signature verification, configured project/app,
  store, environment, and product scoping, followed by authoritative subscription retrieval and
  order-safe reconciliation.

Redirects, callback query strings, and mobile client state are not accepted as server-side proof
of an entitlement. Lifecycle processing is separate from the two acquisition gates, so disabling
new purchases does not disable webhooks, reconciliation, management, or cancellation. See
[Ads and subscriptions](./monetization.md) for provider contracts and activation evidence.

The mobile adapter freezes one Clerk token for each billing operation and sends the captured
Clerk ID in `X-Girapphe-Expected-Billing-Subject`. Mobile mutation routes reject a missing or
mismatched expected subject before changing state. Successful entitlement, identity,
reconciliation, claim, and release responses echo `X-Girapphe-Billing-Subject`; the app rejects a
response that is not bound to the captured account. Browser callers of the shared entitlement
read may omit the expected-subject header.
