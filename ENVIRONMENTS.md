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

Preview-only authenticated evidence variable:

- `AUTHENTICATED_OVERLAY_E2E_USER_EMAIL_PREVIEW` (dedicated
  `+clerk_test_girapphe_overlay_e2e` address)

Production-only secrets:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `DATABASE_URL`
- `ADMIN_CLERK_USER_ID`
- `PERSONAL_KNOWLEDGE_PURGE_TOKEN` (random shared secret for the daily expired personal-card cleanup job)

Production-only authenticated evidence variable:

- `AUTHENTICATED_OVERLAY_E2E_USER_EMAIL` (independent dedicated
  `+clerk_test_girapphe_overlay_e2e` address)

Billing lifecycle groups must be configured completely or left entirely absent. Preview GitHub
names use `_PREVIEW` and only provider test/sandbox resources. AdSense remains production-only;
PR aliases always exercise the labeled house-card fallback.

| Group | Production Worker names |
|---|---|
| Creem lifecycle | `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_ANNUAL_PRODUCT_ID`, `CREEM_ENVIRONMENT` |
| Superwall lifecycle | `SUPERWALL_ORGANIZATION_API_KEY`, `SUPERWALL_WEBHOOK_SECRET`, `SUPERWALL_PROJECT_ID`, `SUPERWALL_ENVIRONMENT`, `SUPERWALL_IOS_APPLICATION_ID`, `SUPERWALL_ANDROID_APPLICATION_ID`, `SUPERWALL_IOS_BUNDLE_ID`, `SUPERWALL_ANDROID_PACKAGE_ID`, `SUPERWALL_IOS_MONTHLY_PRODUCT_ID`, `SUPERWALL_IOS_ANNUAL_PRODUCT_ID`, `SUPERWALL_ANDROID_MONTHLY_PRODUCT_ID`, `SUPERWALL_ANDROID_ANNUAL_PRODUCT_ID` |
| Acquisition | `WEB_BILLING_ACQUISITION_ENABLED`, `MOBILE_BILLING_ACQUISITION_ENABLED` |
| AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID`, `NEXT_PUBLIC_ADSENSE_CONSENT_READY` |

GitHub Actions variables own the two acquisition gates plus `CREEM_ENVIRONMENT` and
`SUPERWALL_ENVIRONMENT`; provider credentials and configured IDs are stored as Actions secrets
and synchronized to the Worker. `test` is required outside production and `production` in
production. A gate set to `true` requires the matching complete lifecycle group. A gate set to
`false` disables only new acquisition, not configured webhook, reconciliation, management, or
cancellation paths for existing subscribers.

Mobile Clerk, Superwall, AdMob identifiers/public SDK keys, and public legal URLs are owned by EAS
Environments rather than the Worker. Never put `SUPERWALL_ORGANIZATION_API_KEY` or
`SUPERWALL_WEBHOOK_SECRET` in a mobile build. See `apps/mobile/SETUP.md` for the exact public names.

Repository variable:

- `APP_BASE_URL=https://www.girapphe.com`

The two authenticated-evidence email variables are consumed only by the manual
`Authenticated overlay performance` workflow. They are not Worker runtime
configuration and are not read by normal CI or deployments.

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
- Production deployment leaves legacy Stripe, RevenueCat, and Toss Worker keys untouched during
  the Billing V1 mixed-version and rollback window. Remove them manually only in a separately
  reviewed cleanup after independent provider-dashboard and database absence checks for legacy
  subscribers, agreements, billing keys, pending charges, and unprojected state.
- Keep both billing acquisition gates false until the external evidence checklist in
  `docs/reference/monetization.md` is complete. Environment validation cannot prove merchant
  approval, provider products/webhooks, store agreements, physical-device purchases, refunds,
  payouts, or production delivery.
- Preview cleanup runs every six hours. It deletes versions only after their PR is closed: 24 hours after a merge, or 7 days after an unmerged close. A reopened/open PR is retained. Run the workflow manually with its dry-run input before an ad-hoc cleanup.
