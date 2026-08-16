import { processDueTossBilling } from '@/lib/billing/toss-subscriptions';

export const dynamic = 'force-dynamic';

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function safeSecretEqual(received: string, expected: string) {
  const [left, right] = await Promise.all([digest(received), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function POST(request: Request) {
  const expected = process.env.TOSS_BILLING_CRON_TOKEN?.trim() ?? '';
  const authorization = request.headers.get('authorization') ?? '';
  const received = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? '';
  if (!expected || !received || !(await safeSecretEqual(received, expected))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) return Response.json({ error: 'billing_unavailable' }, { status: 503 });

  try {
    const result = await processDueTossBilling();
    return Response.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'billing_run_failed' }, { status: 503 });
  }
}
