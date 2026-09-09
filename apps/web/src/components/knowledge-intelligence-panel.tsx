'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import type {
  KnowledgeIntelligenceSignal,
  KnowledgeProductEventOutcome,
} from '@stem-brain/shared/ai-thinking-history';
import { useI18n } from '@/i18n/client';
import { LocalizedLink } from '@/i18n/navigation';
import {
  DEFAULT_SETTINGS_PREFERENCES,
  readSettingsPreferences,
  type ContextPackFormat,
} from '@/lib/settings-preferences';

type DismissOutcome = Extract<KnowledgeProductEventOutcome, 'unhelpful' | 'incorrect' | 'scope_changed'>;

async function recordSignalEvent(body: Record<string, unknown>) {
  const response = await fetch('/api/knowledge/context-pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  });
  if (!response.ok) throw new Error('signal_event_failed');
}

function uniqueContextEvidence(signal: KnowledgeIntelligenceSignal) {
  return signal.contextItemIds.map((itemId) => (
    [...signal.evidence].reverse().find((entry) => entry.itemId === itemId)
  )).filter((entry): entry is KnowledgeIntelligenceSignal['evidence'][number] => Boolean(entry));
}

export type KnowledgeIntelligencePanelProps = {
  signals: KnowledgeIntelligenceSignal[];
  enabled: boolean;
  locale: string;
  loadingLabel: string;
  unavailableLabel: string;
};

export default function KnowledgeIntelligencePanel({
  signals,
  enabled,
  locale,
  loadingLabel,
  unavailableLabel,
}: KnowledgeIntelligencePanelProps) {
  const { formatDate } = useI18n();
  const [messages, setMessages] = useState<Record<string, string> | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState<ContextPackFormat>(DEFAULT_SETTINGS_PREFERENCES.contextFormat);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const signalIds = useMemo(() => signals.map((signal) => signal.id), [signals]);

  useEffect(() => {
    let active = true;
    void fetch('/thinking-history-messages.json')
      .then((response) => response.ok ? response.json() as Promise<Record<string, unknown>> : Promise.reject(new Error('messages_unavailable')))
      .then((catalogs) => {
        const selected = catalogs[locale] ?? catalogs.en;
        const entries = selected && typeof selected === 'object'
          ? Object.entries(selected).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
          : [];
        if (active) setMessages(Object.fromEntries(entries));
      }, () => { if (active) setMessages({}); });
    return () => { active = false; };
  }, [locale]);

  useEffect(() => {
    setFormat(readSettingsPreferences().contextFormat);
  }, []);

  useEffect(() => {
    if (signalIds.length > 0) {
      void recordSignalEvent({ operation: 'viewed', signalIds }).catch(() => undefined);
    }
  }, [signalIds]);

  function t(key: string, values: Record<string, string | number> = {}) {
    let result = messages?.[key] ?? key;
    for (const [name, value] of Object.entries(values)) result = result.replaceAll(`{${name}}`, String(value));
    return result;
  }

  function toggleEvidence(signalId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(signalId)) next.delete(signalId);
      else next.add(signalId);
      return next;
    });
  }

  function toggleContextItem(signalId: string, itemId: string) {
    setSelected((current) => {
      const values = new Set(current[signalId] ?? []);
      if (values.has(itemId)) values.delete(itemId);
      else values.add(itemId);
      return { ...current, [signalId]: [...values] };
    });
  }

  async function createContext(signal: KnowledgeIntelligenceSignal, mode: 'copy' | 'download') {
    const itemIds = selected[signal.id] ?? [];
    if (itemIds.length === 0) {
      setStatus((current) => ({ ...current, [signal.id]: t('insights.context.selectFirst') }));
      return;
    }
    setStatus((current) => ({ ...current, [signal.id]: t('insights.context.working') }));
    try {
      const response = await fetch('/api/knowledge/context-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: signal.topic, format, itemIds, signalId: signal.id }),
      });
      if (!response.ok) {
        if (response.status === 409) throw new Error(t('insights.context.stale'));
        throw new Error(t('insights.context.error'));
      }
      const content = await response.text();
      if (mode === 'copy') {
        await navigator.clipboard.writeText(content);
      } else {
        const url = URL.createObjectURL(new Blob([content], { type: response.headers.get('content-type') ?? 'text/plain' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `girapphe-context-pack.${format === 'markdown' ? 'md' : format}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
      setStatus((current) => ({
        ...current,
        [signal.id]: mode === 'copy' ? t('insights.context.copied') : t('insights.context.downloaded'),
      }));
    } catch (error) {
      setStatus((current) => ({
        ...current,
        [signal.id]: error instanceof Error ? error.message : t('insights.context.error'),
      }));
    }
  }

  function dismiss(signal: KnowledgeIntelligenceSignal, outcome: DismissOutcome) {
    if (!window.confirm(t('insights.dismissConfirm'))) return;
    startTransition(async () => {
      try {
        await recordSignalEvent({ operation: 'dismissed', signalId: signal.id, outcome });
        setDismissed((current) => new Set(current).add(signal.id));
        setStatus((current) => ({ ...current, [signal.id]: t('insights.dismissed') }));
      } catch {
        setStatus((current) => ({ ...current, [signal.id]: t('insights.dismissError') }));
      }
    });
  }

  if (messages === null) return <section aria-busy="true" className="thinking-loading">{loadingLabel}</section>;
  if (Object.keys(messages).length === 0) return <section role="alert" className="thinking-load-error">{unavailableLabel}</section>;

  const visibleSignals = signals.filter((signal) => !dismissed.has(signal.id));
  const topicCount = new Set(visibleSignals.map((signal) => signal.topic)).size;
  const header = (
    <header className="thinking-header">
      <div aria-hidden="true" className="thinking-watermark">G</div>
      <div className="thinking-header-body">
        <div className="thinking-eyebrow-row">
          <p className="thinking-eyebrow">{t('insights.eyebrow')}</p>
          <span className="thinking-private-badge">{t('insights.privateBadge')}</span>
        </div>
        <h1 className="thinking-title">{t('insights.title')}</h1>
        <p className="thinking-subtitle">{t('insights.subtitle')}</p>
        {visibleSignals.length > 0 ? <p className="thinking-summary">{t('insights.summary', { count: visibleSignals.length, topics: topicCount })}</p> : null}
      </div>
    </header>
  );

  if (!enabled) {
    return <>{header}<section className="thinking-paused">
      <h2 className="thinking-paused-title">{t('insights.pausedTitle')}</h2>
      <p className="thinking-paused-body">{t('insights.pausedBody')}</p>
      <div className="thinking-actions">
        <LocalizedLink href="/knowledge-inbox" className="thinking-primary-link">{t('insights.reviewKnowledge')}</LocalizedLink>
        <LocalizedLink href="/account/delete#knowledge-data" className="thinking-secondary-link">{t('insights.dataControls')}</LocalizedLink>
      </div>
    </section></>;
  }

  if (visibleSignals.length === 0) {
    return (
      <>{header}<section className="thinking-empty">
        <p className="thinking-empty-title">{t('insights.emptyTitle')}</p>
        <p className="thinking-empty-body">{t('insights.emptyBody')}</p>
        <div className="thinking-empty-actions">
          <LocalizedLink href="/knowledge-inbox/import" className="thinking-primary-pill">{t('insights.importAction')}</LocalizedLink>
          <LocalizedLink href="/topics" className="thinking-secondary-pill">{t('insights.openTopics')}</LocalizedLink>
        </div>
      </section></>
    );
  }

  return (
    <>{header}<section aria-label={t('insights.feedLabel')} className="thinking-feed">
      <div aria-hidden="true" className="thinking-rail" />
      <ol className="thinking-list">
        {visibleSignals.map((signal, index) => {
          const isOpen = expanded.has(signal.id);
          const contextEvidence = uniqueContextEvidence(signal);
          const selectedIds = new Set(selected[signal.id] ?? []);
          return (
            <li key={signal.id} className="thinking-item">
              <span aria-hidden="true" className="thinking-marker">
                {String(index + 1).padStart(2, '0')}
              </span>
              <article className="thinking-card">
                <div className="thinking-card-copy">
                  <div className="thinking-chip-row">
                    <span className="thinking-signal-label" data-type={signal.type}>{t(`insights.type.${signal.type}`)}</span>
                    <span className="thinking-confidence">{t(`insights.confidence.${signal.confidence}`)}</span>
                    <span className="thinking-topic">{signal.topic}</span>
                  </div>
                  <h2 className="thinking-signal-title">{t(`insights.headline.${signal.type}`)}</h2>
                  <p className="thinking-uncertainty">{t(`insights.uncertainty.${signal.uncertainty}`)}</p>
                  <div className="thinking-details">
                    <span>{formatDate(signal.startedAt, { dateStyle: 'medium' })} → {formatDate(signal.endedAt, { dateStyle: 'medium' })}</span>
                    {signal.relationType ? <span>{t('insights.relation')}: {signal.relationType.replaceAll('_', ' ')}</span> : null}
                    <span>{t('insights.evidenceCount', { count: signal.evidence.length })}</span>
                  </div>
                  <button type="button" aria-expanded={isOpen} onClick={() => toggleEvidence(signal.id)} className="thinking-evidence-toggle">
                    {isOpen ? t('insights.hideEvidence') : t('insights.showEvidence')}
                  </button>
                </div>

                {isOpen ? (
                  <div className="thinking-expanded">
                    <ol className="thinking-evidence-grid">
                      {signal.evidence.map((entry, evidenceIndex) => (
                        <li key={`${entry.itemId}:${entry.revisionVersion ?? 'current'}:${evidenceIndex}`} className="thinking-evidence-card">
                          <p className="thinking-evidence-version">
                            {entry.revisionVersion ? `v${entry.revisionVersion}` : t('insights.currentVersion')} · {formatDate(entry.occurredAt, { dateStyle: 'medium' })}
                          </p>
                          <h3 className="thinking-evidence-title">{entry.title}</h3>
                          <p className="thinking-evidence-summary">{entry.summary}</p>
                          <div className="thinking-evidence-footer">
                            <span className="thinking-selector-count">{t('insights.selectorCount', { count: entry.sourceSelectorCount })}</span>
                            <LocalizedLink
                              href={`/topics/${encodeURIComponent(entry.topic)}#item-${encodeURIComponent(entry.itemId)}`}
                              onClick={() => void recordSignalEvent({ operation: 'evidence_opened', signalId: signal.id, itemId: entry.itemId }).catch(() => undefined)}
                              className="thinking-evidence-link"
                            >
                              {t('insights.openKnowledge')}
                            </LocalizedLink>
                          </div>
                        </li>
                      ))}
                    </ol>

                    <div className="thinking-context">
                      <div className="thinking-context-head">
                        <div>
                          <h3 className="thinking-context-title">{t('insights.context.title')}</h3>
                          <p className="thinking-context-body">{t('insights.context.body')}</p>
                        </div>
                        <span className="thinking-selected-count">{t('insights.context.selected', { count: selectedIds.size })}</span>
                      </div>
                      <fieldset className="thinking-context-options">
                        <legend className="sr-only">{t('insights.context.legend')}</legend>
                        {contextEvidence.map((entry) => (
                          <label key={entry.itemId} className="thinking-context-option" data-selected={selectedIds.has(entry.itemId)}>
                            <input type="checkbox" checked={selectedIds.has(entry.itemId)} onChange={() => toggleContextItem(signal.id, entry.itemId)} className="thinking-checkbox" />
                            <span className="thinking-option-title">{entry.title}</span>
                          </label>
                        ))}
                      </fieldset>
                      <div className="thinking-context-actions">
                        <label className="thinking-format-label">
                          {t('insights.context.format')}
                          <select value={format} onChange={(event) => setFormat(event.target.value as ContextPackFormat)} className="thinking-format-select">
                            <option value="markdown">Markdown</option><option value="yaml">YAML</option><option value="json">JSON</option>
                          </select>
                        </label>
                        <button type="button" onClick={() => void createContext(signal, 'copy')} className="thinking-copy-button">{t('insights.context.copy')}</button>
                        <button type="button" onClick={() => void createContext(signal, 'download')} className="thinking-download-button">{t('insights.context.download')}</button>
                      </div>
                    </div>

                    <div className="thinking-dismiss-row">
                      <span className="thinking-dismiss-prompt">{t('insights.dismissPrompt')}</span>
                      {(['unhelpful', 'incorrect', 'scope_changed'] as const).map((outcome) => (
                        <button key={outcome} type="button" disabled={pending} onClick={() => dismiss(signal, outcome)} className="thinking-dismiss-button">
                          {t(`insights.dismiss.${outcome}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {status[signal.id] ? <p role="status" className="thinking-status">{status[signal.id]}</p> : null}
              </article>
            </li>
          );
        })}
      </ol>
    </section></>
  );
}
