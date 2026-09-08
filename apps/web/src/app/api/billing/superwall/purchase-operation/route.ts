import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requestBodyIsEmpty } from '@/lib/billing/bounded-json';
import {
  claimAccountBillingOperation,
  isBillingOperationOwnerToken,
  persistMobilePurchasePendingBlock,
  releaseMobilePurchaseOperationForUser,
  requireBillingEntitlementState,
} from '@/lib/billing/database';
import {
  isSuperwallAcquisitionEnabled,
  isTrustedBillingMutationRequest,
} from '@/lib/billing/superwall';
import { requestHasExpectedBillingSubject } from '@/lib/billing/request-security';

export const dynamic = 'force-dynamic';

const PRIVATE_HEADERS = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie, Authorization',
};

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
  if (!isSuperwallAcquisitionEnabled()) {
    return NextResponse.json(
      { error: 'acquisition_disabled' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }

  const lease = await claimAccountBillingOperation(user.id, 'superwall', 'mobile_purchase');
  if (!lease) {
    return NextResponse.json(
      { error: 'purchase_operation_unavailable' },
      { status: 409, headers: PRIVATE_HEADERS },
    );
  }
  try {
    const canonical = await requireBillingEntitlementState(user.id);
    if (canonical.acquisitionBlocked) {
      await releaseMobilePurchaseOperationForUser(user.id, lease.ownerToken);
      return NextResponse.json(
        { error: 'subscription_or_purchase_exists' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
    if (!await persistMobilePurchasePendingBlock(user.id, lease)) {
      await releaseMobilePurchaseOperationForUser(user.id, lease.ownerToken);
      return NextResponse.json(
        { error: 'purchase_operation_unavailable' },
        { status: 409, headers: PRIVATE_HEADERS },
      );
    }
  } catch (error) {
    await releaseMobilePurchaseOperationForUser(user.id, lease.ownerToken).catch(() => false);
    console.error('Unable to verify mobile purchase eligibility:', error);
    return NextResponse.json(
      { error: 'entitlement_unavailable' },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  return NextResponse.json(
    { ownerToken: lease.ownerToken },
    {
      headers: {
        ...PRIVATE_HEADERS,
        'X-Girapphe-Billing-Subject': user.id,
      },
    },
  );
}

export async function DELETE(request: Request) {
  if (!isTrustedBillingMutationRequest(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  if (!requestHasExpectedBillingSubject(request, user.id)) {
    return NextResponse.json({ error: 'billing_subject_changed' }, { status: 409 });
  }
  if (new URL(request.url).search.length > 0 || !await requestBodyIsEmpty(request)) {
    return NextResponse.json({ error: 'request_body_or_query_not_allowed' }, { status: 400 });
  }
  const ownerToken = request.headers.get('X-Girapphe-Billing-Operation-Token')?.trim() ?? '';
  if (!isBillingOperationOwnerToken(ownerToken)) {
    return NextResponse.json({ error: 'invalid_operation_token' }, { status: 400 });
  }

  await releaseMobilePurchaseOperationForUser(user.id, ownerToken);
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...PRIVATE_HEADERS,
      'X-Girapphe-Billing-Subject': user.id,
    },
  });
}
