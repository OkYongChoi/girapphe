import { logoutAction } from '@/actions/auth-actions';
import { getCurrentUser, type AuthUser } from '@/lib/auth';
import NavLinks from '@/components/nav-links';
import BrandLogo from '@/components/brand-logo';
import LanguageSwitcher from '@/components/language-switcher';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';

export default async function Navbar({ user: initialUser, variant = 'default' }: { user?: AuthUser | null; variant?: 'default' | 'home' } = {}) {
  const user = initialUser === undefined ? await getCurrentUser() : initialUser;
  const isHome = variant === 'home';
  const { t } = await getServerI18n();

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-md"
      >
        {t('nav.skipToContent')}
      </a>

      <nav
        aria-label={t('nav.siteHeader')}
        className={`sticky top-0 z-40 overflow-hidden border-b px-4 py-3 backdrop-blur ${isHome ? 'border-white/10 bg-slate-950/60 text-white shadow-[0_10px_40px_rgba(2,6,23,0.18)]' : 'border-slate-200 bg-white/95 text-slate-800'}`}
      >
        <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <LocalizedLink href="/" aria-label={t('nav.homeLabel')} className="inline-flex min-w-0 items-center">
              <BrandLogo textClassName={isHome ? 'text-xl !text-white' : 'text-xl'} />
            </LocalizedLink>

            {user ? (
              <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                <LanguageSwitcher compact />
                <span
                  className={`hidden rounded-md px-2 py-1 text-xs md:inline ${isHome ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}
                  title={user.email}
                >
                  {user.email}
                </span>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    aria-label={t('nav.logoutAria')}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'border-white/20 text-white hover:bg-white/10' : 'hover:bg-gray-50'}`}
                  >
                    {t('nav.logout')}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                <LanguageSwitcher compact />
                <LocalizedLink href="/login" className={`rounded-md border px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${isHome ? 'border-white/20 text-white hover:bg-white/10' : 'hover:bg-gray-50'}`}>
                  {t('nav.login')}
                </LocalizedLink>
                <LocalizedLink href="/signup" className={`rounded-md px-3 py-1.5 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${isHome ? 'bg-cyan-500 hover:bg-cyan-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {t('nav.signup')}
                </LocalizedLink>
              </div>
            )}
          </div>

          <NavLinks variant={variant} isAuthenticated={Boolean(user)} />
        </div>
      </nav>
    </>
  );
}
