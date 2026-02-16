import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOAuthConfig, type OAuthProvider } from '@/lib/oauth';
import { createSessionForUser, findOrCreateOAuthUser } from '@/lib/auth';

const STATE_COOKIE = 'oauth_state';

function getBaseUrl(request: NextRequest) {
  return process.env.APP_BASE_URL ?? request.nextUrl.origin;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const oauth = getOAuthConfig(provider as OAuthProvider);
  if (!oauth) {
    return NextResponse.redirect(new URL('/login?error=provider_not_configured', request.url));
  }

  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || !state) {
    return NextResponse.redirect(new URL('/login?error=oauth_invalid_response', request.url));
  }

  const stateStore = await cookies();
  const cookieState = stateStore.get(STATE_COOKIE)?.value;
  stateStore.delete(STATE_COOKIE);

  if (!cookieState || cookieState !== `${oauth.provider}:${state}`) {
    return NextResponse.redirect(new URL('/login?error=oauth_state_mismatch', request.url));
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/oauth/${oauth.provider}/callback`;

  const tokenRes = await fetch(oauth.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth_token_exchange_failed', request.url));
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    return NextResponse.redirect(new URL('/login?error=oauth_missing_access_token', request.url));
  }

  const userInfoRes = await fetch(oauth.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: 'no-store',
  });

  if (!userInfoRes.ok) {
    return NextResponse.redirect(new URL('/login?error=oauth_userinfo_failed', request.url));
  }

  const profile = (await userInfoRes.json()) as {
    sub?: string;
    id?: string;
    email?: string;
  };

  const email = profile.email?.trim().toLowerCase();
  const providerUserId = profile.sub ?? profile.id;

  if (!email || !providerUserId) {
    return NextResponse.redirect(new URL('/login?error=oauth_profile_invalid', request.url));
  }

  const user = await findOrCreateOAuthUser({
    email,
    provider: oauth.provider,
    providerUserId,
  });

  await createSessionForUser(user.id);
  return NextResponse.redirect(new URL('/practice', request.url));
}
