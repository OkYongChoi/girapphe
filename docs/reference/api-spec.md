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
bundles, and keep quick notes untyped.

`GET /api/mobile?resource=notes&view=active|archive|trash` returns the
owner-scoped My Notes lifecycle view requested by the client. Mobile clients
archive or restore an archived item with `POST /api/mobile`, action
`archive-note` or `restore-archived-note`, the item `id`, and its positive
current `version`. A stale optimistic version returns `409 NOTE_STALE`; the
client must reload before retrying. Moving an item to Trash continues to use
`delete-note`, and `restore-note` restores a trashed item to the lifecycle
state it held before deletion.

`GET /api/mobile?resource=saved` returns owner-scoped `cards` plus authoritative
`stats` (`explainable`, `unclear`, and `reviewable`). New clients select the
Review or new-card intent from `reviewable`, not from saved-card list length.

`POST /api/mobile?resource=practice` accepts JSON `{ mode, cursor,
cycleOnEmpty }`, where `mode` is `new` or `review` and `cursor` is null or a
versioned opaque string of at most 1,024 characters. The request body is capped
at 2 KiB. The cursor is an untrusted seek hint, not authorization: every
request derives the actor from server authentication and reapplies owner
scoping. The server alternates public and owner-private lanes, traverses IDs in
deterministic ascending order within each lane, and uses `LIMIT 1` for each
database candidate query. The response is `{ card, stats, nextCursor, cycled }`;
the client sends `nextCursor` on the next read. Neither side retains a growing
card-ID array or request-global traversal state.

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
truncating the caller's round.

New mobile clients send
`X-Girapphe-Knowledge-Capabilities: expression-v1,event-chronology-v1,causal-relations-v1`.
When the header is absent, expression bundles are projected to legacy flat
content, structured event chronology is omitted, and causal relation rows are
filtered. This keeps older installed clients compatible without weakening the
server-side version-one validation. An older client receives `409`
`KNOWLEDGE_CAPABILITY_REQUIRED` instead of overwriting an expression or dated
event whose hidden structured fields it cannot preserve.

## Billing and entitlement endpoints

- `GET /api/billing/entitlement`: authenticated, no-store provider-neutral `ad_free` lookup
  used by web and mobile to honor any valid qualifying provider subscription for the same Clerk
  user. The response also reports provider/plan/management metadata and the independently
  configured web/mobile acquisition gates.
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
