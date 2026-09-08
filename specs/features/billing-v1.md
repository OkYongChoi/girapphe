# Billing V1: Creem web and Superwall mobile

Status: Active

## User outcome

Girapphe Plus is one account-owned entitlement across web, iOS, and Android.
The same Clerk account receives `ad_free` and the full public Knowledge Map
after a provider-verified Creem, App Store, or Google Play subscription reaches
Girapphe's canonical billing state. Learning, card creation and review, private
concepts, and private relationships remain free.

## Scope

In scope:

- Sell one new web product through Creem hosted checkout: Girapphe Plus Annual,
  USD 10.00, tax inclusive, automatic renewal, quantity one, and no trial.
- Use Apple In-App Purchase and Google Play Billing through Superwall's
  purchase infrastructure while Girapphe renders the mobile purchase UI.
- Use the Clerk user ID as the external subscription identity wherever the
  provider supports it, and keep the Girapphe backend as the authorization
  boundary for `ad_free`.
- Normalize Creem and Superwall subscriptions into provider-neutral database
  records, with stable external identifiers and order-safe reconciliation.
- Prevent, detect, and expose recovery information for duplicate subscriptions
  without claiming atomicity across independent payment networks.
- Separate acquisition gates from webhook, reconciliation, management, and
  cancellation lifecycle processing.
- Remove RevenueCat and inactive Stripe and Toss purchase implementations after
  production-state evidence confirms that there are no subscribers, billing
  agreements, pending charges, or unresolved events to preserve.

Out of scope:

- Monthly web billing, trials, lifetime/team/family/regional plans, coupons,
  introductory discounts, or provider selection.
- Superwall-rendered paywalls, campaigns, experiments, or paid MAR features.
- A custom card engine, custom StoreKit/Play receipt verification service,
  automatic refunds, prorated provider switching, or cross-provider migration.
- Creating or changing live provider products, trials, merchant approval,
  payout/bank configuration, store agreements, signed builds, or store review.

## Acceptance criteria

- [ ] `AC-01`: New web checkout accepts only `annual`; the server selects the
  configured Creem product and rejects monthly or client-selected commercial
  fields.
- [ ] `AC-02`: Creem checkout requires Clerk authentication, an active account,
  no qualifying or unresolved subscription, an enabled acquisition gate, and
  a per-account lease before the provider mutation.
- [ ] `AC-03`: An indeterminate Creem response preserves a reusable pending
  checkout and never causes an automatic second checkout.
- [ ] `AC-04`: A checkout return only shows a bounded confirmation state;
  redirect/query parameters never grant `ad_free`.
- [ ] `AC-05`: Creem webhook verification uses the documented signature scheme,
  persists an idempotent event ledger, retries partial failures, and ignores
  stale state.
- [ ] `AC-06`: Creem subscription creation, renewal, scheduled cancellation,
  cancellation, expiration, payment failure/recovery, and full refund converge
  to normalized provider state.
- [ ] `AC-07`: A previously verified Creem renewal may receive one fixed
  72-hour billing grace, while provider-verification outages may receive at
  most one fixed 24-hour technical grace; neither slides on repeated requests.
- [ ] `AC-08`: Creem subscription management opens the Creem customer portal;
  refund execution remains a manual provider operation.
- [ ] `AC-09`: Mobile initializes Superwall without rendering a Superwall
  paywall and loads the monthly and annual native products for Girapphe's UI.
- [ ] `AC-10`: Mobile displays store-localized prices returned by Apple or
  Google and never hardcodes the USD reference prices in UI code.
- [ ] `AC-11`: Mobile direct purchase and restore use Superwall purchase
  infrastructure, while Girapphe creates no custom receipt-verification backend.
- [ ] `AC-12`: Login identifies the Clerk user in Superwall; logout and account
  switching reset user-specific SDK state before identifying and refreshing the
  next account.
- [ ] `AC-13`: A signed Superwall server event, not an app-authored purchase
  claim or local callback, converges mobile subscription state into Girapphe.
- [ ] `AC-14`: Initial purchase, renewal, scheduled cancellation, expiration,
  billing issue, refund/revocation, restore/reassociation, and product change
  are normalized from Superwall events without stale-event rollback.
- [ ] `AC-15`: `ad_free` is true when any non-revoked qualifying subscription
  has unexpired paid access or fixed grace, including cancellation at period
  end, and false only after all qualifying access ends.
- [ ] `AC-16`: Subscription records retain provider customer/user ID, stable
  provider subscription ID, store, product ID, environment, status, periods,
  cancellation/auto-renew state, provider event time, and reconciliation time.
- [ ] `AC-17`: Web and mobile acquisition both consult canonical server state;
  an account with Plus sees its active source and management destination instead
  of an immediate duplicate purchase offer.
- [ ] `AC-18`: Duplicate subscriptions are preserved and flagged for operator
  recovery; code does not delete rows or issue automatic refunds.
- [ ] `AC-19`: Creem, App Store, and Play Store management destinations are
  selected from purchase origin and expose plan, source, access-through date,
  and cancellation state when known.
- [ ] `AC-20`: Account deletion permanently blocks acquisition, safely cancels
  future Creem renewal, preserves required reconciliation metadata, and cleans
  the Superwall identity without claiming that this cancels store billing.
