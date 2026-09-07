export const ENTITLEMENT_CONFIRMATION_TIMEOUT_MS = 60_000;
export const ENTITLEMENT_CONFIRMATION_BACKOFF_MS = [
  1_000,
  2_000,
  3_000,
  5_000,
  8_000,
  10_000,
  15_000,
] as const;

export function canonicalEntitlementIsActive(payload: unknown): boolean {
  return Boolean(
    payload
    && typeof payload === 'object'
    && (payload as { isAdFree?: unknown }).isAdFree === true,
  );
}
