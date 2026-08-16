import { NextResponse } from 'next/server';
import {
  claimWebhookEvent,
  markWebhookEventProcessed,
  releaseWebhookEvent,
} from '@/lib/billing/database';
import { verifyTimestampedHmac } from '@/lib/billing/hmac';
import { parseStripeEvent, processStripeEvent } from '@/lib/billing/stripe';

const MAX_WEBHOOK_BYTES = 1_048_576;

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }

  const rawBodyBytes = Buffer.from(await request.arrayBuffer());
  if (rawBodyBytes.byteLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature || !verifyTimestampedHmac(rawBodyBytes, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
  }

  const rawBody = rawBodyBytes.toString('utf8');
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const event = parseStripeEvent(payload);
  if (!event) return NextResponse.json({ error: 'Invalid Stripe event.' }, { status: 400 });
  const claim = await claimWebhookEvent('stripe', event.id, event.type);
  if (claim === 'processed') return NextResponse.json({ received: true, duplicate: true });
  if (claim === 'busy') return NextResponse.json({ error: 'Event is already processing.' }, { status: 409 });

  try {
    await processStripeEvent(event);
    await markWebhookEventProcessed('stripe', event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await releaseWebhookEvent('stripe', event.id).catch(() => undefined);
    console.error('Stripe webhook processing failed:', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
