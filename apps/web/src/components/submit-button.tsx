'use client';

import { useFormStatus } from 'react-dom';

interface SubmitButtonProps {
  label: string;
  loadingLabel?: string;
  className?: string;
}

export default function SubmitButton({ label, loadingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (loadingLabel ?? 'Saving…') : label}
    </button>
  );
}
