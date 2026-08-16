import { NextResponse } from 'next/server';
import {
  claimWebhookEvent,
  markWebhookEventProcessed,
  releaseWebhookEvent,
} from '@/lib/billing/database';
import { constantTimeTextEqual, verifyTimestampedHmac } from '@/lib/billing/hmac';
import {
  isRevenueCatEventInScope,
  parseRevenueCatEvent,
  processRevenueCatEvent,
} from '@/lib/billing/revenuecat';
import { readBoundedBytes } from '@/lib/billing/bounded-json';

const MAX_WEBHOOK_BYTES = 1_048_576;

export async function POST(request: Request) {
  const expectedAuthorization = process.env.REVENUECAT_WEBHOOK_AUTHORIZATION;
  const signingSecret = process.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  const expectedAppIds = process.env.REVENUECAT_APP_IDS;
  const secretApiKey = process.env.REVENUECAT_SECRET_API_KEY;
  const monthlyProductIds = process.env.REVENUECAT_PRODUCT_AD_FREE_MONTHLY_IDS;
  const annualProductIds = process.env.REVENUECAT_PRODUCT_AD_FREE_ANNUAL_IDS;
  if (
    !process.env.DATABASE_URL
    || !expectedAuthorization
    || !signingSecret
    || !expectedAppIds
    || !secretApiKey
    || !monthlyProductIds
    || !annualProductIds
  ) {
    return NextResponse.json({ error: 'RevenueCat webhook is not configured.' }, { status: 503 });
  }
  const authorization = request.headers.get('authorization') ?? '';
  if (!constantTimeTextEqual(authorization, expectedAuthorization)) {
    return NextResponse.json({ error: 'Invalid webhook authorization.' }, { status: 401 });
  }
  const body = await readBoundedBytes(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) return NextResponse.json(
    { error: body.reason === 'too_large' ? 'Request body is too large.' : 'Invalid request body.' },
    { status: body.reason === 'too_large' ? 413 : 400 },
  );
  const rawBodyBytes = Buffer.from(body.value);
  const signature = request.headers.get('x-revenuecat-webhook-signature');
  if (!signature || !verifyTimestampedHmac(rawBodyBytes, signature, signingSecret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  const rawBody = rawBodyBytes.toString('utf8');
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const event = parseRevenueCatEvent(payload);
  if (!event) return NextResponse.json({ error: 'Invalid RevenueCat event.' }, { status: 400 });
  if (!isRevenueCatEventInScope(event, expectedAppIds)) {
    return NextResponse.json({ received: true, ignored: true });
  }
  const claim = await claimWebhookEvent('revenuecat', event.id, event.type);
  if (claim === 'processed') return NextResponse.json({ received: true, duplicate: true });
  if (claim === 'busy') return NextResponse.json({ error: 'Event is already processing.' }, { status: 409 });

  try {
    await processRevenueCatEvent(event);
    await markWebhookEventProcessed('revenuecat', event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await releaseWebhookEvent('revenuecat', event.id).catch(() => undefined);
    console.error('RevenueCat webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
