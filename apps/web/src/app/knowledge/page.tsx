import { getKnowledgeMapEdges } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map-paginated';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';
import { getUserKnowledgeMapItems } from '@/actions/user-knowledge-actions';
import { getKnowledgeLinkTargets, getPrivateKnowledgeGraph } from '@/actions/knowledge-ingestion-actions';
import { getServerLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  // Server component doesn't get searchParams by default; keep this page stable and let the
  // client component control query params by navigating to the same route.
  const [actor, locale] = await Promise.all([getCurrentActor(), getServerLocale()]);
  const [personalItems, publicEdges, privateGraph, graphLinkTargets] = await Promise.all([
    actor.isGuest ? Promise.resolve([]) : getUserKnowledgeMapItems(),
    getKnowledgeMapEdges(),
    actor.isGuest ? Promise.resolve(null) : getPrivateKnowledgeGraph(),
    actor.isGuest ? Promise.resolve([]) : getKnowledgeLinkTargets(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar user={actor.isGuest ? null : actor} />
      <div className="flex-grow">
        <div className="mx-auto flex h-full w-full max-w-6xl">
          <KnowledgeMap
            personalItems={actor.isGuest ? [] : personalItems}
            publicEdges={publicEdges}
            privateGraph={actor.isGuest ? null : privateGraph}
            graphLinkTargets={graphLinkTargets}
            locale={locale}
          />
        </div>
      </div>
    </main>
  );
}
