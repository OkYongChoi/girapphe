export function requestHasTrustedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const configured = process.env.APP_BASE_URL?.trim();
    const expected = configured ? new URL(configured).origin : new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export const EXPECTED_BILLING_SUBJECT_HEADER = 'X-Girapphe-Expected-Billing-Subject';

export function requestHasExpectedBillingSubject(
  request: Request,
  authenticatedUserId: string,
): boolean {
  const expected = request.headers.get(EXPECTED_BILLING_SUBJECT_HEADER)?.trim() ?? '';
  return Boolean(expected && expected === authenticatedUserId);
}
