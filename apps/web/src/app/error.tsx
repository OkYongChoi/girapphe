'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // ChunkLoadError occurs when a new deployment invalidates cached JS chunks.
    // Automatically reload the page to fetch the latest assets.
    if (error.name === 'ChunkLoadError' || error.message?.includes('Failed to load chunk')) {
      window.location.reload();
      return;
    }
    console.error(error);
  }, [error]);

  if (error.name === 'ChunkLoadError' || error.message?.includes('Failed to load chunk')) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <button
        onClick={reset}
        className="rounded-md border px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
