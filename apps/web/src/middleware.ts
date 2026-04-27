import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import { GUEST_ID_COOKIE } from '@/lib/guest';

const isPublicRoute = createRouteMatcher([
  '/',
  '/dashboard(.*)',
  '/knowledge(.*)',
  '/login(.*)',
  '/my-knowledge(.*)',
  '/practice(.*)',
  '/ranking(.*)',
  '/saved(.*)',
  '/signup(.*)',
  '/register(.*)',
  '/api/graph(.*)',
  '/api/health(.*)',
  '/api/quiz_result(.*)',
]);

function ensureGuestCookie(request: NextRequest, response: NextResponse) {
  const existing = request.cookies.get(GUEST_ID_COOKIE)?.value;
  if (existing?.startsWith('guest_')) return response;

  const guestId = `guest_${crypto.randomUUID()}`;
  request.cookies.set(GUEST_ID_COOKIE, guestId);
  response.cookies.set(GUEST_ID_COOKIE, guestId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Redirect non-www to www in production
  const host = request.headers.get('host') ?? '';
  if (host === 'girapphe.com') {
    const url = request.nextUrl.clone();
    url.host = 'www.girapphe.com';
    return NextResponse.redirect(url, 301);
  }

  if (!hasValidClerkConfig()) {
    return ensureGuestCookie(request, NextResponse.next());
  }

  const handler = clerkMiddleware(async (auth, req) => {
    if (!isPublicRoute(req)) {
      await auth.protect({
        unauthenticatedUrl: new URL('/login', req.url).toString(),
      });
    }
  });

  const response = (await handler(request, event)) as NextResponse;
  return ensureGuestCookie(request, response);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
