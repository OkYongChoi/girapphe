'use client';

import { useEffect, useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMcpAccessToken,
  deleteRevokedMcpAccessToken,
  revokeMcpAccessToken,
  type McpAccessToken,
} from '@/actions/knowledge-ingestion-actions';
import ConfirmDeleteButton from '@/components/confirm-delete-button';
import McpProviderSetupGuide from '@/components/mcp-provider-setup-guide';
import SubmitButton from '@/components/submit-button';
import { useI18n } from '@/i18n/client';

type CopyTarget =
  | { kind: 'token'; tokenId: string }
  | { kind: 'endpoint' };

export default function DraftReviewMcpConnections({
  tokens,
  defaultExpanded = false,
}: {
  tokens: McpAccessToken[];
  defaultExpanded?: boolean;
}) {
  const router = useRouter();
  const { formatDate, t } = useI18n();
  const panelId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [rawToken, setRawToken] = useState<{
    id: string;
    value: string;
    copied: boolean;
  } | null>(null);
  const [endpointCopied, setEndpointCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [endpointUrl, setEndpointUrl] = useState('/api/mcp');
  const [currentTime, setCurrentTime] = useState(0);
  const [showRevoked, setShowRevoked] = useState(false);

  useEffect(() => {
    setEndpointUrl(`${window.location.origin}/api/mcp`);
    setCurrentTime(Date.now());
    if (window.location.hash === '#ai-connections') setExpanded(true);
  }, []);

  const activeCount = tokens.filter((token) => (
    !token.revoked_at
    && (!token.expires_at || currentTime === 0 || new Date(token.expires_at).getTime() > currentTime)
  )).length;
  const hasRevoked = tokens.some((token) => Boolean(token.revoked_at));
  const visibleTokens = showRevoked ? tokens : tokens.filter((token) => !token.revoked_at);

  async function copyValue(value: string, target: CopyTarget) {
    setError(null);
    try {
      await navigator.clipboard.writeText(value);
      if (target.kind === 'token') {
        setRawToken((current) => (
          current?.id === target.tokenId ? { ...current, copied: true } : current
        ));
      } else {
        setEndpointCopied(true);
      }
    } catch {
      setError(target.kind === 'token' ? t('mcp.tokenCopyError') : t('mcp.endpointCopyError'));
    }
  }

  return (
    <section id="ai-connections" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="mcp-connections-title">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-14 w-full items-center gap-3 p-4 text-start transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 md:px-6"
      >
        <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-xl font-medium text-violet-800">
          {expanded ? '−' : '+'}
        </span>
        <span className="min-w-0 flex-1">
          <span id="mcp-connections-title" className="block text-sm font-black text-slate-950">{t('mcp.connectionsTitle')}</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{t('mcp.connectionsSummary')}</span>
        </span>
        <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 sm:inline">
          {t('mcp.activeCount', { count: activeCount })}
        </span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className={`size-5 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="m5.5 7.5 4.5 4.5 4.5-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" />
        </svg>
      </button>

      {expanded ? (
        <div id={panelId} className="border-t border-slate-200 p-4 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.78fr)]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">{t('mcp.authenticatedIngestion')}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{t('mcp.connectionSetupTitle')}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">{t('mcp.scope.description')}</p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">{t('mcp.scope.note')}</p>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-700">{t('mcp.endpointLabel')}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <code className="min-w-0 flex-1 break-all rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800">{endpointUrl}</code>
                  <button
                    type="button"
                    onClick={() => void copyValue(endpointUrl, { kind: 'endpoint' })}
                    className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {endpointCopied ? t('mcp.endpointCopied') : t('mcp.copyEndpoint')}
                  </button>
                </div>
              </div>
            </div>

            <form
              className="grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4"
              action={async (formData) => {
                setError(null);
                try {
                  const result = await createMcpAccessToken(formData);
                  setRawToken({ id: result.record.id, value: result.token, copied: false });
                  router.refresh();
                } catch (createError) {
                  setError(createError instanceof Error ? createError.message : t('mcp.createError'));
                }
              }}
            >
              <label htmlFor="mcp-token-label" className="grid gap-1 text-xs font-bold text-slate-700">
                {t('mcp.connectionLabel')}
                <input
                  id="mcp-token-label"
                  name="label"
                  required
                  maxLength={80}
                  placeholder={t('mcp.connectionPlaceholder')}
                  className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:ring-2 focus:ring-violet-400"
                />
              </label>
              <fieldset className="grid gap-2">
                <legend className="text-xs font-bold text-slate-700">{t('mcp.scope.legend')}</legend>
                <label className="flex min-h-11 items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                  <input type="checkbox" name="scope" value="knowledge:drafts:create" defaultChecked className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-500" />
                  <span><strong className="block text-slate-900">{t('mcp.scope.draftsTitle')}</strong><code>knowledge:drafts:create</code> · {t('mcp.scope.draftsBody')}</span>
                </label>
                <label className="flex min-h-11 items-start gap-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
                  <input type="checkbox" name="scope" value="knowledge:context:read" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-cyan-700 focus:ring-cyan-500" />
                  <span><strong className="block text-slate-900">{t('mcp.scope.contextTitle')}</strong><code>knowledge:context:read</code> · {t('mcp.scope.contextBody')}</span>
                </label>
              </fieldset>
              <SubmitButton
                label={t('mcp.createToken')}
                loadingLabel={t('mcp.creatingToken')}
                className="min-h-11 justify-self-end rounded-lg bg-violet-700 px-4 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
              />
            </form>
          </div>

          {rawToken ? (
            <div role="status" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-950">{t('mcp.secretTitle')}</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">{t('mcp.secretBody')}</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs text-slate-900">{rawToken.value}</code>
                <button
                  type="button"
                  onClick={() => void copyValue(rawToken.value, { kind: 'token', tokenId: rawToken.id })}
                  className="min-h-11 rounded-lg border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {rawToken.copied ? t('mcp.tokenCopied') : t('mcp.copyToken')}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

          <McpProviderSetupGuide endpointUrl={endpointUrl} tokenReady={Boolean(rawToken)} />

          <div className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900">{t('mcp.existingConnections')}</h3>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-xs text-slate-500">{t('mcp.activeCount', { count: activeCount })}</span>
                {hasRevoked ? (
                  <button
                    type="button"
                    aria-pressed={showRevoked}
                    onClick={() => setShowRevoked((visible) => !visible)}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {showRevoked ? t('mcp.hideRevoked') : t('mcp.showRevoked')}
                  </button>
                ) : null}
              </div>
            </div>
            {tokens.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">{t('mcp.noConnections')}</p>
            ) : visibleTokens.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">{t('mcp.revokedHiddenEmpty')}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {visibleTokens.map((token) => {
                  const revoked = Boolean(token.revoked_at);
                  const expired = !revoked
                    && Boolean(token.expires_at)
                    && currentTime > 0
                    && new Date(token.expires_at).getTime() <= currentTime;
                  const status = revoked ? t('mcp.statusRevoked') : expired ? t('mcp.statusExpired') : t('mcp.statusActive');
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
                        <p className="mt-1 break-words text-xs text-slate-500">
                          {t('mcp.scopeValue', { scopes: token.scopes.join(', ') })} · {t('mcp.createdAt', { date: formatDate(token.created_at, { dateStyle: 'medium', timeStyle: 'short' }) })}
                        </p>
                        <p className="mt-1 break-words text-xs text-slate-400">
                          {token.last_used_at
                            ? t('mcp.lastUsedAt', { date: formatDate(token.last_used_at, { dateStyle: 'medium', timeStyle: 'short' }) })
                            : t('mcp.neverUsed')}
                          {token.revoked_at ? ` · ${t('mcp.revokedAt', { date: formatDate(token.revoked_at, { dateStyle: 'medium', timeStyle: 'short' }) })}` : ''}
                          {token.expires_at ? ` · ${t('mcp.expiresAt', { date: formatDate(token.expires_at, { dateStyle: 'medium', timeStyle: 'short' }) })}` : ''}
                        </p>
                      </div>
                      {!revoked ? (
                        <form
                          action={async (formData) => {
                            setError(null);
                            try {
                              await revokeMcpAccessToken(formData);
                              setRawToken((current) => current?.id === token.id ? null : current);
                              router.refresh();
                            } catch {
                              setError(t('mcp.revokeError'));
                            }
                          }}
                        >
                          <input type="hidden" name="token_id" value={token.id} />
                          <ConfirmDeleteButton
                            label={t('mcp.revoke')}
                            confirmMessage={t('mcp.revokeConfirm', { label: token.label })}
                            className="min-h-11 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </form>
                      ) : (
                        <form
                          action={async (formData) => {
                            setError(null);
                            try {
                              await deleteRevokedMcpAccessToken(formData);
                              router.refresh();
                            } catch {
                              setError(t('mcp.deleteError'));
                            }
                          }}
                        >
                          <input type="hidden" name="token_id" value={token.id} />
                          <ConfirmDeleteButton
                            label={t('mcp.deletePermanently')}
                            confirmMessage={t('mcp.deletePermanentlyConfirm', { label: token.label })}
                            className="min-h-11 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
