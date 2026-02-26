'use client';

import { useTransition } from 'react';

interface ResetButtonProps {
  resetAction: () => Promise<void>;
}

export default function ResetButton({ resetAction }: ResetButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    if (!window.confirm('Reset all progress? This will clear your known / saved / again history and cannot be undone.')) {
      return;
    }
    startTransition(() => {
      void resetAction();
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? 'Resetting…' : 'Reset'}
    </button>
  );
}
