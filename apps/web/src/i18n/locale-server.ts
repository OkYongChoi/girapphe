import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  type Locale,
} from '@stem-brain/shared';

export const getServerLocale = cache(async (): Promise<Locale> => {
  const requestHeaders = await headers();
  const headerLocale = requestHeaders.get('x-girapphe-locale');
  if (headerLocale) return resolveLocale(headerLocale, DEFAULT_LOCALE);

  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value, DEFAULT_LOCALE);
});
