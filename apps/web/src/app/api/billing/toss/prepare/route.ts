import { getCurrentUser } from '@/lib/auth';
import { prepareTossBilling } from '@/lib/billing/toss-subscriptions';
import {
  isTossBillingConfigured,
  TossBillingError,
  type TossBillingPlan,
} from '@/lib/billing/toss';
import { requestHasTrustedOrigin } from '@/lib/billing/stripe';
import { hasAdFreeEntitlement, hasBlockingSubscription } from '@/lib/billing/database';
import { readBoundedJson } from '@/lib/billing/bounded-json';

export const dynamic = 'force-dynamic';

function isPlan(value: unknown): value is TossBillingPlan {
  return value === 'monthly' || value === 'annual';
}

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return Response.json({ error: 'invalid_request_origin' }, { status: 403 });
  }
  if (!isTossBillingConfigured()) {
    return Response.json(
      { error: 'billing_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'authentication_required' }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: 'billing_unavailable' }, { status: 503 });

  const parsedBody = await readBoundedJson(request, 4096);
  if (!parsedBody.ok) {
    return Response.json(
      { error: parsedBody.reason === 'too_large' ? 'request_too_large' : 'invalid_plan' },
      {
        status: parsedBody.reason === 'too_large' ? 413 : 400,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  }
  const body = parsedBody.value as { plan?: unknown } | null;
  if (!isPlan(body?.plan)) return Response.json({ error: 'invalid_plan' }, { status: 400 });

  const [isAdFree, hasBlockingPlan] = await Promise.all([
    hasAdFreeEntitlement(user.id),
    hasBlockingSubscription(user.id),
  ]);
  if (isAdFree || hasBlockingPlan) {
    return Response.json({ error: 'subscription_exists' }, { status: 409 });
  }

  try {
    const prepared = await prepareTossBilling(user.id, body.plan);
    const origin = new URL(request.url).origin;
    const { checkoutState, ...publicPreparation } = prepared;
    return Response.json(
      {
        ...publicPreparation,
        plan: body.plan,
        successUrl: `${origin}/api/billing/toss/callback?state=${checkoutState}`,
        failUrl: `${origin}/subscription/toss/fail`,
        customerEmail: user.email || undefined,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof TossBillingError && error.code === 'TOSS_PREPARE_RATE_LIMITED') {
      return Response.json(
        { error: 'rate_limited' },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': '600',
          },
        },
      );
    }
    return Response.json({ error: 'billing_unavailable' }, { status: 503 });
  }
}
