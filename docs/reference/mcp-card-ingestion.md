# MCP card-draft ingestion

Girapphe exposes a provider-neutral Streamable HTTP MCP endpoint at
`POST /api/mcp`. The endpoint has two compatible write tools and one
owner-scoped read tool:

- `create_knowledge_bundle_drafts` for versioned structured knowledge; and
- `create_card_drafts` for existing clients, adapted to a `concept` bundle;
  and
- `get_topic_context` for explicit reuse of confirmed knowledge.

The tool creates a private, pending review batch. It cannot approve cards,
change learning state, or write to the public graph. A signed-in user must
review the batch in `/knowledge-inbox` and explicitly choose one of:

- save a reviewed candidate as new;
- merge or update it after selecting and comparing an owner-scoped match; or
- ignore the candidate.

There is no persistent auto-import or auto-merge setting. Every candidate
crosses this review boundary independently.

## Authentication

Girapphe supports two authentication paths on the same MCP URL.

### Native OAuth connectors

The endpoint accepts Clerk-issued OAuth access tokens and advertises standard
MCP discovery through:

- `/.well-known/oauth-protected-resource/mcp`; and
- `/.well-known/oauth-authorization-server`.

OAuth clients receive only the provider's `profile` identity scope. Girapphe
currently maps that authenticated user only to `knowledge:drafts:create`.
OAuth context reads remain disabled until a custom consent surface can request
and explain `knowledge:context:read`. The access token and Clerk client ID are not stored
in ingestion records or rate-limit keys; a one-way user/client fingerprint is
used for request throttling.

Production activation still requires configuration in Clerk's **OAuth
applications** settings. Prefer Clerk's CIMD allowlist for clients that support
it. Enable Dynamic Client Registration only for clients that require DCR, and
configure `profile` as a default scope because some MCP clients omit `scope`.

### Personal access tokens

Create a scoped access token from the **AI connections** section in Settings at
`/settings#ai-connections`. Send it only in the authorization header:

```http
Authorization: Bearer <token shown once by Girapphe>
```

Girapphe stores only a SHA-256 hash and the final four characters. PATs receive
explicit scopes: `knowledge:drafts:create` is the default, and
`knowledge:context:read` must be selected for Topic Context reuse. Tokens
expire after 90 days and can be revoked. Existing tokens are not automatically
upgraded when a new scope becomes available; create a new token when the
additional permission is needed. An account may keep up to 10 active tokens
and create up to 20 in a day (500 retained token records total).

This path remains useful for programmatic or local clients that can attach a
custom authorization header. OAuth and Girapphe PATs are distinguished before
authentication; an invalid Girapphe-prefixed token never falls through to the
OAuth verifier.

### Provider-specific setup

The **AI connections** disclosure in Settings keeps the hosted-chat and
bearer-token paths separate so a
user does not paste a Girapphe PAT into an unsupported connector field.

