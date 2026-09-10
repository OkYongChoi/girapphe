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
  const localization = useClerkLocalization(locale);

  if (!localization) {
    return (
      <div className="mt-8 min-h-48 animate-pulse rounded-2xl bg-red-100" role="status">
        <span className="sr-only">{t('common.loading')}</span>
      </div>
    );
  }

  return (
    <ClerkProvider localization={localization}>
      <AccountDeletionPanel email={email} />
    </ClerkProvider>
  );
}
