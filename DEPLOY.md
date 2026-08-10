# Deployment Runbook

## Delivery model

```text
local branch -> pull request -> Cloudflare PR Preview -> merge to main -> production
```

There is no persistent `dev` branch or development Worker. Pull requests are the pre-merge
environment; `main` is the only production deployment trigger.

## What GitHub Actions does

### Pull request

For an internal PR, the workflow runs quality checks, creates/updates the stable Cloudflare
Preview alias `pr-<number>-girapphe-preview.<workers-subdomain>.workers.dev`, and smoke tests
it. The preview uses preview Clerk keys and `DATABASE_URL_PREVIEW`; it does not run migrations
and cannot access `/admin`.

Fork PRs run quality checks only because GitHub does not provide repository secrets to them.

### Production

A push to `main` validates production configuration, runs `pnpm db:migrate`, updates the
production Worker runtime values, deploys `girapphe`, and smoke tests `APP_BASE_URL`.

## Repository settings

Configure these under GitHub repository Settings → Secrets and variables → Actions.

| Scope | Name | Notes |
|---|---|---|
| Both | `CLOUDFLARE_API_TOKEN` | Least-privilege token able to upload Worker versions and read the account Workers subdomain. |
| Both | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID. |
| Preview | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PREVIEW` | Test/development Clerk instance. |
| Preview | `CLERK_SECRET_KEY_PREVIEW` | Matching preview Clerk secret. |
| Preview | `DATABASE_URL_PREVIEW` | Isolated Neon branch/database; never production. |
| Production | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Live Clerk publishable key. |
| Production | `CLERK_SECRET_KEY` | Live Clerk secret key. |
| Production | `DATABASE_URL` | Production Neon connection string. |
| Production | `ADMIN_CLERK_USER_ID` | Clerk user ID permitted to use `/admin`. |
| Variable | `APP_BASE_URL` | `https://www.girapphe.com` |

The four Clerk route values are deployment-managed constants: `/login`, `/signup`, and `/practice`.
They are included in both Worker environments; do not add redundant GitHub secrets for them.

## First-time preview database setup

1. In Neon, create a dedicated branch/database for previews.
2. Apply the current Drizzle migrations to that database.
3. Save its connection string as `DATABASE_URL_PREVIEW`.
4. In Clerk, use a development/preview instance for the preview keys. Confirm sign-in works on a PR URL.

Do not point preview at production. Preview deploys deliberately skip migrations so every PR
uses a known, already-migrated schema.

## Local work and verification

```bash
pnpm env:setup:dev
pnpm check:env:dev
pnpm harness
pnpm browser:smoke
```

For a local Cloudflare runtime session (not a deployment):

```bash
pnpm --filter @stem-brain/web preview:cf
```

## Operations and rollback

- Do not run local production deployment commands as the normal release path; merge to `main`.
- If the production smoke test fails, use Cloudflare Workers Versions & Deployments to roll back
  traffic to the previous version, then fix forward with a new PR.
- Preview URLs are `workers.dev` only and are public by default. Use Cloudflare Access if review
  previews must be restricted.
- A Workers.dev account subdomain change changes every workers.dev URL under that account. It does
  not change the production custom domains, but it does change all preview URLs.
