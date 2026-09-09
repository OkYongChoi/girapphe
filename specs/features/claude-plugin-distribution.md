# Shareable Claude Code plugin distribution

Status: Implemented

## User outcome

Girapphe contributors can install the repository's guarded workflows as a
Claude Code plugin from the public GitHub repository, while the same packaged
skills remain installable in Codex.

## Scope

In scope:

- A Claude Code marketplace at the repository root and a native Claude plugin
  manifest beside the existing Codex manifest.
- One shared `skills/` package for Claude Code and Codex, with synchronized
  names, versions, metadata, and repository-local source copies.
- Repository checks for both marketplace contracts and exact installation,
  update, removal, local-validation, and reload instructions.
- A real Claude Code CLI validation and install/remove round trip before
  publication, followed by the same GitHub-source round trip after merge.

Out of scope:

- Publication in Anthropic's official marketplace.
- Claude.ai consumer integrations or remote MCP servers.
- Generic workflows for repositories other than Girapphe.
- Credentials, provider access, data access, or automatic plugin updates.

## Acceptance criteria

- [x] `AC-01`: A Git clone exposes exactly one `girapphe` entry through a
  Claude Code marketplace and a valid native plugin manifest.
- [x] `AC-02`: Claude Code and Codex publish the same plugin name, semantic
  version, description, author, homepage, repository, and shared skill tree.
- [x] `AC-03`: Repository validation rejects a missing Claude manifest,
  platform version drift, an invalid Claude marketplace source, or a packaged
  skill that differs from its project-local source.
- [x] `AC-04`: Contributors have exact Claude Code install, verification,
  update, removal, local-validation, and plugin-reload instructions.
- [x] `AC-05`: Installation does not change the existing skill safety,
  confirmation, privacy, or protected-release boundaries.

## Privacy and data boundaries

The plugin contains instructions and repository scripts only. It contains no
credentials, user data, environment files, or database snapshots. Installing
it does not grant GitHub, Cloudflare, Clerk, Neon, database, or store access.
The skills continue to require the same explicit confirmations and operate
under Girapphe's owner-scope and protected-release contracts.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | `claude plugin validate .`, `claude plugin validate plugins/girapphe`, and `pnpm check:plugin`. |
| `AC-02` | `scripts/check-codex-plugin.mjs` compares both manifests and validates the shared skill package. |
| `AC-03` | `scripts/check-codex-plugin.test.mjs` covers missing metadata, version drift, source drift, and stale skills. |
| `AC-04` | `pnpm check:docs` validates [the plugin operations guide](../../docs/operations/codex-plugin.md). |
| `AC-05` | The shared skill tree remains byte-identical to `.codex/skills/`, as enforced by `pnpm check:plugin`. |

## Rollout

Merge both platform manifests, the shared package, checks, and documentation to
the public `main` branch. Claude Code users add `OkYongChoi/girapphe` as a
marketplace and install `girapphe@girapphe`; Codex users keep their existing
marketplace flow. Existing installations remain cached until explicitly
updated. Rollback uninstalls the plugin and optionally removes its marketplace;
there are no schema, runtime, provider, or data migrations.
