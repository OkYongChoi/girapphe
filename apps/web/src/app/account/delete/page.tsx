import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountDeletionPanel } from '@/components/account-deletion-panel';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import { deleteKnowledgeImportBatch } from '@/actions/knowledge-ingestion-actions';
import { requireCurrentUserProfile } from '@/lib/auth';
import { getKnowledgeDraftBatchesForUser } from '@/lib/knowledge-ingestion';

export const metadata: Metadata = {
  title: 'Delete account',
  description: 'Permanently delete a Girapphe account and its associated private product data.',
};

type DeleteAccountPageProps = { searchParams: Promise<{ importPage?: string | string[] }> };

export default async function DeleteAccountPage({ searchParams }: DeleteAccountPageProps) {
  const user = await requireCurrentUserProfile();
  const requestedPage = Number.parseInt(String((await searchParams).importPage ?? 1), 10);
  const importPage = Math.min(400, Math.max(1, requestedPage || 1));
  const pageSize = 50;
  const pageBatches = await getKnowledgeDraftBatchesForUser(user.id, true, {
    limit: pageSize + 1,
    offset: (importPage - 1) * pageSize,
  });
  const hasNextPage = pageBatches.length > pageSize;
  const batches = pageBatches.slice(0, pageSize);
  return (
    <main className="min-h-screen bg-[linear-gradient(160deg,#f8fafc_0%,#ecfeff_50%,#fff7ed_100%)] px-5 py-12 text-slate-900 sm:py-16">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <Link href="/support" className="text-sm font-semibold text-blue-700 underline underline-offset-4">← Support</Link>
        <h1 className="mt-7 font-serif text-4xl font-black tracking-tight sm:text-5xl">Knowledge data controls</h1>
        <p className="mt-4 leading-7 text-slate-600">
          Export every owner-scoped knowledge record, remove individual import jobs, or permanently delete the full Girapphe account.
        </p>

        <section id="knowledge-data" className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="border-t-4 border-cyan-700 bg-cyan-50/60 p-5">
            <h2 className="text-xl font-black">Export private knowledge</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Includes approved knowledge, revisions, provenance, relationships, pending candidates, import metadata, reuse activity, and privacy-safe feedback. Raw provider archives and transcripts are never included.</p>
            <a href="/api/knowledge/export?scope=all" download className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-cyan-800 px-4 py-2 text-sm font-black text-white">Download complete JSON export</a>
          </div>
          <div className="border-t-4 border-amber-500 bg-amber-50/60 p-5">
            <h2 className="text-xl font-black">Deletion boundaries</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Import-job deletion is immediate: pending candidates and job metrics are removed while approved knowledge and hashed provenance stay intact.</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">My Notes uses a visible 14-day Trash window for approved knowledge. Full account deletion below is immediate and irreversible.</p>
            <Link href="/my-notes" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">Manage approved knowledge</Link>
          </div>
        </section>

        <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="import-jobs-heading">
          <h2 id="import-jobs-heading" className="text-2xl font-black">Import jobs</h2>
          {batches.length === 0 ? <p className="mt-3 text-sm text-slate-600">No import jobs are stored for this account.</p> : (
            <ol className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {batches.map((batch) => (
                <li key={batch.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">{batch.provider} · {batch.scope.replace('_', ' ')} · {batch.status}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{batch.id}</p>
                    <p className="mt-1 text-sm text-slate-600">{batch.pending_count} pending · {batch.approved_count} approved</p>
                  </div>
                  <form action={deleteKnowledgeImportBatch}>
                    <input type="hidden" name="batch_id" value={batch.id} />
                    <ConfirmDeleteButton
                      label="Delete import job"
                      confirmMessage={`Permanently delete this import job and its ${batch.pending_count} pending candidates? ${batch.approved_count} approved knowledge items will be preserved. This cannot be undone.`}
                      className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-black text-red-800 hover:bg-red-50"
                    />
                  </form>
                </li>
              ))}
            </ol>
          )}
          {batches.length > 0 || importPage > 1 ? (
            <nav aria-label="Import job pages" className="mt-4 flex items-center gap-2 text-sm font-bold">
              {importPage > 1 ? <Link href={`/account/delete?importPage=${importPage - 1}#import-jobs-heading`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4">Previous</Link> : null}
              <span className="px-2 text-slate-600">Page {importPage}</span>
              {hasNextPage ? <Link href={`/account/delete?importPage=${importPage + 1}#import-jobs-heading`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4">Next</Link> : null}
            </nav>
          ) : null}
        </section>

        <div className="mt-10 border-t border-red-200 pt-2">
          <h2 className="mt-7 text-3xl font-black tracking-tight text-red-950">Delete Girapphe account</h2>
          <p className="mt-3 leading-7 text-slate-600">This verified web path applies to web, iOS, and Android. Review the irreversible scope before confirming.</p>
        </div>
        <AccountDeletionPanel email={user.email} />
        <p className="mt-6 text-sm leading-6 text-slate-500">
          See the <Link href="/privacy" className="font-semibold text-blue-700 underline underline-offset-4">Privacy Policy</Link>
          {' '}for retention details.
        </p>
      </div>
    </main>
  );
}
