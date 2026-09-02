import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { I18nProvider } from '@/i18n/client';
import { getServerI18n } from '@/i18n/server';
import { METADATA_COPY } from '@/i18n/metadata-copy';
import {
  OPEN_GRAPH_LOCALES,
  getLocalizedAlternates,
  getPublicPathname,
} from '@/lib/locale-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const [{ locale }, publicPathname] = await Promise.all([
    getServerI18n(),
    getPublicPathname(),
  ]);
  const copy = METADATA_COPY[locale];

  return {
    metadataBase: new URL('https://www.girapphe.com'),
    applicationName: 'Girapphe',
    title: {
      default: copy.title,
      template: '%s | Girapphe',
    },
    description: copy.description,
    alternates: getLocalizedAlternates(publicPathname),
    icons: {
      icon: [
        { url: '/favicon.ico', sizes: 'any' },
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      shortcut: '/favicon.ico',
      apple: '/apple-touch-icon.png',
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: publicPathname,
      siteName: 'Girapphe',
      locale: OPEN_GRAPH_LOCALES[locale],
      alternateLocale: Object.values(OPEN_GRAPH_LOCALES).filter(
        (candidate) => candidate !== OPEN_GRAPH_LOCALES[locale],
      ),
      images: [
        {
          url: '/og-logo.png',
          width: 1200,
          height: 630,
          alt: copy.imageAlt,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.title,
      description: copy.description,
      images: ['/og-logo.png'],
    },
    manifest: '/manifest.webmanifest',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const i18n = await getServerI18n();
  const webMcpOriginTrialToken = process.env.NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN?.trim();
  const body = (
    <html
      lang={i18n.locale}
      dir={i18n.direction}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      {webMcpOriginTrialToken ? (
        <head>
          <meta httpEquiv="origin-trial" content={webMcpOriginTrialToken} />
        </head>
      ) : null}
      <body className="antialiased" suppressHydrationWarning>
        <I18nProvider locale={i18n.locale} messages={i18n.messages}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );

  return body;
}
