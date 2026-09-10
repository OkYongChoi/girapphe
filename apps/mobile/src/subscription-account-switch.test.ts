import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Clerk sign-out still completes when native Superwall reset fails', () => {
  for (const relativePath of [
    '../app/(tabs)/account.tsx',
    '../app/(tabs)/index.tsx',
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
    const handler = source.slice(
      source.indexOf('async function signOut()'),
      source.indexOf('\n  }', source.indexOf('async function signOut()')) + 4,
    );
    assert.match(handler, /subscription\.resetIdentity\(\)/);
    assert.match(handler, /catch \(error\)/);
    assert.match(handler, /finally \{\s+await auth\.signOut\(\)/);
  }
});

test('mobile Plus disclosure includes both product benefits and preserves free creation', () => {
  const catalog = readFileSync(new URL('./i18n/catalogs.ts', import.meta.url), 'utf8');
  assert.match(catalog, /Learning, card creation, review, and private concepts stay free/);
  assert.match(catalog, /removes ads and unlocks the full public Knowledge Map/);
});

test('retained legacy web subscribers keep visible purchase-source metadata', () => {
  const screen = readFileSync(new URL('../app/subscription.tsx', import.meta.url), 'utf8');
  assert.match(screen, /active\?\.store === 'web'/);
  assert.match(screen, /subscription\.sourceLegacyWeb/);
  assert.match(screen, /activeMeta/);
});

test('canonical duplicate and acquisition-block states remain visible on mobile', () => {
  const provider = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  const screen = readFileSync(new URL('../app/subscription.tsx', import.meta.url), 'utf8');
  const catalog = readFileSync(new URL('./i18n/catalogs.ts', import.meta.url), 'utf8');

  assert.match(provider, /acquisitionBlocked: currentServerState\?\.acquisitionBlocked === true/);
  assert.match(provider, /duplicateDetected: currentServerState\?\.duplicateDetected === true/);
  assert.match(screen, /subscription\.duplicateDetected[\s\S]*?accessibilityRole="alert"/);
  assert.match(
    screen,
    /subscription\.isConfirming \|\| subscription\.acquisitionBlocked[\s\S]*?subscription\.confirming/,
  );
  assert.match(screen, /subscription\.acquisitionBlocked[\s\S]*?subscription\.refresh\(\)/);
  assert.match(catalog, /Duplicate subscriptions need review/);
  assert.match(catalog, /blocked so you are not charged again/);
});

test('unknown local billing state cannot expose plans or cross the final purchase preflight', () => {
  const source = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  assert.match(source, /let localStatus: SuperwallSubscriptionStatus = \{ status: 'UNKNOWN' \}/);
  assert.match(source, /localSubscriptionStatus !== 'INACTIVE'/);
  assert.match(source, /if \(!superwallStatusAllowsPurchase\(localStatus\)\) \{[\s\S]*return false/);
  assert.match(source, /&& localSubscriptionStatus === 'INACTIVE'/);
});

test('generic native purchase failure remains blocked as an indeterminate charge', () => {
  const source = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  const failure = source.slice(source.indexOf("if (result.type === 'failed')"));
  assert.match(failure, /purchaseOperationOutcome = 'indeterminate'/);
  assert.doesNotMatch(failure.slice(0, failure.indexOf("if (!isCurrentIdentity())")), /purchaseOperationOutcome = 'failed'/);
});

test('restore distinguishes an active Plus purchase from inactive and unknown state', () => {
  const source = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  const restore = source.slice(source.indexOf('const restore = useCallback'));
  assert.match(restore, /if \(locallySubscribed\) return reconcileAndConfirm\(billingSession\)/);
  assert.match(restore, /if \(status\.status === 'UNKNOWN'\)[\s\S]*confirmationMessage\(\)/);
  assert.match(restore, /setError\(t\('subscription\.noActivePurchase'\)\)/);
});

test('account switch sanitizes native identity before canonical I/O and freezes the billing token', () => {
  const source = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  const initialize = source.slice(
    source.indexOf('async function initialize()'),
    source.indexOf('void initialize()'),
  );
  assert.ok(
    initialize.indexOf('superwallClient.transitionIdentity(userId)')
      < initialize.indexOf('captureCurrentBillingSession(userId)'),
  );
  assert.ok(
    initialize.indexOf('captureCurrentBillingSession(userId)')
      < initialize.indexOf('readServer(billingSession)'),
  );

  const purchase = source.slice(
    source.indexOf('const purchase = useCallback'),
    source.indexOf('const restore = useCallback'),
  );
  assert.match(purchase, /purchaseSession = await captureCurrentBillingSession\(userId\)/);
  assert.match(purchase, /expectedUserId: userId,[\s\S]*getToken: purchaseSession\.getToken/);
  assert.match(purchase, /releaseSuperwallPurchaseOperation\(\{[\s\S]*getToken: purchaseSession\.getToken/);
});

test('inactive status transitions can reload products and pre-purchase unavailability releases the block', () => {
  const source = readFileSync(new URL('./subscriptions.tsx', import.meta.url), 'utf8');
  assert.match(
    source,
    /localSubscriptionStatus !== 'INACTIVE'[\s\S]*superwallClient\.loadProducts\(\)/,
  );
  const purchase = source.slice(
    source.indexOf('const purchase = useCallback'),
    source.indexOf('const restore = useCallback'),
  );
  assert.match(
    purchase,
    /if \(result\.type === 'unavailable'\) \{[\s\S]*purchaseOperationOutcome = 'aborted_before_purchase'/,
  );
});
