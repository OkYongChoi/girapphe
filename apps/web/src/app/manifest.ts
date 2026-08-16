import type { MetadataRoute } from 'next';
import { LOCALE_META } from '@stem-brain/shared';
import { METADATA_COPY } from '@/i18n/metadata-copy';
import { getServerLocale } from '@/i18n/server';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getServerLocale();

  return {
    name: 'STEMBrain',
    short_name: 'STEMBrain',
    description: METADATA_COPY[locale].description,
    start_url: `/${locale}`,
    scope: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#0f172a',
    lang: locale,
    dir: LOCALE_META[locale].direction,
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
