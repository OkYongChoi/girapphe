import { arSA } from '@clerk/localizations/ar-SA';
import { enUS } from '@clerk/localizations/en-US';
import { esES } from '@clerk/localizations/es-ES';
import { hiIN } from '@clerk/localizations/hi-IN';
import { jaJP } from '@clerk/localizations/ja-JP';
import { zhCN } from '@clerk/localizations/zh-CN';
import type { Locale } from '@stem-brain/shared';

const CLERK_LOCALIZATIONS = {
  en: enUS,
  ja: jaJP,
  'zh-CN': zhCN,
  es: esES,
  ar: arSA,
  hi: hiIN,
} satisfies Record<Locale, typeof enUS>;

export function getClerkLocalization(locale: Locale): typeof enUS {
  return CLERK_LOCALIZATIONS[locale] ?? enUS;
}
