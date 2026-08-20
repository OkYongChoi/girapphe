import assert from 'node:assert/strict';
import test from 'node:test';
import {
  collectOpsSnapshot,
  isPooledConnectionUrl,
  normalizeCloudflareRows,
  parseOpsRange,
} from './metrics';

test('normalizes Cloudflare rows into selected-range request buckets', () => {
  const metrics = normalizeCloudflareRows([
    { dimensions: { datetime: '2026-08-20T10:03:00.000Z' }, sum: { requests: 20, errors: 1 }, quantiles: { cpuTimeP99: 9 } },
    { dimensions: { datetime: '2026-08-20T10:44:00.000Z' }, sum: { requests: 30, errors: 2 }, quantiles: { cpuTimeP99: 12 } },
    { dimensions: { datetime: '2026-08-20T11:02:00.000Z' }, sum: { requests: 50, errors: 0 }, quantiles: { cpuTimeP99: 7 } },
    { dimensions: { datetime: 'invalid' }, sum: { requests: 99, errors: 99 } },
  ], '24h');

  assert.equal(metrics.requests, 100);
  assert.equal(metrics.errors, 3);
  assert.equal(metrics.errorRate, 0.03);
  assert.equal(metrics.peakCpuP99Ms, 12);
  assert.deepEqual(metrics.requestTrend, [
    { at: '2026-08-20T10:00:00.000Z', value: 50 },
    { at: '2026-08-20T11:00:00.000Z', value: 50 },
  ]);
  assert.equal(parseOpsRange('unknown'), '7d');
});

test('recognizes Neon pooled URLs without relying on endpoint metadata', () => {
  assert.equal(isPooledConnectionUrl('postgres://user:password@ep-blue-bird-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require'), true);
  assert.equal(isPooledConnectionUrl('postgres://user:password@ep-blue-bird-123.us-east-2.aws.neon.tech/neondb?sslmode=require'), false);
  assert.equal(isPooledConnectionUrl(undefined), null);
});

test('collects configured provider signals without exposing credentials', async () => {
  const cloudflareToken = 'cloudflare-token-must-not-appear';
  const neonToken = 'neon-token-must-not-appear';
  const clerkToken = 'clerk-token-must-not-appear';
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('cloudflare.com/client/v4/graphql')) {
      const cloudflareBody = {
        data: {
          viewer: {
            accounts: [{ workersInvocationsAdaptive: [
              { dimensions: { datetime: '2026-08-20T00:00:00.000Z' }, sum: { requests: 100, errors: 1 }, quantiles: { cpuTimeP99: 8 } },
            ] }],
          },
        },
      };
      return new Response(JSON.stringify(cloudflareBody), { status: 200 });
    }
    if (url.includes('api.clerk.com')) {
      return new Response(JSON.stringify({ total_count: url.includes('last_sign_in_at_after') ? 4 : 20 }), { status: 200 });
    }
    if (url.endsWith('/projects/project_123')) {
      return new Response(JSON.stringify({ project: { org_id: 'org_123' } }), { status: 200 });
    }
    if (url.endsWith('/projects/project_123/endpoints')) {
      return new Response(JSON.stringify({ endpoints: [{ branch_id: 'branch_123', autoscaling_limit_min_cu: 0.25, autoscaling_limit_max_cu: 2, current_state: 'active' }] }), { status: 200 });
    }
    if (url.includes('consumption_history')) return new Response('{}', { status: 403 });
    throw new Error(`Unexpected provider request: ${url}`);
  };

  const snapshot = await collectOpsSnapshot('7d', {
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    env: {
      CLOUDFLARE_ACCOUNT_ID: 'account_123',
      CLOUDFLARE_ANALYTICS_API_TOKEN: cloudflareToken,
      CLERK_SECRET_KEY: clerkToken,
      DATABASE_URL: 'postgres://user:password@ep-blue-bird-123-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require',
      NEON_API_KEY: neonToken,
      NEON_PROJECT_ID: 'project_123',
      NEON_BRANCH_ID: 'branch_123',
    },
    fetch: fetcher,
    query: async <T>() => ({ rows: [{ database_bytes: 1024, active_sessions: 10, max_connections: 100 } as T] }),
  });

  assert.equal(snapshot.cloudflare.state, 'attention');
  assert.equal(snapshot.clerk.signedInUsers, 4);
  assert.equal(snapshot.neon.state, 'healthy');
  assert.equal(snapshot.neon.consumptionState, 'plan_required');
  assert.equal(snapshot.neon.pooledConnection, true);
  assert.deepEqual(snapshot.actions.map((action) => action.id), ['review_error_rate']);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, new RegExp(cloudflareToken));
  assert.doesNotMatch(serialized, new RegExp(neonToken));
  assert.doesNotMatch(serialized, new RegExp(clerkToken));
});

test('treats partial provider availability as attention rather than headroom', async () => {
  const snapshot = await collectOpsSnapshot('24h', {
    now: () => new Date('2026-08-20T12:00:00.000Z'),
    env: { CLERK_SECRET_KEY: 'clerk-token' },
    fetch: async (input) => {
      assert.match(String(input), /api\.clerk\.com/);
      return new Response(JSON.stringify({ total_count: 3 }), { status: 200 });
    },
    query: async <T>() => ({ rows: [] as T[] }),
  });

  assert.equal(snapshot.clerk.state, 'healthy');
  assert.equal(snapshot.state, 'attention');
});
