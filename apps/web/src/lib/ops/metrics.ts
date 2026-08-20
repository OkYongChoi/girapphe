import 'server-only';

import { unstable_cache } from 'next/cache';
import resourceLimits from '../../../../../config/resource-limits.json';
import db from '@/lib/db';

export const OPS_RANGES = ['24h', '7d', '30d'] as const;
export type OpsRange = typeof OPS_RANGES[number];
export type SourceState = 'healthy' | 'attention' | 'unavailable';
export type SourceReason = 'not_configured' | 'unauthorized' | 'plan_required' | 'timeout' | 'invalid_response' | 'provider_error';

export type TrendPoint = {
  at: string;
  value: number;
};

type ProviderSnapshot = {
  state: SourceState;
  fetchedAt: string;
  source: string;
  reason?: SourceReason;
};

export type CloudflareSnapshot = ProviderSnapshot & {
  requests: number | null;
  errors: number | null;
  errorRate: number | null;
  peakCpuP99Ms: number | null;
  requestTrend: TrendPoint[];
  workerBundleBudgetKiB: number;
};

export type ClerkSnapshot = ProviderSnapshot & {
  totalUsers: number | null;
  signedInUsers: number | null;
  mru: null;
};

export type NeonSnapshot = ProviderSnapshot & {
  databaseBytes: number | null;
  activeSessions: number | null;
  maxConnections: number | null;
  sessionUtilization: number | null;
  queryLatencyMs: number | null;
  pooledConnection: boolean | null;
  minCu: number | null;
  maxCu: number | null;
  computeState: string | null;
  consumptionState: 'available' | 'plan_required' | 'unavailable';
  consumptionTrend: TrendPoint[];
};

export type OpsAction = {
  id: 'connect_cloudflare' | 'verify_clerk' | 'connect_neon' | 'enable_pooling' | 'review_sessions' | 'review_error_rate';
  provider: 'cloudflare' | 'clerk' | 'neon';
  state: Exclude<SourceState, 'healthy'>;
};

export type OpsSnapshot = {
  range: OpsRange;
  generatedAt: string;
  state: SourceState;
  cloudflare: CloudflareSnapshot;
  clerk: ClerkSnapshot;
  neon: NeonSnapshot;
  actions: OpsAction[];
};


type SqlQuery = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;

type OpsDependencies = {
  env: Record<string, string | undefined>;
  fetch: typeof fetch;
  query: SqlQuery;
  now: () => Date;
};

type UnknownRecord = Record<string, unknown>;

const CLOUDFLARE_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const NEON_API_URL = 'https://console.neon.tech/api/v2';
const CLERK_COUNT_URL = 'https://api.clerk.com/v1/users/count';
const REQUEST_TIMEOUT_MS = 9_000;
const ERROR_RATE_ATTENTION_THRESHOLD = 0.01;
const SESSION_ATTENTION_THRESHOLD = 0.7;

const defaultDependencies: OpsDependencies = {
  env: process.env,
  fetch,
  query: db.query,
  now: () => new Date(),
};

