import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import 'katex/dist/katex.min.css';
import './globals.css';
import { hasValidClerkConfig } from '@/lib/clerk-env';

export const metadata: Metadata = {
  title: 'Personal STEM Brain',
  description: 'Practice and manage your own STEM knowledge graph.',
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
