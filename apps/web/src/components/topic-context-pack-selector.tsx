'use client';

import { useState } from 'react';
import type { KnowledgeBundleType } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import type { MessageKey } from '@/i18n/messages';

const MAX_CONTEXT_ITEMS = 100;

type ContextItem = {
  id: string;
  title: string;
  centralQuestion: string | null;
  knowledgeType: KnowledgeBundleType | null;
};

export default function TopicContextPackSelector({ topic, items }: { topic: string; items: ContextItem[] }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState<'markdown' | 'yaml' | 'json'>('markdown');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setItem = (id: string, checked: boolean) => {
    if (checked && selected.size >= MAX_CONTEXT_ITEMS && !selected.has(id)) {
      setError(t('topic.context.maximum'));
      return;
    }
    setError(null);
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  async function downloadContextPack() {
    if (selected.size === 0 || downloading) return;
    if (selected.size > MAX_CONTEXT_ITEMS) {
      setError(t('topic.context.maximum'));
      return;
    }
    setDownloading(true);
    setError(null);
    try {
      const response = await fetch('/api/knowledge/context-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          format,
          itemIds: items.filter((item) => selected.has(item.id)).map((item) => item.id),
        }),
      });
      if (!response.ok) {
        if (response.status === 409) throw new Error(t('topic.context.stale'));
        if (response.status === 413) throw new Error(t('topic.context.tooLarge'));
        throw new Error(t('topic.context.error'));
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `girapphe-context-pack.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('topic.context.error'));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-cyan-200 bg-white shadow-sm">
      <div className="border-b border-cyan-100 bg-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-800">{t('topic.context.eyebrow')}</p>
            <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">{t('topic.context.title')}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{t('topic.context.body')}</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-800 shadow-sm">{t('topic.context.selected', { count: selected.size })}</span>
        </div>
      </div>

      <div className="p-5">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">{t('topic.context.empty')}</p>
        ) : (
          <fieldset>
            <legend className="sr-only">{t('topic.context.legend')}</legend>
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-bold">
              <button type="button" onClick={() => { setSelected(new Set(items.slice(0, MAX_CONTEXT_ITEMS).map((item) => item.id))); setError(items.length > MAX_CONTEXT_ITEMS ? t('topic.context.maximum') : null); }} className="text-blue-700 hover:underline">{t('topic.context.selectAll')}</button>
              <button type="button" onClick={() => { setSelected(new Set()); setError(null); }} className="text-slate-600 hover:underline">{t('topic.context.clear')}</button>
            </div>
            <div className="grid max-h-96 gap-2 overflow-y-auto pe-1 md:grid-cols-2">
              {items.map((item) => (
                <label key={item.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected.has(item.id) ? 'border-cyan-400 bg-cyan-50' : 'border-slate-200 hover:border-cyan-300'}`}>
                  <input type="checkbox" checked={selected.has(item.id)} onChange={(event) => setItem(item.id, event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{item.title}</span>
                    <span className="mt-1 block text-xs text-slate-500">{item.knowledgeType ? t(`bundle.type.${item.knowledgeType}` as MessageKey) : t('topic.context.legacy')}{item.centralQuestion ? ` · ${item.centralQuestion}` : ''}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-4">
          <label className="grid gap-1 text-xs font-bold text-slate-700">
            {t('topic.context.format')}
            <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold">
              <option value="markdown">Markdown</option>
              <option value="yaml">YAML</option>
              <option value="json">JSON</option>
            </select>
          </label>
          {selected.size > 0 ? (
            <button type="button" disabled={downloading} onClick={() => void downloadContextPack()} className="inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">{downloading ? t('topic.context.creating') : t('topic.context.download')}</button>
          ) : (
            <span aria-disabled="true" className="inline-flex min-h-11 cursor-not-allowed items-center rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-500">{t('topic.context.continue')}</span>
          )}
        </div>
        {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </div>
  );
}
