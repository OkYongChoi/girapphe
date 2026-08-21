'use client';

import { useId } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LOCALE_META,
  SUPPORTED_LOCALES,
  localizePathname,
  type Locale,
} from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useI18n();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectId = useId();

  const changeLocale = (nextLocale: Locale) => {
    if (nextLocale === locale) return;

    document.documentElement.lang = nextLocale;
    document.documentElement.dir = LOCALE_META[nextLocale].direction;

    const query = searchParams.toString();
    const currentHref = `${pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    // Locale prefixes are rewritten to the shared route tree. A document navigation
    // guarantees the root layout, Clerk provider, metadata, and RTL direction all
    // rehydrate with the new locale instead of retaining a cached client layout.
    window.location.replace(localizePathname(currentHref, nextLocale));
  };

  return (
    <div className="inline-flex items-center gap-2">
      <label htmlFor={selectId} className={compact ? 'sr-only' : 'text-xs font-medium'}>
        {t('locale.label')}
      </label>
      <select
        id={selectId}
        value={locale}
        aria-label={t('locale.select')}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        className="min-h-11 max-w-36 rounded-md border border-current/20 bg-transparent px-2 py-1.5 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-500"
      >
        {SUPPORTED_LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale} className="bg-white text-slate-900">
            {LOCALE_META[supportedLocale].nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
