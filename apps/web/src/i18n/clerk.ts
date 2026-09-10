import type { LocalizationResource } from '@clerk/nextjs/types';
import type { Locale } from '@stem-brain/shared';

export type ClerkLocalization = LocalizationResource;

const CLERK_LOCALIZATION_ASSETS = {
  en: { path: '/localization/clerk/en.json', resolvedLocale: 'en-US' },
  ja: { path: '/localization/clerk/ja.json', resolvedLocale: 'ja-JP' },
  'zh-CN': { path: '/localization/clerk/zh-CN.json', resolvedLocale: 'zh-CN' },
  es: { path: '/localization/clerk/es.json', resolvedLocale: 'es-ES' },
  ar: { path: '/localization/clerk/ar.json', resolvedLocale: 'ar-SA' },
  hi: { path: '/localization/clerk/hi.json', resolvedLocale: 'hi-IN' },
} satisfies Record<Locale, { path: string; resolvedLocale: string }>;

type LocalizationFetcher = (input: string, init: RequestInit) => Promise<Response>;

type LoadClerkLocalizationOptions = {
  fetcher?: LocalizationFetcher;
  retryDelayMs?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

function isExpectedLocalization(
  value: unknown,
  resolvedLocale: string,
): value is ClerkLocalization {
  return typeof value === 'object'
    && value !== null
    && 'locale' in value
    && value.locale === resolvedLocale;
}

function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchWithTimeout(
  fetcher: LocalizationFetcher,
  input: string,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  const attemptController = new AbortController();
  let rejectCancellation: (reason: unknown) => void = () => undefined;
  const cancellation = new Promise<never>((_resolve, reject) => {
    rejectCancellation = reject;
  });
  const abortAttempt = () => {
    const reason = signal?.reason instanceof Error
      ? signal.reason
      : new DOMException('Localization request was aborted.', 'AbortError');
    attemptController.abort(reason);
    rejectCancellation(reason);
  };

  if (signal?.aborted) abortAttempt();
  else signal?.addEventListener('abort', abortAttempt, { once: true });

  const timeout = setTimeout(() => {
    const error = new Error(`Localization request timed out after ${timeoutMs} ms.`);
    attemptController.abort(error);
    rejectCancellation(error);
  }, timeoutMs);

  try {
    return await Promise.race([
      fetcher(input, {
        credentials: 'same-origin',
        signal: attemptController.signal,
      }),
      cancellation,
    ]);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortAttempt);
  }
}

export async function loadClerkLocalization(
  locale: Locale,
  {
    fetcher = (input, init) => fetch(input, init),
    retryDelayMs = 200,
    signal,
    timeoutMs = 5_000,
  }: LoadClerkLocalizationOptions = {},
): Promise<ClerkLocalization> {
  const asset = CLERK_LOCALIZATION_ASSETS[locale];
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(fetcher, asset.path, signal, timeoutMs);
      if (!response.ok) throw new Error(`Localization asset returned ${response.status}.`);

      const localization: unknown = await response.json();
      if (!isExpectedLocalization(localization, asset.resolvedLocale)) {
        throw new Error('Localization asset did not match the requested locale.');
      }
      return localization;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (attempt === 0) await delay(retryDelayMs);
    }
  }

  throw new Error('Unable to load Clerk localization after two attempts.', {
    cause: lastError,
  });
}
