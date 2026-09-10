# Settings and AI connections

Status: Implemented

## User outcome

People can find one Settings surface for AI connection setup, reusable-context
defaults, language, account access, and private-data controls. Girapphe clearly
separates the external AI app/model that creates a response from the scoped MCP
connection that receives only content the person explicitly sends for review.

## Scope

In scope:

- Add an authenticated web Settings route and a compact header entry point.
- Move MCP token creation, permission review, status, one-time secret display,
  and revocation from Candidate Inbox into Settings.
- Let the person choose which external AI app's short, localized connection
  guide is shown. The exact model remains selected in that external app.
- Store only versioned, enum-only browser preferences for the connection guide
  and default Context Pack format, then apply the format to both Topic Context
  Packs and Thinking History reuse.
- Group language, subscription, import/review, support, and private-data links
  without duplicating their existing workflows.

Out of scope:

- Routing an inference request, storing provider API keys, or claiming that
  Girapphe can change the model selected by ChatGPT, Claude, Gemini, or another
  MCP client.
- Automatic conversation access, automatic draft approval, or public graph
  publication.
- Dark mode, Recall notification controls, billing-provider activation, and a
  new mobile navigation destination. Mobile keeps its existing Account adapter.

## Acceptance criteria

- [x] `AC-01`: A signed-in web user can open Settings from the compact account
  area without adding another item to the already scrollable primary navigation.
- [x] `AC-02`: Settings exposes a keyboard-operable Connect disclosure with a
  native AI-app selector, explains that the exact model is chosen externally,
  distinguishes ChatGPT web OAuth from server-side PAT use, and preserves the
  existing scoped-token create, one-time display, status, expiry, last-use, and
  revoke behavior.
- [x] `AC-03`: Candidate Inbox links to Settings for connection management and
  no longer embeds the full token-management form.
- [x] `AC-04`: The chosen connection guide and Context Pack format are stored as
  validated enum-only browser preferences; malformed or unavailable storage
  falls back to ChatGPT and Markdown without breaking rendering.
- [x] `AC-05`: The saved Context Pack format becomes the default in Topic Hub
  and Thinking History while the user can still override it for the current
  action.
- [x] `AC-06`: Settings groups language, review/import, subscription, support,
  privacy, export, and account-deletion destinations with touch targets of at
  least 44 CSS pixels and usable mobile/RTL reflow.
- [x] `AC-07`: The change stores no model credential, conversation text, private
  knowledge, or token secret in browser preferences; MCP tokens remain hashed,
  owner-scoped, expiring, revocable, and shown in raw form only once. When that
  same token is successfully revoked, Settings immediately clears its transient
  raw-secret state; a failed revoke leaves that transient state unchanged.
- [x] `AC-08`: Every preference write refreshes the polite save announcement,
  including consecutive successful saves with the same localized message.

## Privacy and data boundaries

The AI-app choice is only a local setup-guide preference. It is not trusted as
provenance and never changes the `provider` supplied by an MCP request. Context
format is likewise local presentation state. Both values are fixed enums and
contain no authored or private knowledge.

