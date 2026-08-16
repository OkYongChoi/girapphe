'use client';

import { useI18n } from '@/i18n/client';

type TranslationFallbackBadgeProps = {
  resolvedLocale?: string;
  status?: string;
  className?: string;
};

export default function TranslationFallbackBadge({
  resolvedLocale,
  status,
  className = '',
}: TranslationFallbackBadgeProps) {
  const { locale, t } = useI18n();
  const isFallback = locale !== 'en'
    && (
      resolvedLocale === 'en'
      || status === 'fallback'
      || status === 'failed'
      || status === 'partial'
    );

  if (!isFallback) return null;

  return (
    <span
      role="status"
      title={t('translation.unavailable')}
      className={`inline-flex rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ${className}`.trim()}
    >
      {t('translation.englishFallback')}
    </span>
  );
}
