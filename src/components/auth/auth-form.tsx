'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  loginAction,
  signupAction,
  type AuthActionState,
} from '@/actions/auth-actions';
import type { OAuthProvider } from '@/lib/oauth';

type Props = {
  mode: 'login' | 'signup';
  enabledProviders?: OAuthProvider[];
  oauthError?: string;
};

const INITIAL_STATE: AuthActionState = { error: null };

function SubmitButton({ mode }: { mode: 'login' | 'signup' }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
    </button>
  );
}

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: 'google', label: 'Google' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'claude', label: 'Claude' },
  { id: 'grok', label: 'Grok' },
];

function oauthErrorMessage(code?: string) {
  if (!code) return null;
  if (code === 'provider_not_configured') return 'This sign-in provider is not configured yet.';
  if (code === 'oauth_dev_login_failed') return 'Dev social login failed. Try email/password signup instead.';
  if (code.startsWith('oauth_')) return 'Social login failed. Please try again.';
  return null;
}

export default function AuthForm({ mode, enabledProviders = [], oauthError }: Props) {
  const action = mode === 'login' ? loginAction : signupAction;
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const oauthErrorText = oauthErrorMessage(oauthError);

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-700">
          ← Back to home
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        {mode === 'login'
          ? 'Log in to continue managing your personal knowledge map.'
          : 'Start tracking and improving your STEM knowledge.'}
      </p>

      <div className="mt-4 space-y-2">
        {PROVIDERS.filter((provider) => enabledProviders.includes(provider.id)).map((provider) => (
          <a
            key={provider.id}
            href={`/api/auth/oauth/${provider.id}/start`}
            className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-800 transition hover:bg-gray-50"
          >
            Continue with {provider.label}
          </a>
        ))}
        {enabledProviders.length === 0 ? (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
            No social login providers are configured.
          </p>
        ) : null}
      </div>

      {oauthErrorText ? <p className="mt-2 text-sm text-red-600">{oauthErrorText}</p> : null}

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-400">or email</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            placeholder="At least 8 characters"
          />
        </div>

        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <SubmitButton mode={mode} />
      </form>

      <p className="mt-4 text-sm text-gray-600">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <Link
          href={mode === 'login' ? '/signup' : '/login'}
          className="font-medium text-blue-600 hover:text-blue-700"
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </Link>
      </p>
    </div>
  );
}
