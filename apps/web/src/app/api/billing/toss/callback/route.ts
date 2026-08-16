import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  activateTossBilling,
  claimTossBillingSession,
  finishTossBillingSession,
} from '@/lib/billing/toss-subscriptions';
import {
  isTossBillingConfigured,
  isTossCheckoutState,
  TossBillingError,
} from '@/lib/billing/toss';

export const dynamic = 'force-dynamic';

function redirectToSubscription(request: Request, params: Record<string, string>) {
  const url = new URL('/subscription', request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}

export async function GET(request: Request) {
  if (!isTossBillingConfigured()) {
    return redirectToSubscription(request, { error: 'not_configured' });
  }
  const user = await getCurrentUser();
  if (!user) return redirectToSubscription(request, { error: 'authentication_required' });
  if (!process.env.DATABASE_URL) return redirectToSubscription(request, { error: 'not_configured' });

  const params = new URL(request.url).searchParams;
  const authKey = params.get('authKey')?.trim() ?? '';
  const customerKey = params.get('customerKey')?.trim() ?? '';
  const checkoutState = params.get('state')?.trim() ?? '';
  if (
    !authKey
    || authKey.length > 300
    || !/^girapphe_[A-Za-z0-9-]{30,42}$/.test(customerKey)
    || !isTossCheckoutState(checkoutState)
  ) {
    return redirectToSubscription(request, { error: 'toss_authorization_failed' });
  }

  let session: Awaited<ReturnType<typeof claimTossBillingSession>> | null = null;
  try {
    session = await claimTossBillingSession({
      userId: user.id,
      customerKey,
      checkoutState,
    });
    await activateTossBilling({
      userId: user.id,
      email: user.email,
      authKey,
      customerKey,
      plan: session.plan,
      checkoutTokenHash: session.tokenHash,
    });
    await finishTossBillingSession(session.tokenHash, 'consumed').catch(() => undefined);
    return redirectToSubscription(request, { checkout: 'toss_returned' });
  } catch (error) {
    if (
      error instanceof TossBillingError
      && error.code === 'TOSS_PAYMENT_RECONCILIATION_PENDING'
    ) {
      if (session) await finishTossBillingSession(session.tokenHash, 'consumed').catch(() => undefined);
      return redirectToSubscription(request, { checkout: 'toss_pending' });
    }
    if (session) await finishTossBillingSession(session.tokenHash, 'failed').catch(() => undefined);
    return redirectToSubscription(request, { error: 'toss_authorization_failed' });
  }
}
