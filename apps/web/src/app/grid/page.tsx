import { getKnowledgeMapCardPage } from '@/actions/card-actions';
import KnowledgeMap from '@/components/knowledge-map';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';
import { getUserKnowledgeItems } from '@/actions/user-knowledge-actions';
import { getServerLocale } from '@/i18n/locale-server';

export const dynamic = 'force-dynamic';

export default async function GridPage() {
  const [actor, locale] = await Promise.all([getCurrentActor(), getServerLocale()]);
  const [cardPage, personalItems] = await Promise.all([
    getKnowledgeMapCardPage({ locale }),
    getUserKnowledgeItems(),
  ]);
  const personalMapItems = personalItems.map(({
    id, title, summary, content, topic, tags, version, created_at, updated_at,
  }) => ({ id, title, summary, content, topic, tags, version, created_at, updated_at }));

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar user={actor.isGuest ? null : actor} />
      <div className="flex-grow">
        <KnowledgeMap
          initialCards={cardPage.cards}
          initialHasMoreCards={cardPage.hasMore}
          initialView="grid"
          personalItems={personalMapItems}
          isGuest={actor.isGuest}
          locale={locale}
        />
      </div>
    </main>
  );
}
