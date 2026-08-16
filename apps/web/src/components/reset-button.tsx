'use client';

import { useTransition } from 'react';
import { useI18n } from '@/i18n/client';

interface ResetButtonProps {
  resetAction: () => Promise<void>;
}

export default function ResetButton({ resetAction }: ResetButtonProps) {
  const [isPending, startTransition] = useTransition();
  const { t } = useI18n();

  const handleClick = () => {
    if (!window.confirm(t('saved.resetConfirm'))) {
      return;
    }
    startTransition(() => {
      void resetAction();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? t('common.loading') : t('common.reset')}
    </button>
  );
}
