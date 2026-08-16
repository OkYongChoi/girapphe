# Ads, subscriptions, and `ad_free`

## Product contract

- Learning, conversation-card creation, review, and the knowledge graph remain free.
- A free practice session inserts one clearly labeled sponsored card after every five
  successful forward actions. Rating and Skip count; reveal, Back, Undo, and opening a
  topic do not.
- An active `ad_free` entitlement prevents the web or mobile ad component from mounting.
- Monthly and annual subscriptions remove ads only. Web list prices are USD 1/month and
  USD 10/year; the first eligible Clerk account starting Stripe or Toss web billing receives
  one shared 14-day trial.
- A provider redirect, purchase-sheet close, or app-authored assertion never grants access.
  The server authorizes from reconciled `billing_subscriptions`; mobile may additionally honor
  RevenueCat's SDK-verified `CustomerInfo` for the signed-in Clerk App User ID while its signed
  webhook converges that provider state into the server database.

## Provider flows

### Stripe web checkout

`POST /api/billing/checkout` creates or reuses a Checkout Session after same-origin and
Clerk checks. Customer mapping, an open-session mutex, provider idempotency, and existing
subscription checks prevent parallel subscriptions. `POST /api/billing/portal` opens the
Stripe Customer Portal for the mapped customer.

`POST /api/webhooks/stripe` verifies the raw-body signature and reconciles the current
subscription from Stripe before writing `ad_free`. Checkout completion only links state;
it does not grant access by itself. Configure the webhook for `checkout.session.completed`,
`checkout.session.expired`, and `customer.subscription.*` events.

### Toss Payments web billing

Toss is optional and is shown only when the complete server configuration is present.
The browser requests card billing authorization with a short-lived, single-use server
nonce bound to the signed-in user, Toss customer, and selected plan. The callback consumes
that state before exchanging the one-time authorization value, then immediately redirects
to a clean subscription URL. Billing keys are AES-GCM encrypted at rest.

Every charge first creates a unique `toss_billing_charges` row containing the persisted
billing-cycle and order key. A provider retry therefore reuses the same Toss order. A
successful payment is marked `paid` before the idempotent entitlement/agreement writes;
the hourly job reconciles a partial DB write without charging again. Five rows are leased
per run with bounded retries, after which an unresolved agreement is paused. A charge is
reused only for the exact persisted plan and cycle; superseded, unattempted rows become
`abandoned`, while uncertain provider attempts are reconciled before another cycle starts.
Cancellation fences an in-flight lease and retains failed billing-key deletion as durable
cleanup work for the hourly job.

Toss automatic billing requires the applicable merchant contract and supported domestic
cards. Girapphe, rather than Toss, owns the renewal schedule. Activate
`.github/workflows/toss-subscription-billing.yml` only after the contract, test-mode cycle,
refund/cancellation operations, and live credentials are ready.

### RevenueCat, App Store, and Google Play

The Expo app signs in with Clerk and uses the Clerk user ID as RevenueCat's App User ID.
It reads only the exact `ad_free` entitlement, supports monthly/annual packages and restore,
and logs RevenueCat out before switching Clerk accounts. The authenticated mobile app also
reads `GET /api/billing/entitlement`, so a Stripe or Toss entitlement on the same Clerk account
removes mobile ads while RevenueCat purchases continue to remove web ads through the webhook.

`POST /api/webhooks/revenuecat` requires the configured Authorization header and raw-body
signature. Production accepts only production events whose app ID is in the exact iOS/Android
allowlist.
The server uses RevenueCat's secret API to reconcile the current subscriber snapshot,
including transfers, refunds, expiration, and mobile trials. Store-localized prices remain
the display source in the app.

App Store and Google Play introductory-offer eligibility is owned by each store account and
cannot be made strictly identical to Girapphe's Clerk-wide web trial marker. For one globally
enforced trial, do not configure separate store introductory trials. If store trials are
enabled, treat them as platform-specific offers; a detected store trial prevents a later web
trial, but a previous web trial cannot revoke an offer the store independently grants.

## Advertising

Web uses the configured AdSense client and practice slot inside the sponsored-card shell.
The server exposes those IDs only when `NEXT_PUBLIC_ADSENSE_CONSENT_READY=true`; set that flag
only after a Google-certified CMP is active for the approved site. If configuration is absent,
the script is blocked, the request is unfilled, or loading times out, practice remains usable
and a labeled Girapphe house card appears.

