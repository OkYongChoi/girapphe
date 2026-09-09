# MCP provider token setup

Status: Implemented

## User outcome

A signed-in person can open Settings, choose ChatGPT or Claude, and
follow a provider-specific path that actually matches the client's supported
authentication: OAuth for the hosted chat app, or the scoped Girapphe PAT for
a header-capable API or developer client.

## Scope

In scope:

- Add ChatGPT and Claude setup choices beside the existing MCP token controls.
- Distinguish hosted-app OAuth from clients that accept a Girapphe bearer PAT.
- Generate endpoint-specific, copyable OpenAI Responses API and Claude Code
  configuration examples without embedding the one-time token value.
- Show current plan/workspace restrictions and link to official provider docs.
- Add authenticated desktop/mobile browser coverage for the rendered guide.

Out of scope:

- Storing OpenAI or Anthropic API keys, the selected provider, or the raw PAT.
- Enabling ChatGPT/Claude workspace features, Clerk client registration, or a
  third-party plan on behalf of the user.
- Sending an unselected conversation, approving a draft, or publishing private
  knowledge automatically.
- Changing MCP tools, token scopes, expiry, quotas, or database records.

## Acceptance criteria

- [x] `AC-01`: Settings offers native, keyboard-operable ChatGPT and
  Claude choices and shows only the chosen provider's instructions.
- [x] `AC-02`: Each provider explains the hosted-app OAuth route separately
  from a PAT-capable route, including the correct Girapphe endpoint and current
  plan, workspace, and administrator-role boundary.
- [x] `AC-03`: The OpenAI example uses the Responses API MCP tool's top-level
  `authorization` field and the Claude Code example uses Streamable HTTP with
  an Authorization header; both reference `GIRAPPHE_MCP_TOKEN` instead of
  embedding a secret.
- [x] `AC-04`: The rendered desktop and mobile guide can switch providers,
  copy a setup example, reflow without horizontal page overflow, and exposes no
  raw Girapphe PAT.
- [x] `AC-05`: Existing token creation remains one-time-display, owner-scoped,
  expiring, revocable, and limited to the selected knowledge scopes.

## Privacy and data boundaries

The detailed guide's ChatGPT/Claude selection is transient component state and
does not overwrite the separate browser-saved quick-guide preference. It is not
written to the server, provenance, or analytics. The raw Girapphe PAT remains in
the existing one-time result only; it is not passed into the setup-guide
component or included in copied examples. The examples refer to a process
environment variable and tell users to keep it out of browser code and shared
configuration. Existing selected-current-conversation, pending-review,
owner-scope, and explicit-approval boundaries do not change.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/e2e-authenticated/authenticated-mcp-provider-setup.spec.ts` selects both native radio controls. |
| `AC-02` | `apps/web/src/lib/mcp/provider-setup.test.ts` checks provider/auth boundaries and official-source links. |
| `AC-03` | `apps/web/src/lib/mcp/provider-setup.test.ts` checks both generated token configurations and unsafe endpoint rejection. |
| `AC-04` | Authenticated Preview desktop/mobile Playwright evidence plus screenshots from `authenticated-mcp-provider-setup.spec.ts`. |
| `AC-05` | Existing MCP token/server regression suite and final diff inspection; no action, schema, or migration change. |

## Rollout

No database migration, Worker binding, secret, or third-party activation is
introduced. Existing tokens remain compatible. The provider guide can be
rolled back independently without invalidating tokens or changing pending
drafts.

Repository checks can prove the generated client configuration, rendered
behavior, MCP authentication challenge, and Girapphe privacy boundary. A real
ChatGPT or Claude connection still depends on that provider's current plan,
workspace policy, and OAuth/client availability; treat an actual provider
sign-in and tool call as a separate activation check rather than inferring it
from deployment.
