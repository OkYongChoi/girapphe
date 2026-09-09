'use client';

import { useState } from 'react';
import {
  MCP_PROVIDER_SETUP_GUIDES,
  MCP_TOKEN_ENVIRONMENT_VARIABLE,
  buildMcpProviderTokenSnippet,
  type McpProviderSetupId,
} from '@/lib/mcp/provider-setup';

export default function McpProviderSetupGuide({
  endpointUrl,
  tokenReady,
}: {
  endpointUrl: string;
  tokenReady: boolean;
}) {
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
    <section
      lang="en"
      dir="ltr"
      className="mt-6 overflow-hidden rounded-2xl border border-cyan-200 bg-cyan-50/40"
      aria-labelledby="mcp-provider-setup-title"
    >
      <div className="border-b border-cyan-200 bg-white px-4 py-4 md:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Provider-specific setup</p>
        <h3 id="mcp-provider-setup-title" className="mt-1 text-lg font-black text-slate-950">Use Girapphe with ChatGPT or Claude</h3>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
          Choose where you want to connect. The web apps use Girapphe OAuth; the token created above is for clients that let you set an Authorization header.
        </p>
      </div>

      <fieldset className="grid gap-2 p-4 sm:grid-cols-2 md:p-5" aria-describedby="mcp-provider-choice-help">
        <legend className="text-xs font-bold text-slate-700">Choose an AI client</legend>
        <p id="mcp-provider-choice-help" className="col-span-full text-xs text-slate-500">This changes the instructions only. It does not store an AI-provider credential or change draft provenance.</p>
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
            <span>{MCP_PROVIDER_SETUP_GUIDES[id].name}</span>
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 border-t border-cyan-200 bg-white p-4 lg:grid-cols-2 md:p-5">
        <article className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-slate-950">{guide.nativeClient}</h4>
            <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-800">OAuth</span>
          </div>
          <p className="mt-2 text-sm font-bold text-violet-950">{guide.nativeAuthLabel}</p>
          <ol className="mt-3 grid gap-2 pl-5 text-sm leading-relaxed text-slate-700">
            {guide.nativeSteps.map((step) => <li key={step} className="list-decimal pl-1">{step}</li>)}
          </ol>
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950">{guide.availability}</p>
          <a href={guide.officialGuideUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-violet-800 underline decoration-violet-300 underline-offset-4 hover:text-violet-950">
            {guide.officialGuideLabel}<span aria-hidden="true">&nbsp;↗</span>
          </a>
        </article>

        <article className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-black text-slate-950">Use the PAT with {guide.tokenClient}</h4>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">Bearer token</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{guide.tokenSummary}</p>
          <p className={`mt-3 rounded-lg border p-3 text-xs font-bold ${tokenReady ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-600'}`}>
            {tokenReady
              ? `Token ready. Copy the one-time secret above and store it as ${MCP_TOKEN_ENVIRONMENT_VARIABLE}.`
              : `Create a token above, copy it once, and store it as ${MCP_TOKEN_ENVIRONMENT_VARIABLE}.`}
          </p>
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
            <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-3 py-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-300">Token configuration</span>
              <button
                type="button"
                onClick={() => void copySnippet()}
                className="min-h-11 rounded-md border border-slate-600 px-3 text-xs font-bold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                {copied ? 'Copied' : 'Copy setup'}
              </button>
            </div>
            <pre className="max-h-80 overflow-auto p-3 text-xs leading-relaxed text-cyan-100"><code>{tokenSnippet}</code></pre>
          </div>
          {copyError ? <p role="alert" className="mt-2 text-xs font-bold text-red-700">Clipboard access failed. Select and copy the setup manually.</p> : null}
          <a href={guide.tokenGuideUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-bold text-emerald-800 underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950">
            {guide.tokenGuideLabel}<span aria-hidden="true">&nbsp;↗</span>
          </a>
        </article>
      </div>

      <aside className="border-t border-cyan-200 bg-cyan-50 px-4 py-3 text-xs leading-relaxed text-cyan-950 md:px-5">
        <strong>Safe first test:</strong> ask {guide.name} to send only one explanation you explicitly select as a pending draft. Confirm it appears here before enabling broader use. Nothing is approved or published automatically.
      </aside>
    </section>
  );
}
