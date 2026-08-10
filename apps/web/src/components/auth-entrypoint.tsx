'use client';

import dynamic from 'next/dynamic';

const SignIn = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignIn),
  { ssr: false },
);

const SignUp = dynamic(
  () => import('@clerk/nextjs').then((module) => module.SignUp),
  { ssr: false },
);

export function AuthEntrypoint({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      {mode === 'sign-in' ? (
        <SignIn forceRedirectUrl="/practice" fallbackRedirectUrl="/practice" />
      ) : (
        <SignUp forceRedirectUrl="/practice" fallbackRedirectUrl="/practice" />
      )}
    </main>
  );
}
