import {
  getAdminEdges,
  getAdminNodes,
  createAdminEdge,
  deleteAdminEdge,
} from '@/actions/admin-actions';

export const dynamic = 'force-dynamic';

const EDGE_TYPES = ['prerequisite', 'related', 'generalizes', 'derived_from', 'equivalent_to'];

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none';

export default async function AdminEdgesPage() {
  const [edges, nodes] = await Promise.all([getAdminEdges(), getAdminNodes()]);
  const nodeMap = new Map(nodes.map((n) => [n.id, n.label]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold mb-1">Graph Edges</h1>
        <p className="text-sm text-gray-400">{edges.length} edges total</p>
      </div>

      {/* Add edge form */}
      <form
        action={async (formData: FormData) => {
          'use server';
          await createAdminEdge({
            source: formData.get('source') as string,
            target: formData.get('target') as string,
            type: formData.get('type') as string,
            weight: Number(formData.get('weight')),
          });
        }}
        className="grid grid-cols-2 gap-3 rounded-xl border border-gray-800 p-4 md:grid-cols-4"
      >
        <h2 className="col-span-full text-sm font-medium text-gray-300">Add Edge</h2>
        <select name="source" required className={inputCls}>
          <option value="">source node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        <select name="target" required className={inputCls}>
          <option value="">target node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>{n.label}</option>
          ))}
        </select>
        <select name="type" required className={inputCls}>
          {EDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          name="weight"
          type="number"
          step="0.1"
          placeholder="weight"
          defaultValue="1"
          min="0"
          max="1"
          required
          className={inputCls}
        />
        <button
          type="submit"
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Add Edge
        </button>
      </form>

      {/* Edges table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pr-4">ID</th>
              <th className="pb-2 pr-4">Source</th>
              <th className="pb-2 pr-4">Target</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2 pr-4">Weight</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {edges.map((edge) => (
              <tr key={edge.id} className="hover:bg-gray-900/50">
                <td className="py-2 pr-4 font-mono text-xs text-gray-400">{edge.id}</td>
                <td className="py-2 pr-4">{nodeMap.get(edge.source) ?? edge.source}</td>
                <td className="py-2 pr-4">{nodeMap.get(edge.target) ?? edge.target}</td>
                <td className="py-2 pr-4 text-gray-400">{edge.type}</td>
                <td className="py-2 pr-4 text-gray-400">{edge.weight}</td>
                <td className="py-2">
                  <form
                    action={async () => {
                      'use server';
                      await deleteAdminEdge(edge.id);
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
