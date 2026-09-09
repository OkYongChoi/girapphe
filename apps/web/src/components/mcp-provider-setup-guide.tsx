'use client';

import { useState } from 'react';
import {
  MCP_PROVIDER_SETUP_GUIDES,
  MCP_TOKEN_ENVIRONMENT_VARIABLE,
  buildMcpProviderTokenSnippet,
  type McpProviderSetupId,
} from '@/lib/mcp/provider-setup';
import { useI18n } from '@/i18n/client';

export default function McpProviderSetupGuide({
  endpointUrl,
  tokenReady,
}: {
  endpointUrl: string;
  tokenReady: boolean;
}) {
  const { t } = useI18n();
  const [provider, setProvider] = useState<McpProviderSetupId>('chatgpt');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const guide = MCP_PROVIDER_SETUP_GUIDES[provider];
  const tokenSnippet = buildMcpProviderTokenSnippet(provider, endpointUrl);

  async function copySnippet() {
    setCopied(false);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(tokenSnippet);
      setCopied(true);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-cyan-200 bg-cyan-50/40" aria-labelledby="mcp-provider-setup-title">
      <div className="border-b border-cyan-200 bg-white px-4 py-4 md:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">{t('mcp.providerSetup.eyebrow')}</p>
        <h3 id="mcp-provider-setup-title" className="mt-1 text-lg font-black text-slate-950">{t('mcp.providerSetup.title')}</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          {t('mcp.providerSetup.intro')}
        </p>
      </div>

      <fieldset className="grid gap-2 p-4 sm:grid-cols-2 md:p-5" aria-describedby="mcp-provider-choice-help">
        <legend className="text-xs font-bold text-slate-700">{t('mcp.providerSetup.choiceLegend')}</legend>
        <p id="mcp-provider-choice-help" className="col-span-full text-xs text-slate-500">{t('mcp.providerSetup.choiceHelp')}</p>
        {(Object.keys(MCP_PROVIDER_SETUP_GUIDES) as McpProviderSetupId[]).map((id) => (
          <label
            key={id}
            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-bold transition ${provider === id ? 'border-cyan-500 bg-white text-cyan-950 shadow-sm' : 'border-slate-200 bg-white/70 text-slate-600 hover:border-cyan-300'}`}
          >
            <input
              type="radio"
              name="mcp-provider-setup"
              value={id}
              checked={provider === id}
              onChange={() => {
                setProvider(id);
                setCopied(false);
                setCopyError(false);
              }}
              className="size-4 border-slate-300 text-cyan-700 focus:ring-cyan-500"
            />
            <span>{t(MCP_PROVIDER_SETUP_GUIDES[id].nameKey)}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 border-t border-cyan-200 bg-white p-4 lg:grid-cols-2 md:p-5">
        <article className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-slate-950">{t(guide.nativeClientKey)}</h4>
            <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-800">{t('mcp.providerSetup.oauthBadge')}</span>
          </div>
          <p className="mt-2 text-sm font-bold text-violet-950">{t(guide.nativeAuthLabelKey)}</p>
          <ol className="mt-3 grid gap-2 ps-5 text-sm leading-relaxed text-slate-700">
            {guide.nativeStepKeys.map((stepKey) => <li key={stepKey} className="list-decimal ps-1">{t(stepKey)}</li>)}
          </ol>
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{t(guide.availabilityKey)}</p>
          <a href={guide.officialGuideUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:text-violet-950">
            {t(guide.officialGuideLabelKey)}<span aria-hidden="true">&nbsp;↗</span>
          </a>
        </article>

        <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-slate-950">{t('mcp.providerSetup.patHeading', { client: t(guide.tokenClientKey) })}</h4>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">{t('mcp.providerSetup.bearerBadge')}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{t(guide.tokenSummaryKey)}</p>
          <p className={`mt-3 rounded-lg border p-3 text-xs font-bold ${tokenReady ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
            {tokenReady
              ? t('mcp.providerSetup.tokenReady', { environmentVariable: MCP_TOKEN_ENVIRONMENT_VARIABLE })
              : t('mcp.providerSetup.tokenMissing', { environmentVariable: MCP_TOKEN_ENVIRONMENT_VARIABLE })}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{t('mcp.providerSetup.tokenConfiguration')}</span>
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="min-h-11 rounded-md border border-slate-600 px-3 text-xs font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                {copied ? t('mcp.providerSetup.copied') : t('mcp.providerSetup.copySetup')}
              </button>
            </div>
            <pre dir="ltr" className="max-h-80 overflow-auto p-3 text-left text-xs leading-relaxed text-cyan-100"><code>{tokenSnippet}</code></pre>
          </div>
          {copyError ? <p role="alert" className="mt-2 text-xs font-bold text-red-700">{t('mcp.providerSetup.copyError')}</p> : null}
          <a href={guide.tokenGuideUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950">
            {t(guide.tokenGuideLabelKey)}<span aria-hidden="true">&nbsp;↗</span>
          </a>
        </article>
      </div>

      <aside className="border-t border-cyan-200 bg-cyan-50 px-4 py-3 text-xs leading-relaxed text-cyan-950 md:px-5">
        <strong>{t('mcp.providerSetup.safeTestTitle')}</strong>{' '}
        {t('mcp.providerSetup.safeTestBody', { provider: t(guide.nameKey) })}
      </aside>
    </section>
  );
}
