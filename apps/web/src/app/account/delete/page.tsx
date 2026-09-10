import type { Metadata } from 'next';
import { AccountDeletionPanelEntrypoint } from '@/components/account-deletion-panel-entrypoint';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import { deleteKnowledgeImportBatch } from '@/actions/knowledge-ingestion-actions';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUser } from '@/lib/auth';
import { getKnowledgeDraftBatchesForUser } from '@/lib/knowledge-ingestion';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t('account.data.metadataTitle'),
    description: t('account.data.metadataDescription'),
  };
}

type DeleteAccountPageProps = { searchParams: Promise<{ importPage?: string | string[] }> };

export default async function DeleteAccountPage({ searchParams }: DeleteAccountPageProps) {
  const [user, { t, locale }, resolvedSearchParams] = await Promise.all([
    // This critical owner-data route needs only the verified session subject.
    // Avoid making it depend on a second Clerk Backend API profile lookup;
    // the email is optional display copy with an existing localized fallback.
    requireCurrentUser('/account/delete'),
    getServerI18n(),
    searchParams,
  ]);
  const requestedPage = Number.parseInt(String(resolvedSearchParams.importPage ?? 1), 10);
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
        <LocalizedLink href="/support" className="text-sm font-semibold text-blue-700 underline underline-offset-4">← {t('account.data.support')}</LocalizedLink>
        <h1 className="mt-7 font-serif text-4xl font-black tracking-tight sm:text-5xl">{t('account.data.title')}</h1>
        <p className="mt-4 leading-7 text-slate-600">
          {t('account.data.body')}
        </p>

        <section id="knowledge-data" className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="border-t-4 border-cyan-700 bg-cyan-50/60 p-5">
            <h2 className="text-xl font-black">{t('account.data.exportTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('account.data.exportBody')}</p>
            <a href="/api/knowledge/export?scope=all" download className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-cyan-800 px-4 py-2 text-sm font-black text-white">{t('account.data.downloadExport')}</a>
          </div>
          <div className="border-t-4 border-amber-500 bg-amber-50/60 p-5">
            <h2 className="text-xl font-black">{t('account.data.deletionTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('account.data.importDeletionBody')}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('account.data.knowledgeDeletionBody')}</p>
            <LocalizedLink href="/my-notes" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold">{t('account.data.manageKnowledge')}</LocalizedLink>
          </div>
        </section>

        <section className="mt-8 border-t border-slate-200 pt-6" aria-labelledby="import-jobs-heading">
          <h2 id="import-jobs-heading" className="text-2xl font-black">{t('account.data.importJobs')}</h2>
          {batches.length === 0 ? <p className="mt-3 text-sm text-slate-600">{t('account.data.noImportJobs')}</p> : (
            <ol className="mt-4 divide-y divide-slate-200 border-y border-slate-200">
              {batches.map((batch) => (
                <li key={batch.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-cyan-800">{batch.provider} · {batch.scope.replace('_', ' ')} · {batch.status}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500">{batch.id}</p>
                    <p className="mt-1 text-sm text-slate-600">{t('account.data.importCounts', { pending: batch.pending_count, approved: batch.approved_count })}</p>
                  </div>
                  <form action={deleteKnowledgeImportBatch}>
                    <input type="hidden" name="batch_id" value={batch.id} />
                    <ConfirmDeleteButton
                      label={t('account.data.deleteImport')}
                      confirmMessage={t('account.data.deleteImportConfirm', { pending: batch.pending_count, approved: batch.approved_count })}
                      className="min-h-11 rounded-lg border border-red-300 px-4 py-2 text-sm font-black text-red-800 hover:bg-red-50"
                    />
                  </form>
                </li>
              ))}
            </ol>
          )}
          {batches.length > 0 || importPage > 1 ? (
            <nav aria-label={t('account.data.importPages')} className="mt-4 flex items-center gap-2 text-sm font-bold">
              {importPage > 1 ? <LocalizedLink href={`/account/delete?importPage=${importPage - 1}#import-jobs-heading`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4">{t('account.data.previous')}</LocalizedLink> : null}
              <span className="px-2 text-slate-600">{t('account.data.page', { page: importPage })}</span>
              {hasNextPage ? <LocalizedLink href={`/account/delete?importPage=${importPage + 1}#import-jobs-heading`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4">{t('account.data.next')}</LocalizedLink> : null}
            </nav>
          ) : null}
        </section>

        <div className="mt-10 border-t border-red-200 pt-2">
          <h2 className="mt-7 text-3xl font-black tracking-tight text-red-950">{t('account.data.deleteAccountTitle')}</h2>
          <p className="mt-3 leading-7 text-slate-600">{t('account.data.deleteAccountBody')}</p>
        </div>
        <AccountDeletionPanelEntrypoint email={user.email} locale={locale} />
        <p className="mt-6 text-sm leading-6 text-slate-500">
          {t('account.data.privacyPrefix')} <LocalizedLink href="/privacy" className="font-semibold text-blue-700 underline underline-offset-4">{t('account.data.privacyPolicy')}</LocalizedLink>
          {' '}{t('account.data.privacySuffix')}
        </p>
      </div>
    </main>
  );
}
