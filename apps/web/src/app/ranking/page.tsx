import Navbar from '@/components/navbar';
import { getCurrentUser } from '@/lib/auth';
import { getCardLeaderboard } from '@/actions/card-actions';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const MEDALS: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

function truncateUserId(userId: string): string {
  return `user-${userId.slice(-6)}`;
}

export default async function RankingPage() {
  const { t, formatNumber } = await getServerI18n();
  const user = await getCurrentUser();

  const rows = await getCardLeaderboard();

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-4xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('ranking.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {t('ranking.subtitle')}
            </p>
          </div>
          <div className="rounded-lg border bg-white px-3 py-2 text-sm text-gray-600">
            {t('ranking.userCount', { count: rows.length })}
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border bg-white">
          <table className="min-w-full text-sm" aria-label={t('ranking.tableAria')}>
            <caption className="sr-only">
              {t('ranking.caption')}
            </caption>
            <thead className="bg-gray-50 text-start text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{t('ranking.rank')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('ranking.user')}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{t('common.explainable')}</th>
                <th scope="col" className="hidden sm:table-cell px-4 py-3 font-semibold">{t('ranking.avgScore')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center">
                    <p className="text-2xl">🏆</p>
                    <p className="mt-2 font-semibold text-gray-700">{t('ranking.empty')}</p>
                    <p className="mt-1 text-sm text-gray-500">{t('ranking.emptyBody')}</p>
                    <LocalizedLink
                      href="/practice"
                      className="mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      {t('dashboard.start')}
                    </LocalizedLink>
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const isCurrentUser = row.userId === user?.id;
                  return (
                    <tr
                      key={row.userId}
                      className={`border-t ${isCurrentUser ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      aria-current={isCurrentUser ? 'true' : undefined}
                    >
                      <td className="px-4 py-3 font-semibold text-gray-700">
                        <span aria-hidden="true">{MEDALS[index] ?? ''} </span>
                        #{formatNumber(index + 1)}
                      </td>
                      <td className="px-4 py-3">
                        {isCurrentUser ? (
                          <span className="font-semibold text-blue-700">
                            {t('ranking.you')}
                            <span className="sr-only"> {t('ranking.yourRank')}</span>
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-gray-700">
                            {truncateUserId(row.userId)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{formatNumber(row.explainable)}</td>
                      <td className="hidden sm:table-cell px-4 py-3 text-gray-900">{formatNumber(row.avgScore, { style: 'percent', maximumFractionDigits: 1 })}</td>
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
