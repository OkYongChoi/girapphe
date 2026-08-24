'use client';

import { useFormStatus } from 'react-dom';

export default function LogoutButton({
  label,
  ariaLabel,
  className,
}: {
  label: string;
  ariaLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      aria-label={ariaLabel}
      aria-disabled={pending}
      disabled={pending}
      className={className}
    >
      {pending ? `${label}…` : label}
    </button>
  );
}
