# Shareable Codex Plugin

Girapphe publishes its repository-specific Codex workflows as the `girapphe`
plugin. The public Git repository is also the plugin marketplace, so another
developer can install the same guarded workflows without copying individual
skill folders.

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

## Install from GitHub

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

## Update or remove

Refresh the Git snapshot and reinstall the plugin, then start a new task:

```bash
codex plugin marketplace upgrade girapphe
codex plugin add girapphe@girapphe
```

Remove the installed plugin without removing the source repository:

```bash
codex plugin remove girapphe@girapphe
```

## Local contributor workflow

For a local checkout, add its absolute repository path instead of the GitHub
source, then install from the same marketplace name:

```bash
codex plugin marketplace add /absolute/path/to/girapphe
codex plugin add girapphe@girapphe
```

Project-local skills under `.codex/skills/` are the authoring source. Their
published copies live under `plugins/girapphe/skills/`. Whenever a source skill
changes, update its packaged copy in the same change and run:

```bash
pnpm check:plugin
```

The check validates the marketplace contract and fails if any packaged file is
missing, extra, or stale. The normal `pnpm harness` includes this gate.

## Publication boundary

The plugin becomes available to Git installers only after the marketplace and
plugin files reach the public `main` branch. A pull request or local validation
does not publish it. Marketplace refresh and plugin reinstall are explicit, so
existing installations remain on their cached copy until the user updates.
