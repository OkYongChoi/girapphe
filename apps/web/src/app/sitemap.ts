import type { MetadataRoute } from 'next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localizePathname } from '@stem-brain/shared';

const SITE_URL = 'https://www.girapphe.com';
const PUBLIC_ROUTES = ['/', '/knowledge', '/practice'] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.flatMap((pathname) => {
    const languages = Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, `${SITE_URL}${localizePathname(pathname, locale)}`]),
    );
    languages['x-default'] = `${SITE_URL}${localizePathname(pathname, DEFAULT_LOCALE)}`;

    return SUPPORTED_LOCALES.map((locale) => ({
      url: `${SITE_URL}${localizePathname(pathname, locale)}`,
      changeFrequency: pathname === '/' ? 'weekly' as const : 'daily' as const,
      priority: pathname === '/' ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
