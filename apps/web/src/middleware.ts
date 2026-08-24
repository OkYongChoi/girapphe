import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';
import { hasValidClerkConfig } from '@/lib/clerk-env';
import { GUEST_ID_COOKIE } from '@/lib/guest';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  getLocaleFromPathname,
  localizePathname,
  parseAcceptLanguage,
  resolveLocale,
  stripLocaleFromPathname,
  type Locale,
} from '@stem-brain/shared';

function isLocaleIndependentPath(pathname: string) {
  return pathname.startsWith('/api/')
    || pathname === '/api'
    || pathname.startsWith('/.well-known/')
    || pathname === '/sitemap.xml'
    || pathname === '/robots.txt';
}

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

function ensureLocaleCookie(request: NextRequest, response: NextResponse, locale: Locale) {
  if (request.cookies.get(LOCALE_COOKIE_NAME)?.value === locale) return response;
  response.cookies.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function getRequestedLocale(request: NextRequest): Locale {
  const explicitHeader = request.headers.get('x-girapphe-locale');
  if (explicitHeader) return resolveLocale(explicitHeader);
  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  if (cookieLocale) return resolveLocale(cookieLocale);
  return parseAcceptLanguage(request.headers.get('accept-language'), DEFAULT_LOCALE);
}

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // Redirect non-www to www in production
  const host = request.headers.get('host') ?? '';
  if (host === 'girapphe.com') {
    const url = request.nextUrl.clone();
    url.host = 'www.girapphe.com';
    return NextResponse.redirect(url, 301);
  }

  const pathname = request.nextUrl.pathname;
  const isInternalRewrite = request.headers.get('x-girapphe-internal-rewrite') === '1';
  const localeIndependent = isLocaleIndependentPath(pathname);
  const pathLocale = localeIndependent ? null : getLocaleFromPathname(pathname);
  const locale = pathLocale ?? getRequestedLocale(request);

  if (!localeIndependent && !pathLocale && !isInternalRewrite) {
    const url = request.nextUrl.clone();
    url.pathname = localizePathname(pathname, locale);
    const response = ensureLocaleCookie(request, NextResponse.redirect(url, 307), locale);
    return ensureGuestCookie(request, response);
  }

  const internalPathname = pathLocale ? stripLocaleFromPathname(pathname) : pathname;
  if (pathLocale) {
    const canonicalPathname = localizePathname(internalPathname, pathLocale);
    if (canonicalPathname !== pathname) {
      const url = request.nextUrl.clone();
      url.pathname = canonicalPathname;
      const response = ensureLocaleCookie(request, NextResponse.redirect(url, 308), pathLocale);
      return ensureGuestCookie(request, response);
    }
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-girapphe-locale', locale);
  requestHeaders.set('x-girapphe-public-path', pathLocale ? pathname : localizePathname(pathname, locale));

  const localizedResponse = () => {
    if (!pathLocale) {
      return NextResponse.next({ request: { headers: requestHeaders } });
    }
    const url = request.nextUrl.clone();
    url.pathname = internalPathname;
    const rewriteHeaders = new Headers(requestHeaders);
    rewriteHeaders.set('x-girapphe-internal-rewrite', '1');
    return NextResponse.rewrite(url, { request: { headers: rewriteHeaders } });
  };

  if (!hasValidClerkConfig()) {
    const response = ensureLocaleCookie(request, localizedResponse(), locale);
    return ensureGuestCookie(request, response);
  }

  // Clerk v7 recommends authorization at the resource that reads or mutates
  // protected data. Admin layouts, the Knowledge Inbox actions/pages, and API
  // handlers enforce their own user/admin/token boundary; middleware only
  // attaches Clerk auth context while preserving the locale rewrite/headers.
  const handler = clerkMiddleware(() => localizedResponse());
  const response = (await handler(request, event)) as NextResponse;
  ensureLocaleCookie(request, response, locale);
  return ensureGuestCookie(request, response);
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
