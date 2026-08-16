'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_LOCALE, type Locale } from '@stem-brain/shared';
import { createI18n, type I18n } from './core';

const DEFAULT_I18N = createI18n(DEFAULT_LOCALE);
const I18nContext = createContext<I18n>(DEFAULT_I18N);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => createI18n(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  return useContext(I18nContext);
}
