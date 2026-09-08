import { NextResponse } from 'next/server';
import { subscriptionGrantsAdFree } from '@stem-brain/shared';
import { getCurrentUser } from '@/lib/auth';
import { createCreemCustomerPortal } from '@/lib/billing/creem';
import {
  consumeBillingRequestRateLimit,
  getSubscriptionOverviews,
} from '@/lib/billing/database';
import { requestHasTrustedOrigin } from '@/lib/billing/request-security';
import { createStripePortal, StripePortalRateLimitError } from '@/lib/billing/stripe';

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });
  try {
    const rateLimit = await consumeBillingRequestRateLimit({
      userId: user.id,
      action: 'customer_portal',
      limit: 5,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'private, no-store',
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }
    const subscriptions = await getSubscriptionOverviews(user.id);
    const subscription = subscriptions.find((candidate) => subscriptionGrantsAdFree(candidate))
      ?? subscriptions[0]
      ?? null;
    if (subscription?.provider === 'stripe') {
      return NextResponse.redirect(
        await createStripePortal({ userId: user.id, requestUrl: request.url }),
        303,
      );
    }
    if (subscription?.provider !== 'creem' || !subscription.providerCustomerId) {
      return NextResponse.json({ error: 'unsupported_provider' }, { status: 409 });
    }
    return NextResponse.redirect(
      await createCreemCustomerPortal({
        userId: user.id,
        providerCustomerId: subscription.providerCustomerId,
      }),
      303,
    );
  } catch (error) {
    if (error instanceof StripePortalRateLimitError) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }
    console.error('Unable to create Creem customer portal session:', error);
    const url = new URL('/subscription', request.url);
    url.searchParams.set('error', 'portal_failed');
    return NextResponse.redirect(url, 303);
  }
}