For **ChatGPT web**, a Business admin or owner enables developer mode and opens
Workspace settings → Apps → Create. On Enterprise/Edu, an admin first grants
developer-mode access through RBAC; an authorized user then enables it in
Settings → Apps → Advanced Settings. Add the Girapphe
`https://www.girapphe.com/api/mcp` endpoint, choose OAuth, scan tools, and
complete the Girapphe sign-in. Full write-capable MCP apps currently require a
Business or Enterprise/Edu web workspace, and only admins/owners publish them;
Pro custom apps are limited to read/fetch actions and therefore cannot create
Girapphe drafts. See OpenAI's current
[ChatGPT MCP app guide](https://help.openai.com/en/articles/12584461).

A server-side **OpenAI Responses API** integration can use a Girapphe PAT in
the remote MCP tool's top-level `authorization` field. Put the raw PAT value in
`GIRAPPHE_MCP_TOKEN`; the Responses API turns that field into MCP
authorization, so do not add a second `Bearer` wrapper. Do not embed the value
in browser code or a committed file. The Settings guide generates the exact
endpoint-specific tool object and keeps tool approval enabled. Its allowlist
includes the draft-creation tools plus `get_topic_context`; the MCP server still
exposes only the tools authorized by the PAT's selected scopes. See OpenAI's
current
[remote MCP reference](https://platform.openai.com/docs/guides/tools-connectors-mcp).

For **Claude web or Desktop**, Free, Pro, and Max users open Customize →
Connectors, choose + → Add custom connector, add the public Girapphe MCP
endpoint, select Connect, and complete the Girapphe OAuth sign-in. Free plans
are limited to one custom connector. On Team and Enterprise, an owner first
adds it under Organization settings → Connectors; members then connect to and
enable it individually. Remote custom connectors are currently available on
Free, Pro, Max, Team, and Enterprise. See Anthropic's current
[custom connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

**Claude Code** accepts the PAT through a custom Streamable HTTP header. Store
the token as `GIRAPPHE_MCP_TOKEN`, then use the Settings guide's generated
`claude mcp add-json` command. The user-scoped configuration retains the
environment-variable reference instead of writing the raw secret into project
configuration. See Anthropic's current
[Claude Code MCP reference](https://code.claude.com/docs/en/mcp).

Provider plan, workspace policy, connector registration, and a successful
OAuth sign-in or bearer-authenticated tool call remain external activation
gates. Deploying this UI or receiving an MCP authentication challenge is not
proof that either provider is connected.

### Browser settings boundary

Settings stores only a versioned, enum-only browser preference for which
external AI client's setup guide to show (`chatgpt`, `claude`, `gemini`, or
`other`) and the default Context Pack format (`markdown`, `yaml`, or `json`).
It stores no MCP token, provider credential, conversation text, private
knowledge, or provenance. The guide preference does not override the
`provider` declared by an MCP request, and the exact AI model remains selected
inside the connected external client. Missing, malformed, or unavailable
browser storage falls back to the ChatGPT guide and Markdown.

## Structured bundle input

`create_knowledge_bundle_drafts` accepts a strict discriminated union. Every
bundle has `title`, `central_question`, `summary`, `topic`, `tags`,
`knowledge_type`, `structured_content`, and `bundle_schema_version: 1`.
`tags` may be empty, while the other common text fields must be non-blank. The
ten discriminators are:

- `concept`: definition, key points, examples, non-examples, misconceptions;
- `procedure`: goal, prerequisites, steps, branches, failure responses, completion criteria;
- `comparison`: targets, criteria values, commonalities, differences, choice guide;
- `mechanism`: causes, stages, results, conditions, exceptions;
- `structure`: purpose, components/hierarchy, internal relations, boundaries; and
- `claim_evidence`: claim, sourced evidence, counterevidence, scope, limitations, confidence;
- `question`: question, context, known facts, hypotheses, next steps, answer summary, open/answered status;
- `decision`: decision, context, options/tradeoffs, criteria, rationale, reconsideration triggers, outcome; and
- `event`: event, occurrence text, optional BCE/CE chronology, context, changes, causes, consequences; and
- `expression`: BCP 47 language, expression, pronunciation, meanings, translations, register, nuance, contexts, examples, contrasts, and common mistakes.

```json
{
  "provider": "claude",
  "request_id": "send-2026-08-28-001",
  "provenance": { "type": "current_conversation", "conversation_ref": "opaque-id" },
  "bundles": [{
    "client_bundle_id": "release-procedure",
    "title": "Safe release",
    "central_question": "How do I release safely?",
    "knowledge_type": "procedure",
    "summary": "Validate, release, and verify.",
    "structured_content": {
      "type": "procedure",
      "goal": "Release without losing verification boundaries.",
      "prerequisites": ["Passing checks"],
      "steps": [{ "title": "Deploy", "detail": "Use the protected workflow." }],
      "branches": [], "failure_modes": [], "done_when": ["Production smoke passes"]
    },
    "bundle_schema_version": 1
  }]
}
```

## Compatible card input

`create_card_drafts` retains its original input shape:

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
  `derived_from`, `equivalent_to`, `supersedes`, `answers`, `supports`,
  `contradicts`, `causes`, `contributes_to`, `enables`, and `inhibits`;
- proposed causal relationships require at least one valid
  `evidence_selector_indexes` entry referring to evidence on the same draft;
- optional evidence is selector-only (`message`, `text_position`,
  `line_range`, or `external_ref`); transcript text and excerpt fields are
  rejected;
- identifiers are opaque strings, not conversation text;
- unknown fields are rejected, and there is no transcript/history field.

Both tools may include a bounded HTTPS `provenance.source_url` and an ISO-8601
`provenance.discussed_at`. Source URLs reject embedded credentials and are
stored without query strings or fragments. Opaque conversation references
reject URL-like `scheme://` values. These locate the explicitly selected current
conversation without accepting its transcript. The adapter uses the card title as the central question, the summary as the
concept definition, and the explanation as a key point. It shares the same
authentication, idempotency, request-size, rate, quota, and pending-review
boundary as the structured tool.

The same user, provider, and request ID return the existing batch rather than
creating duplicates.

## Confirmed Topic Context

`get_topic_context` requires `knowledge:context:read` and a topic plus one
strict selection:

- `{ "type": "items", "item_ids": [...] }` contains 1–100 unique,
  owner-scoped confirmed item IDs; or
- `{ "type": "recent_topic", "limit": 1..50 }` requests a bounded recent
  selection from that topic.

The request also chooses `json`, `markdown`, or `yaml`. Unknown fields,
pending/archived/foreign items, duplicated IDs, transcript text, and mixed
selection shapes are rejected. Successful output contains canonical knowledge
plus selector-only provenance and records a `Reused` lifecycle activity for
every returned item. It never returns a raw transcript.

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
`apps/web/drizzle/migrations/0007_private_knowledge_ingestion.sql` through
`apps/web/drizzle/migrations/0016_conversation_knowledge_hub.sql` before
enabling the MCP endpoint. PR previews keep the repository's existing isolated
database bootstrap, but only authenticated UI paths invoke it; invalid bearer
requests never execute DDL.

After migration, treat schema presence as a release gate: `user_knowledge_items`
must expose `version`, `dedupe_key`, and the temporal/lifecycle columns, and
`knowledge_item_revisions`, `knowledge_item_activity`,
`knowledge_item_supersessions`, and `knowledge_evidence_spans` must all exist.
Run `pnpm --filter @stem-brain/web db:migrate` for the target database and the
repository's `pnpm harness:deploy` gate before enabling the new review UI.

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

Approval or an explicit merge/update creates the following records atomically:

1. a private `user_knowledge_items` item whose structured JSON is authoritative;
2. its `user_graph_nodes` identity;
3. immutable version history and lifecycle activity;
4. provenance in `knowledge_card_sources` plus selector-only evidence metadata;
   and
5. only relationships whose endpoints still exist and are owned by the user
   (or reference a valid public node).

Drafts never affect mastery scores. Deleting a personal card moves its private
node and incident private edges into the same 14-day trash lifecycle.
Existing items and already-pending drafts remain untyped (`knowledge_type IS
NULL`) until the user explicitly converts or edits them. A bundle remains one
private graph node; its steps and components do not expand into graph nodes.
