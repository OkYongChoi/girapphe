import 'server-only';

import { parseAcceptLanguage } from '@stem-brain/shared';
import { NextRequest, NextResponse } from 'next/server';

const MAX_PUBLIC_CONTENT_IDS = 12;

function apiError(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

function requestedIds(request: NextRequest): string[] {
  return [...request.nextUrl.searchParams.getAll('ids'), ...request.nextUrl.searchParams.getAll('id')]
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

export async function handlePublicContentRequest(request: NextRequest) {
  const {
    getApprovedPublicNodeId,
    getLocalizedPublicContent,
    parseContentLocale,
  } = await import('@/lib/content-localization');
  const localeQuery = request.nextUrl.searchParams.get('locale');
  const localeInput = localeQuery
    ?? request.headers.get('x-girapphe-locale')
    ?? parseAcceptLanguage(request.headers.get('accept-language'));
  const locale = parseContentLocale(localeInput);
  if (!locale) {
    return apiError(400, 'UNSUPPORTED_LOCALE', 'The requested content locale is not supported.');
  }

  const rawIds = requestedIds(request);
  if (rawIds.length === 0) {
    return apiError(400, 'CONTENT_IDS_REQUIRED', 'At least one public content id is required.');
  }
  if (rawIds.length > MAX_PUBLIC_CONTENT_IDS || rawIds.some((id) => id.length > 160)) {
    return apiError(
      400,
      'CONTENT_ID_LIMIT_EXCEEDED',
      `Request at most ${MAX_PUBLIC_CONTENT_IDS} short public content ids.`
    );
  }

  const approvedIds = await Promise.all(rawIds.map(getApprovedPublicNodeId));
  if (approvedIds.some((id) => !id)) {
    return apiError(404, 'UNKNOWN_PUBLIC_CONTENT_ID', 'One or more public content ids do not exist.');
  }
  const nodeIds = Array.from(new Set(approvedIds.filter((id): id is string => Boolean(id))));
  const generationMode = 'cache-only' as const;

  try {
    const items = await getLocalizedPublicContent(nodeIds, locale);
    const includesEnglishFallback = locale !== 'en' && items.some((item) =>
      item.resolved_locale === 'en'
      || item.translation_status === 'fallback'
      || item.translation_status === 'failed'
      || item.translation_status === 'partial'
    );
    const contentLanguage = includesEnglishFallback ? `${locale}, en` : locale;
    return NextResponse.json(
      {
        requested_locale: locale,
        source_locale: 'en',
        generation_mode: generationMode,
        items,
      },
      {
        headers: {
          // A locale in the URL is an unambiguous shared-cache key. Header/cookie
          // negotiation remains private so two users cannot receive each other's
          // selected language from an intermediary cache.
          'Cache-Control': localeQuery
            ? 'public, max-age=300, stale-while-revalidate=86400'
            : 'private, no-store',
          'Content-Language': contentLanguage,
          ...(localeQuery
            ? {}
            : { Vary: 'Accept-Language, Cookie, X-Girapphe-Locale' }),
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch {
    return apiError(503, 'CONTENT_LOCALIZATION_UNAVAILABLE', 'Localized public content is temporarily unavailable.');
  }
}
