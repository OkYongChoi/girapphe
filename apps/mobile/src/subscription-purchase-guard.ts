export type GuardedPurchaseResult<T> =
  | { alreadyEntitled: true }
  | { alreadyEntitled: false; purchaseResult: T };

/**
 * Keeps provider-neutral server entitlements authoritative at the moment a
 * store purchase begins. A rejected or malformed check propagates to the
 * caller, so the store operation is never attempted when verification fails.
 */
export async function purchaseAfterServerEntitlementCheck<T>(
  readServerEntitlement: () => Promise<boolean>,
  purchase: () => Promise<T>,
): Promise<GuardedPurchaseResult<T>> {
  if (await readServerEntitlement()) return { alreadyEntitled: true };

  return {
    alreadyEntitled: false,
    purchaseResult: await purchase(),
  };
}
