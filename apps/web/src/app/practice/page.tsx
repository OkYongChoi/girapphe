import { getNextCard, getUserStats } from '@/actions/card-actions';
import CardViewer from '@/components/card-viewer';
import Navbar from '@/components/navbar';
import { getCurrentActor } from '@/lib/auth';
import { GUEST_PRACTICE_CARD_LIMIT } from '@/lib/guest';
import { hasAdFreeEntitlement } from '@/lib/billing/database';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';

export const dynamic = 'force-dynamic';

export default async function PracticePage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { locale, t } = await getServerI18n();
  const actor = await getCurrentActor();
  const searchParams = await props.searchParams;
  const mode = searchParams?.mode === 'review' ? 'review' : 'new';
  const adsenseConsentReady = process.env.NEXT_PUBLIC_ADSENSE_CONSENT_READY === 'true';

  const [initialCard, stats, isAdFree] = await Promise.all([
    getNextCard(mode, undefined, locale),
    getUserStats(),
    hasAdFreeEntitlement(actor.isGuest ? null : actor.id),
  ]);

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar user={actor.isGuest ? null : actor} />

      <div className="mx-auto w-full max-w-lg flex-grow px-4 py-4 md:py-6">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('practice.title')}</h1>
            <p className="text-sm text-gray-600">{t('practice.subtitle')}</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <nav
          aria-label={t('practice.modeAria')}
          aria-describedby="practice-mode-description"
          className="mb-2 flex w-full max-w-lg bg-gray-200 p-1 rounded-lg"
        >
          <LocalizedLink
            href="/practice?mode=new" 
            aria-current={mode === 'new' ? 'page' : undefined}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-200 ${mode === 'new' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('practice.learnNew')}
          </LocalizedLink>
          <LocalizedLink
            href="/practice?mode=review"
            aria-current={mode === 'review' ? 'page' : undefined}
            aria-label={t('practice.reviewAria', { count: stats.unclear })}
            className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-200 ${mode === 'review' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {t('practice.reviewCount', { count: stats.unclear })}
          </LocalizedLink>
        </nav>
        <p id="practice-mode-description" className="mb-6 text-xs text-gray-500">
          {mode === 'new'
            ? t('practice.newDescription')
            : t('practice.reviewDescription', { count: stats.unclear })}
        </p>

        {/* Card viewer — stats are shown inside */}
        <CardViewer
          key={mode}
          initialCard={initialCard}
          initialStats={stats}
          mode={mode}
          isGuest={actor.isGuest}
          guestLimit={GUEST_PRACTICE_CARD_LIMIT}
          isAdFree={isAdFree}
          adsenseClientId={adsenseConsentReady ? process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? null : null}
          adsenseSlotId={adsenseConsentReady ? process.env.NEXT_PUBLIC_ADSENSE_PRACTICE_SLOT_ID ?? null : null}
        />
      </div>
    </main>
  );
}
