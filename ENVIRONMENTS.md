# Environment Configuration Guide

This project uses separate configuration for local development and production.

## 1. Environment Matrix

| Environment | App Domain | Clerk Domain | Clerk Keys | Database |
|---|---|---|---|---|
| Local Dev | `http://localhost:3000` | Clerk test/dev | `pk_test` / `sk_test` | local/dev Neon branch |
| Production | `https://www.girapphe.com` | `clerk.girapphe.com` | `pk_live` / `sk_live` | production Neon |

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
- Do not rely on `.env` for active local runtime configuration.
- Local dev deploy commands (`deploy:cf:dev`, `preview:cf`) load from `.env.local`.
- Local prod deploy command (`deploy:cf:prod`) loads from `.env`.
- In CI, these commands fall back to already-injected environment variables when env files are absent.

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

## 4. Deployment Rules

- Build/deploy production with production keys only.
- Do not reuse dev keys for production domains.
- Keep `main` for production and `dev` for integration/testing.
- GitHub Actions branch mapping:
  - Push to `dev` -> deploy `--env dev`
  - Push to `main` -> deploy `--env prod`

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
