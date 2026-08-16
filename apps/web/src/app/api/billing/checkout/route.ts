import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { hasAdFreeEntitlement, type BillingPlan } from '@/lib/billing/database';
import {
  BillingConfigurationError,
  ExistingSubscriptionError,
  createStripeCheckout,
  requestHasTrustedOrigin,
} from '@/lib/billing/stripe';

const ALLOWED_PLANS = new Set<BillingPlan>(['monthly', 'annual']);

async function readPlan(request: Request): Promise<'monthly' | 'annual' | null> {
  const contentType = request.headers.get('content-type') ?? '';
  let value: unknown;
  if (contentType.includes('application/json')) {
    const payload: unknown = await request.json().catch(() => null);
    value = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).plan
      : null;
  } else {
    value = (await request.formData()).get('plan');
  }
  return typeof value === 'string' && ALLOWED_PLANS.has(value as BillingPlan)
    ? value as 'monthly' | 'annual'
    : null;
}

function subscriptionRedirect(request: Request, error: string) {
  const url = new URL('/subscription', request.url);
  url.searchParams.set('error', error);
  return NextResponse.redirect(url, 303);
}

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > 4_096) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  const user = await requireCurrentUser();
  const plan = await readPlan(request);
  if (!plan) return subscriptionRedirect(request, 'invalid_plan');
  if (await hasAdFreeEntitlement(user.id)) return subscriptionRedirect(request, 'already_active');

  try {
    const checkoutUrl = await createStripeCheckout({
      userId: user.id,
      email: user.email,
      plan,
      requestUrl: request.url,
    });
    return NextResponse.redirect(checkoutUrl, 303);
  } catch (error) {
    console.error('Unable to create Stripe Checkout session:', error);
    return subscriptionRedirect(
      request,
      error instanceof BillingConfigurationError
        ? 'not_configured'
        : error instanceof ExistingSubscriptionError
          ? 'subscription_exists'
          : 'checkout_failed',
    );
  }
}
