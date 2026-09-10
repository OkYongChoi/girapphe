import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { localizePathname } from '@stem-brain/shared';
import LogoutButton from '@/components/logout-button';
import { getServerI18n } from '@/i18n/server';
import { getCurrentUserProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Knowledge data controls',
  description: 'Continue securely to owner-scoped Girapphe knowledge export and import-job controls.',
  robots: { index: false, follow: false },
};

export default async function KnowledgeDataControlsHandoffPage() {
  const [user, { locale, t }] = await Promise.all([
    getCurrentUserProfile(),
    getServerI18n(),
  ]);
  const destination = `${localizePathname('/account/delete', locale)}#knowledge-data`;
  const loginPath = localizePathname('/login', locale);
  const accountSwitchDestination = `${loginPath}?returnTo=${encodeURIComponent('/account/data-controls-handoff')}`;
  if (!user) redirect(accountSwitchDestination);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-950 sm:py-16">
      <section aria-labelledby="handoff-title" className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-800">{t('account.dataControlsHandoff.eyebrow')}</p>
        <h1 id="handoff-title" className="mt-3 text-3xl font-black tracking-tight">{t('account.dataControlsHandoff.title')}</h1>
        <p className="mt-4 leading-7 text-slate-600">
          {t('account.dataControlsHandoff.bodyBeforeIdentity')}{' '}
          <strong dir="ltr" className="text-slate-950">{user.email || user.id}</strong>
          {t('account.dataControlsHandoff.bodyAfterIdentity')}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href={destination} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-cyan-800 px-4 py-2 text-sm font-black text-white">
            {t('account.dataControlsHandoff.continue')}
          </Link>
          <LogoutButton
            label={t('account.dataControlsHandoff.switchAccount')}
            ariaLabel={t('account.dataControlsHandoff.switchAccountAria')}
            redirectUrl={accountSwitchDestination}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800"
          />
        </div>
      </section>
    </main>
  );
}
