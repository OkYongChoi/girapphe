import Link from 'next/link';
import { logoutAction } from '@/actions/auth-actions';
import { getCurrentUser } from '@/lib/auth';

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <nav className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="font-bold text-xl tracking-tight">
          STEM<span className="text-blue-600">Brain</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-3 text-sm font-medium">
              <span className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 md:inline">
                {user.email}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="rounded-md border px-3 py-1.5 hover:bg-gray-50">
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link href="/login" className="rounded-md border px-3 py-1.5 hover:bg-gray-50">
                Log in
              </Link>
              <Link href="/signup" className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700">
                Sign up
              </Link>
            </div>
          )}
        </div>

        {user ? (
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto text-sm font-medium">
            <Link href="/practice" className="hover:text-blue-600 transition-colors">
              Practice
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/saved" className="hover:text-blue-600 transition-colors">
              Saved
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/my-knowledge" className="hover:text-blue-600 transition-colors">
              My Knowledge
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/ranking" className="hover:text-blue-600 transition-colors">
              Ranking
            </Link>
            <span className="text-slate-300">•</span>
            <Link href="/knowledge" className="hover:text-blue-600 transition-colors">
              Knowledge Map
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
