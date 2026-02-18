import { NextRequest, NextResponse } from 'next/server';
import { verifyEmailByToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const result = await verifyEmailByToken(token);

  if (!result.success) {
    return NextResponse.redirect(new URL('/login?error=email_verification_failed', request.url));
  }

  return NextResponse.redirect(new URL('/practice', request.url));
}
