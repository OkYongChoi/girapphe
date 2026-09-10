'use client';

import { useReverification } from '@clerk/nextjs';
import { isReverificationCancelledError } from '@clerk/nextjs/errors';
import { useState } from 'react';
import { useI18n } from '@/i18n/client';

async function requestAccountDeletion() {
  return fetch('/api/account', { method: 'DELETE' });
}

export function AccountDeletionPanel({ email }: { email: string }) {
  const { t } = useI18n();
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
        ? t('account.delete.cancelled')
        : t('account.delete.failed'));
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5">
      <h2 className="text-xl font-black text-red-950">{t('account.delete.title')}</h2>
      <p className="mt-3 text-sm leading-6 text-red-900">
        {t('account.delete.scope', { email: email || t('account.delete.accountFallback') })}
      </p>
      <p className="mt-3 text-sm leading-6 text-red-900">
        {t('account.delete.subscriptionWarning')}
      </p>
      <label className="mt-5 block text-sm font-bold text-red-950" htmlFor="delete-confirmation">
        {t('account.delete.confirm')}
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
        {busy ? t('account.delete.deleting') : t('account.delete.submit')}
      </button>
      {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
    </section>
  );
}
