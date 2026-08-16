'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMcpAccessToken,
  revokeMcpAccessToken,
  type McpAccessToken,
} from '@/actions/knowledge-ingestion-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import SubmitButton from '@/components/submit-button';

export default function DraftReviewMcpConnections({ tokens, currentTime }: { tokens: McpAccessToken[]; currentTime: number }) {
  const router = useRouter();
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointUrl, setEndpointUrl] = useState('/api/mcp');

  useEffect(() => {
    setEndpointUrl(`${window.location.origin}/api/mcp`);
  }, []);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6" aria-labelledby="mcp-connections-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Authenticated ingestion</p>
          <h2 id="mcp-connections-title" className="mt-1 text-xl font-bold text-slate-950">MCP Connections</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            Create a bearer-header token for a header-capable or programmatic MCP client. Connect it to <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-xs">{endpointUrl}</code>; its only scope is <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">knowledge:drafts:create</code>.
          </p>
          <p className="mt-1 text-xs text-slate-500">OAuth-native connectors use the same endpoint and Girapphe sign-in after Clerk MCP OAuth is enabled for the deployment.</p>
        </div>
        <form
          className="flex w-full max-w-sm gap-2"
          action={async (formData) => {
            setError(null);
            setCopied(false);
            try {
              const result = await createMcpAccessToken(formData);
              setRawToken(result.token);
              router.refresh();
            } catch (createError) {
              setError(createError instanceof Error ? createError.message : 'Could not create an MCP token.');
            }
          }}
        >
          <label htmlFor="mcp-token-label" className="sr-only">Connection label</label>
          <input
            id="mcp-token-label"
            name="label"
            required
            maxLength={80}
            placeholder="e.g., Claude desktop"
            className="min-h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none focus:ring-2 focus:ring-violet-400"
          />
          <SubmitButton
            label="Create token"
            loadingLabel="Creating…"
            className="min-h-10 shrink-0 rounded-lg bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
          />
        </form>
      </div>

      {rawToken ? (
        <div role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-950">Secret token — shown exactly once</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">Copy it now and store it in your MCP client&apos;s secret/header configuration. Girapphe will not show this value again.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900">{rawToken}</code>
            <button
              type="button"
              onClick={async () => {
                setError(null);
                try {
                  await navigator.clipboard.writeText(rawToken);
                  setCopied(true);
                } catch {
                  setError('Clipboard access failed. Select and copy the token manually before leaving this page.');
                }
              }}
              className="min-h-10 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 hover:bg-amber-100"
            >
              {copied ? 'Copied' : 'Copy token'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-900">Existing connections</h3>
          <span className="text-xs text-slate-500">{tokens.filter((token) => !token.revoked_at && (!token.expires_at || new Date(token.expires_at).getTime() > currentTime)).length} active</span>
        </div>
        {tokens.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">No MCP tokens created yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {tokens.map((token) => {
              const revoked = !!token.revoked_at;
              const expired = !revoked && !!token.expires_at && new Date(token.expires_at).getTime() <= currentTime;
              const status = revoked ? 'Revoked' : expired ? 'Expired' : 'Active';
              return (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-3 p-3 md:px-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{token.label}</span>
                      <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">…{token.last_four}</code>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${revoked ? 'bg-slate-100 text-slate-500' : expired ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>
                        {status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Scope: {token.scopes.join(', ')} · Created {new Date(token.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {token.last_used_at ? `Last used ${new Date(token.last_used_at).toLocaleString()}` : 'Never used'}
                      {token.revoked_at ? ` · Revoked ${new Date(token.revoked_at).toLocaleString()}` : ''}
                      {token.expires_at ? ` · Expires ${new Date(token.expires_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                  {!revoked ? (
                    <form
                      action={async (formData) => {
                        await revokeMcpAccessToken(formData);
                        router.refresh();
                      }}
                    >
                      <input type="hidden" name="token_id" value={token.id} />
                      <ConfirmDeleteButton
                        label="Revoke"
                        confirmMessage={`Revoke MCP connection "${token.label}"? The client will immediately lose draft-creation access.`}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      />
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
