# Ads and Subscriptions

## Product boundary

Girapphe Plus grants the `ad_free` entitlement and full access to the public
Knowledge Map. Learning, conversation/card creation, review, and user-created
private concepts and relationships remain free. Billing work must not move that
boundary or rename `ad_free`.

## Billing V1 responsibility split

```text
Web -> Creem -------------------------\
                                      -> Girapphe billing projection -> ad_free
iOS/Android -> Apple/Google -> Superwall /
```

- Creem is the Merchant of Record for web checkout, recurring billing, tax,
  refunds, and the hosted customer portal.
- Apple and Google move mobile money. Superwall supplies product loading,
  native purchase and restore, subscription state, entitlements, server events,
  and reconciliation support.
- Girapphe owns the mobile subscription UI, Clerk identity mapping, canonical
  subscription projection, and product authorization.
- Superwall-rendered paywalls, campaigns, and paid experimentation are outside
  V1. Web purchases never pass through Superwall.

RevenueCat, Stripe acquisition, and Toss acquisition are not part of the target
architecture. During the mixed-version window, lifecycle-only compatibility is
retained for Stripe and RevenueCat webhooks, Stripe portal/cancellation,
RevenueCat authoritative reconciliation, and Toss cancellation/recovery. The
Stripe checkout API always rejects, Toss prepare/callback/UI routes remain
absent, and no legacy provider is a new-purchase option.

## Web product and Creem lifecycle

Web offers exactly one new product: Girapphe Plus Annual, USD 10.00, one-year
automatic renewal, quantity one, tax inclusive, and no trial. The server owns
the configured product ID and rejects `plan=monthly`; a hidden monthly button is
not the policy boundary.

`POST /api/billing/checkout` requires Clerk authentication and a trusted origin.
Inside the per-account billing fence it checks account deletion, canonical
entitlement, open acquisition blocks, and any unresolved checkout before
creating or reusing a Creem hosted checkout. The client cannot choose a price,
currency, entitlement, user ID, or product ID. Provider timeouts and uncertain
responses remain pending and never trigger an automatic second checkout.

The checkout return URL is only presentation state. It shows bounded processing
and polls canonical entitlement with backoff for at most about 60 seconds. A
redirect or checkout-complete event alone cannot grant Plus; verified Creem
subscription state must converge into the database first.

`POST /api/webhooks/creem` verifies the raw request body with Creem's documented
`creem-signature` HMAC-SHA256 contract. The event ledger is idempotent,
retryable, environment-scoped, and lease-based: an event is not permanently
complete until its local reconciliation succeeds. When possible the handler
fetches authoritative current subscription state before applying it, and an old
provider event cannot replace a newer projection.

Creem owns card collection, recurring charges, tax calculation/remittance, and
charge retry. Girapphe stores provider references and normalized subscription
state, never raw card data. A confirmed renewal failure may receive one fixed
72-hour billing grace. A temporary provider verification outage may receive at
most one fixed 24-hour technical grace; neither grace slides on duplicate events
or requests. First-payment failure, confirmed refund revocation, and immediate
termination receive no grace.

`POST /api/billing/portal` creates a Creem customer-portal session for a mapped
Creem customer and still routes a verified legacy Stripe subscriber to Stripe's
portal during migration. Web refunds are performed manually in Creem: the standard policy is a
full refund within 14 days of an initial annual purchase or annual renewal, with
no standard prorated refund after that window. A partial or historical-period
refund must not revoke a currently valid subscription.

## Mobile product and Superwall lifecycle

iOS and Android offer store monthly and annual subscriptions through Girapphe's
own UI. The UI displays the localized StoreKit/Google Play price returned for
the configured product; it never hardcodes the USD reference prices. No new
introductory or free trial is configured. An already-live store trial is not
silently changed and must be reported as an activation finding.

The app identifies the signed-in Clerk user ID to Superwall, loads the exact
configured products, and calls the direct purchase or restore API. It does not
register a Superwall paywall. Local SDK state may make the UI responsive, but a
mobile-authored claim never grants server authorization. Purchase and restore
trigger authenticated server reconciliation, and every surface ultimately
uses `GET /api/billing/entitlement`.

On logout or account switch, the app clears the previous user-specific SDK
state, identifies the new Clerk user, and refreshes server entitlement before
showing Plus. Email is not an ownership key and does not transfer a subscription.
The server accepts only configured Superwall project/application, package or
bundle, store, environment, product, and `ad_free` entitlement state. Signed
Svix webhook delivery is a reconciliation trigger; authoritative Superwall
subscription retrieval determines the current projection.
The stable Superwall subscription resource id is the canonical provider row
key. Store root/original and current renewal transaction/order identifiers are
stored as separate correlation aliases, so a renewal never creates a new
canonical subscription merely because its store identifier rotated.

