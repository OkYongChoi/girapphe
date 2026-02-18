import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getUserCardDomainProgress, getUserStats } from '@/actions/card-actions';

export const dynamic = 'force-dynamic';

function SummaryBox({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function DomainCard({
  domain,
  reviewed,
  known,
  saved,
  unknown,
}: {
  domain: string;
  reviewed: number;
  known: number;
  saved: number;
  unknown: number;
}) {
  const knownPercent = reviewed > 0 ? (known / reviewed) * 100 : 0;

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900 capitalize">{domain}</h2>
          <p className="mt-1 text-sm text-slate-600">{reviewed} reviewed cards</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
          {knownPercent.toFixed(0)}% known
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          Known: {known}
        </div>
        <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">
          Saved: {saved}
        </div>
        <div className="rounded border border-red-200 bg-red-50 px-2 py-1 text-red-800">
          Unknown: {unknown}
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const stats = await getUserStats();
  const domains = await getUserCardDomainProgress();

  const totalReviewed = stats.known + stats.saved + stats.unknown;
  const knownPercent = totalReviewed > 0 ? (stats.known / totalReviewed) * 100 : 0;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Progress Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Card progress summary based on your known/saved/unknown states.
            </p>
          </div>
          <Link
            href="/practice"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Practice now →
          </Link>
        </div>

        {totalReviewed === 0 ? (
          <div className="mt-8 rounded-xl border bg-white p-10 text-center">
            <p className="text-3xl">📊</p>
            <p className="mt-3 text-lg font-semibold text-slate-800">No data yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Start practicing to build your card progress.
            </p>
            <Link
              href="/practice"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Start practicing
            </Link>
          </div>
        ) : (
          <>
            <div aria-label="Overall progress summary" className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryBox
                label="Known"
                value={stats.known}
                sub={`${knownPercent.toFixed(0)}% of reviewed`}
                colorClass="bg-emerald-50 text-emerald-900 border-emerald-200"
              />
              <SummaryBox
                label="Saved"
                value={stats.saved}
                sub="bookmarked for review"
                colorClass="bg-blue-50 text-blue-900 border-blue-200"
              />
              <SummaryBox
                label="Unknown"
                value={stats.unknown}
                sub="needs practice"
                colorClass="bg-red-50 text-red-900 border-red-200"
              />
              <SummaryBox
                label="Total Reviewed"
                value={totalReviewed}
                sub={`${domains.length} domain${domains.length !== 1 ? 's' : ''}`}
                colorClass="bg-slate-50 text-slate-900 border-slate-200"
              />
            </div>

            <h2 className="mt-8 text-base font-semibold text-slate-700">Domain Breakdown</h2>
            {domains.length === 0 ? (
              <p className="mt-3 rounded-xl border bg-white p-4 text-sm text-slate-500">
                Domain data is not available yet.
              </p>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {domains.map((item) => (
                  <DomainCard key={item.domain} {...item} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
