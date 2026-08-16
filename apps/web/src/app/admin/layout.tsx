import { requireAdminUser } from '@/lib/auth';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();
  const { t } = await getServerI18n();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-6">
          <span className="text-sm font-semibold uppercase tracking-widest text-gray-400">
            {t('admin.title')}
          </span>
          <nav className="flex gap-4 text-sm">
            <LocalizedLink href="/admin/nodes" className="text-gray-400 transition-colors hover:text-white">
              {t('admin.nodes')}
            </LocalizedLink>
            <LocalizedLink href="/admin/edges" className="text-gray-400 transition-colors hover:text-white">
              {t('admin.edges')}
            </LocalizedLink>
            <LocalizedLink href="/admin/users" className="text-gray-400 transition-colors hover:text-white">
              {t('admin.users')}
            </LocalizedLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
