'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';
import { browserLogoutOptions } from '@/lib/browser-logout-options';

export default function LogoutButton({
  label,
  ariaLabel,
  redirectUrl,
  className,
}: {
  label: string;
  ariaLabel: string;
  redirectUrl: string;
  className: string;
}) {
  const { isLoaded, sessionId, signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const disabled = pending || !isLoaded;

  const handleLogout = async () => {
    if (disabled) return;

    setPending(true);
    try {
      await signOut(browserLogoutOptions(redirectUrl, sessionId));
    } catch {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      disabled={disabled}
      className={className}
    >
      {pending ? `${label}…` : label}
    </button>
  );
}
