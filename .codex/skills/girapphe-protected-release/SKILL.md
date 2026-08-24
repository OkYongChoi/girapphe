---
name: girapphe-protected-release
description: Deliver or verify a Girapphe UI/admin change through protected PR checks, merge ancestry, Cloudflare Workers production deployment, and rendered smoke evidence. Use for “PR merge,” iterative N-cycle delivery, or before claiming a release is complete.
---

# Girapphe protected release

## When to use

Use in a Girapphe checkout when the requested outcome includes a PR, merge, deployment, exact iteration count, or production verification. It covers the observed OpenNext → Cloudflare Workers release path. Do not use it to infer present secret values or as proof that third-party browser/provider activation succeeded without a real check.

## Inputs and context

1. Confirm the checkout, worktree, branch, and intended deployment branch:

   ```bash
   git status --short --branch
   git worktree list --porcelain
   git fetch origin --prune
   ```

2. Inspect the affected paths plus `package.json`, `.github/workflows/deploy-cloudflare.yml`, and relevant browser smoke tests. Confirm current scripts before treating the commands below as authoritative.
3. If local `main` belongs to another worktree, do not switch or force-check it out. Create the branch from `origin/main` and use remote-ref ancestry checks.

## Procedure

1. For iterative work, keep a durable cycle ledger: requested count, branch, PR, merge commit, remote check state, production run, and one concise user-visible change per cycle. Start every independent cycle from fresh `origin/main`.
2. Stage only intended files. Run the relevant baseline, normally:

   ```bash
   pnpm harness
   pnpm --filter @stem-brain/web check
   pnpm browser:smoke
   git diff --check
   ```

   Consider `pnpm harness:deploy` for deployment-sensitive changes. For a narrow change, run the focused typecheck/regression first, but do not substitute it for the release gate.
3. Open the PR against the actual deployment branch. Resolve actionable review conversations, then inspect its real state:

   ```bash
   gh pr view <pr> --json state,mergeStateStatus,mergeable,statusCheckRollup,reviewDecision,mergeCommit
   ```

4. Wait for the required remote run rather than relying on an earlier snapshot:

   ```bash
   gh run watch <run-id> --exit-status
   ```

   On failure, inspect `gh run view <run-id> --log-failed`, fix, push, and wait for the new run.
5. After the PR is merged, fetch and prove the merge is on main:

   ```bash
   git fetch origin --prune
   git merge-base --is-ancestor <merge-commit> origin/main
   ```

6. Monitor the separate main Cloudflare Workers production workflow to `completed/success`; then perform a real production interaction/smoke check. For touch-target claims, measure the rendered desktop/mobile controls rather than inferring from CSS or ARIA.

## Efficiency plan

- Reuse one clean baseline result until relevant files change; use focused checks for intermediate feedback.
- Query one PR's combined status fields in a single `gh pr view` call and use `gh run watch` rather than repeated polling.
- Check installed Playwright browsers before captures. If WebKit is missing, use Chromium explicitly with a mobile viewport such as `--browser=chromium --viewport-size="390,844"`.
- Stop only when every requested cycle has a verified merged state, main ancestry, successful production workflow, and requested rendered evidence.

## Pitfalls and fixes

- Requested count reported complete but some PRs are only open/pending: requery each PR and audit merged range/count; preserve independent cycles instead of silently combining them.
- `main` is already used by another worktree: branch from `origin/main`; never force-checkout the other worktree's branch.
- Quality Checks passed while Preview/deploy is still queued: do not claim complete. Merge policy and production validation are separate; wait for the main production workflow.
- Screenshot command fails with a missing WebKit executable: use an installed browser, normally Chromium, and record that capture limitation.
- `tsc: not found` or Wrangler unavailable: first establish whether dependencies/CLI are absent (`pnpm install --frozen-lockfile` when appropriate). Do not turn a local-tooling failure into a remote configuration claim.

## Verification checklist

- Current checkout/worktree and `origin/main` base were confirmed without disturbing another worktree.
- Final local checks and `git diff --check` passed for the affected scope.
- Required PR reviews/conversations and remote Quality Checks are successful.
- Every requested PR/cycle is merged; each merge commit is an ancestor of `origin/main`.
- The main Cloudflare Workers production run is `completed/success`.
- A real deployed interaction/smoke test supports any user-visible completion claim.
