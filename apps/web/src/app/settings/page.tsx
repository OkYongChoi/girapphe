import type { Metadata } from 'next';
import { LOCALE_META } from '@stem-brain/shared';
import Navbar from '@/components/navbar';
import DraftReviewMcpConnections from '@/components/draft-review-mcp-connections';
import LanguageSwitcher from '@/components/language-switcher';
import SettingsPreferencesPanel from '@/components/settings-preferences-panel';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUserProfile } from '@/lib/auth';
import { getMcpAccessTokensForUser } from '@/lib/knowledge-ingestion';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage Girapphe AI connections, reuse defaults, language, and private-data controls.',
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const [user, { locale, t }] = await Promise.all([
    requireCurrentUserProfile(),
    getServerI18n(),
  ]);
  const tokens = await getMcpAccessTokensForUser(user.id);
  const trailingArrow = LOCALE_META[locale].direction === 'rtl' ? '←' : '→';

  return (
    <main id="main-content" className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_34%),linear-gradient(to_bottom,_#f8fafc,_#f1f5f9)] text-slate-950">
      <Navbar user={user} />
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-9">
          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{t('settings.eyebrow')}</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{t('settings.title')}</h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">{t('settings.subtitle')}</p>
            </div>
            <div className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{t('settings.signedInAs')}</p>
              <p className="mt-1 truncate text-sm font-bold text-white" title={user.email}>{user.email || t('settings.accountFallback')}</p>
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6">
          <SettingsPreferencesPanel />
          <DraftReviewMcpConnections tokens={tokens} />

          <section className="grid gap-5 lg:grid-cols-3" aria-label={t('settings.moreSettings')}>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{t('settings.languageEyebrow')}</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{t('settings.languageTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('settings.languageBody')}</p>
              <div className="mt-4"><LanguageSwitcher /></div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{t('settings.accountEyebrow')}</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{t('settings.accountTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('settings.accountBody')}</p>
              <div className="mt-4 grid gap-2">
                <SettingsLink href="/subscription" label={t('settings.managePlan')} trailingArrow={trailingArrow} />
                <SettingsLink href="/knowledge-inbox" label={t('settings.reviewCandidates')} trailingArrow={trailingArrow} />
                <SettingsLink href="/knowledge-inbox/import" label={t('settings.importHistory')} trailingArrow={trailingArrow} />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">{t('settings.dataEyebrow')}</p>
              <h2 className="mt-2 text-lg font-black text-slate-950">{t('settings.dataTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{t('settings.dataBody')}</p>
              <div className="mt-4 grid gap-2">
                <a href="/api/knowledge/export?scope=all" download className="inline-flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:border-amber-300 hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500">
                  {t('settings.exportData')} <span aria-hidden="true">↓</span>
                </a>
                <SettingsLink href="/account/delete#knowledge-data" label={t('settings.dataControls')} trailingArrow={trailingArrow} />
                <SettingsLink href="/support" label={t('settings.support')} trailingArrow={trailingArrow} />
                <SettingsLink href="/privacy" label={t('settings.privacy')} trailingArrow={trailingArrow} />
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function SettingsLink({
  href,
  label,
  trailingArrow,
}: {
  href: string;
  label: string;
  trailingArrow: '←' | '→';
}) {
  return (
    <LocalizedLink href={href} className="inline-flex min-h-11 items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500">
      {label}<span aria-hidden="true">{trailingArrow}</span>
    </LocalizedLink>
  );
}
