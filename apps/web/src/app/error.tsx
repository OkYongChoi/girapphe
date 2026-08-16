'use client';

import { useEffect, useRef } from 'react';
import { LocalizedLink } from '@/i18n/navigation';
import { useI18n } from '@/i18n/client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    // ChunkLoadError occurs when a new deployment invalidates cached JS chunks.
    // Automatically reload the page to fetch the latest assets.
    if (error.name === 'ChunkLoadError' || error.message?.includes('Failed to load chunk')) {
      window.location.reload();
      return;
    }
    console.error(error);
    headingRef.current?.focus();
  }, [error]);

  if (error.name === 'ChunkLoadError' || error.message?.includes('Failed to load chunk')) {
    return null;
  }

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold focus:outline-none">{t('errors.title')}</h1>
      <p className="max-w-md text-sm text-slate-600">{t('errors.body')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
        >
          {t('errors.tryAgain')}
        </button>
        <LocalizedLink
          href="/"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
        >
          {t('errors.returnHome')}
        </LocalizedLink>
      </div>
    </main>
  );
}
