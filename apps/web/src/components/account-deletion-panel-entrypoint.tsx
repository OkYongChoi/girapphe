'use client';

import dynamic from 'next/dynamic';
import type { Locale } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

function LoadingAccountDeletionPanel() {
  const { t } = useI18n();
  return (
    <div className="mt-8 min-h-48 animate-pulse rounded-2xl bg-red-100" role="status">
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}

const LocalizedAccountDeletionPanel = dynamic(
  () => import('./localized-account-deletion-panel')
    .then((module) => module.LocalizedAccountDeletionPanel),
  { ssr: false, loading: LoadingAccountDeletionPanel },
);

export function AccountDeletionPanelEntrypoint({
  email,
  locale,
}: {
  email: string;
  locale: Locale;
}) {
  return <LocalizedAccountDeletionPanel email={email} locale={locale} />;
}
