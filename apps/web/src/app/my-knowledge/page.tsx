import { randomUUID } from 'node:crypto';
import Navbar from '@/components/navbar';
import { redirect } from 'next/navigation';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getArchivedKnowledgeItems,
  getDeletedKnowledgeItems,
  getUserKnowledgeItems,
  restoreArchivedKnowledgeItem,
  restoreKnowledgeItem,
  updateKnowledgeItem,
} from '@/actions/user-knowledge-actions';
import { PERSONAL_CARD_RETENTION_DAYS } from '@/lib/personal-knowledge';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import SubmitButton from '@/components/submit-button';
import { getCurrentActor } from '@/lib/auth';
import {
  createPrivateKnowledgeEdge,
  deletePrivateKnowledgeEdge,
  getKnowledgeLinkTargets,
  getPrivateKnowledgeGraph,
} from '@/actions/knowledge-ingestion-actions';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import type { Translate } from '@/i18n/core';
import KnowledgeBundleEditor from '@/components/knowledge-bundle-editor';
import KnowledgeBundleView from '@/components/knowledge-bundle-view';
import KnowledgeText from '@/components/knowledge-text';
import { isKnowledgeBundleType, KNOWLEDGE_BUNDLE_TYPES } from '@stem-brain/shared';

export const dynamic = 'force-dynamic';

