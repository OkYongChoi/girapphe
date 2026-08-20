import { localizePathname } from '@stem-brain/shared';
import { getServerI18n } from '@/i18n/server';
import {
  getOpsSnapshot,
  OPS_RANGES,
  parseOpsRange,
  type OpsAction,
  type OpsRange,
  type SourceState,
  type TrendPoint,
} from '@/lib/ops/metrics';

export const dynamic = 'force-dynamic';

const RANGE_LABELS: Record<OpsRange, string> = {
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
};

function statusLabel(state: SourceState) {
  if (state === 'healthy') return 'Healthy';
  if (state === 'attention') return 'Attention';
  return 'Unavailable';
}

function statusStyle(state: SourceState) {
  if (state === 'healthy') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
  if (state === 'attention') return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
  return 'border-slate-600 bg-slate-800/70 text-slate-300';
}

function formatBytes(value: number | null, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string) {
  if (value === null) return 'Not connected';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${formatNumber(size, { maximumFractionDigits: unit > 1 ? 1 : 0 })} ${units[unit]}`;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0 border-l border-slate-700/70 px-4 first:border-l-0 first:ps-0">
      <dt className="text-[11px] font-medium uppercase tracking-[0.13em] text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-100">{value}</dd>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function Trend({ points, color, label }: { points: TrendPoint[]; color: 'cyan' | 'amber' | 'emerald'; label: string }) {
  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(max - min, 1);
  const path = points.length > 1
    ? points.map((point, index) => {
      const x = (index / (points.length - 1)) * 100;
      const y = 30 - ((point.value - min) / span) * 26;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ')
    : '';
  const colors = {
    cyan: 'stroke-cyan-300 fill-cyan-400/10',
    amber: 'stroke-amber-300 fill-amber-400/10',
    emerald: 'stroke-emerald-300 fill-emerald-400/10',
  }[color];

  return (
    <figure className="mt-7 border-t border-slate-800 pt-4" aria-label={label}>
      <figcaption className="mb-2 text-[11px] font-medium uppercase tracking-[0.13em] text-slate-500">{label}</figcaption>
      {points.length > 1 ? (
        <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-16 w-full overflow-visible" role="img">
          <path d={`M0,32 ${path} L100,32 Z`} className={colors.split(' ')[1]} />
          <path d={path} vectorEffect="non-scaling-stroke" className={`fill-none stroke-[1.5] ${colors.split(' ')[0]}`} />
        </svg>
      ) : (
        <div className="flex h-16 items-center justify-center border border-dashed border-slate-700 text-xs text-slate-500">
          No trend data for this range
        </div>
      )}
    </figure>
  );
}

function ConsoleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="text-xs font-semibold text-slate-300 underline decoration-slate-600 underline-offset-4 transition hover:text-white" href={href} target="_blank" rel="noreferrer">{children}</a>;
}

function actionLabel(action: OpsAction) {
  const labels: Record<OpsAction['id'], string> = {
    connect_cloudflare: 'Connect Cloudflare Analytics',
    review_error_rate: 'Review Worker errors',
    verify_clerk: 'Verify Clerk access',
    connect_neon: 'Connect Neon control-plane access',
    enable_pooling: 'Enable Neon pooled connections',
    review_sessions: 'Review database sessions',
  };
  return labels[action.id];
}

export default async function OpsPage({ searchParams }: { searchParams: Promise<{ range?: string | string[] }> }) {
  const params = await searchParams;
  const range = parseOpsRange(typeof params.range === 'string' ? params.range : undefined);
  const snapshot = await getOpsSnapshot(range);
  const { formatDate, formatNumber, locale } = await getServerI18n();
  const allHealthy = snapshot.state === 'healthy';
  const headroom = allHealthy ? 'Operating headroom' : snapshot.state === 'attention' ? 'Attention required' : 'Metrics unavailable';
  const route = localizePathname('/admin/ops', locale);
  const rangeHref = (nextRange: OpsRange) => `${route}?range=${nextRange}`;
  const stateReason = (reason: string | undefined) => reason ? reason.replaceAll('_', ' ') : 'No current signal';

  return (
    <section className="pb-8" aria-labelledby="capacity-title">
      <div className="border-b border-slate-800 pb-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Operations</p>
            <h1 id="capacity-title" className="mt-2 text-3xl font-semibold tracking-tight text-white">Resource capacity</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Provider-backed operating signals for the Worker, identity, and database layers. This dashboard reports headroom; it does not guess a room count before load calibration.</p>
          </div>
          <div className="flex w-full rounded-lg border border-slate-700 bg-slate-900/70 p-1 sm:w-auto" aria-label="Capacity range">
            {OPS_RANGES.map((candidate) => (
              <a key={candidate} href={rangeHref(candidate)} aria-current={candidate === range ? 'page' : undefined} className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition sm:flex-none ${candidate === range ? 'bg-slate-100 text-slate-950 shadow-sm' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                {RANGE_LABELS[candidate]}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 border-b border-slate-800 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-2.5 w-2.5 rounded-full ${snapshot.state === 'healthy' ? 'bg-emerald-300' : snapshot.state === 'attention' ? 'bg-amber-300' : 'bg-slate-500'}`} />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-slate-400">Current operating headroom</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{headroom}</p>
          </div>
        </div>
        <p className="text-xs text-slate-500">Updated {formatDate(snapshot.generatedAt, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · five minute cache</p>
      </div>

      <div className="divide-y divide-slate-800">
        <section className="py-8" aria-labelledby="cloudflare-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-48">
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
                <h2 id="cloudflare-heading" className="text-lg font-semibold text-cyan-100">Cloudflare</h2>
              </div>
              <p className="mt-2 text-sm text-slate-400">Worker traffic and runtime guardrails</p>
              <div className="mt-4 flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(snapshot.cloudflare.state)}`}>{statusLabel(snapshot.cloudflare.state)}</span><ConsoleLink href="https://dash.cloudflare.com/">Open console</ConsoleLink></div>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-y-6 sm:grid-cols-4">
              <Metric label="Requests" value={snapshot.cloudflare.requests === null ? 'Not connected' : formatNumber(snapshot.cloudflare.requests)} />
              <Metric label="Error rate" value={snapshot.cloudflare.errorRate === null ? 'Not connected' : formatNumber(snapshot.cloudflare.errorRate, { style: 'percent', maximumFractionDigits: 2 })} />
              <Metric label="Peak CPU p99" value={snapshot.cloudflare.peakCpuP99Ms === null ? 'Not connected' : `${formatNumber(snapshot.cloudflare.peakCpuP99Ms, { maximumFractionDigits: 1 })} ms`} />
              <Metric label="Worker bundle" value={`${formatNumber(snapshot.cloudflare.workerBundleBudgetKiB)} KiB`} detail="shared compressed limit" />
            </dl>
          </div>
          {snapshot.cloudflare.state === 'unavailable' ? <p className="mt-6 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">Cloudflare signal is unavailable: {stateReason(snapshot.cloudflare.reason)}.</p> : <Trend points={snapshot.cloudflare.requestTrend} color="cyan" label="Requests: current versus prior range" />}
        </section>

        <section className="py-8" aria-labelledby="clerk-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-48">
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-amber-300" /><h2 id="clerk-heading" className="text-lg font-semibold text-amber-100">Clerk</h2></div>
              <p className="mt-2 text-sm text-slate-400">Identity reach and recent sign-in activity</p>
              <div className="mt-4 flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(snapshot.clerk.state)}`}>{statusLabel(snapshot.clerk.state)}</span><ConsoleLink href="https://dashboard.clerk.com/">Open console</ConsoleLink></div>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-y-6 sm:grid-cols-3">
              <Metric label="Total users" value={snapshot.clerk.totalUsers === null ? 'Not connected' : formatNumber(snapshot.clerk.totalUsers)} />
              <Metric label="Signed in" value={snapshot.clerk.signedInUsers === null ? 'Not connected' : formatNumber(snapshot.clerk.signedInUsers)} detail={`within ${RANGE_LABELS[range]}`} />
              <Metric label="Monthly retained users (MRU)" value="Console metric" detail="review in Clerk dashboard" />
            </dl>
          </div>
          {snapshot.clerk.state === 'unavailable' ? <p className="mt-6 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">Clerk signal is unavailable: {stateReason(snapshot.clerk.reason)}.</p> : null}
        </section>

        <section className="py-8" aria-labelledby="neon-heading">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-48">
              <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-300" /><h2 id="neon-heading" className="text-lg font-semibold text-emerald-100">Neon</h2></div>
              <p className="mt-2 text-sm text-slate-400">Database capacity, connection safety, and compute use</p>
              <div className="mt-4 flex items-center gap-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle(snapshot.neon.state)}`}>{statusLabel(snapshot.neon.state)}</span><ConsoleLink href="https://console.neon.tech/">Open console</ConsoleLink></div>
            </div>
            <dl className="grid flex-1 grid-cols-2 gap-y-6 sm:grid-cols-4">
              <Metric label="Database size" value={formatBytes(snapshot.neon.databaseBytes, formatNumber)} />
              <Metric label="Database sessions" value={snapshot.neon.activeSessions === null || snapshot.neon.maxConnections === null ? 'Not connected' : `${formatNumber(snapshot.neon.activeSessions)} / ${formatNumber(snapshot.neon.maxConnections)}`} />
              <Metric label="Query latency" value={snapshot.neon.queryLatencyMs === null ? 'Not connected' : `${formatNumber(snapshot.neon.queryLatencyMs, { maximumFractionDigits: 1 })} ms`} />
              <Metric label="Pooling" value={snapshot.neon.pooledConnection === null ? 'Not connected' : snapshot.neon.pooledConnection ? 'Enabled' : 'Direct connection'} detail={snapshot.neon.computeState ?? undefined} />
            </dl>
          </div>
          {snapshot.neon.state === 'unavailable' ? <p className="mt-6 rounded-md border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-400">Neon signal is unavailable: {stateReason(snapshot.neon.reason)}.</p> : <Trend points={snapshot.neon.consumptionTrend} color="emerald" label={snapshot.neon.consumptionState === 'plan_required' ? 'Consumption history requires a Neon plan with metrics access' : 'Compute-unit consumption over selected range'} />}
        </section>
      </div>

      <section className="mt-8 border-t border-slate-800 pt-6" aria-labelledby="actions-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between"><h2 id="actions-heading" className="text-lg font-semibold text-slate-100">Recommended actions</h2><p className="text-sm text-slate-500">Calibrate room capacity from measured per-room load before expanding any plan.</p></div>
        <ul className="mt-4 divide-y divide-slate-800 rounded-lg border border-slate-800 bg-slate-900/35">
          {snapshot.actions.length > 0 ? snapshot.actions.map((action) => <li key={action.id} className="flex items-center justify-between gap-4 px-4 py-3"><span className="text-sm text-slate-200">{actionLabel(action)}</span><span className={`shrink-0 rounded-full border px-2 py-1 text-xs ${statusStyle(action.state)}`}>{statusLabel(action.state)}</span></li>) : <li className="px-4 py-3 text-sm text-slate-400">No action is currently indicated by the configured signals.</li>}
        </ul>
      </section>
    </section>
  );
}
