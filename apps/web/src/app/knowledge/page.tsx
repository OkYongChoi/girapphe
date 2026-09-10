import { getKnowledgeGraphSnapshot, getKnowledgeMapCardPage } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';
import { getKnowledgeGraphOverlayForUser } from '@/lib/knowledge-ingestion';
import { getServerLocale } from '@/i18n/locale-server';

export const dynamic = 'force-dynamic';

export default async function KnowledgePage() {
  // Server component doesn't get searchParams by default; keep this page stable and let the
  // client component control query params by navigating to the same route.
  const [actor, locale] = await Promise.all([getCurrentActor(), getServerLocale()]);
  const [cardPage, graphSnapshot, personalItems, graphOverlay] = await Promise.all([
    getKnowledgeMapCardPage({ locale }),
    getKnowledgeGraphSnapshot({ locale }),
    getUserKnowledgeItems(),
    actor.isGuest ? Promise.resolve(null) : getKnowledgeGraphOverlayForUser(actor.id),
  ]);
  const personalMapItems = personalItems.map(({
    id, title, summary, content, topic, tags, version, created_at, updated_at,
  }) => ({ id, title, summary, content, topic, tags, version, created_at, updated_at }));

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar user={actor.isGuest ? null : actor} />
      <div className="flex-grow">
        <div className="mx-auto flex h-full w-full max-w-6xl">
          <KnowledgeMap
          initialCards={cardPage.cards}
          initialHasMoreCards={cardPage.hasMore}
          initialTotalCards={cardPage.totalCount}
          initialGraphSnapshot={graphSnapshot}
          personalItems={personalMapItems}
          privateGraph={graphOverlay?.privateGraph ?? null}
          graphLinkTargets={graphOverlay?.graphLinkTargets ?? []}
          enableWebMcp
          isGuest={actor.isGuest}
          locale={locale}
        />
        </div>
      </div>
    </main>
  );
}