- [ ] `AC-21`: `WEB_BILLING_ACQUISITION_ENABLED` and
  `MOBILE_BILLING_ACQUISITION_ENABLED` fail closed independently of lifecycle
  configuration, so disabled acquisition does not disable verified events,
  reconciliation, management, or cancellation.
- [ ] `AC-22`: Logs contain safe provider, store, account, event, subscription,
  product, plan, normalized status, and reconciliation identifiers without
  secrets, raw payment payloads, or unnecessary personal data.
- [ ] `AC-23`: RevenueCat is absent from the final target SDK/server runtime and
  Stripe/Toss acquisition is disabled; transitional server lifecycle bridges
  remain until provider-dashboard absence/equivalence is proven. Production removal of legacy
  secrets, provider configuration, and physical tables occurs only after
  provider-dashboard and database evidence proves no state requires preservation.
- [ ] `AC-24`: The free/paid product boundary and canonical entitlement ID
  remain unchanged: Plus is ad-free plus the full public map, and private
  learning/knowledge creation remains free.
- [ ] `AC-25`: Production acquisition remains disabled until real Creem test
  payment/webhook/portal/refund/failure evidence, Apple sandbox device evidence,
  Google test-purchase evidence, Superwall server-event evidence, and all
  commercial activation items are recorded.

## Privacy and data boundaries

Clerk user IDs, never email addresses, own canonical subscription state. Email
may be sent to a hosted checkout only as provider-required contact data and does
not authorize ownership or transfer it. Provider redirects, client payloads,
local SDK callbacks, and price/product values are untrusted. Webhook bodies are
read with a size bound, authenticated from their raw bytes, and not logged.

Billing records retain the minimum stable identifiers and timestamps required
for access, reconciliation, disputes, refunds, deletion safety, and duplicate
recovery. Account deletion removes application-owned private knowledge while
retaining only billing metadata required for those obligations. Secrets remain
environment bindings and production secrets are never used in Preview.

## Verification

| Criterion | Evidence |
| --- | --- |
| `AC-01` | Annual-only checkout route and trusted-product tests. |
| `AC-02` | Checkout authentication, deletion fence, entitlement, pending-attempt, gate, and lease tests. |
| `AC-03` | Creem timeout and duplicate-checkout recovery tests. |
| `AC-04` | Checkout-return polling component and entitlement API tests. |
| `AC-05` | Creem signature, duplicate, partial-failure, and stale-event tests. |
| `AC-06` | Creem lifecycle normalization tests and provider sandbox evidence. |
| `AC-07` | Billing and technical-grace fixed-expiry tests. |
| `AC-08` | Creem portal route tests and provider sandbox evidence. |
| `AC-09` | Mobile Superwall adapter initialization and product-loading tests. |
| `AC-10` | Mobile UI source assertion and localized product fixture tests. |
| `AC-11` | Superwall direct-purchase bridge and restore tests plus device evidence. |
| `AC-12` | Superwall Clerk identity transition, frozen-token/expected-subject binding, logout, and account-switch tests. |
| `AC-13` | Superwall webhook authentication and non-authoritative app-callback tests. |
| `AC-14` | Superwall lifecycle normalization and stale-event tests. |
| `AC-15` | Canonical multi-provider entitlement aggregation tests. |
| `AC-16` | Drizzle migration and database write-contract assertions. |
| `AC-17` | Cross-provider web and mobile purchase-guard tests. |
| `AC-18` | Duplicate detection and operator-recovery projection tests. |
| `AC-19` | Subscription management projection and rendered UI tests. |
| `AC-20` | Account deletion fence, Creem cancellation, and Superwall lifecycle tests. |
| `AC-21` | Environment validation and acquisition-gate tests. |
| `AC-22` | Structured billing-log redaction assertions. |
| `AC-23` | Repository scan plus the provider-dashboard/database evidence and deferred-cleanup record in `docs/operations/billing.md`. |
| `AC-24` | Product-boundary regression tests and `pnpm harness`. |
| `AC-25` | `docs/operations/billing.md` launch checklist with provider/store evidence links; external items remain unchecked until observed. |

## Rollout

1. Apply the provider-neutral migration before deploying code that writes
   `creem` or `superwall` rows. The migration is additive and keeps legacy
   tables and the old subscription identity constraint for mixed-version
   deploys and rollback. Keep both acquisition gates false.
2. Configure isolated Creem and Superwall test/Preview credentials, products,
   and verified webhooks; exercise actual provider test flows and reconcile the
   resulting canonical rows.
3. Build and test signed iOS and Android binaries on the official store test
   environments. Confirm existing-store-subscription visibility before removing
   a live RevenueCat project; current production evidence indicates no rows or
   deployed provider credentials to migrate, but the provider dashboards still
   require an operator confirmation.
4. Deploy lifecycle processing first. Enable each acquisition gate only after
   its provider-specific launch blockers have evidence. A rollback closes the
   acquisition gate while leaving webhook, reconciliation, portal, cancellation,
   and already-verified entitlement paths running.
5. Do not mark this spec `Implemented` until provider sandbox/device evidence
   and commercial activation blockers are complete. Code-complete and
   externally activated are separate release states.
6. After provider-dashboard absence/equivalence and a completed rollback
   observation window are recorded, use a separate reviewed cleanup to remove
   legacy tables, Worker secret bindings, and provider dashboard configuration.