export function parseOpsRange(value: string | undefined): OpsRange {
  return OPS_RANGES.includes(value as OpsRange) ? value as OpsRange : '7d';
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function clerkCount(value: unknown): number | null {
  if (typeof value === 'number') return asNumber(value);
  if (!isRecord(value)) return null;
  return asNumber(value.total_count) ?? asNumber(value.count);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function unavailable(source: string, reason: SourceReason, now: Date): ProviderSnapshot {
  return { state: 'unavailable', fetchedAt: now.toISOString(), source, reason };
}

class ProviderError extends Error {
  constructor(readonly reason: SourceReason) {
    super(reason);
  }
}

function reasonFor(error: unknown): SourceReason {
  if (error instanceof ProviderError) return error.reason;
  if (error instanceof DOMException && error.name === 'AbortError') return 'timeout';
  return 'provider_error';
}

function rangeDates(range: OpsRange, now: Date) {
  const hours = range === '24h' ? 24 : range === '7d' ? 7 * 24 : 30 * 24;
  return { start: new Date(now.getTime() - hours * 60 * 60 * 1000), end: new Date(now) };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new ProviderError('timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchJson(fetcher: typeof fetch, url: string, init: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, { ...init, signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderError('invalid_response');
    }
    return { status: response.status, body };
  } finally {
    clearTimeout(timer);
  }
}

function bucketDate(at: string, range: OpsRange): string | null {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return null;
  if (range === '24h') date.setUTCMinutes(0, 0, 0);
  else date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export function normalizeCloudflareRows(rows: unknown[], range: OpsRange) {
  const buckets = new Map<string, { requests: number; errors: number; cpuP99: number | null }>();
  let requests = 0;
  let errors = 0;
  let peakCpuP99Ms: number | null = null;

  for (const row of rows) {
    if (!isRecord(row)) continue;
    const dimensions = isRecord(row.dimensions) ? row.dimensions : {};
    const sum = isRecord(row.sum) ? row.sum : {};
    const quantiles = isRecord(row.quantiles) ? row.quantiles : {};
    const at = asString(dimensions.datetime);
    const requestCount = asNumber(sum.requests);
    const errorCount = asNumber(sum.errors);
    if (!at || requestCount === null || errorCount === null) continue;
    const key = bucketDate(at, range);
    if (!key) continue;

    const current = buckets.get(key) ?? { requests: 0, errors: 0, cpuP99: null };
    const cpuP99 = asNumber(quantiles.cpuTimeP99);
    current.requests += requestCount;
    current.errors += errorCount;
    current.cpuP99 = cpuP99 === null ? current.cpuP99 : Math.max(current.cpuP99 ?? 0, cpuP99);
    buckets.set(key, current);
    requests += requestCount;
    errors += errorCount;
    peakCpuP99Ms = cpuP99 === null ? peakCpuP99Ms : Math.max(peakCpuP99Ms ?? 0, cpuP99);
  }

  return {
    requests,
    errors,
    errorRate: requests > 0 ? errors / requests : null,
    peakCpuP99Ms,
    requestTrend: [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([at, value]) => ({ at, value: value.requests })),
  };
}

async function collectCloudflare(range: OpsRange, deps: OpsDependencies): Promise<CloudflareSnapshot> {
  const source = 'Cloudflare GraphQL Analytics';
  const now = deps.now();
  const empty = {
    requests: null,
    errors: null,
    errorRate: null,
    peakCpuP99Ms: null,
    requestTrend: [],
    workerBundleBudgetKiB: resourceLimits.worker.compressedKiB,
  };
  const accountId = deps.env.CLOUDFLARE_ACCOUNT_ID;
  const token = deps.env.CLOUDFLARE_ANALYTICS_API_TOKEN;
  if (!accountId || !token) return { ...unavailable(source, 'not_configured', now), ...empty };

  try {
    const dates = rangeDates(range, now);
    const query = [
      'query GetWorkersAnalytics($accountTag: string, $datetimeStart: string, $datetimeEnd: string, $scriptName: string) {',
      'viewer { accounts(filter: { accountTag: $accountTag }) {',
      'workersInvocationsAdaptive(limit: 1000, filter: { scriptName: $scriptName, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) {',
      'sum { requests errors } quantiles { cpuTimeP99 } dimensions { datetime }',
      '} } } }',
    ].join(' ');
    const response = await fetchJson(deps.fetch, CLOUDFLARE_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: accountId,
          datetimeStart: dates.start.toISOString(),
          datetimeEnd: dates.end.toISOString(),
          scriptName: 'girapphe',
        },
      }),
    });
    if (response.status === 401 || response.status === 403) throw new ProviderError('unauthorized');
    if (response.status < 200 || response.status >= 300) throw new ProviderError('provider_error');

    const root = isRecord(response.body) ? response.body : null;
    const data = root && isRecord(root.data) ? root.data : null;
    const viewer = data && isRecord(data.viewer) ? data.viewer : null;
    const account = viewer ? asArray(viewer.accounts)[0] : null;
    if (!root || asArray(root.errors).length > 0 || !isRecord(account)) throw new ProviderError('invalid_response');

    const metrics = normalizeCloudflareRows(asArray(account.workersInvocationsAdaptive), range);
    return {
      state: metrics.errorRate !== null && metrics.errorRate >= ERROR_RATE_ATTENTION_THRESHOLD ? 'attention' : 'healthy',
      fetchedAt: now.toISOString(),
      source,
      ...metrics,
      workerBundleBudgetKiB: resourceLimits.worker.compressedKiB,
    };
  } catch (error) {
    return { ...unavailable(source, reasonFor(error), now), ...empty };
  }
}

