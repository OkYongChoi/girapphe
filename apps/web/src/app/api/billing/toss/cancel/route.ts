import { getCurrentUser } from '@/lib/auth';
import { cancelTossBilling } from '@/lib/billing/toss-subscriptions';
import { requestHasTrustedOrigin } from '@/lib/billing/stripe';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!requestHasTrustedOrigin(request)) {
    return Response.json({ error: 'invalid_request_origin' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'authentication_required' }, { status: 401 });
  if (!process.env.DATABASE_URL) return Response.json({ error: 'billing_unavailable' }, { status: 503 });

  try {
    const result = await cancelTossBilling(user.id);
    const url = new URL('/subscription', request.url);
    url.searchParams.set('checkout', result.pending > 0 ? 'toss_cancel_pending' : 'toss_cancelled');
    return NextResponse.redirect(url, 303);
  } catch {
    const url = new URL('/subscription', request.url);
    url.searchParams.set('error', 'toss_cancellation_failed');
    return NextResponse.redirect(url, 303);
  }
}
