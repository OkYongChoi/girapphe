'use client';

import { useFormStatus } from 'react-dom';
import { useI18n } from '@/i18n/client';

interface SubmitButtonProps {
  label: string;
  loadingLabel?: string;
  className?: string;
}

export default function SubmitButton({ label, loadingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (loadingLabel ?? t('common.saving')) : label}
    </button>
  );
}
