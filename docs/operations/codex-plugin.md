# Shareable Codex and Claude Code Plugins

Girapphe publishes its repository-specific Codex workflows as the `girapphe`
plugin. The same package is also a native Claude Code plugin. The public Git
repository is the marketplace for both agents, so another developer can install
the same guarded workflows without copying individual skill folders.

## Included skills

- `girapphe-card-hygiene`: audit suspicious graph and card rows before any
  confirmed cleanup.
- `girapphe-db-sync`: upsert static graph data and report skipped rows.
- `girapphe-knowledge-graph`: maintain graph taxonomy, edges, cards, and mobile
  discovery metadata.
- `girapphe-protected-release`: carry a change through PR checks, deployment,
  ancestry proof, and rendered smoke checks.
- `girapphe-validation`: select and report the repository validation gates.

These skills are repository-aware. Use them from a Girapphe checkout with the
project dependencies installed. The plugin does not bundle credentials, grant
database access, or weaken any confirmation and release guardrails.

## Install in Codex from GitHub

Add the public Git marketplace once, then install the plugin:

```bash
codex plugin marketplace add OkYongChoi/girapphe --ref main
codex plugin add girapphe@girapphe
```

Confirm that Codex can see both the marketplace and the installed plugin:

```bash
codex plugin marketplace list
codex plugin list
```

Start a new Codex task in the Girapphe checkout after installation. New tasks
load the plugin's skills and metadata from the installed snapshot.

### Update or remove in Codex

Refresh the Git snapshot and reinstall the plugin, then start a new task:

```bash
codex plugin marketplace upgrade girapphe
codex plugin add girapphe@girapphe
```

Remove the installed plugin without removing the source repository:

```bash
codex plugin remove girapphe@girapphe
```

## Install in Claude Code from GitHub

These commands were verified with Claude Code 2.1.89:

```bash
claude plugin marketplace add OkYongChoi/girapphe
claude plugin install girapphe@girapphe
```

Confirm that Claude Code can see the marketplace and installed plugin:

```bash
claude plugin marketplace list
claude plugin list
```

Restart Claude Code or run `/reload-plugins` in an active session. The skills
then appear under the `girapphe` plugin namespace and can also be selected when
their descriptions match the work.

### Update or remove in Claude Code

Refresh the Git checkout, update the installed snapshot, and reload plugins:

```bash
claude plugin marketplace update girapphe
claude plugin update girapphe@girapphe
```

Remove the plugin and, if it is no longer needed, its marketplace:

```bash
claude plugin uninstall girapphe@girapphe
claude plugin marketplace remove girapphe
```

## Local contributor workflow

For a local Codex checkout, add its absolute repository path instead of the
GitHub source, then install from the same marketplace name:

```bash
codex plugin marketplace add /absolute/path/to/girapphe
codex plugin add girapphe@girapphe
```

Claude Code contributors can validate both native manifests without installing
anything, then load the plugin directly for an interactive development session:

```bash
claude plugin validate .
claude plugin validate plugins/girapphe
claude --plugin-dir ./plugins/girapphe
```

Project-local skills under `.codex/skills/` are the authoring source. Their
published copies live under `plugins/girapphe/skills/`. Whenever a source skill
changes, update its packaged copy in the same change and run:

```bash
pnpm check:plugin
```

The check validates both marketplace contracts, keeps the Codex and Claude Code
identity metadata synchronized, and fails if any packaged skill file is
missing, extra, or stale. The normal `pnpm harness` includes this gate.

## Publication boundary

The plugin becomes available to Git installers only after both platform
marketplaces and plugin manifests reach the public `main` branch. A pull request
or local validation does not publish it. Marketplace refresh and plugin update
are explicit, so existing installations remain on their cached copy until the
user updates. This repository publication does not list the plugin in OpenAI's
curated marketplace or Anthropic's official marketplace.
