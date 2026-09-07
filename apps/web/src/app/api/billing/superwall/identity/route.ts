import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { requestBodyIsEmpty } from '@/lib/billing/bounded-json';
import {
  SuperwallConfigurationError,
  isTrustedBillingMutationRequest,
  registerSuperwallIdentity,
} from '@/lib/billing/superwall';
import { requestHasExpectedBillingSubject } from '@/lib/billing/request-security';

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
    await registerSuperwallIdentity(user.id);
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Girapphe-Billing-Subject': user.id,
      },
    });
  } catch (error) {
    console.error('Unable to register Superwall identity:', error);
    return NextResponse.json(
      { error: error instanceof SuperwallConfigurationError ? 'not_configured' : 'identity_failed' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
