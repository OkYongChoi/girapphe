import { NextResponse } from 'next/server';
import { getCurrentUserProfile } from '@/lib/auth';
import { readAnnualPlan } from '@/lib/billing/checkout-policy';
import {
  BillingConfigurationError,
  CreemProviderRequestError,
  ExistingSubscriptionError,
  PendingCheckoutError,
  createCreemCheckout,
} from '@/lib/billing/creem';
import { requestHasTrustedOrigin } from '@/lib/billing/request-security';


function subscriptionRedirect(request: Request, error: string) {
  const url = new URL('/subscription', request.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const user = await getCurrentUserProfile();
  if (!user) return NextResponse.json({ error: 'authentication_required' }, { status: 401 });

  const planBody = await readAnnualPlan(request);
  if (!planBody.ok) {
    if (planBody.reason === 'too_large') {
      return NextResponse.json({ error: 'request_too_large' }, { status: 413 });
    }
    return subscriptionRedirect(
      request,
      planBody.reason === 'monthly' ? 'annual_only' : 'invalid_plan',
    );
  }

  try {
    const checkoutUrl = await createCreemCheckout({
      userId: user.id,
      email: user.email,
      plan: planBody.plan,
      requestUrl: request.url,
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error('Unable to create Creem checkout:', error);
    return subscriptionRedirect(
      request,
      error instanceof BillingConfigurationError
        ? 'not_configured'
        : error instanceof ExistingSubscriptionError
          ? 'subscription_exists'
          : error instanceof PendingCheckoutError
            ? 'payment_processing'
            : error instanceof CreemProviderRequestError && error.outcome === 'indeterminate'
              ? 'payment_processing'
              : 'checkout_failed',
    );
  }
}
