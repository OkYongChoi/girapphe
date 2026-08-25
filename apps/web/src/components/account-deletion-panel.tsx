'use client';

import { useReverification } from '@clerk/nextjs';
import { isReverificationCancelledError } from '@clerk/nextjs/errors';
import { useState } from 'react';

async function requestAccountDeletion() {
  return fetch('/api/account', { method: 'DELETE' });
}

export function AccountDeletionPanel({ email }: { email: string }) {
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const deleteAccountWithReverification = useReverification(requestAccountDeletion);
  const canDelete = confirmation === 'DELETE' && !busy;

  async function deleteAccount() {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      const result = await deleteAccountWithReverification() as { deleted?: boolean };
      if (!result?.deleted) throw new Error('deletion_failed');
      window.location.assign('/');
    } catch (caught) {
      setError(isReverificationCancelledError(caught)
        ? 'Account deletion was cancelled. Your account and data were not changed.'
        : 'The account could not be deleted safely. Retry, or contact support if the problem continues.');
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
      <h2 className="text-xl font-black text-red-950">Permanently delete this account</h2>
      <p className="mt-3 text-sm leading-6 text-red-900">
        Signed in as <strong>{email || 'your Girapphe account'}</strong>. This deletes private notes, reviewed drafts,
        learning progress, access tokens, and your authentication account. It cannot be undone.
      </p>
      <p className="mt-3 text-sm leading-6 text-red-900">
        Cancel App Store or Google Play renewal separately before continuing. Girapphe will attempt to cancel supported web renewal.
      </p>
      <label className="mt-5 block text-sm font-bold text-red-950" htmlFor="delete-confirmation">
        Type DELETE to confirm
      </label>
      <input
        id="delete-confirmation"
        autoComplete="off"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        className="mt-2 w-full rounded-lg border border-red-300 bg-white px-3 py-3 font-mono text-slate-950 outline-none focus:ring-2 focus:ring-red-500"
      />
      <button
        type="button"
        disabled={!canDelete}
        onClick={() => void deleteAccount()}
        className="mt-4 min-h-12 rounded-lg bg-red-700 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Deleting account…' : 'Delete account permanently'}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
    </section>
  );
}
