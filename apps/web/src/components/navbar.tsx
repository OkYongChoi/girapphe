import Link from 'next/link';
import { logoutAction } from '@/actions/auth-actions';
import { getCurrentUser, type AuthUser } from '@/lib/auth';
import NavLinks from '@/components/nav-links';
import BrandLogo from '@/components/brand-logo';

export default async function Navbar({ user: initialUser, variant = 'default' }: { user?: AuthUser | null; variant?: 'default' | 'home' } = {}) {
  const user = initialUser === undefined ? await getCurrentUser() : initialUser;
  const isHome = variant === 'home';

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
        className={`sticky top-0 z-40 overflow-hidden border-b px-4 py-3 backdrop-blur ${isHome ? 'border-white/10 bg-slate-950/60 text-white shadow-[0_10px_40px_rgba(2,6,23,0.18)]' : 'border-slate-200 bg-white/95 text-slate-800'}`}
      >
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link href="/" aria-label="STEMBrain — go to home" className="inline-flex min-w-0 items-center">
              <BrandLogo textClassName={isHome ? 'text-xl !text-white' : 'text-xl'} />
            </Link>

            {user ? (
              <div className="flex shrink-0 items-center gap-3 text-sm font-medium">
                <span
                  className={`hidden rounded-md px-2 py-1 text-xs md:inline ${isHome ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  title={user.email}
                >
                  {user.email}
                </span>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    aria-label="Log out of your account"
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'border-white/20 text-white hover:bg-white/10' : 'hover:bg-gray-50'}`}
                  >
                    Log out
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                <Link href="/login" className={`rounded-md border px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'border-white/20 text-white hover:bg-white/10' : 'hover:bg-gray-50'}`}>
                  Log in
                </Link>
                <Link href="/signup" className={`rounded-md px-3 py-1.5 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${isHome ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  Sign up
                </Link>
              </div>
            )}
          </div>

          <NavLinks variant={variant} />
        </div>
      </nav>
    </>
  );
}
