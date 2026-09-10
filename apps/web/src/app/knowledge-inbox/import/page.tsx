import Navbar from '@/components/navbar';
import ChatGptExportImporter from '@/components/chatgpt-export-importer';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import { requireCurrentUser } from '@/lib/auth';
import { isAiThinkingHistoryEnabledForUser } from '@/lib/ai-thinking-history-rollout';

export const dynamic = 'force-dynamic';

export default async function ChatGptExportImportPage() {
  const [user, { t }] = await Promise.all([requireCurrentUser(), getServerI18n()]);
  const enabled = isAiThinkingHistoryEnabledForUser(user.id);
  return (
    <main id="main-content" className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_32%),linear-gradient(to_bottom,_#f8fafc,_#f1f5f9)]">
      <Navbar user={user} />
      <section className="mx-auto w-full max-w-6xl p-4 md:p-8">
        <LocalizedLink href="/knowledge-inbox" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-600 hover:text-cyan-800">{t('common.back')}</LocalizedLink>
        <header className="mb-6 max-w-4xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-700">{t('import.eyebrow')}</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] text-slate-950 md:text-6xl">{t('import.title')}</h1>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">{t('import.subtitle')}</p>
        </header>
        {enabled ? <ChatGptExportImporter loadingLabel={t('common.loading')} unavailableLabel={t('translation.unavailable')} /> : (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 md:p-8">
            <h2 className="text-xl font-black text-amber-950">{t('import.pausedTitle')}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-900">
              {t('import.pausedBody')}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <LocalizedLink href="/knowledge-inbox" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">{t('import.openExistingReviews')}</LocalizedLink>
              <LocalizedLink href="/account/delete#knowledge-data" className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-bold text-amber-950">{t('import.dataControls')}</LocalizedLink>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