async function collectClerk(range: OpsRange, deps: OpsDependencies): Promise<ClerkSnapshot> {
  const source = 'Clerk Backend API';
  const now = deps.now();
  const empty = { totalUsers: null, signedInUsers: null, mru: null };
  if (!deps.env.CLERK_SECRET_KEY) return { ...unavailable(source, 'not_configured', now), ...empty };

  try {
    const dates = rangeDates(range, now);
    const headers = {
      Authorization: `Bearer ${deps.env.CLERK_SECRET_KEY}`,
      Accept: 'application/json',
    };
    const signedInUrl = new URL(CLERK_COUNT_URL);
    signedInUrl.searchParams.set('last_sign_in_at_after', String(dates.start.getTime()));
    signedInUrl.searchParams.set('last_sign_in_at_before', String(dates.end.getTime()));
    const [totalResponse, signedInResponse] = await withTimeout(Promise.all([
      fetchJson(deps.fetch, CLERK_COUNT_URL, { headers }),
      fetchJson(deps.fetch, signedInUrl.toString(), { headers }),
    ]));
    for (const response of [totalResponse, signedInResponse]) {
      if (response.status === 401 || response.status === 403) throw new ProviderError('unauthorized');
      if (response.status < 200 || response.status >= 300) throw new ProviderError('provider_error');
    }
    const totalUsers = clerkCount(totalResponse.body);
    const signedInUsers = clerkCount(signedInResponse.body);
    if (totalUsers === null || signedInUsers === null) throw new ProviderError('invalid_response');
    return { state: 'healthy', fetchedAt: now.toISOString(), source, totalUsers, signedInUsers, mru: null };
  } catch (error) {
    return { ...unavailable(source, reasonFor(error), now), ...empty };
  }
}

export function isPooledConnectionUrl(databaseUrl: string | undefined): boolean | null {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname.split('.')[0]?.endsWith('-pooler') ?? false;
  } catch {
    return null;
  }
}

function readNeonConsumption(body: unknown, projectId: string): TrendPoint[] {
  const root = isRecord(body) ? body : null;
  const project = root
    ? asArray(root.projects).find((item) => isRecord(item) && item.project_id === projectId)
    : null;
  if (!isRecord(project)) return [];

  const points: TrendPoint[] = [];
  for (const period of asArray(project.periods)) {
    if (!isRecord(period)) continue;
    for (const consumption of asArray(period.consumption)) {
      if (!isRecord(consumption)) continue;
      const at = asString(consumption.timeframe_start);
      const metric = asArray(consumption.metrics).find((item) => isRecord(item) && item.metric_name === 'compute_unit_seconds');
      const value = isRecord(metric) ? asNumber(metric.value) : null;
      if (at && value !== null) points.push({ at, value });
    }
  }
  return points.sort((left, right) => left.at.localeCompare(right.at));
}

