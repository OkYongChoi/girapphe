# Data Model

## Overview

The platform maintains six main data groups:

1. Graph structure (`graph_nodes`, `graph_edges`)
2. User knowledge state (`user_knowledge_states`)
3. Legacy card model (`knowledge_cards`, `user_card_states`)
4. Private user graph and lifecycle (`user_knowledge_items`,
   `user_graph_nodes`, `user_graph_edges`, revisions, activity,
   supersessions, and evidence selectors)
5. Conversation draft ingestion and scoped reuse
   (`knowledge_ingestion_batches`, `knowledge_card_drafts`,
   `knowledge_card_sources`, `mcp_access_tokens`,
   `mcp_request_rate_limits`, `mcp_deleted_account_markers`)
6. Billing and entitlements (`billing_provider_accounts`,
   `billing_subscriptions`, `billing_checkout_attempts`,
   `billing_acquisition_blocks`, `billing_webhook_events`, and
   `billing_account_operations`)

Card model now separates:

- Knowledge state (`known` or `unknown`)
- Progress state (`new`, `learning`, `review`)

## Graph Node Model

Canonical fields:

- `id`: unique stable node key (string)
- `label`: display title
- `domain`: category/subdomain
- `level`: hierarchy depth (`0-5`)
- `difficulty`: difficulty (`1-5` in MVP)
- `type`: `concept | theorem | algorithm | model`
- `created_at`, `updated_at`

## Graph Edge Model

Canonical fields:

- `source`: upstream node id
- `target`: downstream node id
- `type`: semantic relation
- `weight`: edge strength (`0.0-1.0`)

Supported edge types:

- `prerequisite` (directed)
- `related` (bidirectional)
- `generalizes` (directed)
- `derived_from` (directed)
- `equivalent_to` (bidirectional)

## User Knowledge State Model

Canonical fields:

- `user_id`
- `node_id`
- `knowledge_state`: tri-state (`0`, `0.5`, `1`)
- `confidence`: `0.0-1.0`
- `last_updated`
- `first_known_at` (set when state first reaches `1`)

## Private Knowledge Graph

Every saved personal card has a user-owned graph node. Private edges may join:

- one private node to another node owned by the same user; or
- a private node to an existing public `graph_nodes` record.

Exactly one private/public endpoint column is populated on each side of an
edge. App-layer owner checks prevent cross-user private links. Symmetric
`related` and `equivalent_to` endpoints are normalized before insertion, and
new `prerequisite` edges are rejected when they would close a cycle.

Personal cards, nodes, and incident edges share the 14-day trash lifecycle.
Adding a card does not update `user_knowledge_states` or imply mastery.

Confirmed items expose an owner-scoped Topic Hub projection: overview, open
questions, local relationships, timeline, immutable version history,
provenance, and reusable context. Archive removes an item from active Topic
views without deleting its content, relations, provenance, or history.
`knowledge_item_revisions` stores immutable versions,
`knowledge_item_activity` stores events such as confirmation, verification,
revision, archive/restore, supersession, and reuse,
`knowledge_item_supersessions` links canonical replacements. New links carry an
owner-scoped live-reference pair that becomes null when a replacement is
permanently deleted, while the durable replacement ID remains as a tombstone so
the prior item does not silently become canonical again. Rows created before
migration `0017` intentionally keep a null live-reference pair even if the
replacement still exists; null therefore is not a universal liveness signal.
`knowledge_evidence_spans` stores source positions without transcript text.
`knowledge_relation_evidence` links an owner-scoped private edge to the reviewed
selector rows that support it; it does not copy source text.
Accepted HTTPS source URLs reject embedded credentials and drop query strings
and fragments before persistence; opaque conversation references reject
`scheme://` values.

## Conversation Draft Ingestion

`knowledge_ingestion_batches` is idempotent by user, provider, and request ID.
Its scope is constrained to `current_conversation`. `knowledge_card_drafts`
stores editable pending concepts, explicit tags, version numbers, and proposed
typed relationships. Both it and `user_knowledge_items` have nullable
`knowledge_type`, `central_question`, `structured_content`, and
`bundle_schema_version` fields. Null identifies a legacy quick note. For a
typed item, version-one structured JSON is authoritative; flat summary/content
is regenerated as a compatibility projection for search, graph, practice, and
older clients. Approval creates the personal card, private node, source
record, and valid edges in one database transaction.

The version-one discriminator set is `concept`, `procedure`, `comparison`,
`mechanism`, `structure`, `claim_evidence`, `question`, `decision`, `event`,
and `expression`. Question bundles carry an explicit open/answered status, decision
bundles retain options and reconsideration conditions, and event bundles retain
their occurrence text, changes, causes, and consequences. Events may also carry
structured BCE/CE chronology (including approximate and range precision), while
`occurred_at` remains the compatibility display label. Expression bundles retain
their BCP 47 language, meanings, translations, pronunciation, register, nuance,
usage contexts, examples, contrasts, and common mistakes. These remain bundle
content fields; they do not change the database lifecycle or graph-edge model.

