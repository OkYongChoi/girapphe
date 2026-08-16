import Link from 'next/link';
import { notFound } from 'next/navigation';
import Navbar from '@/components/navbar';
import DraftReviewPanel from '@/components/draft-review-panel';
import {
  getKnowledgeDraftBatch,
  getKnowledgeLinkTargets,
} from '@/actions/knowledge-ingestion-actions';

export const dynamic = 'force-dynamic';

type KnowledgeInboxBatchPageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function KnowledgeInboxBatchPage({ params }: KnowledgeInboxBatchPageProps) {
  const { batchId } = await params;
  const [result, linkTargets] = await Promise.all([
    getKnowledgeDraftBatch(batchId),
    getKnowledgeLinkTargets(),
  ]);

  if (!result) notFound();
  const pendingDrafts = result.drafts.filter((draft) => draft.status === 'pending');

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <Link href="/knowledge-inbox" className="inline-flex items-center text-sm font-semibold text-blue-700 hover:underline">
          ← Back to Knowledge Inbox
        </Link>
        <div className="mt-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Review knowledge drafts</h1>
          <p className="mt-1 text-sm text-slate-600">Edit content and relationships before adding cards to your private graph.</p>
        </div>
        <div className="mt-6">
          <DraftReviewPanel batch={result.batch} drafts={pendingDrafts} linkTargets={linkTargets} />
        </div>
      </section>
    </main>
  );
}
