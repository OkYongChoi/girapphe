import { readBoundedBytes } from '@/lib/billing/bounded-json';

export type PlanBodyResult =
  | { ok: true; plan: 'annual' }
  | { ok: false; reason: 'too_large' | 'monthly' | 'invalid' };

export async function readAnnualPlan(request: Request): Promise<PlanBodyResult> {
  const contentType = request.headers.get('content-type') ?? '';
  const body = await readBoundedBytes(request, 4_096);
  if (!body.ok) return { ok: false, reason: body.reason === 'too_large' ? 'too_large' : 'invalid' };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(body.value);
  } catch {
    return { ok: false, reason: 'invalid' };
  }

  let plan: unknown;
  if (contentType.includes('application/json')) {
    try {
      const payload: unknown = JSON.parse(text);
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, reason: 'invalid' };
      }
      const entries = Object.entries(payload);
      if (entries.length !== 1 || entries[0]?.[0] !== 'plan') {
        return { ok: false, reason: 'invalid' };
      }
      plan = entries[0][1];
    } catch {
      return { ok: false, reason: 'invalid' };
    }
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams(text);
    const entries = [...params.entries()];
    if (entries.length !== 1 || entries[0]?.[0] !== 'plan') {
      return { ok: false, reason: 'invalid' };
    }
    plan = entries[0][1];
  } else {
    return { ok: false, reason: 'invalid' };
  }

  if (plan === 'annual') return { ok: true, plan };
  return { ok: false, reason: plan === 'monthly' ? 'monthly' : 'invalid' };
}