Private graph edges additionally support the directed causal types `causes`,
`contributes_to`, `enables`, and `inhibits`. Extracted and model-inferred causal
suggestions must reference reviewed evidence selectors before approval. The
public STEM graph edge vocabulary is unchanged.

The private graph keeps one node per bundle. Internal steps, components, and
evidence remain inside structured JSON. Existing public graph node types and
existing personal rows are never automatically converted.

`mcp_access_tokens` stores only token hashes, a final-four display hint,
explicit `knowledge:drafts:create` and/or `knowledge:context:read` scopes,
expiry, last-use time, and revocation time. Draft creation is the default;
existing tokens are not upgraded when context read becomes available. Raw
tokens are returned once at creation. Ingestion batches retain the
originating `mcp_token_id` so atomic per-token and per-user write quotas can be
enforced without storing bearer secrets. `mcp_request_rate_limits` keeps one
bounded rolling-window counter per token and user; it never stores raw tokens.
`mcp_deleted_account_markers` permanently stores only a domain-separated
SHA-256 fingerprint, never a raw Clerk user ID, and blocks stale account-owned
knowledge, practice, PAT, OAuth, MCP, and new billing-initiation writes after account deletion.

## Billing and Entitlements

`billing_provider_accounts` maps a Clerk user ID to a stable provider customer or
app-user identity, scoped by provider and test/production environment. Email is
not an ownership key. A provider identity already owned by another Clerk user
cannot be reassigned by an event payload.

`billing_subscriptions` is the provider-neutral projection for Creem,
Superwall/App Store, Superwall/Play Store, and any preserved historical provider
record. For Superwall, `provider_subscription_id` is the stable subscription
resource `item.id`; `provider_root_transaction_id` separately correlates the
store root/original transaction and `provider_store_subscription_id` retains the
current store transaction/order, which may rotate on renewal. It also retains
store, product, environment, plan, normalized status, period, renewal state,
provider event ordering, last successful reconciliation, and fixed billing or
verification grace. The canonical `ad_free` decision is the union of every
currently valid qualifying row, not the last row written.

`billing_checkout_attempts` records the server-selected Creem annual product and
idempotent request before a provider call. Exactly one creating, open, or
indeterminate attempt may exist per user. An uncertain response remains blocked
until provider or operator reconciliation; local expiry does not prove no charge.

`billing_acquisition_blocks` preserves duplicate-subscription and manual-review
holds independently of subscription rows. Detecting a later valid provider row
does not delete financial history. V1 resolution is an explicit operator action
after cancellation/refund and reconciliation.

`billing_webhook_events` is an environment-aware idempotency ledger with bounded
processing leases, attempts, failure identifiers, provider-event time, and final
completion time. A handler marks an event complete only after its local state
update succeeds, so a duplicate can finish a partial failure. Order-safe
subscription writes prevent old events from replacing newer provider state.

`billing_account_operations` stores short-lived, owner-tokened acquisition
locks under domain-separated hashed account scopes. Account deletion uses the
same per-account advisory fence and a permanent hashed deletion marker before
new billing initiation writes. No operation row contains a raw Clerk user ID.

## Tri-State Semantics

- `0`: unknown
- `0.5`: partial
- `1`: known

The system may use continuous intermediate values internally for diffusion, but persisted state is normalized back to tri-state.

## SQL Tables

Defined in `apps/web/schema.sql`.

Main graph tables:

- `graph_nodes`
- `graph_edges`
- `user_knowledge_states`

Private knowledge and ingestion tables:

- `user_knowledge_items`
- `user_graph_nodes`
- `user_graph_edges`
- `knowledge_ingestion_batches`
- `knowledge_card_drafts`
- `knowledge_card_sources`
- `knowledge_item_revisions`
- `knowledge_item_activity`
- `knowledge_item_supersessions`
- `knowledge_evidence_spans`
- `knowledge_relation_evidence`
- `mcp_access_tokens`
- `mcp_request_rate_limits`
- `mcp_deleted_account_markers`

Billing tables:

- `billing_provider_accounts`
- `billing_subscriptions`
- `billing_checkout_attempts`
- `billing_acquisition_blocks`
- `billing_webhook_events`
- `billing_account_operations`

Card tables:

- `knowledge_cards`
- `user_card_states`
  - Legacy compatibility field: `status` (`known` | `saved`)
  - Canonical fields: `knowledge_state`, `progress_state`, `due_at`

Key constraints:

- `graph_nodes.type` constrained enum-like check.
- `graph_edges.type` constrained enum-like check.
- `graph_edges.weight` in `[0, 1]`.
- `user_knowledge_states.knowledge_state` in `(0, 0.5, 1)`.

## Indexing Strategy

- By node domain and level for taxonomy browsing.
- By edge source/target/type for traversal and neighborhood lookup.
- By user_id and node_id for fast personalization reads.

## Versioning Guidance

- Do not repurpose existing node IDs.
- Additive changes preferred (new nodes/edges) over destructive edits.
- If edge semantics change materially, document migration in `docs/operations/development.md`.
