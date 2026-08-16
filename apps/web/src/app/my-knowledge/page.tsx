import { randomUUID } from 'node:crypto';
import Navbar from '@/components/navbar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getDeletedKnowledgeItems,
  getUserKnowledgeItems,
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
    view?: 'active' | 'trash';
    linkStatus?: 'created' | 'invalid' | 'cycle_or_duplicate';
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

function groupLabel(date: string, group: 'week' | 'month') {
  const key = kstDateKey(new Date(date));
  if (group === 'month') return key.slice(0, 7);
  const day = new Date(`${key}T00:00:00+09:00`);
  const monday = new Date(day.getTime() - ((calendarDayOfWeek(key) + 6) % 7) * 86_400_000);
  return `Week of ${kstDateKey(monday)}`;
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

export default async function MyKnowledgePage({ searchParams }: MyKnowledgePageProps) {
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const topicFilter = (params.topic ?? 'all').trim().toLowerCase();
  const sortBy = params.sort === 'title' ? 'title' : params.sort === 'updated' ? 'updated' : 'created';
  const period = ['today', 'week', 'month', 'custom'].includes(params.period ?? '') ? params.period! : 'all';
  const groupBy = params.group === 'week' || params.group === 'month' ? params.group : 'none';
  const isTrash = params.view === 'trash';
  const actor = await getCurrentActor();

  const [items, linkTargets, privateGraph] = await Promise.all([
    isTrash ? getDeletedKnowledgeItems() : getUserKnowledgeItems(),
    isTrash || actor.isGuest ? Promise.resolve([]) : getKnowledgeLinkTargets(),
    isTrash || actor.isGuest ? Promise.resolve({ nodes: [], edges: [] }) : getPrivateKnowledgeGraph(),
  ]);
  const linkTargetLabel = new Map(linkTargets.map((target) => [target.id, target.label]));
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const bounds = periodBounds(period, params.start, params.end);
  const filteredItems = items
    .filter((item) => {
      const matchesTopic = topicFilter === 'all' || item.topic.toLowerCase() === topicFilter;
      const haystack = `${item.title} ${item.summary} ${item.content} ${item.topic} ${item.tags.join(' ')}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const created = new Date(item.created_at).getTime();
      const matchesStart = !bounds.start || created >= kstStart(bounds.start);
      const matchesEnd = !bounds.end || created < kstStart(bounds.end) + 86_400_000;
      return matchesTopic && matchesQuery && matchesStart && matchesEnd;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return +(sortBy === 'updated' ? new Date(b.updated_at) : new Date(b.created_at))
        - +(sortBy === 'updated' ? new Date(a.updated_at) : new Date(a.created_at));
    });

  const itemGroups = groupBy === 'none'
    ? [{ label: null, items: filteredItems }]
    : Object.entries(Object.groupBy(filteredItems, (item) => groupLabel(item.created_at, groupBy)))
      .map(([label, grouped]) => ({ label, items: grouped ?? [] }));
  const hasActiveFilter = !!params.q || (params.topic && params.topic !== 'all') || sortBy !== 'created' || period !== 'all' || groupBy !== 'none';
  const createRequestId = randomUUID();

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar user={actor.isGuest ? null : actor} />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isTrash ? 'Knowledge Trash' : 'My Notes'}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {isTrash
                ? `Restore deleted cards within ${PERSONAL_CARD_RETENTION_DAYS} days before they are permanently removed.`
                : 'Save your own notes, frameworks, and concepts. Everything here is private to your browser or account.'}
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
            {filteredItems.length} of {items.length} {isTrash ? 'deleted' : 'personal'} cards
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

        {/* Filter form */}
        <form role="search" aria-label="Filter knowledge items" className="mt-4 rounded-xl border bg-white p-3">
          <input type="hidden" name="view" value={isTrash ? 'trash' : 'active'} />
          <div className="grid gap-2 lg:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_auto_auto]">
            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-search" className="sr-only">
                Search notes
              </label>
              <input
                id="knowledge-search"
                type="text"
                name="q"
                defaultValue={params.q ?? ''}
                placeholder="Search title, summary, content, or #tag"
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-topic" className="sr-only">
                Filter by topic
              </label>
              <select
                id="knowledge-topic"
                name="topic"
                defaultValue={topicFilter}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">All topics</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic.toLowerCase()}>
                    {topic}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="knowledge-sort" className="sr-only">
                Sort order
              </label>
              <select
                id="knowledge-sort"
                name="sort"
                defaultValue={sortBy}
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="created">Recently added</option>
                <option value="updated">Recently updated</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>

            <select name="period" defaultValue={period} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Added date range">
              <option value="all">Any added date</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="month">This month</option>
              <option value="custom">Custom range</option>
            </select>

            <select name="group" defaultValue={groupBy} className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" aria-label="Group cards by date">
              <option value="none">No date grouping</option>
              <option value="week">Group by week</option>
              <option value="month">Group by month</option>
            </select>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Search
            </button>

            {hasActiveFilter && (
              <Link
                href="/my-knowledge"
                className="rounded-lg border px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Clear
              </Link>
            )}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:max-w-md">
            <label className="text-xs text-gray-600">From<input type="date" name="start" defaultValue={params.start ?? ''} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
            <label className="text-xs text-gray-600">To<input type="date" name="end" defaultValue={params.end ?? ''} className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm" /></label>
          </div>
        </form>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <Link href="/my-knowledge" className={`rounded-lg border px-3 py-1.5 ${!isTrash ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>My notes</Link>
          <Link href="/my-knowledge?view=trash" className={`rounded-lg border px-3 py-1.5 ${isTrash ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>Trash</Link>
        </div>

        {!isTrash && linkTargets.length > 0 ? (
          <datalist id="knowledge-relation-targets">
            {linkTargets.map((target) => (
              <option key={target.id} value={target.id}>{target.label} ({target.scope})</option>
            ))}
          </datalist>
        ) : null}

        {!isTrash && <form action={createKnowledgeItem} className="mt-6 rounded-xl border bg-white p-4 md:p-6">
          <input type="hidden" name="request_id" value={createRequestId} />
          <h2 className="text-base font-semibold">Add knowledge item</h2>
          <p className="mt-1 text-xs text-gray-500">Use concise titles and reusable insights you want to revisit.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-title" className="text-xs font-medium text-gray-700">
                Title <span aria-hidden="true" className="text-red-500">*</span>
              </label>
              <input
                id="new-title"
                name="title"
                required
                placeholder="e.g., Gradient Descent Pitfalls"
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="new-topic" className="text-xs font-medium text-gray-700">
                Topic
              </label>
              <input
                id="new-topic"
                name="topic"
                placeholder="e.g., ml, control, signal"
                className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
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
                Content
              </label>
              <textarea
                id="new-content"
                name="content"
                placeholder="What should you remember?"
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
              label="Save item"
              loadingLabel="Saving…"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
          </div>
        </form>}

        {/* Items list */}
        <div className="mt-6 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-2xl">📝</p>
              <p className="mt-2 font-semibold text-gray-800">No notes yet</p>
              <p className="mt-1 text-sm text-gray-500">
                Add your first knowledge item using the form above. Great for frameworks, pitfalls, and
                hard-to-remember insights.
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border bg-white p-8 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-2 font-semibold text-gray-800">No matches found</p>
              <p className="mt-1 text-sm text-gray-500">
                Try a different search term or topic filter.
              </p>
              <Link href="/my-knowledge" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Clear filters
              </Link>
            </div>
          ) : (
            <div className="grid gap-6">
              {itemGroups.map(({ label, items: groupedItems }) => (
                <section key={label ?? 'all'}>
                  {label && <h2 className="mb-2 text-sm font-semibold text-gray-600">{label}</h2>}
                  <ol aria-label="Your knowledge items" className="grid gap-4">
              {groupedItems.map((item) => (
                <li key={item.id}>
                  <details className="rounded-xl border bg-white p-4 md:p-5 group">
                    <summary className="flex cursor-pointer items-start justify-between gap-3 list-none">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                          <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                            {item.topic}
                          </span>
                          <span className="ml-2">Added {new Date(item.created_at).toLocaleDateString()}</span>
                          <span className="ml-2">Updated {new Date(item.updated_at).toLocaleDateString()}</span>
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
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.summary || item.content}</p>
                        )}
                      </div>
                      <span
                        className="shrink-0 rounded border px-2 py-1 text-xs text-gray-500 group-open:hidden hover:bg-gray-50"
                        aria-hidden="true"
                      >
                        Edit ✎
                      </span>
                      <span
                        className="hidden shrink-0 rounded border px-2 py-1 text-xs text-gray-500 group-open:inline hover:bg-gray-50"
                        aria-hidden="true"
                      >
                        Close ×
                      </span>
                    </summary>

                    {!isTrash && <><form action={updateKnowledgeItem} className="mt-4 grid gap-3">
                      <input type="hidden" name="id" value={item.id} />

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`title-${item.id}`} className="text-xs font-medium text-gray-700">
                          Title <span aria-hidden="true" className="text-red-500">*</span>
                        </label>
                        <input
                          id={`title-${item.id}`}
                          name="title"
                          defaultValue={item.title}
                          required
                          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label htmlFor={`topic-${item.id}`} className="text-xs font-medium text-gray-700">
                          Topic
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
                          Content
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
                          label="Save changes"
                          loadingLabel="Saving…"
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
                              const directed = edge.type === 'prerequisite' || edge.type === 'generalizes' || edge.type === 'derived_from';
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
                        label="Remove item"
                        confirmMessage={`Move "${item.title}" to trash? You can restore it within ${PERSONAL_CARD_RETENTION_DAYS} days.`}
                        ariaLabel={`Remove "${item.title}" from your knowledge items`}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                    </form></>}
                    {isTrash && <form action={restoreKnowledgeItem} className="mt-3 border-t pt-3">
                      <input type="hidden" name="id" value={item.id} />
                      <SubmitButton label="Restore card" loadingLabel="Restoring…" className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50" />
                      {item.purge_at && <p className="mt-2 text-xs text-gray-500">Permanently removed after {new Date(item.purge_at).toLocaleDateString()}.</p>}
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
