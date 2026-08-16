import type { Locale } from '@stem-brain/shared';
import { AR_MESSAGES } from './catalogs/ar';
import { EN_MESSAGES } from './catalogs/en';
import { ES_MESSAGES } from './catalogs/es';
import { HI_MESSAGES } from './catalogs/hi';
import { JA_MESSAGES } from './catalogs/ja';
import { ZH_CN_MESSAGES } from './catalogs/zh-CN';

export type PluralMessage = {
  other: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
};

export type MessageValue = string | PluralMessage;
export type MessageKey = keyof typeof EN_MESSAGES;
export type MessageCatalog = { [Key in MessageKey]: MessageValue };

export const MESSAGE_CATALOGS: Record<Locale, MessageCatalog> = {
  en: EN_MESSAGES,
  ja: JA_MESSAGES,
  'zh-CN': ZH_CN_MESSAGES,
  es: ES_MESSAGES,
  ar: AR_MESSAGES,
  hi: HI_MESSAGES,
};
