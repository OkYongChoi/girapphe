# Environment Configuration

Girapphe uses GitHub Flow. There is no deployed `dev` environment.

| Environment | Trigger | Worker | Data and auth |
|---|---|---|---|
| Local | `pnpm dev` | none | `.env.local`; test Clerk keys recommended; database optional |
| PR Preview | non-fork pull request | `girapphe-preview`, alias `pr-<number>` | preview Clerk keys and an isolated schema-only Neon database |
| Production | push to `main` | `girapphe` on `girapphe.com` and `www.girapphe.com` | production Clerk keys and production Neon database |

## Configuration ownership

- `.env.local` is local-only and gitignored. Create it with `pnpm env:setup:dev`.
- GitHub Actions owns deployment credentials and injects runtime configuration.
- Cloudflare Workers receives version-specific values during deployment; do not manage a parallel manual secret set.
- Repository templates contain placeholders only.

## Required GitHub settings

Secrets required by both deploy paths:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Preview-only secrets:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PREVIEW`
- `CLERK_SECRET_KEY_PREVIEW`
- `DATABASE_URL_PREVIEW`

Production-only secrets:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `ADMIN_CLERK_USER_ID`

Repository variable:

- `APP_BASE_URL=https://www.girapphe.com`

The preview URL is derived from the Cloudflare account at runtime, so no Workers.dev
subdomain variable is stored in GitHub. Preview admin access is intentionally disabled.

## Validation

```bash
pnpm check:env:examples
pnpm check:env:dev
pnpm harness
```

`DATABASE_URL` is optional only for local development. It is required for preview and
production. Preview schema migrations are not automatic: create the isolated Neon database
from the current production schema before enabling preview deploys.

## Deployment rules

- Open, update, reopen, or mark ready a non-fork PR: quality checks, Preview Worker upload, then smoke test.
- Merge to `main`: quality checks, Drizzle migrations, production deploy, then smoke test.
- Fork PRs receive quality checks but no preview because repository secrets are not exposed to them.
- Preview URLs are public `workers.dev` URLs unless Cloudflare Access is applied in the dashboard.
- Preview cleanup runs every six hours. It deletes versions only after their PR is closed: 24 hours after a merge, or 7 days after an unmerged close. A reopened/open PR is retained. Run the workflow manually with its dry-run input before an ad-hoc cleanup.
