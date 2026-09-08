import { NextResponse } from 'next/server';
import { readBoundedBytes } from '@/lib/billing/bounded-json';
import {
  claimWebhookEvent,
  completeWebhookEvent,
  recordWebhookFailure,
} from '@/lib/billing/database';
import {
  CreemProviderRequestError,
  getCreemWebhookConfiguration,
  handleCreemReconciliationOutage,
  isCreemEventInScope,
  parseCreemEvent,
  processCreemEvent,
  subscriptionIdFromCreemEvent,
} from '@/lib/billing/creem';
import { verifyRawBodyHmacSha256 } from '@/lib/billing/hmac';
import { billingLog } from '@/lib/billing/logging';

const MAX_WEBHOOK_BYTES = 1_048_576;

export async function POST(request: Request) {
  let configuration: ReturnType<typeof getCreemWebhookConfiguration>;
  try {
    if (!process.env.DATABASE_URL) throw new Error('database unavailable');
    configuration = getCreemWebhookConfiguration();
  } catch {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const body = await readBoundedBytes(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason === 'too_large' ? 'request_too_large' : 'invalid_body' },
      { status: body.reason === 'too_large' ? 413 : 400 },
    );
  }
  const signature = request.headers.get('creem-signature');
  if (!signature || !verifyRawBodyHmacSha256(body.value, signature, configuration.secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body.value));
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const event = parseCreemEvent(payload);
  if (!event) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  if (!isCreemEventInScope(event, configuration.environment)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const claim = await claimWebhookEvent({
    provider: 'creem',
    environment: configuration.environment,
    eventId: event.id,
    eventType: event.type,
    providerEventAt: event.createdAt,
  });
  if (claim === 'processed') return NextResponse.json({ received: true, duplicate: true });
  if (claim === 'busy') {
    return NextResponse.json({ error: 'event_processing' }, { status: 409 });
  }

  try {
    const result = await processCreemEvent(event, claim);
    if (!result.handled) await completeWebhookEvent(claim);
    return NextResponse.json({ received: true, ignored: !result.handled });
  } catch (error) {
    const subscriptionId = subscriptionIdFromCreemEvent(event);
    if (
      error instanceof CreemProviderRequestError
      && error.outcome === 'unavailable'
      // A paid or payment-state notification can land while authoritative
      // retrieval is unavailable. The DB helper grants only an already
      // verified paid row and anchors technical grace once.
      && ['subscription.paid', 'subscription.past_due', 'subscription.unpaid'].includes(event.type)
    ) {
      await handleCreemReconciliationOutage(subscriptionId).catch(() => false);
    }
    const errorCode = error instanceof CreemProviderRequestError
      ? `provider_${error.outcome}`
      : 'reconciliation_failed';
    await recordWebhookFailure(claim, errorCode).catch(() => undefined);
    billingLog('error', {
      action: 'webhook_reconciliation_failed',
      provider: 'creem',
      eventId: event.id,
      eventType: event.type,
      providerSubscriptionId: subscriptionId,
      providerEventAt: event.createdAt,
      errorCode,
    });
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 });
  }
}
