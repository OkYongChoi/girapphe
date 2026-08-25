import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { AccountDeletionError, deleteGirappheAccount } from '@/lib/account-deletion';
import { requestHasTrustedOrigin } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  if (request.headers.get('origin') && !requestHasTrustedOrigin(request)) {
    return NextResponse.json({ error: 'Invalid request origin.', code: 'INVALID_ORIGIN' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in is required.', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  try {
    await deleteGirappheAccount(user.id);
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
