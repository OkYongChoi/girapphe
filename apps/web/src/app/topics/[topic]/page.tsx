import Navbar from '@/components/navbar';
import KnowledgeBundleView from '@/components/knowledge-bundle-view';
import TopicLocalGraph from '@/components/topic-local-graph';
import TopicContextPackSelector from '@/components/topic-context-pack-selector';
import KnowledgeLifecycleControls from '@/components/knowledge-lifecycle-controls';
import { LocalizedLink } from '@/i18n/navigation';
import type { MessageKey } from '@/i18n/messages';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUser } from '@/lib/auth';
import {
  getTopicKnowledgeHubForUser,
  type TopicKnowledgeActivity,
  type TopicKnowledgeHubItem,
  type TopicKnowledgeSource,
} from '@/lib/topic-knowledge-hub';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TopicHubPageProps = {
  params: Promise<{ topic: string }>;
};

const ACTIVITY_LABEL_KEYS: Record<TopicKnowledgeActivity['activity_type'], MessageKey> = {
  confirmed: 'topic.hub.activity.confirmed',
  connected: 'topic.hub.activity.connected',
  verified: 'topic.hub.activity.verified',
  reused: 'topic.hub.activity.reused',
  revised: 'topic.hub.activity.revised',
  superseded: 'topic.hub.activity.superseded',
  archived: 'topic.hub.activity.archived',
  restored: 'topic.hub.activity.restored',
};

function eventDate(item: TopicKnowledgeHubItem) {
  if (item.structured_content?.type === 'event' && item.structured_content.occurred_at) {
    const occurred = new Date(item.structured_content.occurred_at);
    if (!Number.isNaN(occurred.getTime())) return occurred.toISOString();
  }
  return item.observed_at ?? item.created_at;
}

function lifecycleStage(item: TopicKnowledgeHubItem, activity: TopicKnowledgeActivity[]) {
  const latest = activity
    .filter((entry) => entry.knowledge_item_id === item.id)
    .sort((left, right) => +new Date(right.created_at) - +new Date(left.created_at))[0];
  if (latest) return latest.activity_type;
  if (item.last_verified_at) return 'verified';
  return 'confirmed';
}

function primitiveLocatorEntries(locator: Record<string, unknown> | null) {
  if (!locator) return [];
  return Object.entries(locator).flatMap(([key, value]) => {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [[key, String(value)] as const];
    }
    return [];
  });
}

function sourceLocation(source: TopicKnowledgeSource) {
  return source.source_url ?? source.conversation_ref ?? null;
}

function activityDescription(entry: TopicKnowledgeActivity, itemById: Map<string, TopicKnowledgeHubItem>, label: string) {
  const item = itemById.get(entry.knowledge_item_id);
  const reason = typeof entry.metadata.reason === 'string' ? entry.metadata.reason : null;
  return `${label}${item ? ` · ${item.title}` : ''}${reason ? ` · ${reason}` : ''}`;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-2xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-75">{label}</p>
    </div>
  );
}

