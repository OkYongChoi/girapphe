import { getSavedCards } from '@/actions/card-actions';
import type { CardStatus, KnowledgeCard } from '@/actions/card-actions';
import { removeSavedCard, resetUserCardProgress } from '@/actions/card-actions';
import Navbar from '@/components/navbar';
import { localizeDomain } from '@stem-brain/shared';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import { LocalizedLink } from '@/i18n/navigation';
import { getServerI18n } from '@/i18n/server';
import type { Translate } from '@/i18n/core';
import TranslationFallbackBadge from '@/components/translation-fallback-badge';

export const dynamic = 'force-dynamic';

type SavedPageProps = {
  searchParams?: Promise<{
    q?: string;
    domain?: string;
  }>;
};

function getStatusLabel(status: CardStatus, t: Translate) {
  if (status === 'known') return t('common.explainable');
  if (status === 'saved') return t('common.reviewing');
  return t('common.notStarted');
}

const STATUS_STYLES: Record<string, string> = {
  saved: 'bg-blue-100 text-blue-800 border-blue-200',
  known: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  unknown: 'bg-red-100 text-red-800 border-red-200',
};

export default async function SavedPage({ searchParams }: SavedPageProps) {
  const { locale, t, formatDate } = await getServerI18n();
  const params = (await searchParams) ?? {};
  const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase(locale);
  const query = normalize(params.q ?? '');
  const domainFilter = normalize(params.domain ?? 'all');

  const savedCards = (await getSavedCards(locale)) as (KnowledgeCard & {
    status: CardStatus;
    last_seen: string | Date;
  })[];
  const allDomains = Array.from(new Set(savedCards.map((card) => card.domain))).sort();
  const filteredCards = savedCards.filter((card) => {
    const matchesDomain = domainFilter === 'all' || normalize(card.domain) === domainFilter;
    const haystack = normalize([
      card.title,
      card.summary,
      card.domain,
      card.domain_label,
      card.type_label,
      ...(card.aliases ?? []),
    ].filter(Boolean).join(' '));
    const matchesQuery = !query || haystack.includes(query);
    return matchesDomain && matchesQuery;
  });

  const hasActiveFilter = query || domainFilter !== 'all';

  return (
    <main id="main-content" className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex-grow w-full max-w-2xl mx-auto p-4 md:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('saved.title')}</h1>
            <p className="text-sm text-gray-500">
              {hasActiveFilter
                ? t('saved.filteredCount', { filtered: filteredCards.length, total: savedCards.length })
                : t('saved.totalCount', { count: savedCards.length })}
            </p>
          </div>
          <div className="flex gap-2">
            <form
              action={async () => {
                'use server';
                await resetUserCardProgress();
              }}
            >
              <ConfirmDeleteButton
                label={t('saved.resetProgress')}
                confirmMessage={t('saved.resetConfirm')}
                ariaLabel={t('saved.resetAria')}
                className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </form>
            <LocalizedLink href="/practice" className="rounded-md border px-3 py-2 text-sm hover:bg-gray-50 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {t('saved.continue')}
            </LocalizedLink>
          </div>
        </div>

        <form className="mb-4 rounded-lg border bg-white p-3 shadow-sm" role="search" aria-label={t('saved.filterAria')}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <label className="sr-only" htmlFor="saved-search">{t('saved.searchLabel')}</label>
            <input
              id="saved-search"
              type="search"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder={t('saved.searchPlaceholder')}
              className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2 flex-wrap">
              <label className="sr-only" htmlFor="saved-domain">{t('saved.domainLabel')}</label>
              <select
                id="saved-domain"
                name="domain"
                defaultValue={domainFilter}
                className="rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="all">{t('common.allDomains')}</option>
                {allDomains.map((domain) => (
                  <option key={domain} value={normalize(domain)}>
                    {savedCards.find((card) => card.domain === domain)?.domain_label ?? localizeDomain(locale, domain)}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500">
                {t('common.search')}
              </button>
              {hasActiveFilter && (
                <LocalizedLink href="/saved" className="rounded-md border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {t('common.clear')}
                </LocalizedLink>
              )}
            </div>
          </div>
        </form>

        {savedCards.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
            <p className="text-2xl mb-2" aria-hidden="true">📌</p>
            <p className="font-semibold text-gray-800">{t('saved.empty')}</p>
            <p className="text-sm text-gray-500 mt-1">{t('saved.emptyBody')}</p>
            <LocalizedLink href="/practice" className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors">
              {t('dashboard.start')}
            </LocalizedLink>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-center text-gray-500 shadow-sm">
            <p className="font-medium">{t('saved.noMatches')}</p>
            <p className="text-sm mt-1">{t('saved.noMatchesBody')}</p>
            <LocalizedLink href="/saved" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              {t('saved.clearFilters')}
            </LocalizedLink>
          </div>
        ) : (
          <ol className="grid gap-3 list-none p-0" aria-label={t('saved.cardsAria')}>
            {filteredCards.map((card) => {
              const statusStyle = STATUS_STYLES[card.status] ?? STATUS_STYLES.saved;
              return (
                <li key={card.id} className="bg-white border rounded-xl p-4 flex flex-col shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h2 className="font-semibold text-gray-900 text-base leading-snug">{card.title}</h2>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${statusStyle}`}>
                      {getStatusLabel(card.status, t)}
                    </span>
                  </div>
                  <TranslationFallbackBadge
                    resolvedLocale={card.resolved_locale}
                    status={card.translation_status}
                    className="mb-2 self-start"
                  />
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{card.summary}</p>
                  <div className="mt-auto flex justify-between items-center text-xs text-gray-500">
                    <span className="font-medium">{card.domain_label ?? localizeDomain(locale, card.domain)}</span>
                    <div className="flex items-center gap-3">
                      <span>{t('saved.lastSeen', { date: formatDate(card.last_seen) })}</span>
                      <form
                        action={async () => {
                          'use server';
                          await removeSavedCard(card.id);
                        }}
                      >
                        <ConfirmDeleteButton
                          label={t('common.remove')}
                          confirmMessage={t('saved.removeConfirm', { title: card.title })}
                          ariaLabel={t('saved.removeAria', { title: card.title })}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
