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

  return (
    <main className="min-h-screen bg-gray-50">
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

        <form className="mt-4 grid gap-2 rounded-xl border bg-white p-3 md:grid-cols-[1fr_auto_auto_auto]">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Search title, topic, or content"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select name="topic" defaultValue={topicFilter} className="rounded-lg border px-3 py-2 text-sm">
            <option value="all">All topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic.toLowerCase()}>
                {topic}
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sortBy} className="rounded-lg border px-3 py-2 text-sm">
            <option value="recent">Recently updated</option>
            <option value="title">Title A-Z</option>
          </select>
          <button type="submit" className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
            Apply
          </button>
        </form>

        <form action={createKnowledgeItem} className="mt-6 rounded-xl border bg-white p-4 md:p-6">
          <h2 className="text-base font-semibold">Add knowledge item</h2>
          <p className="mt-1 text-xs text-gray-500">Use concise titles and reusable insights you want to revisit.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              name="title"
              required
              placeholder="Title (e.g., Gradient Descent Pitfalls)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <input
              name="topic"
              placeholder="Topic (e.g., ml, control, signal)"
              className="rounded-lg border px-3 py-2 text-sm"
            />
            <textarea
              name="content"
              placeholder="What should you remember?"
              className="md:col-span-2 min-h-28 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Save item
            </button>
            <Link href="/knowledge" className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Open knowledge map
            </Link>
          </div>
        </form>

        <div className="mt-6 grid gap-4">
          {items.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
              No knowledge items yet. Add your first one above.
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border bg-white p-6 text-sm text-gray-500">
              No knowledge items match your current filter.
            </div>
          ) : (
            filteredItems.map((item) => (
              <details key={item.id} className="rounded-xl border bg-white p-4 md:p-5">
                <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-xs text-gray-500">
                      Topic: {item.topic} · Updated {new Date(item.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">Edit</span>
                </summary>

                <form action={updateKnowledgeItem} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    name="title"
                    defaultValue={item.title}
                    required
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <input
                    name="topic"
                    defaultValue={item.topic}
                    className="rounded-lg border px-3 py-2 text-sm"
                  />
                  <textarea
                    name="content"
                    defaultValue={item.content}
                    className="min-h-28 rounded-lg border px-3 py-2 text-sm"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Update
                    </button>
                  </div>
                </form>

                <form action={deleteKnowledgeItem} className="mt-2">
                  <input type="hidden" name="id" value={item.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </form>
              </details>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
