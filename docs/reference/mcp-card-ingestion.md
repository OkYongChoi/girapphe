# MCP card-draft ingestion

Girapphe exposes a provider-neutral Streamable HTTP MCP endpoint at
`POST /api/mcp`. The endpoint has one write tool, `create_card_drafts`.

The tool creates a private, pending review batch. It cannot approve cards,
change learning state, or write to the public graph. A signed-in user must
review the batch in `/knowledge-inbox` and explicitly choose one of:

- add selected cards;
- add every pending card in this batch; or
- discard this batch.

“Add every card” is deliberately scoped to the displayed batch. It is not a
persistent auto-import setting.

## Authentication

Girapphe supports two authentication paths on the same MCP URL.

### Native OAuth connectors

The endpoint accepts Clerk-issued OAuth access tokens and advertises standard
MCP discovery through:

- `/.well-known/oauth-protected-resource/mcp`; and
- `/.well-known/oauth-authorization-server`.

OAuth clients receive only the provider's `profile` identity scope. Girapphe
then maps that authenticated user to its one narrow MCP permission:
`knowledge:drafts:create`. The access token and Clerk client ID are not stored
in ingestion records or rate-limit keys; a one-way user/client fingerprint is
used for request throttling.

Production activation still requires configuration in Clerk's **OAuth
applications** settings. Prefer Clerk's CIMD allowlist for clients that support
it. Enable Dynamic Client Registration only for clients that require DCR, and
configure `profile` as a default scope because some MCP clients omit `scope`.

### Personal access tokens

Create a scoped access token from the MCP Connections section of the Knowledge
Inbox. Send it only in the authorization header:

```http
Authorization: Bearer <token shown once by Girapphe>
```

Girapphe stores only a SHA-256 hash and the final four characters. Tokens have
the single `knowledge:drafts:create` scope, expire after 90 days, and can be
revoked. An account may keep up to 10 active tokens and create up to 20 in a
day (500 retained token records total).

This path remains useful for programmatic or local clients that can attach a
custom authorization header. OAuth and Girapphe PATs are distinguished before
authentication; an invalid Girapphe-prefixed token never falls through to the
OAuth verifier.

## Tool input

```json
{
  "provider": "claude",
  "request_id": "send-2026-08-16-001",
  "provenance": {
    "type": "current_conversation",
    "conversation_ref": "opaque-conversation-id"
  },
  "cards": [
    {
      "client_card_id": "concept-1",
      "title": "Bayes theorem",
      "summary": "Update a prior probability using observed evidence.",
      "explanation": "Posterior is proportional to likelihood times prior.",
      "topic": "확률",
      "tags": ["probability", "bayes"],
      "relations": [
        {
          "target_kind": "public",
          "target_id": "conditional_probability",
          "type": "prerequisite",
          "direction": "incoming",
          "weight": 0.8
        }
      ]
    }
  ]
}
```

Input boundaries:

- `provider`: `chatgpt`, `claude`, `gemini`, or `other`;
- `request_id`: required opaque retry/idempotency key;
- provenance must be exactly `current_conversation`;
- `cards` must contain only concepts the user explicitly selected in that
  current conversation; connectors must not infer a batch from the full
  transcript or silently revisit conversation history;
- 1–50 cards per request;
- relationship types are `prerequisite`, `related`, `generalizes`,
  `derived_from`, and `equivalent_to`;
- identifiers are opaque strings, not conversation text;
- unknown fields are rejected, and there is no transcript/history field.

The same user, provider, and request ID return the existing batch rather than
creating duplicates.

## Quotas and deployment

To bound writes from an automated or leaked client, Girapphe accepts at most
60 MCP requests per PAT or OAuth user/client pair per minute and 300 per user
per minute. It also accepts at most 250 new drafts per Girapphe PAT per hour
and 500 per user per hour (the user ceiling applies to OAuth ingestion).
Each user may hold at most 500 pending drafts, 20,000 ingestion batches,
100,000 draft records, and 50,000 personal knowledge items. Idempotent retries
of an existing request ID do not consume the draft quota again.

Quota checks and inserts are serialized per user in one database transaction.
Production does not run ingestion DDL in request handlers; apply
`apps/web/drizzle/migrations/0007_private_knowledge_ingestion.sql` before
enabling the MCP endpoint. PR previews keep the repository's existing isolated
database bootstrap, but only authenticated UI paths invoke it; invalid bearer
requests never execute DDL.

## Client compatibility

Programmatic OpenAI and Gemini remote-MCP clients can use authorization
headers. OAuth-discovering clients, including native connector surfaces, can
use the Clerk authorization flow once the deployment's allowed-client or DCR
setting is active. See the current [Clerk MCP server guide](https://clerk.com/docs/nextjs/guides/ai/mcp/build-mcp-server),
[OpenAI remote MCP tool reference](https://platform.openai.com/docs/guides/tools-connectors-mcp),
[Gemini function-calling documentation](https://ai.google.dev/gemini-api/docs/function-calling#remote_mcp),
and [Anthropic remote connector requirements](https://support.anthropic.com/en/articles/11503834-building-custom-integrations-via-remote-mcp-servers).

Connector availability and registration details still depend on each
provider's current plan, workspace policy, and MCP client implementation.

## Data lifecycle

Approval creates the following records atomically:

1. a private `user_knowledge_items` card;
2. its `user_graph_nodes` identity;
3. provenance in `knowledge_card_sources`; and
4. only relationships whose endpoints still exist and are owned by the user
   (or reference a valid public node).

Drafts never affect mastery scores. Deleting a personal card moves its private
node and incident private edges into the same 14-day trash lifecycle.