export default async function TopicHubPage({ params }: TopicHubPageProps) {
  const user = await requireCurrentUser();
  const { topic: topicParam } = await params;
  const { formatDate, t } = await getServerI18n();
  const hub = await getTopicKnowledgeHubForUser(user.id, topicParam);
  const itemById = new Map(hub.items.map((item) => [item.id, item]));
  const sourcesByItem = Map.groupBy(hub.sources, (source) => source.knowledge_item_id);
  const evidenceBySource = Map.groupBy(hub.evidence_selectors, (evidence) => evidence.source_id);
  const historicalTitleById = new Map(hub.revisions.map((revision) => [revision.knowledge_item_id, revision.snapshot.title]));
  const openQuestions = hub.items.filter((item) => item.structured_content?.type === 'question' && item.structured_content.status === 'open');
  const decisions = hub.items.filter((item) => item.structured_content?.type === 'decision');
  const events = hub.items.filter((item) => item.structured_content?.type === 'event')
    .sort((left, right) => +new Date(eventDate(right)) - +new Date(eventDate(left)));
  const recentActivity = [...hub.activity]
    .sort((left, right) => +new Date(right.created_at) - +new Date(left.created_at));
  const timelineEntries = [
    ...events.map((item) => ({ kind: 'event' as const, at: eventDate(item), item })),
    ...recentActivity.map((entry) => ({ kind: 'activity' as const, at: entry.created_at, entry })),
  ].sort((left, right) => +new Date(right.at) - +new Date(left.at));
  const topicQuery = encodeURIComponent(hub.topic);

  return (
    <main id="main-content" className="min-h-screen bg-slate-50">
      <Navbar user={user} />

      <section className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <nav aria-label={t('nav.topics')} className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-600">
          <LocalizedLink href="/topics" className="text-blue-700 hover:underline">{t('nav.topics')}</LocalizedLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{hub.topic}</span>
        </nav>

        <header className="mt-5 overflow-hidden rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-950 via-slate-950 to-cyan-950 p-6 text-white shadow-xl md:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">{t('topic.index.eyebrow')}</p>
              <h1 className="mt-3 break-words text-3xl font-black tracking-tight md:text-5xl">{hub.topic}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
                {t('topic.index.body')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href="#context-pack" className="rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-200">
                {t('topic.context.title')}
              </a>
              <details className="relative">
                <summary className="cursor-pointer list-none rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/15">{t('topic.hub.export')}</summary>
                <div className="absolute end-0 z-20 mt-2 grid min-w-44 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-sm text-slate-800 shadow-xl">
                  {(['markdown', 'yaml', 'json'] as const).map((format) => (
                    <a key={format} href={`/api/knowledge/export?topic=${topicQuery}&format=${format}`} className="rounded-lg px-3 py-2 font-semibold capitalize hover:bg-slate-100">{format}</a>
                  ))}
                </div>
              </details>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label={t('topic.index.confirmed')} value={hub.items.length} tone="border-white/10 bg-white/10 text-white" />
            <Stat label={t('topic.hub.openQuestions')} value={openQuestions.length} tone="border-violet-300/20 bg-violet-300/10 text-violet-100" />
            <Stat label={t('bundle.type.decision')} value={decisions.length} tone="border-amber-300/20 bg-amber-300/10 text-amber-100" />
            <Stat label={t('bundle.type.event')} value={events.length} tone="border-cyan-300/20 bg-cyan-300/10 text-cyan-100" />
            <Stat label={t('topic.hub.sources')} value={hub.sources.length} tone="border-emerald-300/20 bg-emerald-300/10 text-emerald-100" />
          </div>
        </header>

        <aside className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-950">
          <strong>{t('topic.index.consentTitle')}</strong> {t('topic.index.consentBody')}
        </aside>

        <nav aria-label={t('nav.topics')} className="sticky top-[7.2rem] z-30 mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur">
          <ul className="flex min-w-max gap-1 text-sm font-bold text-slate-700">
            {[
              ['overview', t('topic.hub.overview')],
              ['questions', t('topic.hub.openQuestions')],
              ['knowledge', t('topic.hub.confirmedKnowledge')],
              ['graph', t('topic.graph.title')],
              ['timeline', t('topic.hub.timeline')],
              ['history', t('topic.hub.history')],
              ['provenance', t('topic.hub.provenance')],
              ['context-pack', t('topic.context.title')],
            ].map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="inline-flex min-h-10 items-center rounded-xl px-3 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500">{label}</a></li>
            ))}
          </ul>
        </nav>

        <section id="overview" className="scroll-mt-44 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{t('topic.index.eyebrow')}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.overview')}</h2>
            </div>
            <p className="text-xs text-slate-500">{t('topic.hub.generated', { date: formatDate(hub.generated_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <article className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{t('topic.index.open')}</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">{t('topic.index.openCount', { count: openQuestions.length })}</h3>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-700">{t('bundle.type.decision')}</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">{t('topic.index.decisionCount', { count: decisions.length })}</h3>
            </article>
            <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{t('bundle.type.event')}</p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">{t('topic.index.eventCount', { count: events.length })}</h3>
            </article>
          </div>
        </section>

        <section id="questions" className="scroll-mt-44 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700">{t('topic.hub.learningLens')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.openQuestions')}</h2>
          {openQuestions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t('topic.hub.noQuestions')}</p>
          ) : (
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {openQuestions.map((item) => {
                const content = item.structured_content?.type === 'question' ? item.structured_content : null;
                return (
                  <li key={item.id} className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-wide text-violet-700">{t('bundle.status.open')} · {t('topic.index.confirmed')} v{item.version}</p>
                    <a href={`#item-${encodeURIComponent(item.id)}`} className="mt-2 block text-lg font-bold text-slate-950 hover:text-blue-700 hover:underline">{content?.question ?? item.central_question ?? item.title}</a>
                    {content?.context ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{content.context}</p> : null}
                    {content && content.next_steps.length > 0 ? <p className="mt-3 text-xs font-semibold text-slate-500">{t('topic.hub.next', { value: content.next_steps.join(' · ') })}</p> : null}
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section id="knowledge" className="scroll-mt-44 pt-12">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{t('topic.hub.canonicalState')}</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.confirmedKnowledge')}</h2>
            </div>
            <LocalizedLink href={`/my-knowledge?topic=${encodeURIComponent(hub.topic)}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('topic.index.library')}</LocalizedLink>
          </div>

          {hub.items.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-lg font-bold text-slate-900">{t('topic.index.emptyTitle')}</p>
              <p className="mt-2 text-sm text-slate-500">{t('topic.index.emptyBody')}</p>
              <LocalizedLink href="/knowledge-inbox" className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">{t('topic.index.openInbox')}</LocalizedLink>
            </div>
          ) : (
            <ol className="mt-4 grid gap-4">
              {hub.items.map((item) => {
                const itemSources = sourcesByItem.get(item.id) ?? [];
                const stage = lifecycleStage(item, hub.activity);
                return (
                  <li key={item.id} id={`item-${item.id}`} className="scroll-mt-44">
                    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">{t('topic.hub.confirmedByYou')}</span>
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-800">{t(ACTIVITY_LABEL_KEYS[stage])}</span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">v{item.version}</span>
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">{item.knowledge_type ? t(`bundle.type.${item.knowledge_type}` as MessageKey) : t('topic.context.legacy')}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{item.title}</h3>
                          {item.central_question ? <p className="mt-2 text-base font-semibold leading-relaxed text-blue-950">{item.central_question}</p> : null}
                          {item.summary ? <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p> : null}
                        </div>
                        <div className="text-end text-xs text-slate-500">
                          <p>{t('notes.updated', { date: formatDate(item.updated_at, { dateStyle: 'medium' }) })}</p>
                          {item.last_verified_at ? <p className="mt-1 font-semibold text-emerald-700">{t('topic.hub.verifiedAt', { date: formatDate(item.last_verified_at, { dateStyle: 'medium' }) })}</p> : <p className="mt-1 text-amber-700">{t('topic.hub.notVerified')}</p>}
                        </div>
                      </div>

                      {item.structured_content && item.knowledge_type && item.central_question ? (
                        <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                          <KnowledgeBundleView type={item.knowledge_type} centralQuestion={item.central_question} content={item.structured_content} />
                        </div>
                      ) : item.content ? <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{item.content}</p> : null}

                      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        {item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">#{tag}</span>)}
                        <span className="ms-auto text-xs text-slate-500">{t('topic.hub.sourceCount', { count: itemSources.length })}</span>
                      </div>
                      <KnowledgeLifecycleControls
                        itemId={item.id}
                        version={item.version}
                        lastVerifiedAt={item.last_verified_at}
                        reviewAt={item.review_at}
                        replacements={hub.items.filter((candidate) => candidate.id !== item.id).map((candidate) => ({ id: candidate.id, title: candidate.title }))}
                      />
                    </article>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section id="graph" className="scroll-mt-44 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">{t('topic.graph.title')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.graph.title')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('topic.graph.description')}</p>
          <div className="mt-4"><TopicLocalGraph items={hub.items} relations={hub.relations} /></div>
          <LocalizedLink href="/knowledge" className="mt-4 inline-flex rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">{t('nav.atlas')}</LocalizedLink>
        </section>

        <section id="timeline" className="scroll-mt-44 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{t('topic.hub.timeline')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.timeline')}</h2>
          {timelineEntries.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t('topic.hub.timelineEmpty')}</p>
          ) : (
            <ol className="relative mt-5 border-s-2 border-cyan-200 ps-6">
              {timelineEntries.map((timelineEntry) => {
                if (timelineEntry.kind === 'event') {
                  const { item } = timelineEntry;
                  const content = item.structured_content?.type === 'event' ? item.structured_content : null;
                  return (
                    <li key={`event:${item.id}`} className="relative mb-5 rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm before:absolute before:-start-[1.95rem] before:top-5 before:h-3 before:w-3 before:rounded-full before:bg-cyan-500 before:ring-4 before:ring-cyan-100">
                      <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">{t('topic.hub.observedEvent')} · {formatDate(timelineEntry.at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                      <h3 className="mt-2 font-bold text-slate-950">{content?.event ?? item.title}</h3>
                      {content?.context ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{content.context}</p> : null}
                    </li>
                  );
                }
                const { entry } = timelineEntry;
                return (
                  <li key={`activity:${entry.id}`} className="relative mb-3 rounded-xl border border-slate-200 bg-white px-4 py-3 before:absolute before:-start-[1.78rem] before:top-4 before:h-2 before:w-2 before:rounded-full before:bg-slate-400 before:ring-4 before:ring-slate-100">
                    <p className="text-sm font-semibold text-slate-800">{activityDescription(entry, itemById, t(ACTIVITY_LABEL_KEYS[entry.activity_type]))}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(timelineEntry.at, { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section id="history" className="scroll-mt-44 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">{t('topic.hub.history')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.history')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('topic.hub.historyBody')}</p>
          {hub.revisions.length === 0 && hub.supersessions.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t('topic.hub.historyEmpty')}</p>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-950">{t('topic.hub.snapshots')}</h3>
                <ol className="mt-3 grid gap-3">
                  {hub.revisions.map((revision) => {
                    const current = itemById.get(revision.knowledge_item_id);
                    const title = revision.snapshot.title || current?.title || t('topic.hub.historicalKnowledge');
                    return (
                      <li key={revision.id} className="rounded-xl bg-amber-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {current ? <a href={`#item-${encodeURIComponent(current.id)}`} className="font-semibold text-slate-900 hover:text-blue-700 hover:underline">{title}</a> : <span className="font-semibold text-slate-900">{title} <span className="text-xs font-normal text-slate-500">({t('topic.hub.activity.superseded')})</span></span>}
                          <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-amber-800">v{revision.version}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(revision.created_at, { dateStyle: 'medium', timeStyle: 'short' })}{revision.change_reason ? ` · ${revision.change_reason}` : ''}</p>
                      </li>
                    );
                  })}
                  {hub.revisions.length === 0 ? <li className="text-sm text-slate-500">{t('topic.hub.noSnapshots')}</li> : null}
                </ol>
              </article>

              <article className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm">
                <h3 className="font-bold text-slate-950">{t('topic.hub.replacementChain')}</h3>
                <ol className="mt-3 grid gap-3">
                  {hub.supersessions.map((entry) => {
                    const oldTitle = itemById.get(entry.superseded_item_id)?.title ?? historicalTitleById.get(entry.superseded_item_id) ?? t('topic.hub.previousKnowledge');
                    const replacement = itemById.get(entry.replacement_item_id);
                    const replacementTitle = replacement?.title ?? historicalTitleById.get(entry.replacement_item_id) ?? t('topic.hub.replacementKnowledge');
                    return (
                      <li key={entry.id} className="rounded-xl bg-rose-50 p-3 text-sm">
                        <p className="font-semibold text-slate-900">{oldTitle} <span aria-hidden="true">→</span> {replacement ? <a href={`#item-${encodeURIComponent(replacement.id)}`} className="text-blue-700 hover:underline">{replacementTitle}</a> : replacementTitle}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(entry.created_at, { dateStyle: 'medium', timeStyle: 'short' })}{entry.reason ? ` · ${entry.reason}` : ''}</p>
                      </li>
                    );
                  })}
                  {hub.supersessions.length === 0 ? <li className="text-sm text-slate-500">{t('topic.hub.noSupersessions')}</li> : null}
                </ol>
              </article>
            </div>
          )}
        </section>

        <section id="provenance" className="scroll-mt-44 pb-16 pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{t('topic.hub.provenance')}</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{t('topic.hub.provenance')}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{t('topic.hub.provenanceBody')}</p>
          {hub.sources.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">{t('topic.hub.provenanceEmpty')}</p>
          ) : (
            <ol className="mt-4 grid gap-3 md:grid-cols-2">
              {hub.sources.map((source) => {
                const item = itemById.get(source.knowledge_item_id);
                const location = sourceLocation(source);
                const locatorEntries = primitiveLocatorEntries(source.source_locator);
                const evidenceSelectors = evidenceBySource.get(source.id) ?? [];
                return (
                  <li key={source.id} className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold capitalize text-emerald-800">{source.provider}</span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{source.source_type}</span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">{t(`topic.graph.origin.${source.relation_origin}` as MessageKey)}</span>
                    </div>
                    <h3 className="mt-3 font-bold text-slate-950">{item?.title ?? t('topic.hub.confirmedSource')}</h3>
                    {location ? source.source_url ? (
                      <a href={source.source_url} target="_blank" rel="noreferrer noopener" className="mt-2 block break-all text-sm font-semibold text-blue-700 hover:underline">{t('topic.hub.openSource')} ↗</a>
                    ) : <p className="mt-2 break-all font-mono text-xs text-slate-600">{t('topic.hub.conversationReference', { value: location })}</p> : null}
                    {locatorEntries.length > 0 ? (
                      <dl className="mt-3 grid gap-1 rounded-xl bg-slate-50 p-3 text-xs">
                        {locatorEntries.map(([key, value]) => <div key={key} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2"><dt className="font-semibold text-slate-500">{key.replaceAll('_', ' ')}</dt><dd className="break-all font-mono text-slate-700">{value}</dd></div>)}
                      </dl>
                    ) : null}
                    {evidenceSelectors.length > 0 ? (
                      <details className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <summary className="cursor-pointer text-xs font-bold text-emerald-900">{t('topic.hub.selectorCount', { count: evidenceSelectors.length })}</summary>
                        <ol className="mt-2 grid gap-2">
                          {evidenceSelectors.map((evidence) => (
                            <li key={evidence.id} className="rounded-lg bg-white p-2 text-xs text-slate-700">
                              <p className="font-semibold capitalize">{evidence.polarity} · {evidence.selector_type.replaceAll('_', ' ')} · {t('topic.hub.quality', { value: evidence.quality })}</p>
                              {primitiveLocatorEntries(evidence.selector).length > 0 ? <p className="mt-1 break-all font-mono text-[11px] text-slate-500">{primitiveLocatorEntries(evidence.selector).map(([key, value]) => `${key}=${value}`).join(' · ')}</p> : null}
                              <p className="mt-1 text-[11px] text-slate-500">{t(`topic.graph.origin.${evidence.relation_origin}` as MessageKey)}{evidence.confirmed_at ? ` · ${t('topic.hub.confirmedAt', { date: formatDate(evidence.confirmed_at, { dateStyle: 'medium' }) })}` : ''}</p>
                            </li>
                          ))}
                        </ol>
                      </details>
                    ) : null}
                    <p className="mt-3 text-xs text-slate-500">{source.discussed_at ? t('topic.hub.discussedAt', { date: formatDate(source.discussed_at, { dateStyle: 'medium', timeStyle: 'short' }) }) : t('topic.hub.recordedAt', { date: formatDate(source.created_at, { dateStyle: 'medium', timeStyle: 'short' }) })}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section id="context-pack" className="scroll-mt-44 pb-16">
          <TopicContextPackSelector
            topic={hub.topic}
            items={hub.items.map((item) => ({
              id: item.id,
              title: item.title,
              centralQuestion: item.central_question,
              knowledgeType: item.knowledge_type,
            }))}
          />
        </section>
      </section>
    </main>
  );
}
