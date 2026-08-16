import {
  arSA,
  enUS,
  esES,
  hiIN,
  jaJP,
  zhCN,
} from '@clerk/localizations';
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
