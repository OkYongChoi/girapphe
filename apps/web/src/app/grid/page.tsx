import { getAllCardsWithStatus, getKnowledgeMapEdges } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';
import { getKnowledgeLinkTargets, getPrivateKnowledgeGraph } from '@/actions/knowledge-ingestion-actions';
import { getServerLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function GridPage() {
  const [actor, locale] = await Promise.all([getCurrentActor(), getServerLocale()]);
  const [cards, personalItems, publicEdges, privateGraph, graphLinkTargets] = await Promise.all([
    getAllCardsWithStatus({ locale }),
    actor.isGuest ? Promise.resolve([]) : getUserKnowledgeItems(),
    getKnowledgeMapEdges(),
    actor.isGuest ? Promise.resolve(null) : getPrivateKnowledgeGraph(),
    actor.isGuest ? Promise.resolve([]) : getKnowledgeLinkTargets(),
  ]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar user={actor.isGuest ? null : actor} />
      <div className="flex-grow">
        <KnowledgeMap
          initialCards={cards}
          initialView="grid"
          personalItems={actor.isGuest ? [] : personalItems}
          publicEdges={publicEdges}
          privateGraph={actor.isGuest ? null : privateGraph}
          graphLinkTargets={graphLinkTargets}
          isGuest={actor.isGuest}
          locale={locale}
        />
      </div>
    </main>
  );
}