async function collectNeon(range: OpsRange, deps: OpsDependencies): Promise<NeonSnapshot> {
  const source = 'Neon SQL and Control Plane API';
  const now = deps.now();
  const empty: Omit<NeonSnapshot, keyof ProviderSnapshot> = {
    databaseBytes: null,
    activeSessions: null,
    maxConnections: null,
    sessionUtilization: null,
    queryLatencyMs: null,
    pooledConnection: isPooledConnectionUrl(deps.env.DATABASE_URL),
    minCu: null,
    maxCu: null,
    computeState: null,
    consumptionState: 'unavailable',
    consumptionTrend: [],
  };
  let sqlMetrics = { databaseBytes: null as number | null, activeSessions: null as number | null, maxConnections: null as number | null, queryLatencyMs: null as number | null };

  if (deps.env.DATABASE_URL) {
    try {
      const startedAt = Date.now();
      const result = await withTimeout(deps.query<{
        database_bytes: unknown;
        active_sessions: unknown;
        max_connections: unknown;
      }>([
        'SELECT pg_database_size(current_database()) AS database_bytes,',
        "(SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database() AND state <> 'idle') AS active_sessions,",
        "current_setting('max_connections')::int AS max_connections",
      ].join(' ')));
      const row = result.rows[0];
      sqlMetrics = {
        databaseBytes: row ? asNumber(row.database_bytes) : null,
        activeSessions: row ? asNumber(row.active_sessions) : null,
        maxConnections: row ? asNumber(row.max_connections) : null,
        queryLatencyMs: Date.now() - startedAt,
      };
    } catch {
      // A control-plane response remains useful when the database read is temporarily unavailable.
    }
  }

  const sessionUtilization = sqlMetrics.activeSessions !== null && sqlMetrics.maxConnections && sqlMetrics.maxConnections > 0
    ? sqlMetrics.activeSessions / sqlMetrics.maxConnections
    : null;
  const sqlAvailable = sqlMetrics.databaseBytes !== null || sqlMetrics.activeSessions !== null;
  const apiKey = deps.env.NEON_API_KEY;
  const projectId = deps.env.NEON_PROJECT_ID;
  const branchId = deps.env.NEON_BRANCH_ID;
  if (!apiKey || !projectId || !branchId) {
    return {
      state: sqlAvailable ? 'attention' : 'unavailable',
      fetchedAt: now.toISOString(),
      source,
      reason: 'not_configured',
      ...empty,
      ...sqlMetrics,
      sessionUtilization,
    };
  }

  try {
    const headers = { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' };
    const [projectResponse, endpointsResponse] = await Promise.all([
      fetchJson(deps.fetch, NEON_API_URL + '/projects/' + encodeURIComponent(projectId), { headers }),
      fetchJson(deps.fetch, NEON_API_URL + '/projects/' + encodeURIComponent(projectId) + '/endpoints', { headers }),
    ]);
    if ([projectResponse.status, endpointsResponse.status].some((status) => status === 401 || status === 403)) throw new ProviderError('unauthorized');
    if ([projectResponse.status, endpointsResponse.status].some((status) => status < 200 || status >= 300)) throw new ProviderError('provider_error');

    const projectRoot = isRecord(projectResponse.body) ? projectResponse.body : null;
    const project = projectRoot && isRecord(projectRoot.project) ? projectRoot.project : projectRoot;
    const endpointsRoot = isRecord(endpointsResponse.body) ? endpointsResponse.body : null;
    const endpoint = endpointsRoot
      ? asArray(endpointsRoot.endpoints).find((item) => isRecord(item) && item.branch_id === branchId)
      : null;
    if (!isRecord(project) || !isRecord(endpoint)) throw new ProviderError('invalid_response');

    let consumptionState: NeonSnapshot['consumptionState'] = 'unavailable';
    let consumptionTrend: TrendPoint[] = [];
    const orgId = asString(project.org_id);
    if (orgId) {
      const dates = rangeDates(range, now);
      const params = new URLSearchParams({
        project_ids: projectId,
        org_id: orgId,
        from: dates.start.toISOString(),
        to: dates.end.toISOString(),
        granularity: range === '30d' ? 'daily' : 'hourly',
        metrics: 'compute_unit_seconds',
      });
      const consumptionResponse = await fetchJson(
        deps.fetch,
        NEON_API_URL + '/consumption_history/v2/projects?' + params.toString(),
        { headers },
      );
      if (consumptionResponse.status === 403) consumptionState = 'plan_required';
      else if (consumptionResponse.status >= 200 && consumptionResponse.status < 300) {
        consumptionState = 'available';
        consumptionTrend = readNeonConsumption(consumptionResponse.body, projectId);
      }
    }

    const pooledConnection = isPooledConnectionUrl(deps.env.DATABASE_URL);
    const state = sessionUtilization !== null && sessionUtilization >= SESSION_ATTENTION_THRESHOLD || pooledConnection === false
      ? 'attention'
      : 'healthy';
    return {
      state,
      fetchedAt: now.toISOString(),
      source,
      ...empty,
      ...sqlMetrics,
      sessionUtilization,
      pooledConnection,
      minCu: asNumber(endpoint.autoscaling_limit_min_cu),
      maxCu: asNumber(endpoint.autoscaling_limit_max_cu),
      computeState: asString(endpoint.current_state),
      consumptionState,
      consumptionTrend,
    };
  } catch (error) {
    return {
      state: sqlAvailable ? 'attention' : 'unavailable',
      fetchedAt: now.toISOString(),
      source,
      reason: reasonFor(error),
      ...empty,
      ...sqlMetrics,
      sessionUtilization,
    };
  }
}

export function deriveActions(cloudflare: CloudflareSnapshot, clerk: ClerkSnapshot, neon: NeonSnapshot): OpsAction[] {
  const actions: OpsAction[] = [];
  if (cloudflare.reason === 'not_configured') actions.push({ id: 'connect_cloudflare', provider: 'cloudflare', state: 'unavailable' });
  else if (cloudflare.errorRate !== null && cloudflare.errorRate >= ERROR_RATE_ATTENTION_THRESHOLD) actions.push({ id: 'review_error_rate', provider: 'cloudflare', state: 'attention' });
  if (clerk.state === 'unavailable') actions.push({ id: 'verify_clerk', provider: 'clerk', state: 'unavailable' });
  if (neon.reason === 'not_configured') actions.push({ id: 'connect_neon', provider: 'neon', state: 'unavailable' });
  if (neon.pooledConnection === false) actions.push({ id: 'enable_pooling', provider: 'neon', state: 'attention' });
  if (neon.sessionUtilization !== null && neon.sessionUtilization >= SESSION_ATTENTION_THRESHOLD) actions.push({ id: 'review_sessions', provider: 'neon', state: 'attention' });
  return actions;
}

export async function collectOpsSnapshot(range: OpsRange, overrides: Partial<OpsDependencies> = {}): Promise<OpsSnapshot> {
  const deps = { ...defaultDependencies, ...overrides };
  const [cloudflare, clerk, neon] = await Promise.all([
    collectCloudflare(range, deps),
    collectClerk(range, deps),
    collectNeon(range, deps),
  ]);
  const states = [cloudflare.state, clerk.state, neon.state];
  const state: SourceState = states.every((value) => value === 'unavailable')
    ? 'unavailable'
    : states.includes('attention') || states.includes('unavailable')
      ? 'attention'
      : 'healthy';
  return {
    range,
    generatedAt: deps.now().toISOString(),
    state,
    cloudflare,
    clerk,
    neon,
    actions: deriveActions(cloudflare, clerk, neon),
  };
}

const getCachedOpsSnapshot = unstable_cache(
  async (range: OpsRange) => collectOpsSnapshot(range),
  ['ops-capacity-snapshot'],
  { revalidate: 300 },
);

export function getOpsSnapshot(range: OpsRange): Promise<OpsSnapshot> {
  return getCachedOpsSnapshot(range);
}
