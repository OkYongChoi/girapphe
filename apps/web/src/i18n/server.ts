import 'server-only';

import { cache } from 'react';
import type { Locale } from '@stem-brain/shared';
import { createI18n } from './core';
import { getServerLocale } from './locale-server';
import type { MessageCatalog } from './messages';

export { getServerLocale } from './locale-server';

export const loadServerMessages = cache(async (locale: Locale): Promise<MessageCatalog> => {
  switch (locale) {
    case 'ja':
      return (await import('./catalogs/ja')).JA_MESSAGES;
    case 'zh-CN':
      return (await import('./catalogs/zh-CN')).ZH_CN_MESSAGES;
    case 'es':
      return (await import('./catalogs/es')).ES_MESSAGES;
    case 'ar':
      return (await import('./catalogs/ar')).AR_MESSAGES;
    case 'hi':
      return (await import('./catalogs/hi')).HI_MESSAGES;
    case 'en':
    default:
      return (await import('./catalogs/en')).EN_MESSAGES;
  }
});

export const getServerI18n = cache(async () => {
  const locale = await getServerLocale();
  return createI18n(locale, await loadServerMessages(locale));
});
