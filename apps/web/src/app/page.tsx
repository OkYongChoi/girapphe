import Navbar from '@/components/navbar';
import HomeDomainProgress, { type HomeDomainProgressRow } from '@/components/home-domain-progress';
import HomeGraphScene from '@/components/home-graph-scene';
import { getCurrentUser } from '@/lib/auth';
import type { UserCardDomainProgress } from '@/actions/card-actions';
import GuestStartButton from '@/components/guest-start-button';
import { getServerI18n } from '@/i18n/server';
import { LocalizedLink } from '@/i18n/navigation';
import type { MessageKey } from '@/i18n/messages';
import type { Translate } from '@/i18n/core';
import { localizeDomain, type Locale } from '@stem-brain/shared';

export const dynamic = 'force-dynamic';

const HOME_DOMAIN_TONES = ['bg-emerald-300', 'bg-sky-300', 'bg-amber-300', 'bg-cyan-300'] as const;
const HOME_DISCIPLINES: MessageKey[] = [
  'home.disciplineBiology',
  'home.disciplineComputerScience',
  'home.disciplineSemiconductor',
  'home.disciplineBiochemistry',
  'home.disciplineMedicine',
  'home.disciplineStatistics',
  'home.disciplineEconomics',
  'home.disciplineArchitecture',
];
const HOME_LEARNING_LOOP = [
  { step: '01', title: 'home.loop1Title', copy: 'home.loop1Copy' },
  { step: '02', title: 'home.loop2Title', copy: 'home.loop2Copy' },
  { step: '03', title: 'home.loop3Title', copy: 'home.loop3Copy' },
] satisfies Array<{ step: string; title: MessageKey; copy: MessageKey }>;

const HOME_FALLBACK_STATS = {
  explainable: 18,
  review: 7,
  notes: 5,
};

const HOME_DEMO_GRAPH_STATS = {
  domains: 8,
  concepts: 42,
  links: 58,
};

