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
- `PERSONAL_KNOWLEDGE_PURGE_TOKEN` (random shared secret for the daily expired personal-card cleanup job)

Optional monetization groups must be configured as a complete group or left entirely absent.
Preview uses the same names with `_PREVIEW` appended except for production-only AdSense; PR
aliases always exercise the labeled house-card fallback. Production uses the names below.

| Group | Production secret names |
|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_AD_FREE_MONTHLY`, `STRIPE_PRICE_AD_FREE_ANNUAL` |
| RevenueCat | `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_APP_IDS`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS`, `REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS` |
| AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID`, `NEXT_PUBLIC_ADSENSE_CONSENT_READY` |
| Toss Payments | `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_BILLING_ENCRYPTION_KEY`, `TOSS_MONTHLY_AMOUNT_KRW`, `TOSS_ANNUAL_AMOUNT_KRW`, `TOSS_BILLING_CRON_TOKEN` |

Mobile Clerk, RevenueCat, AdMob identifiers/public SDK keys, and public legal URLs are owned by EAS
Environments rather than the Worker. See `apps/mobile/SETUP.md` for the exact names.

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
from the current production schema and apply every committed migration, including the private
ingestion and billing migrations, before enabling preview deploys.

## Deployment rules

- Open, update, reopen, or mark ready a non-fork PR: quality checks, Preview Worker upload, then smoke test.
- Merge to `main`: quality checks, Drizzle migrations, production deploy, then smoke test.
- Fork PRs receive quality checks but no preview because repository secrets are not exposed to them.
- Preview URLs are public `workers.dev` URLs unless Cloudflare Access is applied in the dashboard.
- The daily personal-card cleanup workflow is separate from deployment and uses
  `PERSONAL_KNOWLEDGE_PURGE_TOKEN` to authenticate its request to production. GitHub Actions is
  the current scheduler; consider Cloudflare Cron only when several scheduled tasks warrant a
  custom Worker and unified Cloudflare operations.
- The hourly Toss renewal workflow is also separate from deployment. It skips safely while
  its complete production group is absent and authenticates the internal endpoint with
  `TOSS_BILLING_CRON_TOKEN`. Enable the group only after the automatic-billing contract and
  sandbox renewal/cancellation tests are complete.
- Preview cleanup runs every six hours. It deletes versions only after their PR is closed: 24 hours after a merge, or 7 days after an unmerged close. A reopened/open PR is retained. Run the workflow manually with its dry-run input before an ad-hoc cleanup.
