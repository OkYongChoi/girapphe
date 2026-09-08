import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requestBodyIsEmpty } from '@/lib/billing/bounded-json';
import { consumeBillingRequestRateLimit } from '@/lib/billing/database';
import { publicBillingEntitlementResponse } from '@/lib/billing/entitlement-response';
import { requestHasExpectedBillingSubject } from '@/lib/billing/request-security';
import {
  SuperwallConfigurationError,
  SuperwallProviderRequestError,
  handleSuperwallUserReconciliationOutage,
  isTrustedBillingMutationRequest,
  reconcileSuperwallForUser,
} from '@/lib/billing/superwall';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isTrustedBillingMutationRequest(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  if (!requestHasExpectedBillingSubject(request, user.id)) {
    return NextResponse.json({ error: 'billing_subject_changed' }, { status: 409 });
  }
  if (!await requestBodyIsEmpty(request)) {
    return NextResponse.json({ error: 'request_body_not_allowed' }, { status: 400 });
  }

  try {
    const rateLimit = await consumeBillingRequestRateLimit({
      userId: user.id,
      action: 'superwall_reconcile',
      limit: 3,
      windowSeconds: 60,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'private, no-store',
            Vary: 'Cookie, Authorization',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
    const state = await reconcileSuperwallForUser(user.id);
    return NextResponse.json(publicBillingEntitlementResponse(state), {
      headers: {
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie, Authorization',
        'X-Girapphe-Billing-Subject': user.id,
      },
    });
  } catch (error) {
    console.error('Unable to reconcile Superwall subscription:', error);
    if (error instanceof SuperwallProviderRequestError && error.outcome === 'unavailable') {
      await handleSuperwallUserReconciliationOutage(user.id).catch(() => 0);
    }
    const status = error instanceof SuperwallProviderRequestError
      && error.outcome === 'definite_rejection'
      ? 502
      : 503;
    return NextResponse.json(
      {
        error: error instanceof SuperwallConfigurationError
          ? 'not_configured'
          : 'reconciliation_unavailable',
      },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
