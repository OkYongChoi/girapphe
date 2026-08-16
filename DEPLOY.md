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

The workflow first deploys the preview Worker to apply its non-versioned Worker settings, then
uploads the PR-specific alias. Review and share only the PR alias URL; the base preview Worker
is not a review environment and can be replaced by whichever internal PR deploys last. Provider
webhooks are not validated automatically because each PR alias changes. For a focused sandbox
test, temporarily register the exact PR alias and matching `_PREVIEW` signing secret (or use a
Stripe CLI forwarder), then remove it after the test.

The smoke test retries for up to one minute because a newly assigned preview alias can briefly
return `404` while Cloudflare propagates it.

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
| Preview | `DATABASE_URL_PREVIEW` | Isolated **schema-only** Neon branch/database for PR QA; never production. |
| Production | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Live Clerk publishable key. |
| Production | `CLERK_SECRET_KEY` | Live Clerk secret key. |
| Production | `DATABASE_URL` | Production Neon connection string. |
| Production | `ADMIN_CLERK_USER_ID` | Clerk user ID permitted to use `/admin`. |
| Production | `PERSONAL_KNOWLEDGE_PURGE_TOKEN` | Random shared secret used only by the daily expired-personal-card cleanup job. |
| Variable | `APP_BASE_URL` | `https://www.girapphe.com` |

Monetization is optional, but each enabled provider group must be complete. Preview names add
`_PREVIEW`; production names do not. AdSense is production-only: PR aliases deliberately show
the house card because there is no approved AdSense-for-Content test slot for a changing PR domain.

| Group | Secret names |
|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_AD_FREE_MONTHLY`, `STRIPE_PRICE_AD_FREE_ANNUAL` |
| RevenueCat | `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_APP_IDS`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS`, `REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS` |
| AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID`, `NEXT_PUBLIC_ADSENSE_CONSENT_READY` |
| Toss Payments | Default-off gate `TOSS_BILLING_ENABLED`; credentials `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_BILLING_ENCRYPTION_KEY`, `TOSS_MONTHLY_AMOUNT_KRW`, `TOSS_ANNUAL_AMOUNT_KRW`, `TOSS_BILLING_CRON_TOKEN` |

The mobile build values, including final public Terms and Privacy URLs, are configured separately in EAS Environments. Follow
`apps/mobile/SETUP.md`; do not put server-side RevenueCat or payment secrets in an Expo build.

The four Clerk route values are deployment-managed constants: `/login`, `/signup`, and `/practice`.
They are included in both Worker environments; do not add redundant GitHub secrets for them.

## First-time preview database setup

1. In Neon, create a dedicated **schema-only** branch/database for previews. Do not
   select current production data.
2. Apply the current Drizzle migrations to that database, including
   `0007_private_knowledge_ingestion.sql`, `0008_billing_entitlements.sql`,
   `0009_private_card_practice.sql`, and `0010_stripe_portal_rate_limit.sql`. Add only
   synthetic or anonymized seed data when representative QA data is needed.
3. Save its connection string as `DATABASE_URL_PREVIEW`.
4. In Clerk, use a development/preview instance for the preview keys. Confirm sign-in works on a PR URL.

The preview preflight rejects placeholder, malformed, and live Clerk keys. Set the matching
development-instance values as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PREVIEW` (`pk_test_...`) and
`CLERK_SECRET_KEY_PREVIEW` (`sk_test_...`) in GitHub before rerunning the PR workflow.

Do not point preview at production. Preview deploys deliberately skip migrations so every PR
uses a known, already-migrated schema.

Preview URLs are public by default. If a future per-PR QA workflow needs data cloned from
production, use anonymized data and protect the Worker with Cloudflare Access before assigning
that database URL to a preview deployment.

## Configuration verification

Run these checks before opening the first PR that needs a preview:

```bash
# Names only; GitHub never reveals secret values.
gh secret list --repo OkYongChoi/girapphe
gh variable list --repo OkYongChoi/girapphe

# Local configuration and the production health endpoint.
pnpm --filter @stem-brain/web check:env:dev
curl --fail-with-body https://www.girapphe.com/api/health
```

Expected core GitHub Secrets are the entries in the first table above. A missing core preview
secret causes the preview job to fail before upload; a missing core production secret blocks
production validation. Optional monetization groups may be absent, but a partially configured
group fails validation so that a checkout or webhook cannot be exposed half-configured.

After the first PR preview deploys, verify all three of the following:

1. Its Preview Worker upload and smoke-test steps succeed in GitHub Actions.
2. `GET <preview-url>/api/health` returns `200` with the preview database connected.
3. Sign in and sign out in a browser. This verifies the preview Clerk instance and redirect flow;
   a status code alone cannot validate a social OAuth provider.

For production, the `main` deployment job is the source of truth for synchronized Cloudflare
runtime secrets. Do not copy them manually from GitHub or commit them locally. A local Wrangler
session is optional; it requires a separately authenticated Cloudflare account or a securely
injected `CLOUDFLARE_API_TOKEN` and should only inspect secret names, never values.

## Scheduled personal-card cleanup

Deleted personal knowledge cards remain recoverable for 14 days. The `Purge expired personal
knowledge cards` GitHub Actions workflow runs once a day at 00:20 Asia/Seoul and asks the
production application to permanently remove only cards whose individual restore deadline has
passed. A card can therefore remain in the trash for up to roughly one additional day after its
14-day deadline, depending on when the daily job runs.

The job sends `PERSONAL_KNOWLEDGE_PURGE_TOKEN` as a bearer token. Generate this value locally
with a cryptographically secure random generator (for example, `openssl rand -hex 32`) and store
it only as a GitHub Actions repository secret. The production deployment copies the same value
to the Cloudflare Worker runtime; do not send it in chat, commit it, or maintain a separate
manual Worker value. It can be rotated by replacing the GitHub secret and running a production
deployment.

This GitHub Actions job is intentionally the current scheduling mechanism: it keeps the task
separate from the OpenNext Worker entry point and is appropriate for this single daily task.
Reconsider a Cloudflare Cron Trigger only when several scheduled jobs need unified Cloudflare
execution, logs, and retry operations. That migration requires a custom OpenNext Worker with a
`scheduled` handler and a deliberate redesign of how the cleanup function is invoked; it is not
an automatic token-removal change.

## Scheduled Toss renewals

The `Process Toss subscription renewals` workflow calls the production-only internal billing
endpoint hourly at minute 17. It does nothing unless `TOSS_BILLING_ENABLED` is exactly `true`
and the complete Toss credential group is present. Once enabled, Girapphe owns the renewal
calendar, durable per-cycle order IDs, reconciliation, and retry/pause behavior; Toss does not
schedule these charges for the application.

Before setting the gate to `true`, complete the Toss automatic-billing contract and test
authorization, initial charge or trial, process termination after provider success, renewal,
failed-payment retry, cancellation races, reconciliation, and billing-key cleanup with sandbox
credentials. Rotate `TOSS_BILLING_CRON_TOKEN` independently from
`TOSS_BILLING_ENCRYPTION_KEY`. See `docs/reference/monetization.md` for the complete activation
checklist.

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
