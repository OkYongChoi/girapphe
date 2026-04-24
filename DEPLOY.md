# Test/Dev/Prod Runbook

## 1. Environment Model

The app has two storage modes.

1. DB mode (`DATABASE_URL` set)
- Knowledge state and app data are stored in Postgres.

2. Local fallback mode (`DATABASE_URL` missing)
- Knowledge state is stored in memory only (resets on restart).

Use fallback only for local development.

Authentication is handled by [Clerk](https://clerk.com) in both modes.

## 2. Local Dev

1. Install
```bash
npm install
```

2. Create `.env.local`
```bash
npm run env:setup:dev
# Fill in your Clerk keys from https://dashboard.clerk.com
npm run check:env:dev
```

3. Start
```bash
npm run dev
```

4. Open
- `http://localhost:3000`

5. Quick checks
```bash
npm run check
```

6. App smoke check (server must already be running)
```bash
npm run smoke
```

## 3. Test Strategy

Use this order in CI/local:

1. Static quality gate
```bash
npm run lint
npm run typecheck
```

2. Runtime smoke
```bash
npm run dev
npm run smoke
```

3. Health endpoint verification
- `GET /api/health`
- expected:
  - `200` with `"status":"ok"` in local fallback or DB healthy
  - `503` when DB configured but unavailable

## 4. Production Required Config

Required:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from Clerk dashboard
- `CLERK_SECRET_KEY` — from Clerk dashboard (add as secret, not plain env var)
- `DATABASE_URL` — PostgreSQL connection string
- `APP_BASE_URL` — production app URL (for example `https://www.girapphe.com`)

Clerk redirect URLs (set these too):
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/practice`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/practice`

Clerk dashboard setup:
- Enable desired social providers (Google, GitHub, etc.)
- Add your production domain to "Allowed redirect URLs"

## 5. Production Deploy - Vercel

1. Push repo to GitHub.
2. Import project in Vercel.
3. Configure env vars:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- Clerk redirect URL vars (see section 4)
4. Build command:
- `npm run build`
5. Deploy.

Post deploy:
```bash
curl -sS https://YOUR_DOMAIN/api/health
```

## 6. Production Deploy - Cloudflare Workers (OpenNext)

1. Ensure Cloudflare auth:
```bash
npx wrangler whoami
```
2. Add Clerk secret key to Cloudflare Workers:
```bash
wrangler secret put CLERK_SECRET_KEY
# Enter the value from your Clerk dashboard when prompted
```
3. Add publishable key to `wrangler.jsonc` under `vars` (it's safe to commit):
```jsonc
"vars": {
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY": "pk_live_..."
}
```
4. Build Next.js output for Cloudflare Workers:
```bash
npm run build:cf
```
5. Deploy worker (prod):
```bash
npm run deploy:cf:prod
```
This command can load runtime vars from an optional `.env.production`, but the recommended path is production values injected from CI secrets, Wrangler secrets, or temporary shell environment variables.
6. Set remaining env vars in Worker settings:
- `DATABASE_URL`
- `APP_BASE_URL`
- Clerk redirect URL vars

Dev deploy command:
```bash
npm run deploy:cf:dev
```
This command loads runtime vars from `.env.local` (local dev path).

Per-environment secret update:
```bash
npx wrangler secret put CLERK_SECRET_KEY --env dev
npx wrangler secret put CLERK_SECRET_KEY --env prod
```

Environment validation before deploy:
```bash
# template sanity
npm run check:env:examples

# validate production values from current shell/CI env
npm run check:env:prod
```

Drizzle migration step (required before deploy):
```bash
npm run db:migrate
```

Wrangler requirement:
- Yes, Wrangler is required for Cloudflare deployment.
- This repository already includes Wrangler as a dev dependency, so you do not need a global install.
- Use project commands (`npm run deploy:cf`) or `npx wrangler ...`.

### 6.1 GitHub Actions Template (Recommended)

1. Create workflow file:
- `.github/workflows/deploy-cloudflare.yml`

2. See `.github/workflows/deploy-cloudflare.yml` for the current workflow.

Key steps per deploy job:
- Validate env vars (`pnpm check:env:prod`)
- Run Drizzle migrations (`pnpm db:migrate`)
- Deploy Worker (`pnpm deploy:cf`)
- **Smoke test** (`pnpm smoke`) — runs after deploy, fails the job if any endpoint is down

3. Configure GitHub repository secrets and variables:
- Secrets:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV`
  - `CLERK_SECRET_KEY_DEV`
  - `DATABASE_URL_DEV`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `DATABASE_URL`
- Variables:
  - `APP_BASE_URL_DEV`
  - `APP_BASE_URL`

Branch deploy behavior (current workflow):
- `dev` branch push -> deploy to Cloudflare `dev` environment
- `main` branch push -> deploy to Cloudflare `prod` environment

## 7. Manual Steps You Must Do Yourself

These cannot be completed automatically by code changes:

1. Create a Clerk application at https://dashboard.clerk.com
2. Configure social providers and redirect URLs in Clerk dashboard.
3. Provision production DB and run `npm run db:migrate`.
4. Set production environment variables on hosting platform.
5. Add custom domain and HTTPS settings in hosting platform.
6. Run live smoke test against real domain after each deploy.

## 8. Manual Release Checklist

1. `npm run check`
2. `npm run build`
3. Deploy to staging/prod
4. Verify:
- `/api/health`
- signup/login/logout (via Clerk UI)
- `/practice`, `/saved`, `/my-knowledge`, `/knowledge`
- `/knowledge` default opens 3D view
- navbar active link highlight works on each route
- saved/my-knowledge filter `Clear` resets query params
5. Verify DB writes (new knowledge_state row after quiz)
6. Verify rollback plan (previous deployment available)

## 9. Command Clarification (Cloudflare)

The Cloudflare deploy commands are:

- `npm run build:cf`
- `npm run deploy:cf` (alias to prod)
- `npm run deploy:cf:dev`
- `npm run deploy:cf:prod`

How to use:

- Use `npm run build:cf` when you only want to validate/build Cloudflare output.
- Use `npm run deploy:cf:prod` for production deployment. This script runs build + deploy.
- Use `npm run deploy:cf:dev` for development deployment.
- If you use raw Wrangler instead (`npx wrangler deploy`), you must build first:
  - `npm run build:cf && npx wrangler deploy`

## 10. Latest Deployment Verification (2026-03-19 KST)

Triggered at: `2026-03-19 17:19 KST` via GitHub Actions (push to `main`, PR #65 merge)

- Deploy method: GitHub Actions → `deploy_prod` job → `pnpm deploy:cf:prod`
- Deployed URL: `https://girapphe.richokychoi.workers.dev` / `https://www.girapphe.com`
- Trigger commit: `d5d75fa` — Merge pull request #65 from OkYongChoi/claude/thirsty-grothendieck

### Changes deployed since 2026-02-18

#### Infrastructure
- `feat`: restructure repo as pnpm monorepo (apps/web, apps/mobile, packages/shared, packages/graph-engine)
- `fix`: remove explicit pnpm version from CI — use `packageManager` field in package.json instead

#### Practice / Card UX
- `feat`: memorize-first flow — show concept content directly instead of quiz
- `feat`: prerequisites strip and Z-key undo in practice mode
- `feat`: answer hide toggle in practice card
- `feat`: undo button after rating + card flip UX
- `feat`: show round-complete banner when all review cards are skipped
- `feat`: infinite generated card pool + knowledge map toggle
- `refactor`: remove mock cards, quiz UI, and broken filters
- `refactor`: remove unknown/again card status — keep only known and saved
- `fix`: skip no longer ends session early
- `fix`: prevent same card reappearing; fix review count deduplication
- `fix`: reset practice state on mode switch
- `fix`: prevent server re-renders from resetting CardViewer mid-session
- `fix`: stop revalidating /practice in saveCardState to prevent mid-session reset
- `fix`: card actions not advancing + skip loop

#### Knowledge Cards Content
- `feat`: add 50 semiconductor and computer architecture knowledge cards (batch 1)
- `feat`: add 60 more semiconductor and computer architecture cards (batch 2)
- `feat`: expand knowledge card content set (OS, networking, databases, distributed systems, perf, security, PL)
- `feat`: add deep dives for indexes, TCP congestion control, memory models, testing
- `feat`: expand and connect knowledge cards (cross-links between concepts)
- `feat`: expand knowledge cards to ~973 total (batches b7–b15)
- `feat`: add full card content coverage + DB versioning to force re-seed

#### Knowledge Graph
- `refactor`: center 3D graph on direct concept links
- `fix`: restore related concept links for DB-backed cards
- `fix`: show main content in graph node details
- `fix`: make 3D graph top nav reliably clickable
- `fix`: align knowledge map filters
- `feat`: add in-graph nav links to other tabs

#### Auth / Routing
- `ci`: redeploy with girapphe.com Clerk publishable key
- `fix`: redirect unauthenticated users to /login instead of /_not-found
- `fix`: redirect girapphe.com → www.girapphe.com in middleware

#### Performance
- `perf`: parallelize DB queries and deduplicate schema init
- `perf`: replace pg Pool with Neon HTTP client for faster cold starts

#### DB / Schema
- `feat`: split card knowledge and progress states (separate DB tables)
- `fix`: always run card schema migrations before version gate
- `fix`: reseed empty card table and fallback on card query errors

#### UI / Mobile
- `ui`: redesign practice page for mobile-first UX
- `feat`: comprehensive UI/UX improvements across app

### Previous Deployment Record (2026-02-18)

Verified at: `2026-02-18 20:41:03 KST`

- Cloudflare deploy: `npm run deploy:cf` passed
- Deployed URL: `https://girapphe.richokychoi.workers.dev`
- Version ID: `5247c546-309a-4dd3-b90a-d3d89c41c0fd`
- Health check: `GET /api/health` → `200`, `"status":"ok"`, `"mode":"database"`, `"database":"connected"`

## 11. Branch and Environment Strategy

This project uses **GitHub Flow** — no persistent `dev` branch.

- `main`: always deployable, auto-deploys to prod on push
- Feature branches: created from `main`, merged back via PR

Basic flow:

1. feature branch -> PR -> `main` -> prod auto-deploy
2. Smoke test runs automatically after deploy
3. Cloudflare Workers rollback available if smoke test fails

No staging branch. Use PR preview environments or local dev for pre-merge validation.

## 12. Progress Data Reset

If card state data becomes inconsistent for a user, use the built-in reset action:

- `/practice` top action: `Reset progress`
- `/saved` top action: `Reset progress`

What it clears for the current user:

- `user_card_states`
- `user_knowledge_states`
