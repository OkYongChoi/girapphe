import { redirect } from 'next/navigation';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getLeaderboardData } from '@/actions/graph-actions';

export const dynamic = 'force-dynamic';

function maskEmail(email: string): string {
  const [localPart, domainPart] = email.toLowerCase().split('@');
  if (!localPart || !domainPart) return 'hidden';

  const visibleLocal = localPart.slice(0, 2);
  const maskedLocal = `${visibleLocal}${'*'.repeat(Math.max(localPart.length - 2, 2))}`;

  const domainSegments = domainPart.split('.');
  const rootDomain = domainSegments[0] ?? '';
  const suffix = domainSegments.slice(1).join('.');
  const visibleDomain = rootDomain.slice(0, 1);
  const maskedDomain = `${visibleDomain}${'*'.repeat(Math.max(rootDomain.length - 1, 2))}`;

  return `${maskedLocal}@${maskedDomain}${suffix ? `.${suffix}` : ''}`;
}

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const rows = await getLeaderboardData();

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ranking</h1>
            <p className="mt-1 text-sm text-gray-600">
              Leaderboard based on known concepts and average graph score.
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
            {rows.length} users ranked
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Rank</th>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Known Count</th>
                <th className="px-4 py-3 font-semibold">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No rankings yet.
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.userId} className="border-t">
                    <td className="px-4 py-3 font-semibold text-gray-700">#{index + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{maskEmail(row.email)}</td>
                    <td className="px-4 py-3 text-gray-900">{row.known}</td>
                    <td className="px-4 py-3 text-gray-900">{(row.avgScore * 100).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
