import { headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocaleFromPathname,
  localizePathname,
  stripLocaleFromPathname,
  type Locale,
} from '@stem-brain/shared';

export const OPEN_GRAPH_LOCALES: Record<Locale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  'zh-CN': 'zh_CN',
  es: 'es_ES',
  ar: 'ar_SA',
  hi: 'hi_IN',
};

export async function getPublicPathname(): Promise<string> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-girapphe-public-path') ?? `/${DEFAULT_LOCALE}`;
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function getLocalizedAlternates(publicPathname: string) {
  const internalPathname = getLocaleFromPathname(publicPathname)
    ? stripLocaleFromPathname(publicPathname)
    : publicPathname;
  const languages = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, localizePathname(internalPathname, locale)]),
  );
  languages['x-default'] = localizePathname(internalPathname, DEFAULT_LOCALE);

  return {
    canonical: publicPathname,
    languages,
  };
}
