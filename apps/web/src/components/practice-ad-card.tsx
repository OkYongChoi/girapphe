'use client';

import Link from 'next/link';
import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export default function PracticeAdCard({
  clientId,
  slotId,
  sequence,
  onContinue,
}: {
  clientId: string | null;
  slotId: string | null;
  sequence: number;
  onContinue: () => void;
}) {
  const [adFailed, setAdFailed] = useState(false);
  const requested = useRef(false);
  const cardRef = useRef<HTMLElement>(null);
  const adSlotRef = useRef<HTMLModElement>(null);
  const configured = Boolean(clientId && slotId) && !adFailed;
  const requestAd = useCallback(() => {
    if (!configured || requested.current || !window.adsbygoogle) return;
    try {
      window.adsbygoogle.push({});
      requested.current = true;
    } catch (error) {
      console.error('AdSense practice card request failed:', error);
      setAdFailed(true);
    }
  }, [configured]);

  useEffect(() => {
    requestAd();
  }, [requestAd]);

  useEffect(() => {
    if (!configured) return;

    const slot = adSlotRef.current;
    if (!slot) return;

    const handleStatus = () => {
      if (slot.dataset.adStatus === 'unfilled') setAdFailed(true);
    };
    handleStatus();

    const observer = new MutationObserver(handleStatus);
    observer.observe(slot, { attributes: true, attributeFilter: ['data-ad-status'] });
    const timeout = window.setTimeout(() => {
      if (slot.dataset.adStatus !== 'filled') setAdFailed(true);
    }, 12_000);

    return () => {
      observer.disconnect();
      window.clearTimeout(timeout);
    };
  }, [configured]);

  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  return (
    <section
      ref={cardRef}
      tabIndex={-1}
      aria-label="Sponsored practice card"
      className="flex min-h-[34rem] w-full max-w-md flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-xl focus:outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Sponsored</p>
        <p className="text-xs text-slate-400">After {sequence * 5} cards</p>
      </div>

      {configured ? (
        <div className="my-5 flex min-h-[22rem] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
          <Script
            id="girapphe-practice-adsense"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId!)}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
            onLoad={requestAd}
            onReady={requestAd}
            onError={() => setAdFailed(true)}
          />
          <ins
            ref={adSlotRef}
            className="adsbygoogle block min-h-[20rem] w-full"
            data-ad-client={clientId!}
            data-ad-slot={slotId!}
            data-ad-format="fluid"
            data-full-width-responsive="true"
          />
        </div>
      ) : (
        <div className="my-5 flex flex-1 flex-col justify-between rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Girapphe Ad-free</p>
            <h2 className="mt-4 text-3xl font-black leading-tight">Stay in your review flow.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Remove sponsored cards for $1 per month or $10 per year. Learning and card creation stay free.
            </p>
          </div>
          <Link
            href="/subscription"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-100 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            See ad-free plans
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="min-h-12 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Continue reviewing
      </button>
    </section>
  );
}
