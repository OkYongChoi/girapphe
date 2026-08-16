import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import {
  createStripePortal,
  requestHasTrustedOrigin,
  StripePortalRateLimitError,
} from '@/lib/billing/stripe';

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const user = await requireCurrentUser();
  try {
    const portalUrl = await createStripePortal({ userId: user.id, requestUrl: request.url });
    return NextResponse.redirect(portalUrl, 303);
  } catch (error) {
    if (error instanceof StripePortalRateLimitError) {
      return NextResponse.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(error.retryAfterSeconds),
          },
        },
      );
    }
    console.error('Unable to create Stripe Customer Portal session:', error);
    const url = new URL('/subscription', request.url);
    url.searchParams.set('error', 'portal_failed');
    return NextResponse.redirect(url, 303);
  }
}