Mobile uses Google Mobile Ads NativeAd test IDs in development and platform-specific
production units. The SDK owns asset clicks and AdChoices; each loaded ad is destroyed when
the card unmounts. UMP consent is gathered and `canRequestAds` must be true before Mobile Ads
initialization or any request. Production native builds require both AdMob app IDs and both
NativeAd unit IDs; a runtime consent, request, or load failure falls back to the house card.
See `apps/mobile/SETUP.md` for EAS,
store, device, consent, and AdMob preparation.

## Server configuration names

Configure a provider group completely or leave the whole group absent. Values belong in
GitHub Actions/Cloudflare settings, never in the repository or chat.

| Group | Names |
|---|---|
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_AD_FREE_MONTHLY`, `STRIPE_PRICE_AD_FREE_ANNUAL` |
| RevenueCat | `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_APP_IDS`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS`, `REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS` |
| AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID`, `NEXT_PUBLIC_ADSENSE_CONSENT_READY` |
| Toss | `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_BILLING_ENCRYPTION_KEY`, `TOSS_MONTHLY_AMOUNT_KRW`, `TOSS_ANNUAL_AMOUNT_KRW`, `TOSS_BILLING_CRON_TOKEN` |

Preview uses corresponding GitHub secret names with `_PREVIEW` appended and provider
test/sandbox resources, except AdSense: PR aliases always use the house card because AdSense
for Content has no PR-domain test slot. Production uses the exact names above. The environment
checker rejects partially configured groups and test/live mismatches.

## Activation checklist

1. Apply migrations `0007_private_knowledge_ingestion.sql` and
   `0008_billing_entitlements.sql` to the isolated preview database. Preview deploys do not
   run migrations. Production runs committed Drizzle migrations before deployment.
2. In Stripe, create the USD 1 monthly and USD 10 annual recurring prices, configure the
   Customer Portal and signed webhook, then test trial, renewal, cancellation, payment
   failure, and duplicate Checkout attempts in test mode.
3. Confirm RevenueCat webhook access (currently a Pro integration), create the exact `ad_free`
   entitlement, and attach App Store and Play monthly/annual products to the current offering.
   Use one project-wide production webhook with one auth/signing configuration and the exact
   iOS/Android app-ID allowlist. Add the secret API key, map the exact store product IDs into
   the two comma-separated server lists, connect both stores' credentials and server
   notifications/RTDN, decide the store-trial policy above, and test purchase, restore,
   transfer, refund, and expiration on physical devices.
4. Complete App Store Connect and Google Play agreements, tax/banking, subscription terms,
   review metadata, sandbox/license testers, and the apps' ads/privacy disclosures. Publish
   final public Terms of Use and Privacy Policy URLs and configure the two mobile URL values.
   Add an in-app and public-web account-deletion path before store submission.
5. Add `girapphe.com` to AdSense, complete ownership review until the site is Ready, publish
   web `ads.txt`, create the practice slot, and activate a Google-certified CMP. Create both
   AdMob apps/NativeAd units, publish app-ads.txt, and configure/test the UMP message. Only then
   set the AdSense consent-ready flag and enable production ad values; non-personalized ads
   still require applicable consent.
6. If enabling Toss, complete the automatic-billing contract, choose integer KRW prices,
   generate a base64-encoded 32-byte encryption key and independent scheduler token, verify test-card
   authorization/renewal/cancel/reconciliation, then switch the whole group to live values.
7. Add names through GitHub Secrets/EAS Environments, deploy a PR preview, and verify webhooks,
   the fifth-action ad, `ad_free` suppression, account switching, and provider dashboards.

PR aliases change per pull request, while provider webhook destinations and signing secrets
are fixed settings. Preview deploys therefore do not prove webhook delivery automatically.
For a bounded test, register the exact current PR alias in provider test mode with the matching
`_PREVIEW` signing secret (or forward Stripe test events with Stripe CLI), serialize that test,
and remove the temporary endpoint afterward. Do not use the base preview Worker as a durable
review endpoint: it can be replaced by the most recently deployed internal PR.

Provider sandbox/live transactions, store review, physical-device NativeAd/purchase behavior,
and production webhook delivery are external activation checks; local builds cannot prove them.
