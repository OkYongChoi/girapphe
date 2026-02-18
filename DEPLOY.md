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
cp .env.example .env.local
# Fill in your Clerk keys from https://dashboard.clerk.com
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
5. Deploy worker:
```bash
npm run deploy:cf
```
6. Set remaining env vars in Worker settings:
- `DATABASE_URL`
- Clerk redirect URL vars

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

2. Add:
```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - name: Install
        run: npm ci

      - name: Verify
        run: npm run check

      - name: Apply Drizzle migrations
        run: npm run db:migrate
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Deploy
        run: npm run deploy:cf
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

3. Configure GitHub repository secrets and variables:
- Secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `DATABASE_URL`
  - `CLERK_SECRET_KEY` (add to Cloudflare via `wrangler secret put`, not GitHub)

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

The Cloudflare deploy commands are unchanged:

- `npm run build:cf`
- `npm run deploy:cf`

How to use:

- Use `npm run build:cf` when you only want to validate/build Cloudflare output.
- Use `npm run deploy:cf` for real deployment. This script already runs build + deploy.
- If you use raw Wrangler instead (`npx wrangler deploy`), you must build first:
  - `npm run build:cf && npx wrangler deploy`

## 10. Latest Deployment Verification (2026-02-18 KST)

Verified at: `2026-02-18 20:41:03 KST`

- Static/type checks: `npm run check` passed
- Cloudflare build: `npm run build:cf` passed
- Cloudflare deploy: `npm run deploy:cf` passed
- Deployed URL: `https://girapphe.richokychoi.workers.dev`
- Version ID: `5247c546-309a-4dd3-b90a-d3d89c41c0fd`
- Health check:
  - `GET /api/health` -> `200`
  - response included:
    - `"status":"ok"`
    - `"mode":"database"`
    - `"database":"connected"`

## 11. Branch and Environment Strategy

Recommended minimum setup:

- `main`: production deploy source
- `dev`: integration branch for daily development

Optional but recommended when changes are frequent:

- staging preview environment (Cloudflare preview or separate Worker) connected to a separate Neon branch/database

Basic flow:

1. feature branch -> PR -> `dev`
2. validate on staging
3. merge `dev` -> `main`
4. deploy production from `main`

## 12. Progress Data Reset

If card state data becomes inconsistent for a user, use the built-in reset action:

- `/practice` top action: `Reset progress`
- `/saved` top action: `Reset progress`

What it clears for the current user:

- `user_card_states`
- `user_knowledge_states`
