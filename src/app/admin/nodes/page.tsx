import { getAdminNodes, createAdminNode, deleteAdminNode } from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

const NODE_TYPES = ['concept', 'theorem', 'algorithm', 'model'];
const DOMAINS = ['ml', 'dl', 'nlp', 'cv', 'rl', 'math', 'stats', 'systems', 'general', 'signal'];

export default async function AdminNodesPage() {
  const nodes = await getAdminNodes();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Graph Nodes</h1>
        <p className="text-sm text-gray-400">{nodes.length} nodes total</p>
      </div>

      {/* Add node form */}
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
        <input
          name="id"
          placeholder="id (slug)"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <input
          name="label"
          placeholder="label"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <select
          name="domain"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
        >
          {DOMAINS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <input
          name="level"
          type="number"
          placeholder="level (0-5)"
          defaultValue="1"
          min="0"
          max="5"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <input
          name="difficulty"
          type="number"
          placeholder="difficulty (1-5)"
          defaultValue="2"
          min="1"
          max="5"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
        />
        <select
          name="type"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none"
        >
          {NODE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button
          type="submit"
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Add Node
        </button>
      </form>

      {/* Nodes table */}
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
              <th className="pb-2"></th>
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
                    <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
