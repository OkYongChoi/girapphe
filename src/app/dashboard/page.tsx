import { redirect } from 'next/navigation';
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

function Ring({ percent }: { percent: number }) {
  const safePercent = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#2563eb ${safePercent}%, #e2e8f0 ${safePercent}% 100%)`,
      }}
    >
      <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-xs font-semibold text-slate-700">
        {safePercent.toFixed(0)}%
      </div>
    </div>
  );
}

function DomainCard({ item }: { item: DomainProgress }) {
  const knownPercent = item.total > 0 ? (item.known / item.total) * 100 : 0;
  const scorePercent = item.avg * 100;

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {item.known}/{item.total} known nodes
          </p>
        </div>
        <Ring percent={knownPercent} />
      </div>
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Knowledge score</span>
          <span>{scorePercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
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
  const domainCards = [
    getDomainProgress(stats.domains, 'Artificial Intelligence'),
    getDomainProgress(stats.domains, 'Chemistry'),
    getDomainProgress(stats.domains, 'Biology'),
  ];

  const totalKnowledgeScore = stats.avg_knowledge * 100;
  const nodesToMaster = stats.unknown + stats.partial;

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Progress Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Domain progress for AI, Chemistry, and Biology.
            </p>
          </div>
          <div className="rounded-lg border bg-white px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold">Total Knowledge Score: {totalKnowledgeScore.toFixed(1)}%</div>
            <div className="mt-1 text-slate-500">Nodes to Master: {nodesToMaster}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {domainCards.map((item) => (
            <DomainCard key={item.name} item={item} />
          ))}
        </div>
      </section>
    </main>
  );
}
