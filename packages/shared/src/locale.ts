export const SUPPORTED_LOCALES = ['en', 'ja', 'zh-CN', 'es', 'ar', 'hi'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleDirection = 'ltr' | 'rtl';

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE_NAME = 'girapphe_locale';

export const LOCALE_META: Record<
  Locale,
  { nativeName: string; englishName: string; direction: LocaleDirection; translationCode: string }
> = {
  en: { nativeName: 'English', englishName: 'English', direction: 'ltr', translationCode: 'en' },
  ja: { nativeName: '日本語', englishName: 'Japanese', direction: 'ltr', translationCode: 'ja' },
  'zh-CN': { nativeName: '简体中文', englishName: 'Simplified Chinese', direction: 'ltr', translationCode: 'zh' },
  es: { nativeName: 'Español', englishName: 'Spanish', direction: 'ltr', translationCode: 'es' },
  ar: { nativeName: 'العربية', englishName: 'Arabic', direction: 'rtl', translationCode: 'ar' },
  hi: { nativeName: 'हिन्दी', englishName: 'Hindi', direction: 'ltr', translationCode: 'hi' },
};

const LOCALE_ALIASES: Record<string, Locale> = {
  en: 'en',
  ja: 'ja',
  jp: 'ja',
  zh: 'zh-CN',
  'zh-cn': 'zh-CN',
  'zh-hans': 'zh-CN',
  es: 'es',
  ar: 'ar',
  hi: 'hi',
};

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && SUPPORTED_LOCALES.includes(value as Locale));
}

export function resolveLocale(value: string | null | undefined, fallback: Locale = DEFAULT_LOCALE): Locale {
  const normalized = value?.trim().replace(/_/g, '-').toLowerCase();
  if (!normalized) return fallback;
  if (LOCALE_ALIASES[normalized]) return LOCALE_ALIASES[normalized];

  const base = normalized.split('-')[0];
  return LOCALE_ALIASES[base] ?? fallback;
}

export function parseAcceptLanguage(header: string | null | undefined, fallback: Locale = DEFAULT_LOCALE): Locale {
  if (!header) return fallback;

  const preferences = header
    .split(',')
    .map((part, index) => {
      const [tag, ...parameters] = part.trim().split(';');
      const qualityParameter = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = qualityParameter ? Number.parseFloat(qualityParameter.trim().slice(2)) : 1;
      return { tag, quality: Number.isFinite(quality) ? quality : 0, index };
    })
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const preference of preferences) {
    if (preference.quality <= 0 || preference.tag === '*') continue;
    const resolved = resolveLocale(preference.tag, fallback);
    const normalized = preference.tag.trim().replace(/_/g, '-').toLowerCase();
    if (LOCALE_ALIASES[normalized] || LOCALE_ALIASES[normalized.split('-')[0]]) return resolved;
  }

  return fallback;
}

export function getLocaleDirection(locale: Locale): LocaleDirection {
  return LOCALE_META[locale].direction;
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segment = pathname.split('/').filter(Boolean)[0];
  if (!segment) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment).replace(/_/g, '-').toLowerCase();
  } catch {
    return null;
  }
  return LOCALE_ALIASES[decoded] ?? LOCALE_ALIASES[decoded.split('-')[0]] ?? null;
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);
  if (!locale) return pathname || '/';
  const segments = pathname.split('/');
  const stripped = segments.slice(2).join('/');
  return stripped ? `/${stripped}` : '/';
}

export function localizePathname(pathname: string, locale: Locale): string {
  if (!pathname.startsWith('/') || pathname.startsWith('/api/')) return pathname;
  const [pathAndQuery, hash = ''] = pathname.split('#', 2);
  const [pathOnly, query = ''] = pathAndQuery.split('?', 2);
  const cleanPath = stripLocaleFromPathname(pathOnly || '/');
  const localized = `/${locale}${cleanPath === '/' ? '' : cleanPath}`;
  return `${localized}${query ? `?${query}` : ''}${hash ? `#${hash}` : ''}`;
}
