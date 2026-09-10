'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@stem-brain/shared';
import { loadClerkLocalization, type ClerkLocalization } from './clerk';

type ClerkLocalizationState =
  | { status: 'loading'; localization: null }
  | { status: 'ready'; localization: ClerkLocalization }
  | { status: 'error'; localization: null };

export type ClerkLocalizationResult = ClerkLocalizationState & {
  retry: () => void;
};

export function useClerkLocalization(locale: Locale): ClerkLocalizationResult {
  const [state, setState] = useState<ClerkLocalizationState>({
    status: 'loading',
    localization: null,
  });
  const [loadVersion, setLoadVersion] = useState(0);
  const retry = useCallback(() => setLoadVersion((version) => version + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading', localization: null });
    void loadClerkLocalization(locale, { signal: controller.signal })
      .then((localization) => {
        if (!controller.signal.aborted) {
          setState({ status: 'ready', localization });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'error', localization: null });
        }
      });
    return () => controller.abort();
  }, [loadVersion, locale]);

  return { ...state, retry };
}
