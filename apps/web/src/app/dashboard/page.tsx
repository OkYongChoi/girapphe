import Navbar from '@/components/navbar';
import { getUserCardDomainProgress, getUserStats } from '@/actions/card-actions';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import type { Translate } from '@/i18n/core';
import { localizeDomain } from '@stem-brain/shared';

export const dynamic = 'force-dynamic';

function SummaryBox({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl border p-4 ${colorClass}`}>
      <dt className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
      {sub && <dd className="mt-0.5 text-xs opacity-60">{sub}</dd>}
    </div>
  );
}

function DomainCard({
  domainLabel,
  reviewed,
  explainable,
  unclear,
  t,
}: {
  domain: string;
  domainLabel: string;
  reviewed: number;
  explainable: number;
  unclear: number;
  t: Translate;
}) {
  const explainablePercent = reviewed > 0 ? (explainable / reviewed) * 100 : 0;
  const roundedExplainablePercent = Math.round(explainablePercent);

  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">{domainLabel}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('dashboard.reviewedCards', { count: reviewed })}</p>
        </div>
        <div className="rounded-lg bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
          {t('dashboard.explainablePercent', { percent: roundedExplainablePercent })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-800">
          {t('dashboard.explainableCount', { count: explainable })}
        </div>
        <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">
          {t('dashboard.unclearCount', { count: unclear })}
        </div>
      </div>
      <div
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={t('dashboard.progressAria', { domain: domainLabel })}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={explainablePercent}
        aria-valuetext={t('dashboard.progressText', { percent: roundedExplainablePercent })}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${explainablePercent}%` }}
        />
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const { locale, t, formatNumber } = await getServerI18n();
  const [stats, domains] = await Promise.all([getUserStats(), getUserCardDomainProgress(locale)]);

  const totalReviewed = stats.explainable + stats.unclear;
  const explainablePercent = totalReviewed > 0 ? (stats.explainable / totalReviewed) * 100 : 0;

  return (
    <main id="main-content" className="min-h-screen bg-gray-50">
      <Navbar />

      <section className="mx-auto w-full max-w-5xl p-4 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t('dashboard.title')}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {t('dashboard.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.unclear > 0 && (
              <LocalizedLink
                href="/practice?mode=review"
                className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {t('dashboard.reviewUnclear', { count: stats.unclear })}
              </LocalizedLink>
            )}
            <LocalizedLink
              href="/practice"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {t('dashboard.practiceNow')}
            </LocalizedLink>
          </div>
        </div>

        {totalReviewed === 0 ? (
          <div className="mt-8 rounded-xl border bg-white p-10 text-center">
            <p className="text-3xl">📊</p>
            <p className="mt-3 text-lg font-semibold text-slate-800">{t('dashboard.noData')}</p>
            <p className="mt-2 text-sm text-slate-500">
              {t('dashboard.noDataBody')}
            </p>
            <LocalizedLink
              href="/practice"
              className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              {t('dashboard.start')}
            </LocalizedLink>
          </div>
        ) : (
          <>
            <dl aria-label={t('dashboard.summaryAria')} className="mt-6 grid gap-3 sm:grid-cols-3">
              <SummaryBox
                label={t('common.explainable')}
                value={formatNumber(stats.explainable)}
                sub={t('dashboard.percentReviewed', { percent: Math.round(explainablePercent) })}
                colorClass="bg-emerald-50 text-emerald-900 border-emerald-200"
              />
              <SummaryBox
                label={t('common.unclear')}
                value={formatNumber(stats.unclear)}
                sub={t('dashboard.stillNeedsReview')}
                colorClass="bg-blue-50 text-blue-900 border-blue-200"
              />
              <SummaryBox
                label={t('dashboard.totalReviewed')}
                value={formatNumber(totalReviewed)}
                sub={t('dashboard.domainCount', { count: domains.length })}
                colorClass="bg-slate-50 text-slate-900 border-slate-200"
              />
            </dl>

            <h2 className="mt-8 text-base font-semibold text-slate-700">{t('dashboard.breakdown')}</h2>
            {domains.length === 0 ? (
              <p className="mt-3 rounded-xl border bg-white p-4 text-sm text-slate-500">
                {t('dashboard.noDomains')}
              </p>
            ) : (
              <div className="mt-3 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {domains.map((item) => (
                  <DomainCard
                    key={item.domain}
                    {...item}
                    domainLabel={item.domain_label ?? localizeDomain(locale, item.domain)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
