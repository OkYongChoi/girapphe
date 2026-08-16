import {
  createAdminNode,
  deleteAdminNode,
  getAdminNodes,
} from '@/actions/admin-actions';
import { ADMIN_DOMAINS, ADMIN_NODE_TYPES } from '@/lib/admin-config';
import { getServerI18n } from '@/i18n/server';
import { localizeDomain, localizeType } from '@stem-brain/shared';

export const dynamic = 'force-dynamic';

const inputCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';
const selectCls =
  'w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export default async function AdminNodesPage() {
  const { locale, t, formatNumber } = await getServerI18n();
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  const nodes = databaseConfigured ? await getAdminNodes() : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{t('admin.graphNodes')}</h1>
        <p className="text-sm text-gray-400">{t('admin.nodesTotal', { count: nodes.length })}</p>
      </div>

      {!databaseConfigured && (
        <div className="rounded-xl border border-amber-700/40 bg-amber-950/40 p-4 text-sm text-amber-200">
          {t('admin.nodesDbNotice')}
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
        <h2 className="col-span-full text-sm font-medium text-gray-300">{t('admin.addNode')}</h2>
        <input name="id" placeholder={t('admin.idPlaceholder')} required disabled={!databaseConfigured} className={inputCls} />
        <input name="label" placeholder={t('admin.labelPlaceholder')} required disabled={!databaseConfigured} className={inputCls} />
        <select
          name="domain"
          required
          defaultValue={ADMIN_DOMAINS[0]}
          disabled={!databaseConfigured}
          className={selectCls}
        >
          {ADMIN_DOMAINS.map((domain) => (
            <option key={domain} value={domain}>
              {localizeDomain(locale, domain)}
            </option>
          ))}
        </select>
        <input
          name="level"
          type="number"
          placeholder={t('admin.levelPlaceholder')}
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
          placeholder={t('admin.difficultyPlaceholder')}
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
              {localizeType(locale, type)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!databaseConfigured}
          className="col-span-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-950 disabled:text-indigo-300"
        >
          {t('admin.addNode')}
        </button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-start text-xs uppercase tracking-wide text-gray-500">
              <th className="pb-2 pe-4">{t('admin.id')}</th>
              <th className="pb-2 pe-4">{t('admin.label')}</th>
              <th className="pb-2 pe-4">{t('common.domain')}</th>
              <th className="pb-2 pe-4">{t('admin.level')}</th>
              <th className="pb-2 pe-4">{t('admin.diff')}</th>
              <th className="pb-2 pe-4">{t('admin.type')}</th>
              <th className="pb-2">{t('admin.action')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-900">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-900/50">
                <td className="py-2 pe-4 font-mono text-xs text-gray-400">{node.id}</td>
                <td className="py-2 pe-4">{node.label}</td>
                <td className="py-2 pe-4 text-gray-400">{localizeDomain(locale, node.domain)}</td>
                <td className="py-2 pe-4 text-gray-400">{formatNumber(node.level)}</td>
                <td className="py-2 pe-4 text-gray-400">{formatNumber(node.difficulty)}</td>
                <td className="py-2 pe-4 text-gray-400">{localizeType(locale, node.type)}</td>
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
                      {t('common.delete')}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {nodes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-sm text-gray-500">
                  {databaseConfigured ? t('admin.noNodes') : t('admin.databaseRequired')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
