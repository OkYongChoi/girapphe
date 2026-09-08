import type {
  BillingPlan,
  BillingProvider,
  BillingStatus,
  BillingStore,
} from '@stem-brain/shared';

type BillingLog = {
  action: string;
  provider: BillingProvider;
  store?: BillingStore | null;
  userId?: string | null;
  eventId?: string | null;
  eventType?: string | null;
  providerSubscriptionId?: string | null;
  productId?: string | null;
  plan?: BillingPlan | null;
  normalizedStatus?: BillingStatus | null;
  providerEventAt?: Date | null;
  reconciledAt?: Date | null;
  errorCode?: string | null;
};

function bounded(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/[\r\n\t]/g, ' ').slice(0, 200);
}

export function billingLog(
  level: 'info' | 'warn' | 'error',
  event: BillingLog,
): void {
  const record = {
    kind: 'billing',
    action: bounded(event.action),
    provider: event.provider,
    store: event.store ?? null,
    userId: bounded(event.userId),
    eventId: bounded(event.eventId),
    eventType: bounded(event.eventType),
    providerSubscriptionId: bounded(event.providerSubscriptionId),
    productId: bounded(event.productId),
    plan: event.plan ?? null,
    normalizedStatus: event.normalizedStatus ?? null,
    providerEventAt: event.providerEventAt?.toISOString() ?? null,
    reconciledAt: event.reconciledAt?.toISOString() ?? null,
    errorCode: bounded(event.errorCode),
  };
  const serialized = JSON.stringify(record);
  if (level === 'error') console.error(serialized);
  else if (level === 'warn') console.warn(serialized);
  else console.info(serialized);
}
