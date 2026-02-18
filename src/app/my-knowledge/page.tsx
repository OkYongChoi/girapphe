import { redirect } from 'next/navigation';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getUserKnowledgeItems,
  updateKnowledgeItem,
} from '@/actions/user-knowledge-actions';

export const dynamic = 'force-dynamic';

type MyKnowledgePageProps = {
  searchParams?: Promise<{
    q?: string;
    topic?: string;
    sort?: 'recent' | 'title';
  }>;
};

export default async function MyKnowledgePage({ searchParams }: MyKnowledgePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  const params = (await searchParams) ?? {};
  const query = (params.q ?? '').trim().toLowerCase();
  const topicFilter = (params.topic ?? 'all').trim().toLowerCase();
  const sortBy = params.sort === 'title' ? 'title' : 'recent';

  const items = await getUserKnowledgeItems();
  const topics = Array.from(new Set(items.map((item) => item.topic))).sort();
  const filteredItems = items
    .filter((item) => {
      const matchesTopic = topicFilter === 'all' || item.topic.toLowerCase() === topicFilter;
      const haystack = `${item.title} ${item.content} ${item.topic}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesTopic && matchesQuery;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return +new Date(b.updated_at) - +new Date(a.updated_at);
    });

  const hasActiveFilter = !!params.q || (params.topic && params.topic !== 'all') || params.sort === 'title';

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Knowledge</h1>
            <p className="mt-1 text-sm text-gray-600">
              Save your own notes, frameworks, and concepts. Everything here is private to your account.
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
            {filteredItems.length} of {items.length} personal notes
          </div>
        </div>

        {/* Filter form */}
        <form role="search" aria-label="Filter knowledge items" className="mt-4 rounded-xl border bg-white p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
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
                className="rounded-lg border px-3 py-2 text-sm"
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
                className="rounded-lg border px-3 py-2 text-sm"
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
                className="rounded-lg border px-3 py-2 text-sm"
              >
                <option value="recent">Recently updated</option>
                <option value="title">Title A–Z</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Search
            </button>

            {hasActiveFilter && (
              <Link
                href="/my-knowledge"
                className="rounded-lg border px-4 py-2 text-center text-sm text-gray-600 hover:bg-gray-50"
              >
                Clear
              </Link>
            )}
          </div>
        </form>

        {/* Add new item form */}
        <form action={createKnowledgeItem} className="mt-6 rounded-xl border bg-white p-4 md:p-6">
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
                className="rounded-lg border px-3 py-2 text-sm"
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
                className="rounded-lg border px-3 py-2 text-sm"
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
                className="min-h-28 rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save item
            </button>
            <Link
              href="/knowledge"
              className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Open knowledge map
            </Link>
          </div>
        </form>

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
            <ol aria-label="Your knowledge items" className="grid gap-4">
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <details className="rounded-xl border bg-white p-4 md:p-5 group">
                    <summary className="flex cursor-pointer items-start justify-between gap-3 list-none">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900">{item.title}</h3>
                        <p className="mt-0.5 text-xs text-gray-500">
                          <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-medium">
                            {item.topic}
                          </span>
                          <span className="ml-2">
                            Updated {new Date(item.updated_at).toLocaleDateString()}
                          </span>
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

                    {/* Edit form */}
                    <form action={updateKnowledgeItem} className="mt-4 grid gap-3">
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
                          className="rounded-lg border px-3 py-2 text-sm"
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
                          className="rounded-lg border px-3 py-2 text-sm"
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
                          className="min-h-28 rounded-lg border px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          Save changes
                        </button>
                      </div>
                    </form>

                    {/* Delete form */}
                    <form
                      action={deleteKnowledgeItem}
                      className="mt-3 border-t pt-3"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <button
                        type="submit"
                        aria-label={`Remove "${item.title}" from your knowledge items`}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove item
                      </button>
                    </form>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </main>
  );
}
