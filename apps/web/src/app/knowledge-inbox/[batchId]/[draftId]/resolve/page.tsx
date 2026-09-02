import { notFound } from 'next/navigation';
import Navbar from '@/components/navbar';
import DraftResolutionPanel from '@/components/draft-resolution-panel';
import KnowledgeText from '@/components/knowledge-text';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import { getKnowledgeDraftBatch } from '@/actions/knowledge-ingestion-actions';
import { getKnowledgeDraftResolutionContext } from '@/actions/user-knowledge-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResolutionPageProps = {
  params: Promise<{ batchId: string; draftId: string }>;
  searchParams?: Promise<{ target?: string }>;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function CandidateResolutionPage({ params, searchParams }: ResolutionPageProps) {
  const { t } = await getServerI18n();
  const { batchId, draftId } = await params;
  if (batchId.length > 240 || draftId.length > 240
    || !/^[A-Za-z0-9._:-]+$/.test(batchId) || !/^[A-Za-z0-9._:-]+$/.test(draftId)) notFound();
  const query = (await searchParams) ?? {};
  const targetId = typeof query.target === 'string' && query.target.length <= 240 && /^[A-Za-z0-9._:-]+$/.test(query.target)
    ? query.target
    : undefined;
  const [context, batchResult] = await Promise.all([
    getKnowledgeDraftResolutionContext(draftId, targetId),
    getKnowledgeDraftBatch(batchId),
  ]);
  if (!context || !batchResult || context.draft.batch_id !== batchId || context.draft.status !== 'pending') notFound();

  const batch = record(batchResult.batch);
  const provider = stringValue(batch.provider) || 'Girapphe';
  const sourceUrl = stringValue(batch.source_url);
  const sourceReference = stringValue(batch.conversation_ref) || stringValue(batch.source_reference);

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto w-full max-w-6xl p-4 pb-16 md:p-8">
        <nav aria-label={t('inbox.title')} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
          <LocalizedLink href="/knowledge-inbox" className="text-blue-700 hover:underline">{t('inbox.title')}</LocalizedLink>
          <span aria-hidden="true">/</span>
          <LocalizedLink href={`/knowledge-inbox/${encodeURIComponent(batchId)}`} className="text-blue-700 hover:underline">{t('inbox.currentImport')}</LocalizedLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{t('inbox.reviewTitle')}</span>
        </nav>

        <header className="mt-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-700">{t('inbox.currentImport')}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950"><KnowledgeText text={context.draft.title} allowCodeCopy={false} /></h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('inbox.reviewSubtitle')}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-end text-xs text-slate-600">
              <p className="font-bold capitalize text-blue-800">{provider}</p>
              <p className="mt-1 font-mono">{t('inbox.isolated')} {batchId}</p>
              {sourceReference ? <p className="mt-1 max-w-xs truncate">{t('inbox.sourceReference', { reference: sourceReference })}</p> : null}
              {sourceUrl.startsWith('https://') ? <a href={sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-2 inline-flex font-bold text-blue-700 hover:underline">{t('topic.hub.openSource')} ↗</a> : null}
            </div>
          </div>
        </header>

        <div className="mt-6">
          <DraftResolutionPanel
            batchId={batchId}
            draft={context.draft}
            target={context.target}
            duplicateSuggestions={context.duplicateSuggestions}
          />
        </div>
      </section>
    </main>
  );
}
