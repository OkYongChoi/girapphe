'use client';

import { useAuth } from '@clerk/nextjs';
import { useState } from 'react';
import { completeBrowserLogout } from '@/lib/browser-logout';

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
      await completeBrowserLogout({
        redirectUrl,
        sessionId,
        signOut,
        redirect: (url) => window.location.assign(url),
      });
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
