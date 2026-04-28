import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { hasValidClerkConfig } from '@/lib/clerk-env';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.girapphe.com'),
  applicationName: 'STEMBrain',
  title: {
    default: 'STEMBrain | Personal STEM Knowledge Graph',
    template: '%s | STEMBrain',
  },
  description: 'Practice STEM concepts, review weak spots, and build a personal knowledge graph across science, computing, and engineering.',
  alternates: {
    canonical: '/',
  },
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
    title: 'STEMBrain | Personal STEM Knowledge Graph',
    description: 'Practice STEM concepts and build your knowledge graph.',
    url: '/',
    siteName: 'STEMBrain',
    images: [
      {
        url: '/og-logo.png',
        width: 1200,
        height: 630,
        alt: 'STEMBrain knowledge graph logo',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STEMBrain | Personal STEM Knowledge Graph',
    description: 'Practice STEM concepts and build your knowledge graph.',
    images: ['/og-logo.png'],
  },
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const useClerk = hasValidClerkConfig();
  const body = (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );

  if (!useClerk) {
    return body;
  }

  return (
    <ClerkProvider>
      {body}
    </ClerkProvider>
  );
}
