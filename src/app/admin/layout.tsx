import { requireAdminUser } from '@/lib/auth';
import Link from 'next/link';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminUser();

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center gap-6">
          <span className="font-semibold text-sm text-gray-400 uppercase tracking-widest">
            Admin
          </span>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/nodes" className="text-gray-400 hover:text-white transition-colors">
              Nodes
            </Link>
            <Link href="/admin/edges" className="text-gray-400 hover:text-white transition-colors">
              Edges
            </Link>
            <Link href="/admin/users" className="text-gray-400 hover:text-white transition-colors">
              Users
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
