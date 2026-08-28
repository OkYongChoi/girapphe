import Navbar from '@/components/navbar';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUser } from '@/lib/auth';
import { getActiveKnowledgeTopicSummariesForUser } from '@/lib/topic-knowledge-hub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TopicsPage() {
  const user = await requireCurrentUser();
  const { formatDate, t } = await getServerI18n();
  const topics = await getActiveKnowledgeTopicSummariesForUser(user.id);
  const totalItems = topics.reduce((sum, topic) => sum + topic.item_count, 0);
  const totalOpenQuestions = topics.reduce((sum, topic) => sum + topic.open_question_count, 0);

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <Navbar user={user} />
      <section className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">{t('topic.index.eyebrow')}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{t('nav.topics')}</h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 md:text-base">
                {t('topic.index.body')}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-950 px-4 py-3 text-white"><p className="text-2xl font-black">{topics.length}</p><p className="text-[11px] uppercase tracking-wide text-slate-300">{t('nav.topics')}</p></div>
              <div className="rounded-2xl bg-blue-50 px-4 py-3 text-blue-950"><p className="text-2xl font-black">{totalItems}</p><p className="text-[11px] uppercase tracking-wide text-blue-700">{t('topic.index.confirmed')}</p></div>
              <div className="rounded-2xl bg-violet-50 px-4 py-3 text-violet-950"><p className="text-2xl font-black">{totalOpenQuestions}</p><p className="text-[11px] uppercase tracking-wide text-violet-700">{t('topic.index.open')}</p></div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <LocalizedLink href="/knowledge-inbox" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">{t('topic.index.review')}</LocalizedLink>
            <LocalizedLink href="/my-knowledge" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('topic.index.library')}</LocalizedLink>
            <LocalizedLink href="/knowledge" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('nav.atlas')}</LocalizedLink>
          </div>
        </header>

        <aside className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
          <strong>{t('topic.index.consentTitle')}</strong> {t('topic.index.consentBody')}
        </aside>

        {topics.length === 0 ? (
          <section className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-4xl" aria-hidden="true">🧭</p>
            <h2 className="mt-4 text-xl font-black text-slate-950">{t('topic.index.emptyTitle')}</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500">{t('topic.index.emptyBody')}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <LocalizedLink href="/knowledge-inbox" className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">{t('topic.index.openInbox')}</LocalizedLink>
              <LocalizedLink href="/my-knowledge" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('topic.index.addManual')}</LocalizedLink>
            </div>
          </section>
        ) : (
          <ol className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {topics.map((topic) => (
              <li key={topic.topic}>
                <LocalizedLink href={`/topics/${encodeURIComponent(topic.topic)}`} className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wide text-blue-700">{t('topic.index.topic')}</p>
                      <h2 className="mt-2 break-words text-xl font-black tracking-tight text-slate-950 group-hover:text-blue-700">{topic.topic}</h2>
                    </div>
                    <span aria-hidden="true" className="rounded-full bg-blue-50 px-3 py-1 text-lg font-black text-blue-700">→</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{t('topic.index.confirmedCount', { count: topic.item_count })}</span>
                    {topic.open_question_count > 0 ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">{t('topic.index.openCount', { count: topic.open_question_count })}</span> : null}
                    {topic.decision_count > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">{t('topic.index.decisionCount', { count: topic.decision_count })}</span> : null}
                    {topic.event_count > 0 ? <span className="rounded-full bg-cyan-100 px-2.5 py-1 text-cyan-800">{t('topic.index.eventCount', { count: topic.event_count })}</span> : null}
                    {topic.source_count > 0 ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{t('topic.index.sourceCount', { count: topic.source_count })}</span> : null}
                  </div>

                  <ul className="mt-5 flex-1 space-y-1 text-sm text-slate-600">
                    {topic.sample_titles.map((title) => <li key={title} className="truncate">• {title}</li>)}
                  </ul>
                  <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">{t('topic.index.updated', { date: formatDate(topic.last_updated_at, { dateStyle: 'medium' }) })}</p>
                </LocalizedLink>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
