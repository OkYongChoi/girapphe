# Billing V1 operations

This runbook separates deployable Girapphe code from provider activation and
irreversible legacy cleanup. Do not enable acquisition or remove a legacy
recovery path merely because repository tests pass.

## Safe deployment order

1. Keep `WEB_BILLING_ACQUISITION_ENABLED=false` and
   `MOBILE_BILLING_ACQUISITION_ENABLED=false`.
2. Apply `0021_billing_v1_domain.sql`. It is additive: legacy billing/Toss
   tables and the old `(provider, provider_subscription_id)` unique constraint
   remain available to the running Worker and a rollback. Billing V1 adds a
   separate environment-aware unique constraint.
   The Preview schema runner then reclassifies pre-existing Preview
   subscription/webhook rows from the migration's production-compatible
   default to `test`, and changes only that isolated Preview database's
   compatibility defaults to `test`.
3. Deploy the new lifecycle handlers and verify the exact Worker revision,
   health endpoint, and canonical entitlement reads before enabling purchases.
4. Exercise provider test environments and record the evidence below.
5. Enable one acquisition gate only after its entire provider path passes.
   Closing a gate must not disable webhook, reconciliation, management,
   cancellation, or already-verified entitlement handling.

During this sequence, deployment leaves any existing Stripe, RevenueCat, and
Toss Worker secret bindings untouched. Omission from the new Worker does not
authorize deletion of those values.

The mixed-version Worker retains signed Stripe and RevenueCat webhook handlers,
authoritative legacy reconciliation, Stripe portal/account-deletion cleanup,
and Toss cancellation/recovery. Stripe checkout creation is hard-disabled and
Toss purchase preparation/callback/UI are absent. Do not interpret lifecycle
compatibility as an acquisition option.

For a verified existing Toss agreement, set `TOSS_BILLING_ENABLED` to exactly
`true` only alongside the complete legacy Toss group. This enables the retained
renewal, cancellation, and recovery paths and may coexist with Stripe or
RevenueCat lifecycle configuration. It never restores a Toss checkout route or
purchase UI. Missing, partial, or non-exact configuration keeps the bridge
closed.

## Activation evidence

Record links or dated operator evidence without copying secret values.

| Gate | Required evidence | State |
|---|---|---|
| Creem commercial | merchant/business approval; dashboard evidence that the product is exactly USD 10 annual, tax-inclusive, quantity one, automatically renewing, and has no trial; webhook; payout/bank setup | Blocked until provider evidence is attached |
| Creem lifecycle | hosted checkout, test payment, signed webhook, cancellation, portal, full refund, failed payment, duplicate-checkout recovery | Blocked until provider test evidence is attached |
| Superwall | production project/apps, Clerk user mapping, signed event, authoritative reconciliation, direct-purchase pricing confirmation | Blocked until provider evidence is attached |
| Apple | agreements/tax/banking; App Store product and existing trial/introductory-offer inspection; physical-device sandbox purchase, restore, expiry/cancellation, account switch, refund/revocation | Blocked until store/device evidence is attached |
| Google | agreements/tax/banking; Play product/base-plan and every existing trial/introductory offer inspection; official test purchase, restore, expiry/cancellation, account switch, refund/revocation | Blocked until store evidence is attached |
| Cross-platform | same Clerk account grants web purchase on mobile and store purchase on web; duplicate prevention and deletion flow verified | Blocked until end-to-end evidence is attached |

Mocked tests, local SDK checks, or an unsigned app build do not complete these
gates. A provider redirect or local mobile purchase callback is never canonical
authorization.

Mobile account switching starts the native Superwall reset/identify transition
before canonical network I/O. Each billing operation then freezes one Clerk
token and verifies the expected Clerk subject on every successful server
response, including release of a purchase fence. This protects the code path;
physical-device switching and interrupted-purchase evidence is still required
before activation.

