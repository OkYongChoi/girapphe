import Link from 'next/link';
import { logoutAction } from '@/actions/auth-actions';
import { getCurrentUser } from '@/lib/auth';
import NavLinks from '@/components/nav-links';
import BrandLogo from '@/components/brand-logo';

export default async function Navbar() {
  const user = await getCurrentUser();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        Skip to main content
      </a>

      <nav
        aria-label="Site header"
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 text-slate-800 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" aria-label="STEMBrain — go to home" className="inline-flex items-center">
              <BrandLogo textClassName="text-xl" />
            </Link>

            {user ? (
              <div className="flex items-center gap-3 text-sm font-medium">
                <span
                  className="hidden rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 md:inline"
                  title={user.email}
                >
                  {user.email}
                </span>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    aria-label="Log out of your account"
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
                  >
                    Log out
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Link href="/login" className="rounded-md border px-3 py-1.5 hover:bg-gray-50 transition-colors">
                  Log in
                </Link>
                <Link href="/signup" className="rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700 transition-colors">
                  Sign up
                </Link>
              </div>
            )}
          </div>

          {user ? <NavLinks /> : null}
        </div>
      </nav>
    </>
  );
}
