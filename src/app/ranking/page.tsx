import { redirect } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getCardLeaderboard } from '@/actions/card-actions';

export const dynamic = 'force-dynamic';

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function truncateUserId(userId: string): string {
  return `user-${userId.slice(-6)}`;
}

export default async function RankingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const rows = await getCardLeaderboard();

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ranking</h1>
            <p className="mt-1 text-sm text-gray-600">
              Leaderboard based on card progress (known ratio + known count).
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
            {rows.length} {rows.length === 1 ? 'user' : 'users'} ranked
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm" aria-label="Knowledge leaderboard">
            <caption className="sr-only">
              Knowledge leaderboard — ranked by known cards and known ratio
            </caption>
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Rank</th>
                <th scope="col" className="px-4 py-3 font-semibold">User</th>
                <th scope="col" className="px-4 py-3 font-semibold">Known</th>
                <th scope="col" className="px-4 py-3 font-semibold">Avg Score</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-2xl">🏆</p>
                    <p className="mt-2 font-semibold text-gray-700">No rankings yet</p>
                    <p className="mt-1 text-sm text-gray-500">Be the first on the leaderboard!</p>
                    <Link
                      href="/practice"
                      className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Start practicing
                    </Link>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const isCurrentUser = row.userId === user.id;
                  return (
                    <tr
                      key={row.userId}
                      className={`border-t ${isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      aria-current={isCurrentUser ? 'true' : undefined}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        <span aria-hidden="true">{MEDALS[index] ?? ''} </span>
                        #{index + 1}
                      </td>
                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="font-semibold text-blue-700">
                            You
                            <span className="sr-only"> (your rank)</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-gray-700">
                            {truncateUserId(row.userId)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{row.known}</td>
                      <td className="px-4 py-3 text-gray-900">{(row.avgScore * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
