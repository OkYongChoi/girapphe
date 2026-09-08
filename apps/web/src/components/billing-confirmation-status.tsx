'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  canonicalEntitlementIsActive,
  ENTITLEMENT_CONFIRMATION_BACKOFF_MS,
  ENTITLEMENT_CONFIRMATION_TIMEOUT_MS,
} from '@/lib/billing/confirmation';

type ConfirmationState = 'checking' | 'active' | 'delayed';

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeoutId);
      reject(signal.reason);
    }, { once: true });
  });
}
async function readEntitlement(signal: AbortSignal): Promise<boolean> {
  const response = await fetch('/api/billing/entitlement', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) return false;
  const payload: unknown = await response.json();
  return canonicalEntitlementIsActive(payload);
}

export default function BillingConfirmationStatus() {
  const router = useRouter();
  const [state, setState] = useState<ConfirmationState>('checking');

  useEffect(() => {
    const controller = new AbortController();
    const startedAt = Date.now();
    void (async () => {
      let attempt = 0;
      while (!controller.signal.aborted) {
        if (await readEntitlement(controller.signal).catch(() => false)) {
          setState('active');
          router.refresh();
          return;
        }
        const elapsed = Date.now() - startedAt;
        if (elapsed >= ENTITLEMENT_CONFIRMATION_TIMEOUT_MS) break;
        const backoff = ENTITLEMENT_CONFIRMATION_BACKOFF_MS[
          Math.min(attempt, ENTITLEMENT_CONFIRMATION_BACKOFF_MS.length - 1)
        ];
        attempt += 1;
        await wait(
          Math.min(backoff, ENTITLEMENT_CONFIRMATION_TIMEOUT_MS - elapsed),
          controller.signal,
        ).catch(() => undefined);
      }
      if (!controller.signal.aborted) setState('delayed');
    })();
    return () => controller.abort();
  }, [router]);

  if (state === 'active') {
    return (
      <div role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        Payment confirmed. Girapphe Plus is active for this Clerk account.
      </div>
    );
  }
  if (state === 'delayed') {
    return (
      <div role="status" className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Payment is being confirmed. Do not purchase again. You can safely return to this page later.
      </div>
    );
  }
  return (
    <div role="status" className="mt-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      Creem returned to Girapphe. We are waiting for verified provider state; this return does not grant Plus by itself.
    </div>
  );
}
