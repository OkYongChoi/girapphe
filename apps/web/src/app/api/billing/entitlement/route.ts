import { getCurrentUser } from '@/lib/auth';
import { requireAdFreeEntitlementStatus } from '@/lib/billing/database';
import {
  authenticationRequiredEntitlementResponse,
  readEntitlementResponse,
} from '@/lib/billing/entitlement-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return authenticationRequiredEntitlementResponse();

  return readEntitlementResponse(() => requireAdFreeEntitlementStatus(user.id));
}
