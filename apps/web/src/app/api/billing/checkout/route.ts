import { NextResponse } from 'next/server';
import { requireCurrentUser } from '@/lib/auth';
import { hasAdFreeEntitlement, type BillingPlan } from '@/lib/billing/database';
import {
  BillingConfigurationError,
  ExistingSubscriptionError,
  createStripeCheckout,
  requestHasTrustedOrigin,
} from '@/lib/billing/stripe';
import { readBoundedBytes } from '@/lib/billing/bounded-json';

const ALLOWED_PLANS = new Set<BillingPlan>(['monthly', 'annual']);

type PlanBodyResult =
  | { ok: true; plan: 'monthly' | 'annual' }
  | { ok: false; reason: 'too_large' | 'invalid' };

async function readPlan(request: Request): Promise<PlanBodyResult> {
  const contentType = request.headers.get('content-type') ?? '';
  const body = await readBoundedBytes(request, 4_096);
  if (!body.ok) return { ok: false, reason: body.reason === 'too_large' ? 'too_large' : 'invalid' };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body.value);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  let value: unknown;
  if (contentType.includes('application/json')) {
    let payload: unknown = null;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = null;
    }
    value = payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).plan
      : null;
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    value = new URLSearchParams(text).get('plan');
  } else {
    return { ok: false, reason: 'invalid' };
  }
  return typeof value === 'string' && ALLOWED_PLANS.has(value as BillingPlan)
    ? { ok: true, plan: value as 'monthly' | 'annual' }
    : { ok: false, reason: 'invalid' };
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
  const user = await requireCurrentUser();
  const planBody = await readPlan(request);
  if (!planBody.ok) {
    if (planBody.reason === 'too_large') {
      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
    }
    return subscriptionRedirect(request, 'invalid_plan');
  }
  const { plan } = planBody;
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
