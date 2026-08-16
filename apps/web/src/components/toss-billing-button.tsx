'use client';

import { useState } from 'react';
import { useI18n } from '@/i18n/client';

type TossBillingPlan = 'monthly' | 'annual';

type TossPaymentWindow = {
  requestBillingAuth(input: {
    method: 'CARD';
    successUrl: string;
    failUrl: string;
    customerEmail?: string;
    windowTarget?: 'self' | 'iframe';
  }): Promise<void>;
};

type TossPaymentsFactory = (clientKey: string) => {
  payment(input: { customerKey: string }): TossPaymentWindow;
};

declare global {
  interface Window {
    TossPayments?: TossPaymentsFactory;
  }
}

let tossSdkPromise: Promise<TossPaymentsFactory> | null = null;

function loadTossSdk() {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser_required'));
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (tossSdkPromise) return tossSdkPromise;

  tossSdkPromise = new Promise<TossPaymentsFactory>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-girapphe-toss-sdk]');
    const script = existing ?? document.createElement('script');
    const onLoad = () => window.TossPayments ? resolve(window.TossPayments) : reject(new Error('sdk_unavailable'));
    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', () => reject(new Error('sdk_load_failed')), { once: true });
    if (!existing) {
      script.src = 'https://js.tosspayments.com/v2/standard';
      script.async = true;
      script.dataset.girappheTossSdk = 'true';
      document.head.appendChild(script);
    }
  }).catch((error) => {
    tossSdkPromise = null;
    throw error;
  });
  return tossSdkPromise;
}

export default function TossBillingButton({
  plan,
  amountKrw,
  trialAvailable,
  disabled = false,
}: {
  plan: TossBillingPlan;
  amountKrw: number;
  trialAvailable: boolean;
  disabled?: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={loading || disabled}
        onClick={async () => {
          if (loading) return;
          setLoading(true);
          setError(null);
          try {
            const response = await fetch('/api/billing/toss/prepare', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan }),
            });
            const prepared = await response.json() as {
              clientKey?: string;
              customerKey?: string;
              successUrl?: string;
              failUrl?: string;
              customerEmail?: string;
            };
            if (!response.ok || !prepared.clientKey || !prepared.customerKey || !prepared.successUrl || !prepared.failUrl) {
              throw new Error('prepare_failed');
            }
            const TossPayments = await loadTossSdk();
            const payment = TossPayments(prepared.clientKey).payment({ customerKey: prepared.customerKey });
            await payment.requestBillingAuth({
              method: 'CARD',
              successUrl: prepared.successUrl,
              failUrl: prepared.failUrl,
              customerEmail: prepared.customerEmail,
              windowTarget: 'self',
            });
          } catch {
            setError(t('toss.startError'));
            setLoading(false);
          }
        }}
        className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? t('toss.opening')
          : disabled
            ? t('toss.manageFirst')
            : trialAvailable
              ? t('toss.trialButton', { amount: formatNumber(amountKrw) })
              : t('toss.payButton', { amount: formatNumber(amountKrw) })}
      </button>
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
      <p className="mt-2 text-xs leading-relaxed text-slate-500">
        {t('toss.supportedCards')}
      </p>
    </div>
  );
}
