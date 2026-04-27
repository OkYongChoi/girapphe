'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

export default function GuestStartButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isStarting, setIsStarting] = useState(false);
  const isBusy = isStarting || isPending;

  useEffect(() => {
    router.prefetch('/practice');
  }, [router]);

  return (
    <button
      type="button"
      disabled={isBusy}
      aria-busy={isBusy}
      onClick={() => {
        setIsStarting(true);
        startTransition(() => {
          router.push('/practice');
        });
      }}
      className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-100 disabled:cursor-wait disabled:bg-sky-100 disabled:text-slate-600"
    >
      {isBusy ? 'Starting...' : 'Start as guest'}
    </button>
  );
}
