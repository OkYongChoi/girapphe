'use client';

import dynamic from 'next/dynamic';
import { ClerkProvider } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { localizePathname, type Locale } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

const SignIn = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignIn),
  { ssr: false },
);

const SignUp = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignUp),
  { ssr: false },
);

async function loadClerkLocalization(locale: Locale) {
  switch (locale) {
    case 'ar': return (await import('@clerk/localizations/ar-SA')).arSA;
    case 'es': return (await import('@clerk/localizations/es-ES')).esES;
    case 'hi': return (await import('@clerk/localizations/hi-IN')).hiIN;
    case 'ja': return (await import('@clerk/localizations/ja-JP')).jaJP;
    case 'zh-CN': return (await import('@clerk/localizations/zh-CN')).zhCN;
    default: return (await import('@clerk/localizations/en-US')).enUS;
  }
}

export function AuthEntrypoint({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { locale } = useI18n();
  const practiceHref = localizePathname('/practice', locale);
  const [localization, setLocalization] = useState<Awaited<ReturnType<typeof loadClerkLocalization>> | null>(null);

  useEffect(() => {
    let active = true;
    setLocalization(null);
    void loadClerkLocalization(locale).then((value) => {
      if (active) setLocalization(value);
    });
    return () => {
      active = false;
    };
  }, [locale]);

  if (!localization) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        <div className="h-72 w-full max-w-sm animate-pulse rounded-xl bg-gray-200" aria-hidden="true" />
      </main>
    );
  }

  return (
    <ClerkProvider localization={localization}>
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
        {mode === 'sign-in' ? (
          <SignIn forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
        ) : (
          <SignUp forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
        )}
      </main>
    </ClerkProvider>
  );
}
