# Shareable Codex plugin distribution

Status: Implemented

## User outcome

Girapphe contributors can install the repository's guarded Codex workflows from
the public GitHub repository instead of manually copying project skill folders.

## Scope

In scope:

- A repository marketplace and one `girapphe` plugin manifest.
- Packaging all project-local Girapphe skills and their support files.
- A repeatable drift check included in the normal repository harness.
- Git, local-checkout, update, removal, and new-task usage instructions.

Out of scope:

- Publication in OpenAI's curated marketplace.
- Generic workflows for repositories other than Girapphe.
- Apps, MCP servers, credentials, database access, or automatic plugin updates.

## Acceptance criteria

- [x] `AC-01`: A Git clone exposes an available `girapphe` plugin through a
  valid repository marketplace entry and plugin manifest.
- [x] `AC-02`: The plugin contains every project-local Girapphe skill and its
  support files without changing the skills' safety guardrails.
- [x] `AC-03`: Repository validation fails when marketplace metadata is invalid
  or a packaged skill differs from its project-local source.
- [x] `AC-04`: Contributors have exact install, verification, update, removal,
  local-development, and new-task instructions.

## Privacy and data boundaries

The plugin contains instructions and repository scripts only. It contains no
credentials, user data, environment files, or database snapshots. Installation
does not grant database, GitHub, Cloudflare, Clerk, Neon, or store access.
Existing dry-run, confirmation, owner-scope, and protected-release boundaries
remain in force.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `pnpm check:plugin`, followed by a local `codex plugin marketplace add <checkout>` and `codex plugin add girapphe@girapphe` round trip. |
| `AC-02` | `pnpm check:plugin` byte-compares `.codex/skills/` with `plugins/girapphe/skills/`. |
| `AC-03` | `scripts/check-codex-plugin.test.mjs` covers a valid package and rejects stale packaged content. |
| `AC-04` | `pnpm check:docs` validates [the plugin operations guide](../../docs/operations/codex-plugin.md). |

## Rollout

Merge the marketplace, plugin package, and checks together to the public
`main` branch. Users add `OkYongChoi/girapphe` as a Git marketplace and install
`girapphe@girapphe`; existing tasks must be replaced with a new task to load the
new skills. Updates require an explicit marketplace refresh and reinstall.
Rollback is `codex plugin remove girapphe@girapphe`; there are no schema,
runtime, provider, or data migrations.
