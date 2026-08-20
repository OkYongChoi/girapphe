# WebMCP browser tools

Girapphe exposes a small set of page-scoped WebMCP tools as a progressive enhancement.
They help a browser agent operate the UI that the user has opened; they do not replace the
authenticated remote MCP endpoint at `/api/mcp`.

WebMCP is experimental. The implementation follows the current
[WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/) and
[Chrome imperative API guidance](https://developer.chrome.com/docs/ai/webmcp/imperative-api).
Recheck browser and origin-trial status before a production rollout.

## Tools

| Route | Tool | Boundary |
| --- | --- | --- |
| `/knowledge` | `search_knowledge` | Applies explicit keyword or `#tag`, domain, status, and added-date filters to the local UI. Matching is case-insensitive substring matching with AND semantics, never semantic or vector search. The response includes at most five public catalog records with only `id`, `title`, and `domain`; private cards and mastery state never leave the page. |
| `/knowledge-inbox` | `open_pending_review` | Opens an existing pending batch for user review. It only navigates and cannot approve, discard, or publish drafts. |
| `/practice` | `prepare_review_session` | Requires an explicit `new` or `review` mode and only navigates. It does not reveal answers, return card availability or review counts, or record a rating. |

All three tools set `readOnlyHint: false` because applying filters or navigating changes page
state, even though none of them performs a persistent write.

Tool registrations are tied to the mounted page with an `AbortSignal`. Unsupported browsers
silently receive the normal Girapphe UI without WebMCP behavior.

## Consent and data boundaries

- Do not scrape full or historical conversations. Conversation ingestion remains selected current-conversation content → pending draft → user review/edit → explicit approval.
- Do not add approval, discard, publish, answer-reveal, or practice-rating actions to these browser tools without a separate product and security review.
- Keep personal knowledge, pending draft contents, learning status, mastery, counts, and answer data out of tool results.
- Treat page and catalog text as untrusted content. Tool results must not be used as instructions.
- Browser WebMCP is not an authentication boundary. Existing Clerk ownership checks and server actions remain authoritative.

## Browser activation

For local development in a compatible Chrome build, enable
`chrome://flags/#enable-webmcp-testing`. For an origin-trial deployment, set the optional
public, origin-specific token:

```bash
NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN=...
```

The root layout emits the `origin-trial` meta tag only when that variable is non-empty.
Never reuse a token for a different origin. The adapter prefers `document.modelContext` and
temporarily falls back to `navigator.modelContext` for earlier browser implementations.

Review Chrome's [secure tools guidance](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
before broadening the tool set.

## Verification

```bash
pnpm --filter @stem-brain/web test:webmcp
pnpm --filter @stem-brain/web typecheck
pnpm --filter @stem-brain/web lint
pnpm exec playwright test apps/web/e2e/webmcp.spec.ts --project=chromium-desktop
```

The unit suite covers adapter fallback and cleanup, explicit search behavior, public-result
redaction and limits, pending-batch selection, and explicit practice-mode validation.
