import { getAdminUsers } from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const users = await getAdminUsers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold mb-1">Users</h1>
        <p className="text-sm text-gray-400">{users.length} active users</p>
      </div>

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
            {users.map((u) => (
              <tr key={u.user_id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{u.user_id}</td>
                <td className="py-2 pr-4 text-green-400">{u.known}</td>
                <td className="py-2 pr-4 text-yellow-400">{u.partial}</td>
                <td className="py-2 pr-4 text-gray-400">{u.total}</td>
                <td className="py-2 text-xs text-gray-400">
                  {u.last_updated ? new Date(u.last_updated).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
