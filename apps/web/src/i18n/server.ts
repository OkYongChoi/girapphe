import 'server-only';

import { cache } from 'react';
import { DEFAULT_LOCALE } from '@stem-brain/shared';
import { createI18n } from './core';
import { getServerLocale } from './locale-server';
import { MESSAGE_CATALOGS } from './messages';

export { getServerLocale } from './locale-server';

export const getServerI18n = cache(async () => {
  const locale = await getServerLocale();
  return createI18n(locale, MESSAGE_CATALOGS[locale] ?? MESSAGE_CATALOGS[DEFAULT_LOCALE]);
});