Superwall's current documentation describes direct purchase APIs and an
infrastructure tier independent of paywall-attributed revenue. This design
depends on Girapphe-owned UI remaining outside Superwall's MAR-priced paywall
product. If real configuration would attribute Girapphe revenue or require a
paid tier, stop activation and record the exact provider requirement before
changing the architecture. See the official [Superwall pricing](https://superwall.com/pricing),
[Expo integration](https://superwall.com/docs/expo), and
[webhook verification](https://superwall.com/docs/integrations/webhooks/verify)
documentation.

## Canonical entitlement and duplicates

`billing_subscriptions` projects stable provider subscription identities and
their store, product, environment, plan, normalized status, period, renewal
state, provider-event time, and last reconciliation time. `ad_free` is true when
**any** qualifying subscription is still valid. It is never copied from the
most recently processed row.

- Active access and scheduled cancellation before period end remain entitled.
- Expiration or verified full-period revocation ends that row's access.
- A valid subscription from another provider keeps `ad_free` true.
- Duplicate and out-of-order events are harmless.
- An unresolved cross-provider duplicate opens an acquisition block. Records
  are preserved for operator ordering, cancellation/refund of the later charge,
  and reconciliation; V1 does not refund automatically or delete rows.

Before web checkout, canonical state checks web and mobile subscriptions. Before
mobile purchase options are shown, the app checks both canonical state and local
Superwall state. This prevents common duplicate purchases but cannot make Apple,
Google, and Creem one atomic payment network. The UI points an existing subscriber
to the management destination for the original provider and requires that
subscription to expire before an intentional provider switch.

## Account deletion

Deletion takes the permanent account/billing fence before blocking new checkout
and abandoning unresolved acquisition attempts. Girapphe requests scheduled
cancellation of active Creem renewal, preserves required reconciliation
metadata, resets the Superwall device identity where supported, and then deletes
application-owned user data according to the deletion policy.

During the legacy observation window, deletion also expires owned open Stripe
checkout sessions, cancels renewing Stripe subscriptions, safely cancels any
persisted Toss agreement, and deletes an existing RevenueCat customer profile.
Missing lifecycle configuration fails deletion closed when a corresponding
legacy record requires cleanup. This bridge does not create a legacy purchase.

Deleting or resetting a Superwall identity does not cancel an App Store or
Google Play subscription. Store subscribers receive the relevant store
management instructions; Apple/Google remain the owners of store billing.

## Configuration and acquisition gates

Provider lifecycle groups are all-or-nothing. A partial group fails closed.
Preview uses the same names with `_PREVIEW` in GitHub settings and only provider
test/sandbox resources.

| Group | Worker names |
|---|---|
| Creem lifecycle | `CREEM_API_KEY`, `CREEM_WEBHOOK_SECRET`, `CREEM_ANNUAL_PRODUCT_ID`, `CREEM_ENVIRONMENT` (`test` or `production`) |
| Superwall lifecycle | `SUPERWALL_ORGANIZATION_API_KEY`, `SUPERWALL_WEBHOOK_SECRET`, `SUPERWALL_PROJECT_ID`, `SUPERWALL_ENVIRONMENT`, `SUPERWALL_IOS_APPLICATION_ID`, `SUPERWALL_ANDROID_APPLICATION_ID`, `SUPERWALL_IOS_BUNDLE_ID`, `SUPERWALL_ANDROID_PACKAGE_ID`, `SUPERWALL_IOS_MONTHLY_PRODUCT_ID`, `SUPERWALL_IOS_ANNUAL_PRODUCT_ID`, `SUPERWALL_ANDROID_MONTHLY_PRODUCT_ID`, `SUPERWALL_ANDROID_ANNUAL_PRODUCT_ID` |
| Acquisition gates | `WEB_BILLING_ACQUISITION_ENABLED`, `MOBILE_BILLING_ACQUISITION_ENABLED` |
| Transitional Stripe lifecycle | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_AD_FREE_MONTHLY`, `STRIPE_PRICE_AD_FREE_ANNUAL` |
| Transitional RevenueCat lifecycle | `REVENUECAT_WEBHOOK_AUTHORIZATION`, `REVENUECAT_WEBHOOK_SIGNING_SECRET`, `REVENUECAT_APP_IDS`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS`, `REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS` |
| Transitional Toss recovery | `TOSS_BILLING_ENABLED`, `NEXT_PUBLIC_TOSS_CLIENT_KEY`, `TOSS_SECRET_KEY`, `TOSS_BILLING_ENCRYPTION_KEY`, `TOSS_MONTHLY_AMOUNT_KRW`, `TOSS_ANNUAL_AMOUNT_KRW`, `TOSS_BILLING_CRON_TOKEN` |
| AdSense | `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID`, `NEXT_PUBLIC_ADSENSE_CONSENT_READY` |

`TOSS_BILLING_ENABLED` is a transitional lifecycle/recovery gate, not an
acquisition gate. Only the exact value `true` with the complete Toss group
enables renewal, cancellation, and reconciliation for an already-existing
agreement. It may coexist with retained Stripe and RevenueCat lifecycle groups.
Toss checkout preparation, callback, and purchase UI remain absent regardless
of this value; incomplete configuration fails closed.

The gates are explicit booleans, not inferred from secret presence:

- `false`: new purchases are unavailable, while configured webhook,
  reconciliation, management, cancellation, and existing entitlement paths stay on.
- `true`: new purchases may be offered only when the matching lifecycle group is
  complete and provider activation evidence has passed.

Mobile Superwall SDK keys and product identifiers are public Expo/EAS build
configuration, not Worker secrets. Server organization API keys and webhook
secrets must never be embedded in an app. See `apps/mobile/SETUP.md` for those
adapter-specific names.

## Advertising

Web uses the configured AdSense client and practice slot inside the sponsored
card shell. The server exposes them only when the consent-ready flag is true;
otherwise practice remains usable with a labeled Girapphe house card.

Mobile uses Google Mobile Ads with UMP gating and store-specific production
identifiers. Advertising behavior is unchanged by Billing V1, and `ad_free`
continues to suppress the sponsored interval across platforms.

## Legacy evidence and rollback boundary

The 2026-09-07 read-only production inspection found zero rows in the Girapphe
billing subscription/customer/webhook tables and every Toss agreement, intent,
session, and charge table. GitHub and Cloudflare configuration-name inspection
also found no Stripe, Toss, RevenueCat, Creem, or Superwall provider values.
Therefore no reconciled legacy subscriber or unresolved Toss financial state is
known to Girapphe. That evidence is not sufficient to make migration-time
deletion safe: `0019_billing_v1_domain.sql` retains every legacy billing/Toss
table and the previous `(provider, provider_subscription_id)` unique contract
while adding the environment-aware key required by Billing V1.

Provider dashboards were not available to that inspection. Before production
cleanup, independently verify Stripe has no customer/subscription requiring a
portal or webhook, Toss has no agreement/billing key/pending charge, and
RevenueCat has no real subscriber missing from Girapphe. Do not remove provider
dashboard configuration, Worker secret values, or physical database tables
until those absence checks or Superwall equivalence are recorded and the new
deployment has passed its rollback observation window. Cleanup is a separate
reviewed migration; see `docs/operations/billing.md`.

Until that evidence exists, `/api/webhooks/stripe`,
`/api/webhooks/revenuecat`, `/api/billing/portal`,
`/api/billing/toss/cancel`, and the authenticated Toss recovery scheduler are
intentional rollback/lifecycle bridges. Their presence does not reopen provider
selection or acquisition policy.

Historical migrations and dated architecture reviews remain as audit records.
Rollback must restore code and schema from a reviewed deployment; it must never
manufacture legacy subscriptions or silently cancel an external subscription.

## External activation evidence

Code and mocked tests are necessary but do not activate billing. Keep both
acquisition gates false until the applicable evidence is recorded:

1. Apply all migrations, including `0019_billing_v1_domain.sql`, to the isolated
   preview database and run the repository harness.
2. Creem: merchant/business approval, production product and webhook, payout
   setup, hosted checkout, real test payment, webhook, cancellation, portal,
   refund, failed payment, duplicate-checkout recovery, first production
   transaction, and first payout.
3. Superwall: production project/app configuration, exact Clerk identity mapping,
   Apple/Google product equivalence, signed server events, authoritative
   reconciliation, and confirmation that Girapphe's direct-purchase use is not
   billed as paywall-attributed MAR.
4. Apple: agreements/tax/banking and physical-device official sandbox purchase,
   restore, cancellation/expiration, account switch, server event, refund or
   revocation, and canonical Girapphe entitlement.
5. Google: agreements/tax/banking and official test purchase, restore,
   cancellation/expiration, account switch, server event, refund or revocation,
   and canonical Girapphe entitlement.
6. Verify web purchase grants mobile access and mobile purchase grants web
   access for the same Clerk account, including duplicate prevention and
   account-deletion handling.

PR Preview aliases change per pull request, so provider webhook delivery is not
proved automatically. Register only the exact current alias with matching test
credentials for a bounded test, then remove it. Never use production secrets in
a Preview Worker and never label mocked coverage as provider-ready evidence.
