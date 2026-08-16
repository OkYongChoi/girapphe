import { getAdminUsers } from '@/actions/admin-actions';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const { t, formatDate, formatNumber } = await getServerI18n();
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const users = databaseConfigured ? await getAdminUsers() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{t('admin.users')}</h1>
        <p className="text-sm text-gray-400">{t('admin.activeUsers', { count: users.length })}</p>
      </div>

      {!databaseConfigured && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          {t('admin.usersDbNotice')}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-start text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pe-4">{t('admin.clerkId')}</th>
              <th className="pb-2 pe-4">{t('admin.mastered')}</th>
              <th className="pb-2 pe-4">{t('admin.reinforcing')}</th>
              <th className="pb-2 pe-4">{t('admin.totalSeen')}</th>
              <th className="pb-2">{t('admin.lastActive')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {users.map((user) => (
              <tr key={user.user_id} className="hover:bg-gray-900/50">
                <td className="py-2 pe-4 font-mono text-xs text-gray-400">{user.user_id}</td>
                <td className="py-2 pe-4 text-green-400">{formatNumber(user.mastered)}</td>
                <td className="py-2 pe-4 text-yellow-400">{formatNumber(user.reinforcing)}</td>
                <td className="py-2 pe-4 text-gray-400">{formatNumber(user.total)}</td>
                <td className="py-2 text-xs text-gray-400">
                  {user.last_updated ? formatDate(user.last_updated) : '—'}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                  {databaseConfigured ? t('admin.noUsers') : t('admin.databaseRequired')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
