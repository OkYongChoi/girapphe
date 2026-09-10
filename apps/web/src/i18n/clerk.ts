import type { Locale } from '@stem-brain/shared';

export type ClerkLocalization = typeof import('@clerk/localizations/en-US')['enUS'];

const CLERK_LOCALIZATION_LOADERS = {
  en: async () => (await import('@clerk/localizations/en-US')).enUS,
  ja: async () => (await import('@clerk/localizations/ja-JP')).jaJP,
  'zh-CN': async () => (await import('@clerk/localizations/zh-CN')).zhCN,
  es: async () => (await import('@clerk/localizations/es-ES')).esES,
  ar: async () => (await import('@clerk/localizations/ar-SA')).arSA,
  hi: async () => (await import('@clerk/localizations/hi-IN')).hiIN,
} satisfies Record<Locale, () => Promise<ClerkLocalization>>;

export function loadClerkLocalization(locale: Locale): Promise<ClerkLocalization> {
  return CLERK_LOCALIZATION_LOADERS[locale]();
}
