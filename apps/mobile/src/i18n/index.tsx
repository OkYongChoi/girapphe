import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';
import { reloadAppAsync } from 'expo';
import { I18nManager, Platform } from 'react-native';
import {
  DEFAULT_LOCALE,
  LOCALE_META,
  resolveLocale,
  type Locale,
} from '@stem-brain/shared';
import { catalogs, type MessageKey } from './catalogs';

const STORAGE_KEY = 'girapphe.mobile.locale';
let activeLocale: Locale = resolveLocale(Localization.getLocales()[0]?.languageTag, DEFAULT_LOCALE);

type Values = Record<string, string | number>;
type PluralBase = 'browse.privateNotes';

function interpolate(message: string, values?: Values): string {
  if (!values) return message;
  return message.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  );
}

export function getActiveLocale(): Locale {
  return activeLocale;
}

export function translate(locale: Locale, key: MessageKey, values?: Values): string {
  return interpolate(catalogs[locale][key], values);
}

async function syncNativeDirection(locale: Locale): Promise<void> {
  if (Platform.OS === 'web') return;
  const shouldBeRTL = LOCALE_META[locale].direction === 'rtl';
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === shouldBeRTL) return;
  I18nManager.forceRTL(shouldBeRTL);
  await reloadAppAsync('Apply Girapphe locale direction');
}

type I18nValue = {
  locale: Locale;
  direction: 'ltr' | 'rtl';
  isRTL: boolean;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: MessageKey, values?: Values) => string;
  plural: (base: PluralBase, count: number, values?: Values) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatPercent: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, updateLocale] = useState<Locale>(activeLocale);

  useEffect(() => {
    let mounted = true;
    void SecureStore.getItemAsync(STORAGE_KEY).then((saved) => {
      if (!mounted || !saved) return;
      const nextLocale = resolveLocale(saved, activeLocale);
      activeLocale = nextLocale;
      updateLocale(nextLocale);
      void syncNativeDirection(nextLocale);
    });
    return () => { mounted = false; };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    activeLocale = nextLocale;
    updateLocale(nextLocale);
    await SecureStore.setItemAsync(STORAGE_KEY, nextLocale);
    await syncNativeDirection(nextLocale);
  }, []);

  const value = useMemo<I18nValue>(() => {
    const t = (key: MessageKey, values?: Values) => translate(locale, key, values);
    const formatNumber = (number: number, options?: Intl.NumberFormatOptions) =>
      new Intl.NumberFormat(locale, options).format(number);
    return {
      locale,
      direction: LOCALE_META[locale].direction,
      isRTL: LOCALE_META[locale].direction === 'rtl',
      setLocale,
      t,
      plural: (base, count, values) => {
        const category = new Intl.PluralRules(locale).select(count);
        const candidate = `${base}.${category}` as MessageKey;
        const key = Object.prototype.hasOwnProperty.call(catalogs[locale], candidate)
          ? candidate
          : `${base}.other` as MessageKey;
        return t(key, { count: formatNumber(count), ...values });
      },
      formatNumber,
      formatDate: (input, options) => new Intl.DateTimeFormat(locale, options ?? { dateStyle: 'medium' }).format(new Date(input)),
      formatPercent: (number, options) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1, ...options }).format(number),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider.');
  return value;
}
