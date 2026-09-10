'use client';

import { useEffect, useState } from 'react';

interface ConfirmDeleteButtonProps {
  label: string;
  confirmMessage: string;
  className?: string;
  ariaLabel?: string;
}

export default function ConfirmDeleteButton({
  label,
  confirmMessage,
  className,
  ariaLabel,
}: ConfirmDeleteButtonProps) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <button
      type="submit"
      disabled={!hydrated}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {label}
    </button>
  );
}
