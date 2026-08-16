import Link from 'next/link';
import Navbar from '@/components/navbar';
import {
  getKnowledgeDraftBatches,
  getMcpAccessTokens,
} from '@/actions/knowledge-ingestion-actions';
import DraftReviewMcpConnections from '@/components/draft-review-mcp-connections';

export const dynamic = 'force-dynamic';

type KnowledgeInboxPageProps = {
  searchParams?: Promise<{
    approved?: string;
    skippedEdges?: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function readString(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function readNumber(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return 0;
}

function formatProvider(record: Record<string, unknown>) {
  const value = readString(record, 'provider', 'source_provider', 'source_type') || 'Girapphe';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function KnowledgeInboxPage({ searchParams }: KnowledgeInboxPageProps) {
  const params = (await searchParams) ?? {};
  const approved = Math.max(0, Number.parseInt(params.approved ?? '0', 10) || 0);
  const skippedEdges = Math.max(0, Number.parseInt(params.skippedEdges ?? '0', 10) || 0);
  const [batches, tokens] = await Promise.all([
    getKnowledgeDraftBatches(),
    getMcpAccessTokens(),
  ]);

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Private review queue</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Knowledge Inbox</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
              Review concept drafts explicitly sent from a current ChatGPT, Claude, Gemini, or other connected conversation. Nothing is added to your map until you approve it.
            </p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3 text-right shadow-sm">
            <p className="text-2xl font-bold text-slate-950">{batches.length}</p>
            <p className="text-xs text-slate-500">pending batches</p>
          </div>
        </div>

        <aside className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>Approval boundary:</strong> each row is one explicitly sent batch. “Add all” on its review page applies only to that batch, never to older conversations or future messages.
        </aside>

        {approved > 0 || skippedEdges > 0 ? (
          <div role="status" className={`mt-4 rounded-2xl border p-4 text-sm ${skippedEdges > 0 ? 'border-amber-300 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <strong>{approved} cards added.</strong>{' '}
            {skippedEdges > 0
              ? `${skippedEdges} relationship suggestions were skipped because their targets were unavailable, duplicated, or would create an invalid cycle.`
              : 'All approved relationships were saved.'}
          </div>
        ) : null}

        {batches.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-3xl" aria-hidden="true">📬</p>
            <h2 className="mt-3 text-lg font-semibold text-slate-900">No drafts waiting</h2>
            <p className="mt-1 text-sm text-slate-500">Send selected concepts from a current AI conversation, then return here to review them.</p>
            <Link href="/my-knowledge" className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Add a manual note instead
            </Link>
          </section>
        ) : (
          <ol className="mt-6 grid gap-4">
            {batches.map((batch) => {
              const record = asRecord(batch);
              const id = readString(record, 'id', 'batch_id');
              const provider = formatProvider(record);
              const sourceReference = readString(record, 'source_reference', 'source_ref', 'conversation_ref', 'external_source_id');
              const createdAt = readString(record, 'created_at', 'received_at');
              const count = readNumber(record, 'pending_count', 'draft_count', 'card_count');
              const requestedMode = readString(record, 'approval_mode', 'requested_approval_mode') || 'review';

              return (
                <li key={id}>
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{provider}</span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{count || 'Pending'} drafts</span>
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">Requested: {requestedMode.replace('_', ' ')}</span>
                        </div>
                        <h2 className="mt-3 text-lg font-bold text-slate-950">Current conversation import</h2>
                        <p className="mt-1 max-w-2xl text-sm text-slate-600">
                          This review is isolated to batch <span className="font-mono text-xs">{id}</span>.
                        </p>
                        {sourceReference ? <p className="mt-2 truncate text-xs text-slate-500">Source reference: {sourceReference}</p> : null}
                        {createdAt ? <p className="mt-1 text-xs text-slate-400">Received {new Date(createdAt).toLocaleString()}</p> : null}
                      </div>
                      <Link
                        href={`/knowledge-inbox/${encodeURIComponent(id)}`}
                        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        Review this batch
                      </Link>
                    </div>
                  </article>
                </li>
              );
            })}
          </ol>
        )}

        <DraftReviewMcpConnections tokens={tokens} currentTime={Date.now()} />
      </section>
    </main>
  );
}
