'use client';

import dynamic from 'next/dynamic';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';

const SignIn = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignIn),
  { ssr: false },
);

const SignUp = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignUp),
  { ssr: false },
);

export function AuthEntrypoint({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { locale } = useI18n();
  const practiceHref = localizePathname('/practice', locale);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      {mode === 'sign-in' ? (
        <SignIn forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
      ) : (
        <SignUp forceRedirectUrl={practiceHref} fallbackRedirectUrl={practiceHref} />
      )}
    </main>
  );
}
