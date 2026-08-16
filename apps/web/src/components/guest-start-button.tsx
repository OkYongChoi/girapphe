'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

export default function GuestStartButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isStarting, setIsStarting] = useState(false);
  const isBusy = isStarting || isPending;
  const { locale, t } = useI18n();
  const practiceHref = localizePathname('/practice', locale);

  useEffect(() => {
    router.prefetch(practiceHref);
  }, [practiceHref, router]);

  return (
    <button
      type="button"
      disabled={isBusy}
      aria-busy={isBusy}
      onClick={() => {
        setIsStarting(true);
        startTransition(() => {
          router.push(practiceHref);
        });
      }}
      className="rounded-lg border border-cyan-100/70 bg-gradient-to-b from-cyan-200 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(255,255,255,0.82)] transition duration-300 hover:-translate-y-0.5 hover:from-cyan-100 hover:to-cyan-300 hover:shadow-[0_18px_42px_rgba(34,211,238,0.34)] disabled:cursor-wait disabled:from-sky-100 disabled:to-sky-200 disabled:text-slate-600"
    >
      {isBusy ? t('home.starting') : t('home.startGuest')}
    </button>
  );
}
