'use client';

import { createKnowledgeItemWithOutcome } from '@/actions/user-knowledge-actions';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent, type ReactNode } from 'react';

type KnowledgeCreateFormProps = {
  children: ReactNode;
  fallbackAction: (formData: FormData) => Promise<void>;
  className?: string;
  submitLabel: string;
  savingLabel: string;
  rateLimitMessage: string;
  saveErrorMessage: string;
};

export default function KnowledgeCreateForm({
  children,
  fallbackAction,
  className,
  submitLabel,
  savingLabel,
  rateLimitMessage,
  saveErrorMessage,
}: KnowledgeCreateFormProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setErrorMessage(null);

    startSaving(async () => {
      try {
        const result = await createKnowledgeItemWithOutcome(formData);
        if (result.outcome === 'rate_limited') {
          setErrorMessage(rateLimitMessage);
          return;
        }
        if (result.outcome !== 'inserted' && result.outcome !== 'replayed') {
          setErrorMessage(saveErrorMessage);
          return;
        }

        form.reset();
        const currentUrl = new URL(window.location.href);
        if (currentUrl.searchParams.get('createStatus') === 'guest_write_rate_limited') {
          currentUrl.searchParams.delete('createStatus');
          window.history.replaceState(
            window.history.state,
            '',
            `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
          );
        }
        router.refresh();
      } catch {
        setErrorMessage(saveErrorMessage);
      }
    });
  }

  return (
    <form
      action={fallbackAction}
      onSubmit={handleSubmit}
      className={className}
      data-testid="knowledge-create-form"
    >
      {children}
      {errorMessage ? (
        <p
          role="alert"
          data-testid="knowledge-create-alert"
          className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950"
        >
          {errorMessage}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isSaving ? savingLabel : submitLabel}
        </button>
      </div>
    </form>
  );
}
