import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getUserGraphStats } from '@/actions/graph-actions';

export const dynamic = 'force-dynamic';

type DomainProgress = {
  name: string;
  known: number;
  total: number;
  avg: number;
};

function getDomainProgress(
  domains: Record<string, { total: number; known: number; avg: number }>,
  domainName: string
): DomainProgress {
  const stats = domains[domainName] ?? { total: 0, known: 0, avg: 0 };
  return {
    name: domainName,
    known: stats.known,
    total: stats.total,
    avg: stats.avg,
  };
}

function Ring({ percent, label }: { percent: number; label: string }) {
  const safePercent = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="img"
      aria-label={`${label}: ${safePercent.toFixed(0)}%`}
      className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#2563eb ${safePercent}%, #e2e8f0 ${safePercent}% 100%)`,
      }}
    >
      <div
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-full bg-white text-xs font-semibold text-slate-700"
      >
        {safePercent.toFixed(0)}%
      </div>
    </div>
  );
}

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

function DomainCard({ item }: { item: DomainProgress }) {
  const knownPercent = item.total > 0 ? (item.known / item.total) * 100 : 0;
  const scorePercent = item.avg * 100;

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {item.known} / {item.total} known nodes
          </p>
        </div>
        <Ring percent={knownPercent} label={`${item.name} coverage`} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span id={`score-label-${item.name.replace(/\s+/g, '-').toLowerCase()}`}>Knowledge score</span>
          <span aria-hidden="true">{scorePercent.toFixed(1)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(scorePercent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-labelledby={`score-label-${item.name.replace(/\s+/g, '-').toLowerCase()}`}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            aria-hidden="true"
            className="h-full rounded-full bg-blue-600"
            style={{ width: `${Math.max(0, Math.min(100, scorePercent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const stats = await getUserGraphStats();

  // Show all domains sorted by total nodes, falling back to avg score
  const allDomainEntries = Object.entries(stats.domains).sort(
    ([, a], [, b]) => b.total - a.total || b.avg - a.avg
  );

  const domainCards = allDomainEntries.length > 0
    ? allDomainEntries.map(([name]) => getDomainProgress(stats.domains, name))
    : [];

  const totalKnowledgeScore = stats.avg_knowledge * 100;
  const nodesToMaster = stats.unknown + stats.partial;
  const knownPercent = stats.total_nodes > 0 ? (stats.known / stats.total_nodes) * 100 : 0;

  const hasData = stats.total_nodes > 0;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Progress Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Your graph coverage and knowledge scores across all domains.
            </p>
          </div>
          <Link
            href="/practice"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Practice now →
          </Link>
        </div>

        {!hasData ? (
          <div className="mt-8 rounded-xl border bg-white p-10 text-center">
            <p className="text-3xl">📊</p>
            <p className="mt-3 text-lg font-semibold text-slate-800">No data yet</p>
            <p className="mt-2 text-sm text-slate-500">
              Start practicing to build up your knowledge graph and see your progress here.
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
            {/* Summary stats */}
            <div
              aria-label="Overall progress summary"
              className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4"
            >
              <SummaryBox
                label="Known"
                value={stats.known}
                sub={`${knownPercent.toFixed(0)}% of graph`}
                colorClass="bg-emerald-50 text-emerald-900 border-emerald-200"
              />
              <SummaryBox
                label="Knowledge Score"
                value={`${totalKnowledgeScore.toFixed(1)}%`}
                sub="avg across all nodes"
                colorClass="bg-blue-50 text-blue-900 border-blue-200"
              />
              <SummaryBox
                label="To Master"
                value={nodesToMaster}
                sub="unknown + partial"
                colorClass="bg-amber-50 text-amber-900 border-amber-200"
              />
              <SummaryBox
                label="Total Nodes"
                value={stats.total_nodes}
                sub={`${allDomainEntries.length} domain${allDomainEntries.length !== 1 ? 's' : ''}`}
                colorClass="bg-slate-50 text-slate-900 border-slate-200"
              />
            </div>

            {/* Domain breakdown */}
            <h2 className="mt-8 text-base font-semibold text-slate-700">Domains</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {domainCards.map((item) => (
                <DomainCard key={item.name} item={item} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
