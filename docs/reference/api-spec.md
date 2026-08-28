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

Authenticated mobile `notes`, `graph`, and `practice` payloads preserve the
legacy flat fields and may additionally include `knowledge_type`,
`central_question`, `structured_content`, and `bundle_schema_version`. Mobile
create/update requests accept the same fields, reject invalid version-one
bundles, and keep quick notes untyped.

The path is exempt from Clerk cookie authentication because remote MCP clients
do not carry a browser session. The route still verifies its own PAT or OAuth
bearer token before reading a request body. Per-credential and per-user quotas
bound writes; OAuth discovery metadata is public under `/.well-known/`.

## Billing and entitlement endpoints

- `GET /api/billing/entitlement`: authenticated, no-store provider-neutral `ad_free` lookup
  used by mobile to honor Stripe, Toss, or reconciled RevenueCat state for the same Clerk user.
- `POST /api/billing/checkout`: same-origin, signed-in Stripe Checkout creation for a
  `monthly` or `annual` plan. Existing nonterminal subscriptions block a second checkout.
- `POST /api/billing/portal`: same-origin, signed-in Stripe Customer Portal session, limited
  to ten provider attempts per user in each ten-minute window. Excess attempts return `429`
  with `Retry-After: 600` before Stripe is called.
- `POST /api/billing/toss/prepare`: creates a signed-in, one-time Toss billing-authorization
  state bound to the user, customer key, and selected plan. It returns unavailable unless
  `TOSS_BILLING_ENABLED` is exactly `true` and the complete Toss configuration is present.
- `GET /api/billing/toss/callback`: verifies and consumes that server state before exchanging
  Toss's one-time authorization value; the callback redirects to a clean subscription URL.
- `POST /api/billing/toss/cancel`: same-origin cancellation of future Girapphe-scheduled Toss
  renewals. Already-paid access remains through its recorded period end.
- `POST /api/webhooks/stripe`: raw-body Stripe signature verification followed by an
  authoritative subscription fetch and idempotent entitlement reconciliation.
- `POST /api/webhooks/revenuecat`: configured authorization plus raw-body signature,
  app/environment checks, and authoritative RevenueCat subscriber reconciliation.
- `POST /api/internal/toss-subscription-charge`: bearer-protected production scheduler target.
  It is fail-closed behind the same explicit Toss gate and reconciles durable paid rows before
  attempting bounded due renewals.

Redirects, callback query strings, and mobile client state are not accepted as server-side proof
of a web entitlement. See [Ads and subscriptions](./monetization.md) for provider contracts and
operational activation requirements.
