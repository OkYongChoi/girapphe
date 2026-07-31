# Environment Configuration Guide

This project uses separate configuration for local development and production.

## 1. Environment Matrix

| Environment | App Domain | Clerk Domain | Clerk Keys | Database | Deploy trigger |
|---|---|---|---|---|---|
| Local Dev | `http://localhost:3000` | active Clerk tenant | usually `pk_test` / `sk_test`, but `pk_live` / `sk_live` is also supported when intentionally sharing prod auth | optional Neon/local DB | manual |
| Cloudflare Dev | `*.workers.dev` or dev custom domain | active Clerk tenant | tenant-matched keys | dev or shared Neon DB | push to `dev` |
| Production | `https://www.girapphe.com` | `clerk.girapphe.com` | `pk_live` / `sk_live` | production Neon | push to `main` |

## 2. Where Secrets Live

- Local only: `.env.local` (gitignored)
- Cloudflare runtime: Worker Secrets (`wrangler secret put ...`)
- CI/CD: GitHub Secrets
- Repository files (`.env.dev.example`, `.env.prod.example`, `.env.example`, docs): placeholders only

Never commit real keys, tokens, or database credentials.

Template usage:

```bash
npm run env:setup:dev
npm run check:env:dev
```

Local file rule:
- Use `.env.local` for local development values.
- Do not keep a persistent `.env.production` file with real production secrets.
- Local dev deploy commands (`deploy:cf:dev`, `preview:cf`) load from `.env.local`.
- Local prod deploy command (`deploy:cf:prod`) can read an optional `.env.production`, but the preferred path is already-injected shell/CI environment variables.
- In CI, these commands fall back to already-injected environment variables when env files are absent.

Current project note:
- If you only maintain one live Clerk tenant and one Neon database right now, `.env.local` may intentionally point at those real services for local debugging.
- Production deploy credentials should live in Worker secrets, GitHub secrets, or temporary shell exports, not in a checked or persistent local prod env file.
- `scripts/check-env.mjs` warns when dev uses live Clerk keys, but that warning is advisory and does not block local validation.

## 3. Required Variables

Always set:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/practice`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/practice`
- `DATABASE_URL`
- `APP_BASE_URL`

Validation commands:

- Template consistency check: `npm run check:env:examples`
- Local dev file check: `npm run check:env:dev`
- Production env check (CI/runtime): `npm run check:env:prod`

## 4. Branch and Deployment Rules

- Build/deploy production with production keys only.
- Do not reuse dev keys for production domains.
- This project uses two protected environment branches:
  - `dev`: integration branch for development-network deployment.
  - `main`: production branch and the only source for production deployment.
- Feature branches are short-lived and should be named by scope, for example `feature/home-graph-polish`, `fix/admin-empty-state`, or `chore/env-runbook`.
- GitHub Actions branch mapping:
  - PR to `dev` or `main` -> quality checks only
  - Push to `dev` -> deploy `--env dev` -> smoke test dev URL
  - Push to `main` -> deploy `--env prod` -> smoke test prod URL
- Normal promotion path:
  1. feature branch -> PR -> `dev`
  2. smoke-test the Cloudflare dev deployment
  3. `dev` -> PR -> `main`
  4. smoke-test the production deployment
- Delete feature branches after merge. Keep `dev` and `main` protected.

## 4.1 Codebase-Enforced Separation

This repository separates Cloudflare deployments by command and Wrangler environment:

- Dev deploy: `npm run deploy:cf:dev`
  - Wrangler env: `dev`
  - Worker name: `girapphe-dev`
  - Intended domain: `*.workers.dev` (or separate dev custom domain)
- Prod deploy: `npm run deploy:cf:prod`
  - Wrangler env: `prod`
  - Worker name: `girapphe`
  - Intended domains: `girapphe.com`, `www.girapphe.com`

Backward compatibility:
- `npm run deploy:cf` is mapped to `npm run deploy:cf:prod`.

Recommended secret commands:

- Dev secret: `npx wrangler secret put KEY --env dev`
- Prod secret: `npx wrangler secret put KEY --env prod`

Secret classification:

- Public/build-time values, safe to expose to browsers:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
  - `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
  - `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
  - `APP_BASE_URL`
- Server-only secrets, never commit:
  - `CLERK_SECRET_KEY`
  - `DATABASE_URL`
  - `ADMIN_CLERK_USER_ID`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`

## 5. Google OAuth 400 (invalid_request) Checklist

If Google signup/login shows `Error 400: invalid_request`, check:

1. Clerk is using production keys (`pk_live` / `sk_live`) on production.
2. Clerk primary domain is `girapphe.com` and frontend API is `clerk.girapphe.com`.
3. DNS CNAME records exist and resolve:
   - `clerk.girapphe.com` -> `frontend-api.clerk.services`
   - `accounts.girapphe.com` -> `accounts.clerk.services`
4. Google OAuth app (in Clerk dashboard) is configured for production.
5. In Google Cloud Console OAuth client:
   - Authorized JavaScript origins include:
     - `https://www.girapphe.com`
     - `https://accounts.girapphe.com`
   - Authorized redirect URIs include:
     - `https://accounts.girapphe.com/v1/oauth_callback`

After changing Google/Clerk settings, wait a few minutes and retry in a fresh browser session.