type MyKnowledgePageProps = {
  searchParams?: Promise<{
    q?: string;
    topic?: string;
    sort?: 'created' | 'updated' | 'title';
    period?: 'all' | 'today' | 'week' | 'month' | 'custom';
    start?: string;
    end?: string;
    group?: 'none' | 'week' | 'month';
    view?: 'active' | 'archive' | 'trash';
    linkStatus?: 'created' | 'invalid' | 'cycle_or_duplicate';
    editStatus?: 'stale' | 'missing';
    archiveStatus?: 'stale';
    type?: string;
  }>;
};

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(value: Date) {
  const shifted = new Date(value.getTime() + KST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

function kstStart(value: string) {
  return new Date(`${value}T00:00:00+09:00`).getTime();
}

function calendarDayOfWeek(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function periodBounds(period: string, customStart?: string, customEnd?: string) {
  const today = kstDateKey(new Date());
  if (period === 'today') return { start: today, end: today };
  if (period === 'week') {
    const mondayOffset = (calendarDayOfWeek(today) + 6) % 7;
    return { start: kstDateKey(new Date(kstStart(today) - mondayOffset * 86_400_000)), end: today };
  }
  if (period === 'month') return { start: `${today.slice(0, 7)}-01`, end: today };
  if (period === 'custom') return { start: customStart || undefined, end: customEnd || undefined };
  return {};
}

function groupLabel(
  date: string,
  group: 'week' | 'month',
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string,
  t: Translate,
) {
  const key = kstDateKey(new Date(date));
  if (group === 'month') return formatDate(`${key.slice(0, 7)}-01T00:00:00+09:00`, { year: 'numeric', month: 'long' });
  const day = new Date(`${key}T00:00:00+09:00`);
  const monday = new Date(day.getTime() - ((calendarDayOfWeek(key) + 6) % 7) * 86_400_000);
  return t('notes.weekOf', { date: formatDate(monday) });
}

function getItemSourceProvider(item: unknown) {
  if (!item || typeof item !== 'object') return '';
  const value = (item as Record<string, unknown>).source_provider;
  return typeof value === 'string' ? value.trim() : '';
}

async function createPrivateKnowledgeEdgeAction(formData: FormData) {
  'use server';
  const result = await createPrivateKnowledgeEdge(formData);
  redirect(`/my-knowledge?linkStatus=${result.created ? 'created' : result.reason ?? 'invalid'}`);
}

async function restoreArchivedKnowledgeItemAction(formData: FormData) {
  'use server';
  const result = await restoreArchivedKnowledgeItem(formData);
  if (result.stale || result.version === null) {
    redirect('/my-knowledge?view=archive&archiveStatus=stale');
  }
}

async function updateKnowledgeItemAction(formData: FormData) {
  'use server';
  const result = await updateKnowledgeItem(formData);
  if (!result.updated) redirect(`/my-knowledge?editStatus=${'stale' in result ? 'stale' : 'missing'}`);
}

export default async function MyKnowledgePage({ searchParams }: MyKnowledgePageProps) {
  const { locale, t, formatDate } = await getServerI18n();
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const topicFilter = (params.topic ?? 'all').trim().toLowerCase();
  const typeFilter = (params.type ?? 'all').trim();
  const sortBy = params.sort === 'title' ? 'title' : params.sort === 'updated' ? 'updated' : 'created';
  const period = ['today', 'week', 'month', 'custom'].includes(params.period ?? '') ? params.period! : 'all';
  const groupBy = params.group === 'week' || params.group === 'month' ? params.group : 'none';
  const view = params.view === 'trash' || params.view === 'archive' ? params.view : 'active';
  const isTrash = view === 'trash';
  const isArchive = view === 'archive';
  const isActive = view === 'active';
  const actor = await getCurrentActor();
  const clearFiltersHref = view === 'active' ? '/my-knowledge' : `/my-knowledge?view=${view}`;

  const [items, linkTargets, privateGraph] = await Promise.all([
    isTrash ? getDeletedKnowledgeItems() : isArchive ? getArchivedKnowledgeItems() : getUserKnowledgeItems(),
    !isActive || actor.isGuest ? Promise.resolve([]) : getKnowledgeLinkTargets(),
    !isActive || actor.isGuest ? Promise.resolve({ nodes: [], edges: [] }) : getPrivateKnowledgeGraph(),
  ]);
  const linkTargetLabel = new Map(linkTargets.map((target) => [target.id, target.label]));
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const bounds = periodBounds(period, params.start, params.end);
  const filteredItems = items
    .filter((item) => {
      const matchesTopic = topicFilter === 'all' || item.topic.toLowerCase() === topicFilter;
      const matchesType = typeFilter === 'all'
        || (typeFilter === 'legacy' ? !item.knowledge_type : item.knowledge_type === typeFilter);
      const haystack = `${item.title} ${item.summary} ${item.content} ${item.central_question ?? ''} ${item.knowledge_type ?? ''} ${item.topic} ${item.tags.join(' ')}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const created = new Date(item.created_at).getTime();
      const matchesStart = !bounds.start || created >= kstStart(bounds.start);
      const matchesEnd = !bounds.end || created < kstStart(bounds.end) + 86_400_000;
      return matchesTopic && matchesType && matchesQuery && matchesStart && matchesEnd;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title, locale);
      return +(sortBy === 'updated' ? new Date(b.updated_at) : new Date(b.created_at))
        - +(sortBy === 'updated' ? new Date(a.updated_at) : new Date(a.created_at));
    });

  const itemGroups = groupBy === 'none'
    ? [{ label: null, items: filteredItems }]
    : Object.entries(Object.groupBy(filteredItems, (item) => groupLabel(item.created_at, groupBy, formatDate, t)))
      .map(([label, grouped]) => ({ label, items: grouped ?? [] }));
  const hasActiveFilter = !!params.q || (params.topic && params.topic !== 'all') || typeFilter !== 'all' || sortBy !== 'created' || period !== 'all' || groupBy !== 'none';
  const createRequestId = randomUUID();

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar user={actor.isGuest ? null : actor} />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isTrash ? t('notes.trashTitle') : isArchive ? t('notes.archiveTitle') : t('notes.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {isTrash
                ? t('notes.trashSubtitle', { days: PERSONAL_CARD_RETENTION_DAYS })
                : isArchive ? t('notes.archiveSubtitle') : t('notes.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!actor.isGuest && isActive ? (
              <LocalizedLink href="/topics" className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700">
                {t('notes.topicHubs')}
              </LocalizedLink>
            ) : null}
            <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
              {t('notes.count', {
                filtered: filteredItems.length,
                total: items.length,
                kind: isTrash ? t('notes.deleted') : isArchive ? t('notes.archive') : t('notes.personal'),
              })}
            </div>
          </div>
        </div>

        {params.linkStatus ? (
          <div role="status" className={`mt-4 rounded-xl border px-4 py-3 text-sm ${params.linkStatus === 'created' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-950'}`}>
            {params.linkStatus === 'created'
              ? 'Graph relationship saved.'
              : params.linkStatus === 'cycle_or_duplicate'
                ? 'Relationship was not added because it is a duplicate or would create an invalid prerequisite cycle.'
                : 'Relationship target is invalid or unavailable.'}
          </div>
        ) : null}

        {params.editStatus ? (
          <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
            {params.editStatus === 'stale'
              ? 'This knowledge item changed in another session. Reloaded values are shown; review them before saving again.'
              : 'This knowledge item is no longer available to edit.'}
          </div>
        ) : null}

        {params.archiveStatus === 'stale' ? (
          <div role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
            {t('notes.archiveStale')}
          </div>
        ) : null}

        {/* Filter form */}
        <form role="search" aria-label={t('notes.filterAria')} className="mt-4 rounded-xl border bg-white p-3">
          <input type="hidden" name="view" value={view} />
          <div className="grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto_auto_auto]">
            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-search" className="sr-only">
                {t('notes.search')}
              </label>
              <input
                id="knowledge-search"
                type="text"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder={t('notes.searchPlaceholder')}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <select name="type" defaultValue={typeFilter} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label={t('bundle.format')}>
              <option value="all">{t('common.allStatus')}</option>
              <option value="legacy">{t('bundle.quickNote')}</option>
              {KNOWLEDGE_BUNDLE_TYPES.map((value) => <option key={value} value={value}>{t(`bundle.type.${value}`)}</option>)}
            </select>

            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-topic" className="sr-only">
                {t('notes.topicFilter')}
              </label>
              <select
                id="knowledge-topic"
                name="topic"
                defaultValue={topicFilter}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">{t('notes.allTopics')}</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic.toLowerCase()}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-sort" className="sr-only">
                {t('notes.sort')}
              </label>
              <select
                id="knowledge-sort"
                name="sort"
                defaultValue={sortBy}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="created">{t('notes.recentAdded')}</option>
                <option value="updated">{t('notes.recentUpdated')}</option>
                <option value="title">{t('notes.titleSort')}</option>
              </select>
            </div>

            <select name="period" defaultValue={period} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label={t('notes.dateRange')}>
              <option value="all">{t('notes.anyDate')}</option>
              <option value="today">{t('notes.today')}</option>
              <option value="week">{t('notes.thisWeek')}</option>
              <option value="month">{t('notes.thisMonth')}</option>
              <option value="custom">{t('notes.customRange')}</option>
            </select>

            <select name="group" defaultValue={groupBy} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label={t('notes.groupByDate')}>
              <option value="none">{t('notes.noGrouping')}</option>
              <option value="week">{t('notes.byWeek')}</option>
              <option value="month">{t('notes.byMonth')}</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              {t('common.search')}
            </button>

            {hasActiveFilter && (
              <LocalizedLink
                href={clearFiltersHref}
                className="rounded-lg border px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t('common.clear')}
              </LocalizedLink>
            )}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:max-w-md">
            <label className="text-xs text-gray-600">{t('notes.from')}<input type="date" name="start" defaultValue={params.start ?? ''} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="text-xs text-gray-600">{t('notes.to')}<input type="date" name="end" defaultValue={params.end ?? ''} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
          </div>
        </form>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <LocalizedLink href="/my-knowledge" className={`rounded-lg border px-3 py-1.5 ${isActive ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>{t('notes.title')}</LocalizedLink>
          {!actor.isGuest ? <LocalizedLink href="/my-knowledge?view=archive" className={`rounded-lg border px-3 py-1.5 ${isArchive ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>{t('notes.archive')}</LocalizedLink> : null}
          <LocalizedLink href="/my-knowledge?view=trash" className={`rounded-lg border px-3 py-1.5 ${isTrash ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>{t('notes.trash')}</LocalizedLink>
        </div>

        {isActive && linkTargets.length > 0 ? (
          <datalist id="knowledge-relation-targets">
            {linkTargets.map((target) => (
              <option key={target.id} value={target.id}>{target.label} ({target.scope})</option>
            ))}
          </datalist>
        ) : null}

        {isActive && <form action={createKnowledgeItem} className="mt-6 rounded-xl border bg-white p-4 md:p-6">
          <input type="hidden" name="request_id" value={createRequestId} />
          <h2 className="text-base font-semibold">{t('notes.addHeading')}</h2>
          <p className="mt-1 text-xs text-gray-500">{t('notes.addHelp')}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-title" className="text-xs font-medium text-gray-700">
                {t('notes.titleLabel')} <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="new-title"
                name="title"
                required
                placeholder={t('notes.titleExample')}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-topic" className="text-xs font-medium text-gray-700">
                {t('notes.newTopic')}
              </label>
              <input
                id="new-topic"
                name="topic"
                placeholder={t('notes.topicExample')}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <KnowledgeBundleEditor key={createRequestId} />
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="new-summary" className="text-xs font-medium text-gray-700">
                Summary
              </label>
              <textarea
                id="new-summary"
                name="summary"
                maxLength={500}
                placeholder="A concise takeaway for the card preview"
                className="min-h-20 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="new-content" className="text-xs font-medium text-gray-700">
                {t('notes.contentLabel')}
              </label>
              <textarea
                id="new-content"
                name="content"
                placeholder={t('notes.contentExample')}
                className="min-h-28 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label htmlFor="new-tags" className="text-xs font-medium text-gray-700">Tags</label>
              <input id="new-tags" name="tags" maxLength={599} placeholder="ml, optimization, gradient-descent" className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <span className="text-xs text-gray-500">Up to 12 comma-separated tags, 48 characters each.</span>
            </div>
            {!actor.isGuest ? <fieldset className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3 md:col-span-2 md:grid-cols-[minmax(0,1fr)_12rem_10rem]">
              <legend className="px-1 text-xs font-semibold text-slate-700">Optional graph relationship</legend>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Connect this note to an existing concept
                <input
                  name="related_node_id"
                  list="knowledge-relation-targets"
                  placeholder="Choose by keyword, label, or stable concept ID"
                  className="min-h-10 rounded-lg border bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Relationship type
                <select name="relation_type" defaultValue="related" className="min-h-10 rounded-lg border bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="related">related</option>
                  <option value="prerequisite">prerequisite</option>
                  <option value="generalizes">generalizes</option>
                  <option value="derived_from">derived from</option>
                  <option value="equivalent_to">equivalent to</option>
                  <option value="causes">causes</option>
                  <option value="contributes_to">contributes to</option>
                  <option value="enables">enables</option>
                  <option value="inhibits">inhibits</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                Direction
                <select name="direction" defaultValue="outgoing" className="min-h-10 rounded-lg border bg-white px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="outgoing">This → target</option>
                  <option value="incoming">Target → this</option>
                </select>
              </label>
              <p className="text-xs leading-relaxed text-slate-500 md:col-span-3">
                This uses explicit IDs and keyword labels only. Leave blank to save the note now and link it later.
              </p>
            </fieldset> : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500 md:col-span-2">
                Sign in to connect private notes to the persisted knowledge graph.
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <SubmitButton
              label={t('notes.saveItem')}
              loadingLabel={t('common.saving')}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
          </div>
        </form>}

        {/* Items list */}
        <div className="mt-6 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-2xl">📝</p>
              <p className="mt-2 font-semibold text-gray-800">{isTrash ? t('notes.trashEmpty') : isArchive ? t('notes.archiveEmpty') : t('notes.empty')}</p>
              <p className="mt-1 text-sm text-gray-500">
                {isTrash ? t('notes.trashEmptyBody') : isArchive ? t('notes.archiveEmptyBody') : t('notes.emptyBody')}
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-2 font-semibold text-gray-800">{t('notes.noMatches')}</p>
              <p className="mt-1 text-sm text-gray-500">
                {t('notes.noMatchesBody')}
              </p>
              <LocalizedLink href={clearFiltersHref} className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                {t('notes.clearFilters')}
              </LocalizedLink>
            </div>
          ) : (
            <div className="grid gap-6">
              {itemGroups.map(({ label, items: groupedItems }) => (
                <section key={label ?? 'all'}>
                  {label && <h2 className="mb-2 text-sm font-semibold text-gray-600">{label}</h2>}
                  <ol aria-label={t('notes.itemsAria')} className="grid gap-4">
              {groupedItems.map((item) => (
                <li key={item.id}>
                  <details suppressHydrationWarning className="rounded-xl border bg-white p-4 md:p-5 group">
                    <summary
                      aria-label={t('notes.itemAction', {
                        action: isTrash ? t('notes.restoreCard') : isArchive ? t('notes.restoreArchived') : t('common.edit'),
                        title: item.title,
                      })}
                      className="flex cursor-pointer items-start justify-between gap-3 list-none"
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900"><KnowledgeText text={item.title} allowCodeCopy={false} /></h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {!actor.isGuest && isActive ? (
                            <LocalizedLink href={`/topics/${encodeURIComponent(item.topic)}`} className="inline-block rounded bg-blue-50 px-1.5 py-0.5 font-semibold text-blue-700 hover:bg-blue-100 hover:underline">
                              {item.topic} ↗
                            </LocalizedLink>
                          ) : (
                            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-medium">{item.topic}</span>
                          )}
                          <span className="ms-2">{t('notes.added', { date: formatDate(item.created_at) })}</span>
                          <span className="ms-2">{t('notes.updated', { date: formatDate(item.updated_at) })}</span>
                        </p>
                        {getItemSourceProvider(item) ? (
                          <span className="mt-2 inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-violet-700">
                            Imported from {getItemSourceProvider(item)}
                          </span>
                        ) : null}
                        {item.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">#{tag}</span>)}
                          </div>
                        ) : null}
                        {(item.summary || item.content) && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600"><KnowledgeText text={item.summary || item.content} allowCodeCopy={false} /></p>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded border px-2 py-1 text-xs text-gray-500 group-open:hidden hover:bg-gray-50"
                        aria-hidden="true"
                      >
                        {isTrash ? t('notes.restoreCard') : isArchive ? t('notes.restoreArchived') : t('common.edit')} ✎
                      </span>
                      <span
                        className="hidden shrink-0 rounded border px-2 py-1 text-xs text-gray-500 group-open:inline hover:bg-gray-50"
                        aria-hidden="true"
                      >
                        {t('common.close')} ×
                      </span>
                    </summary>

                    {item.knowledge_type && isKnowledgeBundleType(item.knowledge_type) && item.central_question && item.structured_content ? (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-white p-4">
                        <KnowledgeBundleView type={item.knowledge_type} centralQuestion={item.central_question} content={item.structured_content} />
                      </div>
                    ) : null}

                    {isActive && <><form action={updateKnowledgeItemAction} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="version" value={item.version} />

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`title-${item.id}`} className="text-xs font-medium text-gray-700">
                          {t('notes.titleLabel')} <span aria-hidden="true" className="text-red-500">*</span>
                        </label>
                        <input
                          id={`title-${item.id}`}
                          name="title"
                          defaultValue={item.title}
                          required
                          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <KnowledgeBundleEditor
                        defaultType={item.knowledge_type}
                        defaultQuestion={item.central_question}
                        defaultContent={item.structured_content}
                        legacyContent={item.knowledge_type ? '' : item.content}
                      />

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`topic-${item.id}`} className="text-xs font-medium text-gray-700">
                          {t('notes.newTopic')}
                        </label>
                        <input
                          id={`topic-${item.id}`}
                          name="topic"
                          defaultValue={item.topic}
                          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`summary-${item.id}`} className="text-xs font-medium text-gray-700">Summary</label>
                        <textarea id={`summary-${item.id}`} name="summary" defaultValue={item.summary} maxLength={500} className="min-h-20 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`content-${item.id}`} className="text-xs font-medium text-gray-700">
                          {t('notes.contentLabel')}
                        </label>
                        <textarea
                          id={`content-${item.id}`}
                          name="content"
                          defaultValue={item.content}
                          className="min-h-28 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`tags-${item.id}`} className="text-xs font-medium text-gray-700">Tags</label>
                        <input id={`tags-${item.id}`} name="tags" defaultValue={item.tags.join(', ')} maxLength={599} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                        <span className="text-xs text-gray-500">Up to 12 comma-separated tags, 48 characters each.</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <SubmitButton
                          label={t('notes.save')}
                          loadingLabel={t('common.saving')}
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                        />
                      </div>
                    </form>

                    {!actor.isGuest ? <section className="mt-4 rounded-xl border border-violet-200 bg-violet-50/50 p-3">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-violet-800">Graph relationships</h4>
                      {privateGraph.edges.filter((edge) => edge.source === `personal:${item.id}` || edge.target === `personal:${item.id}`).length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {privateGraph.edges
                            .filter((edge) => edge.source === `personal:${item.id}` || edge.target === `personal:${item.id}`)
                            .map((edge) => {
                              const outgoing = edge.source === `personal:${item.id}`;
                              const otherId = outgoing ? edge.target : edge.source;
                              const directed = edge.type !== 'related' && edge.type !== 'equivalent_to';
                              return (
                                <li key={edge.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                                  <span className="min-w-0 text-xs text-slate-700">
                                    <span className="font-semibold">{outgoing ? (directed ? '→' : '↔') : (directed ? '←' : '↔')} {linkTargetLabel.get(otherId) ?? otherId}</span>
                                    <span className="ml-2 text-slate-500">{edge.type.replace('_', ' ')}</span>
                                  </span>
                                  <form action={deletePrivateKnowledgeEdge}>
                                    <input type="hidden" name="edge_id" value={edge.id} />
                                    <ConfirmDeleteButton
                                      label="Remove link"
                                      confirmMessage="Remove this private graph relationship?"
                                      className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50"
                                    />
                                  </form>
                                </li>
                              );
                            })}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">No saved relationship yet. This card remains visible and can be connected below.</p>
                      )}

                      <form action={createPrivateKnowledgeEdgeAction} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_8rem_auto]">
                        <input type="hidden" name="source_node_id" value={`personal:${item.id}`} />
                        <label className="sr-only" htmlFor={`relation-target-${item.id}`}>Relationship target</label>
                        <input
                          id={`relation-target-${item.id}`}
                          name="target_node_id"
                          list="knowledge-relation-targets"
                          required
                          placeholder="Search or enter a stable concept ID"
                          className="min-h-10 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                        <label className="sr-only" htmlFor={`relation-type-${item.id}`}>Relationship type</label>
                        <select id={`relation-type-${item.id}`} name="relation_type" defaultValue="related" className="min-h-10 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                          <option value="related">related</option>
                          <option value="prerequisite">prerequisite</option>
                          <option value="generalizes">generalizes</option>
                          <option value="derived_from">derived from</option>
                          <option value="equivalent_to">equivalent to</option>
                          <option value="causes">causes</option>
                          <option value="contributes_to">contributes to</option>
                          <option value="enables">enables</option>
                          <option value="inhibits">inhibits</option>
                        </select>
                        <label className="sr-only" htmlFor={`relation-direction-${item.id}`}>Relationship direction</label>
                        <select id={`relation-direction-${item.id}`} name="direction" defaultValue="outgoing" className="min-h-10 rounded-lg border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                          <option value="outgoing">This → target</option>
                          <option value="incoming">Target → this</option>
                        </select>
                        <SubmitButton label="Add link" loadingLabel="Linking…" className="min-h-10 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60" />
                      </form>
                    </section> : null}

                    {/* Delete form */}
                    <form
                      action={deleteKnowledgeItem}
                      className="mt-3 border-t pt-3"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmDeleteButton
                        label={t('notes.moveTrash')}
                        confirmMessage={t('notes.moveTrashConfirm', { title: item.title })}
                        ariaLabel={t('notes.moveTrashAria', { title: item.title })}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </form></>}
                    {isTrash && <form action={restoreKnowledgeItem} className="mt-3 border-t pt-3">
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton label={t('notes.restoreCard')} loadingLabel={t('notes.restoring')} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" />
                      {item.purge_at && <p className="mt-2 text-xs text-gray-500">{t('notes.purgeAfter', { date: formatDate(item.purge_at) })}</p>}
                    </form>}
                    {isArchive && <form action={restoreArchivedKnowledgeItemAction} className="mt-3 border-t pt-3">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="version" value={item.version} />
                      <SubmitButton label={t('notes.restoreArchived')} loadingLabel={t('notes.restoringArchived')} className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" />
                    </form>}
                  </details>
                </li>
              ))}</ol>
                </section>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
