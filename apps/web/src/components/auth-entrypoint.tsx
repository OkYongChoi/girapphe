'use client';

import dynamic from 'next/dynamic';
import { ClerkProvider } from '@clerk/nextjs';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import { useClerkLocalization } from '@/i18n/use-clerk-localization';

const SignIn = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignIn),
  { ssr: false },
);

const SignUp = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignUp),
  { ssr: false },
);

export function AuthEntrypoint({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { locale, t } = useI18n();
  const practiceHref = localizePathname('/practice', locale);
  const localizationState = useClerkLocalization(locale);

  if (localizationState.status === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="h-72 w-full max-w-sm animate-pulse rounded-xl bg-gray-200" aria-hidden="true" />
      </main>
    );
  }

  if (localizationState.status === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm rounded-xl border border-red-200 bg-white p-6 text-center" role="alert">
          <p className="text-sm text-gray-700">{t('errors.body')}</p>
          <button
            type="button"
            className="mt-4 min-h-11 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={localizationState.retry}
          >
            {t('errors.tryAgain')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <ClerkProvider localization={localizationState.localization}>
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        {mode === 'sign-in' ? (
          <SignIn forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
        ) : (
          <SignUp forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
        )}
      </main>
    </ClerkProvider>
  );
}