The Creem product read validates price, currency, annual recurrence, tax mode,
and active status, but its documented product response does not prove the
separate dashboard trial setting. Likewise, the loaded Apple/Google purchase
option cannot prove that no other live introductory offer exists. Attach dated
dashboard/store evidence for those settings and report any pre-existing trial
without changing it before either acquisition gate is enabled.

## Legacy evidence and cleanup

The 2026-09-07 read-only database inspection found no rows in Girapphe's legacy
billing subscription/customer/webhook or Toss agreement, intent, session, and
charge tables. Configuration-name inspection found no deployed legacy provider
keys. Provider dashboards were not accessible, so this is not proof that no
orphan provider-side financial state exists.

Before opening the physical-cleanup change, independently record:

- Stripe: no active or scheduled subscription, customer requiring portal
  access, pending invoice/refund/dispute, or webhook reconciliation need.
- RevenueCat: no real Apple/Google subscriber missing from Girapphe, or recorded
  Superwall equivalence for every such subscriber.
- Toss: no live agreement or billing key, pending/uncertain charge, retry or
  reconciliation job, or unresolved cancellation.
- Girapphe DB: no legacy row requiring lifecycle/recovery handling and no
  unexpected legacy writer during the observation window.
- Deployment: Billing V1 has passed the agreed rollback observation window and
  the retained previous Worker revision can be retired.

Only then may a separate reviewed PR delete legacy Worker bindings, dashboard
configuration, Drizzle table declarations, physical tables, and the old unique
constraint. Preserve audit migrations. Never delete subscription rows to repair
a duplicate and never issue an automatic refund in V1.

## Rollback

First set the affected acquisition gate to `false`. Keep lifecycle processing
and canonical entitlement reads running. Because migration 0021 preserves the
legacy tables, subscription key, and secret values, the previously reviewed
Worker remains a database-compatible rollback target during the observation
window. Reconcile provider events received during the incident before reopening
acquisition.

If provider state and Girapphe disagree, preserve all records, block further
purchases for the account, order transactions by authoritative provider time,
and perform any cancellation/refund manually through the originating provider.

## Operator recovery for an acquisition block

`mobile_purchase_pending` intentionally has no clock-only expiry: an app kill,
network loss, StoreKit pending approval, or Google Play pending payment can
outlive the short execution lease. A signed Superwall event or manual refresh
resolves it only when the accompanying authoritative snapshot confirms current
qualifying access. Empty, expired, or incomplete historical rows do not prove
that a pending store transaction can no longer settle.

After reviewing the Superwall event history and the originating App Store or
Play transaction, an operator can resolve the preserved block without deleting
subscription rows:

```bash
pnpm --filter @stem-brain/web billing:block:resolve -- \
  --user user_example \
  --reason mobile_purchase_pending \
  --confirm resolve:user_example:mobile_purchase_pending
```

Use the same command with `duplicate_subscription` only after the later charge
has been canceled/refunded manually and canonical state has reconciled. The
command takes the permanent account lifecycle lock, refuses a deleted account,
marks the block resolved, and removes only its exact stale execution lease.

## Operator recovery for a Creem checkout with no provider id

A timeout while creating a checkout can leave an `indeterminate` ledger row
before Girapphe receives a Creem checkout id. Creem's documented checkout read
requires that id, so Girapphe must not auto-expire, retry, or assume this attempt
failed. Account deletion also remains stopped because a late checkout could
still create a subscription.

Only after account deletion has begun and an operator has checked the Creem
dashboard/event history and request logs to confirm that this exact attempt did
not create a checkout, charge, or subscription, mark the preserved attempt as
absent:

```bash
pnpm --filter @stem-brain/web billing:creem-attempt:resolve -- \
  --user user_example \
  --attempt checkout_attempt_123 \
  --confirm absent:user_example:checkout_attempt_123
```

The command takes the account lifecycle lock, requires the permanent deletion
marker, accepts only an unresolved Creem attempt with no provider checkout id,
and changes it to `abandoned` with `operator_confirmed_absent`. It never deletes
the ledger row. Retry account deletion afterward; if a provider checkout id is
present, use authoritative Creem reconciliation instead.
