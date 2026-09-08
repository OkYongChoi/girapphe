import { getCurrentUser } from '@/lib/auth';
import { requireBillingEntitlementState } from '@/lib/billing/database';
import { isCreemAcquisitionEnabled } from '@/lib/billing/creem';
import { isSuperwallAcquisitionEnabled } from '@/lib/billing/superwall';
import {
  authenticationRequiredEntitlementResponse,
  readEntitlementResponse,
} from '@/lib/billing/entitlement-response';
import { EXPECTED_BILLING_SUBJECT_HEADER } from '@/lib/billing/request-security';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return authenticationRequiredEntitlementResponse();
  const expectedSubject = request.headers.get(EXPECTED_BILLING_SUBJECT_HEADER)?.trim();
  if (expectedSubject && expectedSubject !== user.id) {
    return Response.json(
      { error: 'billing_subject_changed' },
      {
        status: 409,
        headers: {
          'Cache-Control': 'private, no-store',
          Vary: 'Cookie, Authorization',
          'X-Girapphe-Billing-Subject': user.id,
        },
      },
    );
  }

  const response = await readEntitlementResponse(async () => ({
    ...await requireBillingEntitlementState(user.id),
    acquisitionEnabled: {
      web: isCreemAcquisitionEnabled(),
      mobile: isSuperwallAcquisitionEnabled(),
    },
  }));
  response.headers.set('X-Girapphe-Billing-Subject', user.id);
  return response;
}
