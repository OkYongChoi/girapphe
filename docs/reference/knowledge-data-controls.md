# Knowledge data controls

Girapphe keeps imported AI material inside the existing private knowledge
review boundary. It does not persist an uploaded provider archive or a raw
conversation transcript.

Leaving the local preview before confirmation creates no import job. The first
release has no background model work. After confirmation, ignoring a candidate
or discarding a batch marks its remaining candidates rejected and removes them
from active review, but their owner-scoped structured content remains in the
import record and full export until the user explicitly deletes that import.
Approved knowledge is deleted separately so import cleanup cannot silently
remove work the user already approved.

## Export

`GET /api/knowledge/export?scope=all` requires the current Clerk account and returns a
no-store JSON attachment. The export contains every owner-scoped derived
knowledge record:

- approved private knowledge and lifecycle metadata;
- revisions, source locators, evidence selectors, and private relationships;
- import-job metadata and pending or resolved candidates;
- reuse activity plus privacy-safe intelligence feedback and metric events.

MCP token identifiers and credential material are excluded. Export is never
paywalled.

## iOS and Android

The signed-in mobile Account screen always links to Knowledge Data Controls.
That native screen lists active and completed import jobs from the
owner-scoped mobile API and requires a destructive confirmation before deleting
one. Deletion remains retry-safe: an already deleted or non-owned ID returns the
same non-disclosing result, while the server preserves approved knowledge and
its hashed provenance.

Complete export uses a fixed first-party browser handoff at
`/account/data-controls-handoff`. A browser session that is already signed in
shows its account identity with localized page metadata and requires an
explicit confirmation before continuing to `/account/delete#knowledge-data`;
otherwise the handoff uses the fixed, allowlisted login `returnTo` for that same
confirmation. This prevents a silently reused browser session from being
mistaken for the account currently open in the app. The mobile Clerk bearer
token is never put in a URL or sent to
the browser.

The full export is not bounded enough for React Native's text-sharing API.
Keeping generation and download on the existing authenticated web endpoint
avoids loading a complete private export into JavaScript memory or adding a
direct native file-sharing dependency. The new Knowledge Data Controls UI and
handoff link still ship through the normal new iOS and Android binary.

## Deletion boundaries

`/account/delete` distinguishes three destructive actions:

- **Delete import job** is immediate and has no recovery window. It deletes the
  job, pending and ignored candidates, and the job's metric events. Approved
  knowledge is preserved and detached from the deleted job; its source and
  evidence provenance remains without transcript text. Selected-export source
  fingerprints are hashed.
- **Delete approved knowledge** uses My Notes and its visible 14-day Trash
  recovery window.
- **Delete account** is immediate and irreversible after Clerk
  reverification. It removes import jobs, drafts, approved private knowledge,
  revisions, evidence, relationships, intelligence feedback, reuse activity,
  learning state, credentials, and the authentication account.

The authenticated account-data UI and confirmation panel use the active locale
for these boundaries. The literal destructive confirmation token remains
`DELETE` in every locale so the server and client share one unambiguous
contract.

## Rollout and rollback

`AI_THINKING_HISTORY_ROLLOUT` accepts `off`, `allowlist`, or `all`. Development
defaults to `all`; production fails closed to `off` when the value is absent or
invalid. Checked-in Worker configuration uses `all` for Preview and
`allowlist` for production.

Set `AI_THINKING_HISTORY_USER_IDS` as a production Cloudflare secret containing
a comma- or whitespace-separated list of exact Clerk user IDs. Do not commit
the values. The allowlist is capped at 500 entries.

Rollback sets `AI_THINKING_HISTORY_ROLLOUT=off` and redeploys. This disables new
selected-export imports and intelligence generation only. Existing inbox
review, approved knowledge, context packs, export, and deletion remain
available so rollback cannot strand private user data.
