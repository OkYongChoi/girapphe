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
- Repository files (`.env.example`, docs): placeholders only

Never commit real keys, tokens, or database credentials.

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

## 4. Deployment Rules

- Build/deploy production with production keys only.
- Do not reuse dev keys for production domains.
- Keep `main` for production and `dev` for integration/testing.

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
