'use client';

import { ClerkProvider } from '@clerk/nextjs';
import type { Locale } from '@stem-brain/shared';
import { AccountDeletionPanel } from '@/components/account-deletion-panel';
import { useI18n } from '@/i18n/client';
import { useClerkLocalization } from '@/i18n/use-clerk-localization';

export function LocalizedAccountDeletionPanel({
  email,
  locale,
}: {
  email: string;
  locale: Locale;
}) {
  const { t } = useI18n();
  const localizationState = useClerkLocalization(locale);

  if (localizationState.status === 'loading') {
    return (
      <div className="mt-8 min-h-48 animate-pulse rounded-2xl bg-red-100" role="status">
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  if (localizationState.status === 'error') {
    return (
      <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <p className="text-sm text-red-900">{t('errors.body')}</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white"
          onClick={localizationState.retry}
        >
          {t('errors.tryAgain')}
        </button>
      </div>
    );
  }

  return (
    <ClerkProvider localization={localizationState.localization}>
      <AccountDeletionPanel email={email} />
    </ClerkProvider>
  );
}
