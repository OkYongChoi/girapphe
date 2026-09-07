import { NextResponse } from 'next/server';
import { readBoundedBytes } from '@/lib/billing/bounded-json';
import {
  claimWebhookEvent,
  recordWebhookFailure,
} from '@/lib/billing/database';
import { billingLog } from '@/lib/billing/logging';
import {
  verifySuperwallSignature,
  type SuperwallSignatureHeaders,
} from '@/lib/billing/superwall-signature';
import {
  SuperwallConfigurationError,
  SuperwallProviderRequestError,
  getSuperwallWebhookConfiguration,
  handleSuperwallSubscriptionOutage,
  isSuperwallEventInScope,
  parseSuperwallEvent,
  processSuperwallEvent,
} from '@/lib/billing/superwall';

export const dynamic = 'force-dynamic';
const MAX_WEBHOOK_BYTES = 1_048_576;

function requiredSvixHeaders(request: Request): SuperwallSignatureHeaders | null {
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signature = request.headers.get('svix-signature');
  return id && timestamp && signature
    ? { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signature }
    : null;
}

export async function POST(request: Request) {
  let configuration: ReturnType<typeof getSuperwallWebhookConfiguration>;
  try {
    configuration = getSuperwallWebhookConfiguration();
  } catch (error) {
    console.error('Superwall webhook lifecycle is not configured:', error);
    return NextResponse.json({ error: 'not_configured' }, { status: 503 });
  }

  const headers = requiredSvixHeaders(request);
  if (!headers) return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  const body = await readBoundedBytes(request, MAX_WEBHOOK_BYTES);
  if (!body.ok) {
    return NextResponse.json(
      { error: body.reason },
      { status: body.reason === 'too_large' ? 413 : 400 },
    );
  }

  let rawBody: string;
  try {
    rawBody = new TextDecoder('utf-8', { fatal: true }).decode(body.value);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  if (!verifySuperwallSignature(rawBody, headers, configuration.secret)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const event = parseSuperwallEvent(payload);
  if (!event) return NextResponse.json({ error: 'invalid_event' }, { status: 400 });
  if (!isSuperwallEventInScope(event)) {
    billingLog('warn', {
      action: 'webhook_out_of_scope',
      provider: 'superwall',
      eventId: event.id,
      eventType: event.type,
      providerSubscriptionId: event.providerRootTransactionId,
      productId: event.productId,
      providerEventAt: event.providerEventAt,
    });
    return NextResponse.json({ received: true, handled: false }, { status: 202 });
  }

  const claim = await claimWebhookEvent({
    provider: 'superwall',
    environment: configuration.environment,
    eventId: event.id,
    eventType: event.type,
    providerEventAt: event.providerEventAt,
  });
  if (claim === 'processed') return NextResponse.json({ received: true, duplicate: true });
  if (claim === 'busy') {
    return NextResponse.json(
      { error: 'event_busy' },
      { status: 503, headers: { 'Retry-After': '5' } },
    );
  }

  try {
    const result = await processSuperwallEvent(event, claim);
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    if (
      error instanceof SuperwallProviderRequestError
      && error.outcome === 'unavailable'
      && event.price >= 0
      && ['initial_purchase', 'renewal', 'uncancellation', 'billing_issue'].includes(event.type)
    ) {
      await handleSuperwallSubscriptionOutage(event).catch(() => false);
    }
    const errorCode = error instanceof SuperwallProviderRequestError
      ? `provider_${error.outcome}`
      : error instanceof SuperwallConfigurationError
        ? 'configuration_error'
        : 'reconciliation_failed';
    await recordWebhookFailure(claim, errorCode).catch(() => undefined);
    billingLog('error', {
      action: 'webhook_reconciliation_failed',
      provider: 'superwall',
      eventId: event.id,
      eventType: event.type,
      providerSubscriptionId: event.providerRootTransactionId,
      productId: event.productId,
      providerEventAt: event.providerEventAt,
      errorCode,
    });
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 });
  }
}