MCP token records keep their current server-owned lifecycle and owner scope.
The raw secret is returned once, is never placed in local storage, and is not
recoverable from Settings later. A successful revoke of the just-created token
also removes that secret from transient component state without deleting the
server-owned token record. If revocation fails, Settings reports the error and
keeps that transient state unchanged. With the corresponding scope, a connected
AI client can create pending drafts from content the user explicitly submits. A
separately granted context-read scope can retrieve bounded confirmed knowledge
by explicit item IDs or a recent-topic query. It cannot read conversation
history or approve, publish, or mutate public knowledge.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/e2e-authenticated/authenticated-settings.spec.ts` and navbar source inspection. |
| `AC-02` | `authenticated-settings.spec.ts` plus existing MCP token scope/quota tests in `apps/web/src/lib/knowledge-ingestion.test.ts`. |
| `AC-03` | `apps/web/src/app/knowledge-inbox/page.tsx` source inspection and the final browser suite. |
| `AC-04` | `apps/web/src/lib/settings-preferences.test.ts` and the authenticated reload assertion in `authenticated-settings.spec.ts`. |
| `AC-05` | Preference tests, source inspection of both consumers, and the Preview-gated Thinking History assertion in `authenticated-settings.spec.ts`. |
| `AC-06` | Desktop/mobile English and Arabic assertions in `authenticated-settings.spec.ts`, including the English guide's explicit LTR boundary inside RTL Settings, plus all six localization catalog checks. |
| `AC-07` | Preference parser and MCP token regressions, the revoke control-flow source regression in `apps/web/src/lib/mcp/provider-setup.test.ts`, the one-run normal Preview PAT check in `authenticated-mcp-provider-setup.spec.ts`, and the post-create route-fault fallback in `authenticated-mcp-provider-setup-fault.spec.ts`. |
| `AC-08` | Two consecutive save assertions plus replacement of the first live-region node in `authenticated-settings.spec.ts`. |

The authenticated Settings preference test uses the dedicated synthetic owner
and does not create or revoke an MCP token. The separate provider-setup test
permits PAT mutation only once per PAT test in the desktop project when the
explicit closeout flag, testing-token Preview Worker hostname, and
marker-validated synthetic account all match. Setup uses that same gate and
takes the account-lifecycle then token advisory lock before resetting the
synthetic owner's prior tokens.
Each label contains the unique
`authenticated-overlay-e2e:mcp-pat:<random UUID>` run marker. The normal path
redacts the one-time secret immediately after capture, clears the clipboard
with readback, revokes through Settings, and verifies under the account and
token advisory locks that the exact owner, label, marker, and SHA-256 hash have
zero active matches. If that normal create attempt commits but the one-time PAT
cannot be captured, the same locked owner/label/random-marker fallback revokes
the exact synthetic row and the run still fails without accepted evidence. The
normal evidence step keeps the original timeout while a separate cleanup
reserve is added to the enclosing test before Create, ensuring that evidence
timeout cannot skip `finally` cleanup.

The separate fault path ignores Clerk and other background traffic and
intercepts only the exact same-origin Settings Server Action POST carrying the
unique run marker. It lets that create POST commit, extracts the one-time PAT
only in process memory, replaces it in the fulfilled response, then faults both
UI cleanup paths. The database fallback runs after the create attempt even when
clipboard, response-capture, or UI assertions error; the evidence itself still
requires PAT capture and exactly two UI faults. The same locked exact predicate and hash check
revokes the row and proves `active=0` before the original sentinel Error object
is rethrown unchanged. If its create commits but response capture fails, a
locked owner/label/random-marker fallback still revokes the exact synthetic row,
then fails the run without producing accepted evidence.
Provider JSON evidence and the generated job summary contain counts and
booleans only. Automatic screenshots are disabled in PAT-bearing specs and
automatic authenticated accessibility error snapshots are disabled suite-wide;
the only PAT-path screenshots are explicit success captures after exact
revocation. The summarizer accepts the two mutation paths only from distinct,
exactly named, versioned, kind-tagged artifacts with mutually exclusive fields.

## Rollout

No database migration, new provider, secret, Worker binding, or provider-side
activation is introduced. Existing MCP tokens remain compatible and continue
to work. Removing this UI restores the old Inbox entry point without changing
token rows or pending/approved knowledge.

The local synthetic-session smoke proves the signed-in layout and browser-local
preference behavior. Preview and production smoke must still verify the exact
deployed revision and authentication boundary; an unauthenticated redirect is
not evidence of the signed-in Settings contents.

The actual model is still selected in the connected external AI product. A
future Girapphe-owned inference feature requires a separate allowlisted model
catalog, execution purpose, consent/retention/cost policy, owner-scoped server
contract, migration, deletion/export behavior, and provider activation proof.
