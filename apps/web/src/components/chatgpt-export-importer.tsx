'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { localizePathname } from '@stem-brain/shared';
import { createChatGptExportDrafts } from '@/actions/knowledge-ingestion-actions';
import { useI18n } from '@/i18n/client';
import type { ChatGptExportExchange, ParsedChatGptExport } from '@/lib/chatgpt-export';

const MAX_VISIBLE_EXCHANGES = 100;
const MAX_SELECTIONS = 12;
const MAX_FILE_MIB = 20;

function preview(value: string, limit = 220) {
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > limit ? `${compact.slice(0, limit).trimEnd()}...` : compact;
}

function errorCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}

type ChatGptExportImporterProps = { loadingLabel: string; unavailableLabel: string };

export default function ChatGptExportImporter({ loadingLabel, unavailableLabel }: ChatGptExportImporterProps) {
  const router = useRouter();
  const { locale, t: appT, formatDate } = useI18n();
  const [messages, setMessages] = useState<Record<string, string> | null>(null);
  const [archive, setArchive] = useState<ParsedChatGptExport | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase(locale));
  const [consent, setConsent] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();
  const importSessionId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/conversation-import-messages.json')
      .then((response) => response.ok ? response.json() as Promise<Record<string, Record<string, string>>> : Promise.reject())
      .then((catalogs) => { if (active) setMessages(catalogs[locale] ?? catalogs.en ?? {}); }, () => { if (active) setMessages({}); });
    return () => { active = false; };
  }, [locale]);

  function t(key: string, values: Record<string, string | number> = {}) {
    let result = messages?.[key] ?? key;
    for (const [name, value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
    return result;
  }

  const filteredExchanges = useMemo(() => {
    const exchanges = archive?.exchanges ?? [];
    if (!deferredQuery) return exchanges;
    return exchanges.filter((exchange) => (
      `${exchange.title}\n${exchange.topic}\n${exchange.question}\n${exchange.answer}`
        .toLocaleLowerCase(locale)
        .includes(deferredQuery)
    ));
  }, [archive, deferredQuery, locale]);

  const visibleExchanges = filteredExchanges.slice(0, MAX_VISIBLE_EXCHANGES);
  const selectedExchanges = useMemo(() => (
    archive?.exchanges.filter((exchange) => selectedIds.has(exchange.id)) ?? []
  ), [archive, selectedIds]);

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exchange of archive?.exchanges ?? []) counts.set(exchange.topic, (counts.get(exchange.topic) ?? 0) + 1);
    return Array.from(counts, ([topic, count]) => ({ topic, count }))
      .toSorted((left, right) => right.count - left.count || left.topic.localeCompare(right.topic, locale))
      .slice(0, 8);
  }, [archive, locale]);

  const timeline = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exchange of archive?.exchanges ?? []) {
      if (!exchange.createdAt) continue;
      const month = exchange.createdAt.slice(0, 7);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    return Array.from(counts, ([month, count]) => ({ month, count })).toSorted((left, right) => left.month.localeCompare(right.month)).slice(-12);
  }, [archive]);

  const maxTopicCount = Math.max(1, ...topics.map((topic) => topic.count));
  const maxTimelineCount = Math.max(1, ...timeline.map((item) => item.count));

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const sessionId = crypto.randomUUID();
    importSessionId.current = sessionId;
    setError(null);
    setArchive(null);
    setSelectedIds(new Set());
    setConsent(false);
    if (file.size > MAX_FILE_MIB * 1024 * 1024) {
      setError(t('import.tooLarge', { size: MAX_FILE_MIB }));
      input.value = '';
      return;
    }
    setParsing(true);
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const [{ parseChatGptExportText }, source] = await Promise.all([
        import('@/lib/chatgpt-export'),
        file.text(),
      ]);
      const parsed = parseChatGptExportText(source);
      setArchive(parsed);
    } catch (fileError) {
      const code = errorCode(fileError);
      setError(code === 'too_large'
        ? t('import.tooLarge', { size: MAX_FILE_MIB })
        : code === 'empty' ? t('import.empty') : t('import.invalid'));
    } finally {
      setParsing(false);
      input.value = '';
    }
  }

  function toggle(exchange: ChatGptExportExchange) {
    setError(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(exchange.id)) next.delete(exchange.id);
      else if (next.size < MAX_SELECTIONS) next.add(exchange.id);
      else setError(t('import.selectionLimit', { count: MAX_SELECTIONS }));
      return next;
    });
  }

  function selectVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const exchange of visibleExchanges) {
        if (next.size >= MAX_SELECTIONS) break;
        next.add(exchange.id);
      }
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!consent || selectedExchanges.length === 0) return;
    setError(null);
    startSubmitting(async () => {
      try {
        const sessionId = importSessionId.current;
        if (!sessionId) throw new Error('Import session is unavailable.');
        const result = await createChatGptExportDrafts({
          source: 'chatgpt_export',
          consent: true,
          importSessionId: sessionId,
          selections: selectedExchanges.map((exchange) => ({
            conversationId: exchange.conversationId,
            messageId: exchange.messageId,
            title: exchange.title,
            question: exchange.question,
            answer: exchange.answer,
            createdAt: exchange.createdAt,
          })),
        }, {
          parsedExchangeCount: archive?.exchangeCount ?? selectedExchanges.length,
        });
        setArchive(null);
        setSelectedIds(new Set());
        importSessionId.current = null;
        router.push(localizePathname(result.reviewPath, locale));
      } catch {
        setError(t('import.failed'));
      }
    });
  }

  if (messages === null) return <section aria-busy="true" className="thinking-loading">{loadingLabel}</section>;
  if (Object.keys(messages).length === 0) return <section role="alert" className="thinking-load-error">{unavailableLabel}</section>;

  return (
    <div className="grid gap-6">
      <aside className="rounded-2xl border border-cyan-200 bg-cyan-50/80 p-4 text-sm leading-relaxed text-cyan-950">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0 rounded-full bg-cyan-500 shadow-[0_0_0_5px_rgba(6,182,212,0.14)]" />
          <p><strong>{t('import.privacyTitle')}</strong> {t('import.privacyBody')}</p>
        </div>
      </aside>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:p-7">
          <div>
            <span className="inline-flex rounded-full bg-slate-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-200">{t('import.localBadge')}</span>
            <label htmlFor="chatgpt-export-file" className="mt-4 block text-lg font-black text-slate-950">{t('import.fileLabel')}</label>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{t('import.fileHint', { size: MAX_FILE_MIB })}</p>
          </div>
          <input
            id="chatgpt-export-file"
            type="file"
            accept="application/json,.json"
            disabled={parsing || isSubmitting}
            onChange={handleFile}
            className="min-h-11 w-full max-w-sm cursor-pointer rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm file:me-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:font-bold file:text-white hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
          />
        </div>
        {parsing ? <p role="status" className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600 md:px-7">{t('import.parsing')}</p> : null}
      </section>

      {error ? <p role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p> : null}

      {archive ? (
        <>
          <section aria-labelledby="import-summary-title" className="relative overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl md:p-8">
            <div aria-hidden="true" className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-cyan-300/20 bg-cyan-300/10 blur-2xl" />
            <div aria-hidden="true" className="absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />
            <div className="relative">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{t('import.pendingBadge')}</p>
              <h2 id="import-summary-title" className="mt-2 text-2xl font-black tracking-tight md:text-3xl">{t('import.summaryTitle')}</h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-3xl font-black text-cyan-200">{archive.conversationCount}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-300">{t('import.conversations')}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-3xl font-black text-amber-200">{archive.exchangeCount}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-300">{t('import.exchanges')}</p></div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-sm font-black leading-relaxed text-white">{archive.dateFrom && archive.dateTo ? `${formatDate(archive.dateFrom, { dateStyle: 'medium' })} - ${formatDate(archive.dateTo, { dateStyle: 'medium' })}` : appT('common.never')}</p></div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">{t('import.topicsTitle')}</h2>
              <ol className="mt-5 grid gap-3">
                {topics.map((topic, index) => (
                  <li key={topic.topic} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="font-mono text-xs text-slate-400">{String(index + 1).padStart(2, '0')}</span>
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{topic.topic}</p><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${Math.max(8, topic.count / maxTopicCount * 100)}%` }} /></div></div>
                    <span className="text-sm font-black text-slate-500">{topic.count}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-900">{t('import.timelineTitle')}</h2>
              <ol className="mt-5 flex min-h-40 items-end gap-2 border-b border-slate-200 pb-2">
                {timeline.map((item) => (
                  <li key={item.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500">{item.count}</span>
                    <span aria-hidden="true" className="w-full rounded-t-md bg-gradient-to-t from-amber-500 to-amber-200" style={{ height: `${Math.max(12, item.count / maxTimelineCount * 112)}px` }} />
                    <span className="max-w-full -rotate-45 truncate text-[9px] text-slate-400">{item.month}</span>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <label htmlFor="import-search" className="grid w-full max-w-xl gap-1 text-sm font-bold text-slate-800">
                {t('import.searchLabel')}
                <input id="import-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('import.searchPlaceholder')} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-normal outline-none focus:ring-2 focus:ring-cyan-500" />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={selectVisible} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('import.selectVisible')}</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">{t('import.clearSelection')}</button>
              </div>
            </div>

            <div role="status" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm">
              <strong className="text-slate-900">{t('import.selected', { count: selectedIds.size })}</strong>
              <span className="text-slate-500">{t('import.selectionLimit', { count: MAX_SELECTIONS })}</span>
            </div>

            {visibleExchanges.length === 0 ? <p className="mt-5 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{t('import.noMatches')}</p> : (
              <ol className="mt-5 grid max-h-[42rem] gap-2 overflow-y-auto pe-1">
                {visibleExchanges.map((exchange) => {
                  const checked = selectedIds.has(exchange.id);
                  return (
                    <li key={exchange.id} className="[content-visibility:auto] [contain-intrinsic-size:0_160px]">
                      <label className={`grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border p-4 transition ${checked ? 'border-cyan-400 bg-cyan-50/70 ring-1 ring-cyan-300' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(exchange)} className="mt-1 h-5 w-5 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500" />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-slate-950">{exchange.title}</strong><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{exchange.topic}</span>{exchange.truncated ? <span className="text-[10px] font-bold text-amber-700">{t('import.truncated')}</span> : null}</span>
                          <span className="mt-2 block text-xs leading-relaxed text-slate-600"><b className="text-slate-800">{t('import.question')}:</b> {preview(exchange.question)}</span>
                          <span className="mt-1 block text-xs leading-relaxed text-slate-500"><b className="text-slate-700">{t('import.answer')}:</b> {preview(exchange.answer)}</span>
                          {exchange.createdAt ? <time dateTime={exchange.createdAt} className="mt-2 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">{formatDate(exchange.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</time> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-amber-400 text-amber-700 focus:ring-amber-500" />
                <span>{t('import.consent')}</span>
              </label>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500">{t('import.pendingBadge')}</p>
                <button type="submit" disabled={!consent || selectedIds.size === 0 || isSubmitting} className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white shadow-lg shadow-slate-300 transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-45">
                  {isSubmitting ? t('import.submitting') : t('import.submit', { count: selectedIds.size })}
                </button>
              </div>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
