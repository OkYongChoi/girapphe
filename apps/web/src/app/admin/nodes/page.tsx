import {
  createAdminNode,
  deleteAdminNode,
  getAdminNodes,
} from '@/actions/admin-actions';
import { ADMIN_DOMAINS, ADMIN_NODE_TYPES } from '@/lib/admin-config';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const selectCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export default async function AdminNodesPage() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const nodes = databaseConfigured ? await getAdminNodes() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold">Graph Nodes</h1>
        <p className="text-sm text-gray-400">{nodes.length} nodes total</p>
      </div>

      {!databaseConfigured && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          Set `DATABASE_URL` before using admin node management. The public app can run in fallback
          mode, but `/admin` reads and writes the PostgreSQL graph tables directly.
        </div>
      )}

      <form
        action={async (formData: FormData) => {
          'use server';
          await createAdminNode({
            id: formData.get('id') as string,
            label: formData.get('label') as string,
            domain: formData.get('domain') as string,
            level: Number(formData.get('level')),
            difficulty: Number(formData.get('difficulty')),
            type: formData.get('type') as string,
          });
        }}
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 p-4 md:grid-cols-3"
      >
        <h2 className="col-span-full text-sm font-medium text-gray-300">Add Node</h2>
        <input name="id" placeholder="id (slug)" required disabled={!databaseConfigured} className={inputCls} />
        <input name="label" placeholder="label" required disabled={!databaseConfigured} className={inputCls} />
        <select
          name="domain"
          required
          defaultValue={ADMIN_DOMAINS[0]}
          disabled={!databaseConfigured}
          className={selectCls}
        >
          {ADMIN_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {domain}
            </option>
          ))}
        </select>
        <input
          name="level"
          type="number"
          placeholder="level (0-5)"
          defaultValue="1"
          min="0"
          max="5"
          required
          disabled={!databaseConfigured}
          className={inputCls}
        />
        <input
          name="difficulty"
          type="number"
          placeholder="difficulty (1-5)"
          defaultValue="2"
          min="1"
          max="5"
          required
          disabled={!databaseConfigured}
          className={inputCls}
        />
        <select
          name="type"
          required
          defaultValue={ADMIN_NODE_TYPES[0]}
          disabled={!databaseConfigured}
          className={selectCls}
        >
          {ADMIN_NODE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!databaseConfigured}
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-950 disabled:text-indigo-300"
        >
          Add Node
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">ID</th>
              <th className="pb-2 pr-4">Label</th>
              <th className="pb-2 pr-4">Domain</th>
              <th className="pb-2 pr-4">Level</th>
              <th className="pb-2 pr-4">Diff</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{node.id}</td>
                <td className="py-2 pr-4">{node.label}</td>
                <td className="py-2 pr-4 text-gray-400">{node.domain}</td>
                <td className="py-2 pr-4 text-gray-400">{node.level}</td>
                <td className="py-2 pr-4 text-gray-400">{node.difficulty}</td>
                <td className="py-2 pr-4 text-gray-400">{node.type}</td>
                <td className="py-2">
                  <form
                    action={async () => {
                      'use server';
                      await deleteAdminNode(node.id);
                    }}
                  >
                    <button
                      type="submit"
                      disabled={!databaseConfigured}
                      className="text-xs text-red-400 hover:text-red-300 disabled:cursor-not-allowed disabled:text-red-900"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                  {databaseConfigured ? 'No graph nodes found.' : 'Database connection required.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
