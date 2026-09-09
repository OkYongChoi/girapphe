'use client';

import { useEffect, useState } from 'react';
import {
  AI_CLIENTS,
  CONTEXT_FORMATS,
  DEFAULT_SETTINGS_PREFERENCES,
  readSettingsPreferences,
  writeSettingsPreferences,
  type AiConnectionClient,
  type ContextPackFormat,
  type SettingsPreferences,
} from '@/lib/settings-preferences';
import { useI18n } from '@/i18n/client';
import type { MessageKey } from '@/i18n/messages';

export default function SettingsPreferencesPanel() {
  const { t } = useI18n();
  const [preferences, setPreferences] = useState<SettingsPreferences>(DEFAULT_SETTINGS_PREFERENCES);
  const [saveAnnouncement, setSaveAnnouncement] = useState<{
    status: 'idle' | 'saved' | 'unavailable';
    sequence: number;
  }>({ status: 'idle', sequence: 0 });

  useEffect(() => {
    setPreferences(readSettingsPreferences());
  }, []);

  function update(next: SettingsPreferences) {
    setPreferences(next);
    const status = writeSettingsPreferences(next) ? 'saved' : 'unavailable';
    setSaveAnnouncement((current) => ({
      status,
      sequence: current.sequence + 1,
    }));
  }

  const aiLabel = t(`settings.aiClient.${preferences.aiClient}` as MessageKey);

  return (
    <section className="grid gap-5 lg:grid-cols-2" aria-labelledby="settings-preferences-title">
      <h2 id="settings-preferences-title" className="sr-only">{t('settings.preferencesTitle')}</h2>

      <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-lg text-blue-800">◇</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">{t('settings.aiClientEyebrow')}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{t('settings.aiClientTitle')}</h2>
            <p id="ai-client-help" className="mt-2 text-sm leading-relaxed text-slate-600">{t('settings.aiClientBody')}</p>
          </div>
        </div>

        <label htmlFor="settings-ai-client" className="mt-5 grid gap-1.5 text-xs font-bold text-slate-700">
          {t('settings.aiClientLabel')}
          <select
            id="settings-ai-client"
            aria-describedby="ai-client-help model-selection-boundary"
            value={preferences.aiClient}
            onChange={(event) => update({ ...preferences, aiClient: event.target.value as AiConnectionClient })}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-blue-500"
          >
            {AI_CLIENTS.map((client) => (
              <option key={client} value={client}>{t(`settings.aiClient.${client}` as MessageKey)}</option>
            ))}
          </select>
        </label>

        <div className="mt-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
          <p className="text-sm font-black text-cyan-950">{t('settings.guideTitle', { app: aiLabel })}</p>
          <p className="mt-1 text-xs leading-relaxed text-cyan-900">{t(`settings.aiGuide.${preferences.aiClient}` as MessageKey)}</p>
        </div>

        <div id="model-selection-boundary" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
          <strong>{t('settings.modelBoundaryTitle')}</strong>{' '}
          {t('settings.modelBoundaryBody', { app: aiLabel })}
        </div>
      </div>

      <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-lg font-black text-violet-800">↗</span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">{t('settings.contextEyebrow')}</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">{t('settings.contextTitle')}</h2>
            <p id="context-format-help" className="mt-2 text-sm leading-relaxed text-slate-600">{t('settings.contextBody')}</p>
          </div>
        </div>

        <label htmlFor="settings-context-format" className="mt-5 grid gap-1.5 text-xs font-bold text-slate-700">
          {t('settings.contextFormatLabel')}
          <select
            id="settings-context-format"
            aria-describedby="context-format-help"
            value={preferences.contextFormat}
            onChange={(event) => update({ ...preferences, contextFormat: event.target.value as ContextPackFormat })}
            className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 outline-none transition focus:ring-2 focus:ring-violet-500"
          >
            {CONTEXT_FORMATS.map((format) => (
              <option key={format} value={format}>{format === 'markdown' ? 'Markdown' : format.toUpperCase()}</option>
            ))}
          </select>
        </label>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">{t('settings.localPreferenceNote')}</p>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-save-announcement={saveAnnouncement.sequence}
          className={`mt-2 min-h-5 text-xs font-bold ${saveAnnouncement.status === 'unavailable' ? 'text-amber-700' : 'text-emerald-700'}`}
        >
          {saveAnnouncement.status === 'idle' ? null : (
            <span key={saveAnnouncement.sequence}>
              {saveAnnouncement.status === 'saved'
                ? t('settings.saved')
                : t('settings.saveUnavailable')}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
