# MCP revoked-token cleanup

Status: Active

## User outcome

A signed-in person sees active MCP connections by default in Settings, can
inspect revoked connections on demand, and can permanently remove a revoked
credential record without weakening token-creation limits or deleting the
provenance of knowledge that was already submitted for review.

## Scope

In scope:

- Hide revoked MCP connections from the default Settings list and expose a
  keyboard-operable show/hide control.
- Clear a newly issued one-time PAT from rendered state as soon as that exact
  connection is revoked.
- Allow only the owning user to permanently delete a token after revocation,
  together with that token's request-rate row.
- Preserve the rolling daily token-creation limit in domain-separated,
  minute-bucketed aggregate counters after the credential row is deleted.
- Localize the lifecycle controls in every supported web locale and retain
  mobile, RTL, focus, and 44 CSS pixel target behavior.

Out of scope:

- Deleting approved knowledge, pending review batches, or their opaque source
  token identifiers.
- Recovering a deleted PAT, deleting an active PAT directly, or changing MCP
  scopes, expiry, request quotas, OAuth behavior, or provider activation.
- Storing a raw PAT, token hash, final-four hint, connection label, or token ID
  in retained token-creation buckets.

## Acceptance criteria

- [x] `AC-01`: Settings omits revoked connections by default, reports the
  hidden-only empty state, and reveals the exact revoked rows only while the
  localized show/hide control is pressed.
- [x] `AC-02`: Revoking the exact newly created connection removes its one-time
  raw PAT surface immediately; only a revoked row exposes the separately
  confirmed permanent-delete action.
- [x] `AC-03`: Permanent deletion is authenticated, owner-scoped, and
  revoked-only; it removes the credential row and only its `token:<id>` request
  counter while retaining historical ingestion rows and opaque `mcp_token_id`
  values.
- [x] `AC-04`: Revoke-and-delete cycles do not reset the 20-per-day creation
  ceiling, including across a rolling-day boundary. Retained buckets contain
  only a domain-separated owner fingerprint, expiry-rounded minute timestamp,
  and aggregate count; expired buckets are cleaned in bounded batches during
  token create or permanent-delete actions, and account deletion removes all
  owner buckets.
- [x] `AC-05`: All lifecycle labels, confirmations, empty and error states are
  present in the six locale catalogs, and every new interactive control keeps
  a visible focus treatment and at least a 44 CSS pixel target.
- [x] `AC-06`: An exact-head authenticated Preview run creates one marker-owned
  PAT, proves immediate revoke redaction, proves revoked rows are hidden then
  explicitly revealed, permanently deletes that exact row, reloads Settings,
  and emits only sanitized JSON and post-delete screenshots.

## Privacy and data boundaries

The raw PAT still exists only in the one-time creation response and transient
component state. Revocation immediately invalidates authentication; permanent
deletion then removes the stored hash, final-four hint, label, scopes, and
lifecycle timestamps. Existing knowledge ingestion batches keep only their
opaque source token ID so review provenance does not disappear or become
reattributed.

The daily creation guard uses `mcp_request_rate_limits` with scopes derived
from the existing domain-separated account fingerprint plus an
expiry-rounded minute bucket. They cannot be reversed to a Clerk user ID and
contain no credential identity or content. A bucket remains after an
individual credential deletion solely to prevent delete-and-recreate quota
bypass. Expired buckets are removed in bounded batches during later token
create or permanent-delete actions; without another such action anywhere, a
non-reversible bucket can remain until the account-wide private-product purge
removes it.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `apps/web/e2e-authenticated/authenticated-mcp-provider-setup.spec.ts` and component source assertions exercise the default-hidden, explicit-reveal, and hidden-only empty states. |
| `AC-02` | The authenticated provider setup test checks immediate one-time-secret removal and the component exposes permanent deletion only in the revoked branch. |
| `AC-03` | `apps/web/src/lib/knowledge-ingestion.test.ts` covers foreign-owner and active-token no-ops, exact memory cleanup, and the locked database query's owner/revoked/rate predicates. |
| `AC-04` | `knowledge-ingestion.test.ts` performs 20 create/revoke/delete cycles, covers the rolling-day boundary, and rejects over-limit creation; `apps/web/src/lib/billing/account-deletion-source.test.ts` requires purge coverage for all bucket scopes. |
| `AC-05` | `apps/web/src/i18n/messages.test.ts`, web lint/typecheck, source inspection, and authenticated desktop/mobile RTL coverage. |
| `AC-06` | The exact-head `authenticated-performance.yml` Preview gate creates and revokes one marker-owned PAT, verifies immediate raw-secret removal, default-hidden and explicitly revealed revoked state, permanent deletion, reload absence, zero remaining active rows in both UI and route-fault cleanup paths, an empty clipboard, and sanitized JSON plus post-delete screenshots. |

## Rollout

No new table, column, Worker binding, secret, or provider activation is needed.
Migration `0026_mcp_token_creation_rate_buckets.sql` adds the partial cleanup
index to the existing generic MCP rate table and must precede Worker activation.
The Preview database and exact deployed revision must pass the authenticated
flow before merge. Rollback may remove the UI and delete action while leaving
non-secret buckets in place until a later lifecycle action or account deletion. A real
ChatGPT or Claude connection and first tool call remain external activation
evidence rather than proof supplied by this repository change.
