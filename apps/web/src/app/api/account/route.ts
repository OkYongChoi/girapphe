import { NextResponse } from 'next/server';
import { auth, reverificationErrorResponse } from '@clerk/nextjs/server';
import { AccountDeletionError, deleteGirappheAccount } from '@/lib/account-deletion';
import { requestHasTrustedOrigin } from '@/lib/billing/stripe';
import { hasValidClerkConfig } from '@/lib/clerk-env';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  if (request.headers.get('origin') && !requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.', code: 'INVALID_ORIGIN' }, { status: 403 });
  }
  if (!hasValidClerkConfig()) {
    return NextResponse.json({ error: 'Sign in is required.', code: 'AUTH_REQUIRED' }, { status: 401 });
  }
  const { userId, has } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Sign in is required.', code: 'AUTH_REQUIRED' }, { status: 401 });
  }
  if (!has({ reverification: 'strict' })) return reverificationErrorResponse('strict');

  try {
    await deleteGirappheAccount(userId);
    return NextResponse.json(
      { deleted: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    console.error('Account deletion failed:', error);
    const code = error instanceof AccountDeletionError ? error.code : 'DELETION_FAILED';
    return NextResponse.json(
      { error: 'The account could not be deleted safely. Try again or open Support.', code },
      { status: code === 'ADMIN_ACCOUNT' ? 403 : 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
