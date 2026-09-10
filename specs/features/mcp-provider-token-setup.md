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
- Localize the complete provider guide in English, Arabic, Spanish, Hindi,
  Japanese, and Simplified Chinese without translating endpoint URLs or copied
  configuration.
- Add authenticated desktop/mobile browser coverage for the rendered guide.

Out of scope:

- Storing OpenAI or Anthropic API keys, the selected provider, or the raw PAT.
- Enabling ChatGPT/Claude workspace features, Clerk client registration, or a
  third-party plan on behalf of the user.
- Sending an unselected conversation, approving a draft, or publishing private
  knowledge automatically.
- Changing MCP tools, token scopes, expiry, quotas, schema, or production token
  behavior. Preview evidence may mutate only the dedicated synthetic owner.

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
- [x] `AC-06`: Every user-facing provider-guide instruction, status, and action
  comes from the six-locale message catalogs while official URLs, provider plan
  boundaries, administrator roles, and PAT privacy guidance stay equivalent.

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
| `AC-04` | Authenticated Preview desktop/mobile Playwright evidence plus English and Arabic RTL screenshots from `authenticated-mcp-provider-setup.spec.ts`. |
| `AC-05` | Existing MCP token/server regressions plus one marker-validated testing-token Preview run. Setup and both PAT specs share the explicit PR Preview hostname plus `E2E_REQUIRE_MCP_PAT_CLOSEOUT=true` mutation gate, and setup takes account/token locks before resetting only that synthetic owner. Both PAT paths resolve and validate the Clerk synthetic owner before Create, then reuse that cached owner so post-create cleanup cannot wait on Clerk. Immediately before Create, both paths account for elapsed setup work, bound evidence to the original timeout, and preallocate a separate 180-second cleanup reserve. They track the exact marker-bearing Server Action through `route.fetch()` and response fulfillment, retry exact owner/full-label/run-marker cleanup while it settles, and require a new successful exact cleanup after action/request quiescence; captured PATs additionally take the hash path. An absent row or failed/unknown transport is not closeout, transient visibility/lock/connection failures retry with database timeouts clamped to the remaining reserve, and invalid owner/marker input fails immediately. The normal path verifies the exact owner/label/run-marker/hash row has `active=0`, proves revoked rows are hidden until requested, reveals the exact revoked row, then permanently deletes it and proves reload absence before its safe screenshot. `authenticated-mcp-provider-setup-fault.spec.ts` ignores background traffic, intercepts only the exact Settings Server Action carrying its unique marker, commits that synthetic create POST, redacts its response, faults both UI cleanup paths, and always reaches locked database fallback. A capture failure uses exact owner/label/run-marker emergency cleanup but still fails the evidence run after safe marker cleanup. Automatic PAT failure screenshots and accessibility error snapshots are disabled. The summarizer validates exact schema, kind, project, filename, lifecycle booleans, truth-valued fallback, and mutually exclusive fields before accepting one normal revoke/delete artifact plus one distinct route-fault fallback artifact; production does not enable this mutation requirement. |
| `AC-06` | `apps/web/src/lib/mcp/provider-setup.test.ts` verifies all provider-guide keys, plan/admin/PAT markers, and genuine availability translations across every supported locale; `apps/web/src/i18n/messages.test.ts` verifies catalog and placeholder parity; authenticated Arabic Playwright verifies RTL layout with an LTR configuration block. |

## Rollout

The provider guide itself introduces no database migration, Worker binding,
secret, or third-party activation. The companion revoked-token cleanup uses
the additive `0026_mcp_token_creation_rate_buckets.sql` index migration;
existing tokens remain compatible. The provider guide can be rolled back
independently without invalidating tokens or changing pending drafts.

Repository checks can prove the generated client configuration, rendered
behavior, MCP authentication challenge, and Girapphe privacy boundary. A real
ChatGPT or Claude connection still depends on that provider's current plan,
workspace policy, and OAuth/client availability; treat an actual provider
sign-in and tool call as a separate activation check rather than inferring it
from deployment.
