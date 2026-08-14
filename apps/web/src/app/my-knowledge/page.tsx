import { randomUUID } from 'node:crypto';
import Navbar from '@/components/navbar';
import Link from 'next/link';
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

export default async function MyKnowledgePage({ searchParams }: MyKnowledgePageProps) {
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const topicFilter = (params.topic ?? 'all').trim().toLowerCase();
  const sortBy = params.sort === 'title' ? 'title' : params.sort === 'updated' ? 'updated' : 'created';
  const period = ['today', 'week', 'month', 'custom'].includes(params.period ?? '') ? params.period! : 'all';
  const groupBy = params.group === 'week' || params.group === 'month' ? params.group : 'none';
  const isTrash = params.view === 'trash';

  const items = isTrash ? await getDeletedKnowledgeItems() : await getUserKnowledgeItems();
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const bounds = periodBounds(period, params.start, params.end);
  const filteredItems = items
    .filter((item) => {
      const matchesTopic = topicFilter === 'all' || item.topic.toLowerCase() === topicFilter;
      const haystack = `${item.title} ${item.content} ${item.topic}`.toLowerCase();
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
      <Navbar />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isTrash ? 'Knowledge Trash' : 'My Knowledge'}</h1>
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
                placeholder="Search title, topic, or content"
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
          <Link href="/my-knowledge" className={`rounded-lg border px-3 py-1.5 ${!isTrash ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>My cards</Link>
          <Link href="/my-knowledge?view=trash" className={`rounded-lg border px-3 py-1.5 ${isTrash ? 'bg-slate-900 text-white' : 'bg-white text-gray-700'}`}>Trash</Link>
        </div>

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
                        {item.content && (
                          <p className="mt-2 line-clamp-2 text-sm text-gray-600">{item.content}</p>
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

                      <div className="flex items-center gap-2">
                        <SubmitButton
                          label="Save changes"
                          loadingLabel="Saving…"
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
                        />
                      </div>
                    </form>

                    {/* Delete form */}
                    <form
                      action={deleteKnowledgeItem}
                      className="mt-3 border-t pt-3"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <ConfirmDeleteButton
                        label="Remove item"
                        confirmMessage={`Remove "${item.title}"? This cannot be undone.`}
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