export default async function HomePage() {
  const { t, formatNumber, locale } = await getServerI18n();
  const user = await getCurrentUser();
  const personalization = user
    ? await import('@/lib/home-personalization').then(({ getHomePersonalization }) =>
        getHomePersonalization(user.id, locale)
      )
    : null;
  const userStats = personalization?.userStats ?? null;
  const userKnowledge = personalization?.userKnowledge ?? { count: 0, graphNotes: [] };
  const domainProgress = personalization?.domainProgress ?? [];
  const userGraphData = personalization?.userGraphData ?? null;
  const sceneStats = {
    explainable: userStats?.explainable ?? HOME_FALLBACK_STATS.explainable,
    review: userStats?.unclear ?? HOME_FALLBACK_STATS.review,
    notes: user ? userKnowledge.count : HOME_FALLBACK_STATS.notes,
  };
  const homeDomainProgress = buildHomeDomainProgress(domainProgress, t, locale);
  const isPersonalized = Boolean(user);

  return (
    <main id="main-content" className="home-shell relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_24%,rgba(14,165,233,0.13),transparent_30%),radial-gradient(circle_at_22%_58%,rgba(20,184,166,0.1),transparent_28%),linear-gradient(135deg,#020617_0%,#0b1120_54%,#111827_100%)]" />
        <div className="home-grid-lines absolute inset-0 opacity-45" />
        <div className="home-map-contours absolute inset-0 opacity-20" />
      </div>
      <div aria-hidden="true" className="home-scroll-progress fixed left-0 top-0 z-[70] h-0.5 w-full origin-left bg-gradient-to-r from-cyan-200 via-emerald-200 to-amber-200" />
      <Navbar user={user} variant="home" />

      <section className="home-snap-section home-hero-section relative z-10 overflow-hidden px-6 pb-12 pt-10 md:pb-16 md:pt-14">
        <div aria-hidden="true" className="home-hero-network pointer-events-none absolute inset-x-0 top-0 h-[calc(100vh-4rem)] min-h-[42rem]">
          <div className="home-hero-constellation absolute left-1/2 top-[44%] h-[38rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 md:h-[48rem] md:w-[48rem]" />
          <div className="home-hero-node home-hero-node-a">{t('home.heroNodeReview')}</div>
          <div className="home-hero-node home-hero-node-b">{t('home.heroNodeNotes')}</div>
          <div className="home-hero-node home-hero-node-c">{t('home.heroNodeMastery')}</div>
          <div className="home-hero-node home-hero-node-d">{t('home.heroNodeLinks')}</div>
        </div>

        <div className="home-hero-stage relative z-10 mx-auto grid min-h-[calc(100vh-7rem)] max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,0.88fr)_minmax(27rem,0.72fr)] lg:gap-4">
          <div className="home-hero-copy fade-up min-w-0 max-w-4xl">
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-[4.25rem]">
              {t('home.heroTitle')}{' '}
              <span className="text-cyan-300">{t('home.heroAccent')}</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              {t('home.heroBody')}
            </p>

            <ul
              className="mt-7 flex max-w-3xl flex-wrap gap-2 text-xs font-semibold uppercase text-slate-300"
              aria-label={t('home.disciplinesAria')}
            >
              {HOME_DISCIPLINES.map((key) => (
                <li key={key} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 backdrop-blur">
                  {t(key)}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <>
                  <LocalizedLink
                    href="/practice"
                    className="rounded-lg border border-cyan-100/70 bg-gradient-to-b from-cyan-200 to-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-[0_12px_32px_rgba(34,211,238,0.25),inset_0_1px_0_rgba(255,255,255,0.82)] transition duration-300 hover:-translate-y-0.5 hover:from-cyan-100 hover:to-cyan-300 hover:shadow-[0_18px_42px_rgba(34,211,238,0.34)]"
                  >
                    {t('home.keepPracticing')}
                  </LocalizedLink>
                  <LocalizedLink
                    href="/knowledge"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    {t('home.viewKnowledgeGraph')}
                  </LocalizedLink>
                  <LocalizedLink
                    href="/dashboard"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    {t('home.progressDashboard')}
                  </LocalizedLink>
                  <LocalizedLink
                    href="#knowledge-graph"
                    className="rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-300/15"
                  >
                    {t('home.seeLiveGraph')}
                  </LocalizedLink>
                </>
              ) : (
                <>
                  <GuestStartButton />
                  <LocalizedLink
                    href="/signup"
                    className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-white/15"
                  >
                    {t('home.createAccount')}
                  </LocalizedLink>
                  <LocalizedLink
                    href="#knowledge-graph"
                    className="rounded-lg border border-cyan-200/25 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-50 backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:bg-cyan-300/15"
                  >
                    {t('home.seeLiveGraph')}
                  </LocalizedLink>
                </>
              )}
            </div>

            {user && userStats ? (
              <div
                aria-label={t('home.learningStatsAria')}
                className="mt-7 grid max-w-xl grid-cols-3 gap-2"
              >
                <StatBox value={formatNumber(sceneStats.explainable)} label={t('common.explainable')} color="text-emerald-200" bg="bg-emerald-400/10 border-emerald-300/20" delay="0ms" />
                <StatBox value={formatNumber(sceneStats.review)} label={t('home.review')} color="text-sky-200" bg="bg-sky-400/10 border-sky-300/20" delay="160ms" />
                <StatBox value={formatNumber(sceneStats.notes)} label={t('home.note', { count: sceneStats.notes })} color="text-amber-200" bg="bg-amber-400/10 border-amber-300/20" delay="320ms" />
              </div>
            ) : null}
          </div>
          <div className="home-hero-visual fade-up min-w-0 lg:justify-self-end">
            <KnowledgeSurface
              domainProgress={homeDomainProgress}
              demoDomainProgress={!isPersonalized || domainProgress.length === 0}
              showStats={isPersonalized}
              explainable={sceneStats.explainable}
              review={sceneStats.review}
              notes={sceneStats.notes}
              t={t}
              formatNumber={formatNumber}
            />
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-4 grid max-w-6xl gap-5 lg:-mt-14 lg:grid-cols-[minmax(0,0.56fr)_minmax(22rem,0.44fr)] lg:items-end">
          <div className="home-learning-loop grid gap-3 sm:grid-cols-3" aria-label={t('home.learningLoopAria')}>
            {HOME_LEARNING_LOOP.map((item) => (
              <div key={item.step} className="home-learning-step rounded-lg border border-white/10 bg-white/[0.055] px-4 py-4 backdrop-blur">
                <span className="text-xs font-bold tracking-[0.16em] text-cyan-200">{item.step}</span>
                <h2 className="mt-2 text-base font-bold text-white">{t(item.title)}</h2>
                <p className="mt-1.5 text-sm leading-5 text-slate-400">{t(item.copy)}</p>
              </div>
            ))}
          </div>
          <p className="home-stage-caption hidden max-w-sm justify-self-end text-end text-sm leading-6 text-slate-400 lg:block">{t('home.stageCaption')}</p>
        </div>
        <div className="relative z-10 mx-auto mt-8 flex max-w-6xl flex-col items-center gap-4">
          <LocalizedLink
            href="#knowledge-graph"
            aria-label={t('home.scrollGraphAria')}
            className="home-scroll-cue group inline-flex h-14 w-9 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-cyan-100 shadow-lg shadow-black/20 backdrop-blur transition hover:border-cyan-200/40 hover:bg-cyan-300/10 focus:outline-none focus:ring-2 focus:ring-cyan-200/60"
          >
            <span className="home-scroll-dot h-2 w-2 rounded-full bg-cyan-100" />
          </LocalizedLink>
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>
      </section>

      <section id="knowledge-graph" className="home-snap-section home-graph-section home-reveal relative z-10 scroll-mt-6 px-6 py-16 md:py-20">
        <div aria-hidden="true" className="home-graph-ambient absolute inset-x-0 top-0 h-48" />
        <div className="mx-auto max-w-6xl">
          <div className="home-graph-heading flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-cyan-100/70">{t('home.graphEyebrow')}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                {t('home.graphTitle')}
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-300">
                {t('home.graphBody')}
              </p>
            </div>
            {isPersonalized ? (
              <div className="home-graph-metric-rail grid grid-cols-3 gap-3 text-center">
                <MiniMetric value={formatNumber(sceneStats.explainable)} label={t('common.explainable')} />
                <MiniMetric value={formatNumber(sceneStats.review)} label={t('home.review')} />
                <MiniMetric value={formatNumber(sceneStats.notes)} label={t('home.note', { count: sceneStats.notes })} />
              </div>
            ) : (
              <div className="home-graph-metric-rail grid grid-cols-3 gap-3 text-center">
                <MiniMetric value={formatNumber(HOME_DEMO_GRAPH_STATS.domains)} label={t('home.domains')} />
                <MiniMetric value={formatNumber(HOME_DEMO_GRAPH_STATS.concepts)} label={t('home.concepts')} />
                <MiniMetric value={formatNumber(HOME_DEMO_GRAPH_STATS.links)} label={t('home.links')} />
              </div>
            )}
          </div>

          <div className="home-graph-frame relative mt-8 h-[34rem] overflow-hidden rounded-lg border border-white/10 bg-slate-950/60 shadow-2xl shadow-black/30 md:h-[38rem]">
            <HomeGraphScene
              demo={!isPersonalized}
              explainable={sceneStats.explainable}
              unclear={sceneStats.review}
              notes={sceneStats.notes}
              personalizedGraphData={userGraphData}
              personalizedNotes={userKnowledge.graphNotes}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function MiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="home-graph-metric rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 backdrop-blur">
      <span className="block text-2xl font-bold text-white">{value}</span>
      <span className="text-xs uppercase text-slate-400">{label}</span>
    </div>
  );
}

function StatBox({
  value,
  label,
  color,
  bg,
  delay,
}: {
  value: string;
  label: string;
  color: string;
  bg: string;
  delay: string;
}) {
  return (
    <div
      className={`home-stat-tile rounded-lg border px-3 py-2 text-center backdrop-blur ${bg}`}
      style={{ animationDelay: delay }}
    >
      <span className={`block text-xl font-bold ${color}`}>{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}

function KnowledgeSurface({
  domainProgress,
  demoDomainProgress,
  showStats,
  explainable,
  review,
  notes,
  t,
  formatNumber,
}: {
  domainProgress: HomeDomainProgressRow[];
  demoDomainProgress: boolean;
  showStats: boolean;
  explainable: number;
  review: number;
  notes: number;
  t: Translate;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}) {
  return (
    <div className="home-knowledge-surface relative min-h-[31rem] overflow-hidden rounded-2xl border border-cyan-100/15 bg-slate-950/75 p-5 shadow-[0_32px_90px_rgba(2,6,23,0.56),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-xl">
      <div aria-hidden="true" className="home-surface-grid absolute inset-0 opacity-50" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent" />
      <div className="relative flex h-full min-h-[28.5rem] flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">{t('home.learningSpace')}</p>
              <h2 className="mt-2 max-w-xs text-2xl font-bold tracking-tight text-white">{t('home.surfaceTitle')}</h2>
            </div>
            <span className="home-status-pill mt-1 h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.72)]" />
          </div>

          <div className="home-next-concept mt-7 rounded-xl border border-white/10 bg-slate-900/55 p-4">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span>{t('home.nextConcept')}</span>
              <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-cyan-100">{t('home.tenMinutes')}</span>
            </div>
            <p className="mt-4 text-xl font-bold tracking-tight text-white">{t('home.bayesRule')}</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">{t('home.bayesCopy')}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <span className="block h-full w-[38%] rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
            </div>
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{t('home.inProgress')}</span><span>{formatNumber(38)}%</span></div>
          </div>
        </div>

        <HomeDomainProgress rows={domainProgress} demo={demoDomainProgress} />

        <div className="mt-6">
          <p className="max-w-sm text-sm leading-6 text-slate-200">
            {t('home.surfaceBody')}
          </p>
          {showStats ? (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs uppercase text-slate-400">
              <span><strong className="me-1 text-base text-emerald-200">{formatNumber(explainable)}</strong>{t('common.explainable')}</span>
              <span className="h-1 w-1 rounded-full bg-slate-500" />
              <span><strong className="me-1 text-base text-sky-200">{formatNumber(review)}</strong>{t('home.review')}</span>
              <span className="h-1 w-1 rounded-full bg-slate-500" />
              <span><strong className="me-1 text-base text-amber-200">{formatNumber(notes)}</strong>{t('home.note', { count: notes })}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function buildHomeDomainProgress(
  domains: UserCardDomainProgress[],
  t: Translate,
  locale: Locale,
): HomeDomainProgressRow[] {
  const fallbackRows: HomeDomainProgressRow[] = [
    { label: t('home.fallbackLinearSystems'), value: 82, tone: 'bg-emerald-300' },
    { label: t('home.fallbackBayesRule'), value: 64, tone: 'bg-sky-300' },
    { label: t('home.fallbackFourierAnalysis'), value: 48, tone: 'bg-amber-300' },
    { label: t('home.fallbackGraphSearch'), value: 72, tone: 'bg-cyan-300' },
  ];

  if (domains.length === 0) {
    return fallbackRows;
  }

  const rows = domains
    .filter((domain) => domain.reviewed > 0)
    .sort((a, b) => b.reviewed - a.reviewed || a.domain.localeCompare(b.domain, locale))
    .slice(0, 4)
    .map((domain, index) => ({
      label: domain.domain_label ?? localizeDomain(locale, domain.domain),
      value: Math.round((domain.explainable / domain.reviewed) * 100),
      tone: HOME_DOMAIN_TONES[index % HOME_DOMAIN_TONES.length],
    }));

  return rows.length > 0 ? rows : fallbackRows;
}
