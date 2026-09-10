'use client';

import { useEffect, useState } from 'react';
import type { Locale } from '@stem-brain/shared';
import { loadClerkLocalization, type ClerkLocalization } from './clerk';

export function useClerkLocalization(locale: Locale): ClerkLocalization | null {
  const [localization, setLocalization] = useState<ClerkLocalization | null>(null);

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

  return localization;
}
