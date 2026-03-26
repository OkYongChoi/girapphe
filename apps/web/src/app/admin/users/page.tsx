import { getAdminUsers } from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const users = databaseConfigured ? await getAdminUsers() : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Users</h1>
        <p className="text-sm text-gray-400">{users.length} active users</p>
      </div>

      {!databaseConfigured && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          Set `DATABASE_URL` before viewing user knowledge summaries. This page queries
          `user_knowledge_states` directly.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">Clerk ID</th>
              <th className="pb-2 pr-4">Known</th>
              <th className="pb-2 pr-4">Partial</th>
              <th className="pb-2 pr-4">Total seen</th>
              <th className="pb-2">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {users.map((user) => (
              <tr key={user.user_id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{user.user_id}</td>
                <td className="py-2 pr-4 text-green-400">{user.known}</td>
                <td className="py-2 pr-4 text-yellow-400">{user.partial}</td>
                <td className="py-2 pr-4 text-gray-400">{user.total}</td>
                <td className="py-2 text-xs text-gray-400">
                  {user.last_updated ? new Date(user.last_updated).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-sm text-gray-500">
                  {databaseConfigured ? 'No user knowledge data found.' : 'Database connection required.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
