import { getCurrentUser } from '@/lib/auth';
import { hasAdFreeEntitlement } from '@/lib/billing/database';

export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      Vary: 'Authorization, Cookie',
    },
  });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: 'authentication_required' }, 401);

  try {
    return json({ isAdFree: await hasAdFreeEntitlement(user.id) });
  } catch (error) {
    console.error('Unable to read billing entitlement:', error);
    return json({ error: 'entitlement_unavailable' }, 503);
  }
}
