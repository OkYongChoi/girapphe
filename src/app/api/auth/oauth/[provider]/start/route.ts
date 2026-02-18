import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
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
  const typedProvider = provider as OAuthProvider;
  const config = getOAuthConfig(typedProvider);

  // In development, keep a fallback social-login path if OAuth credentials are not set.
  // If credentials are configured, use the real OAuth flow.
  if (process.env.NODE_ENV !== 'production' && !config) {
    try {
      const devEmail = `${provider}.dev@local.stembrain`;
      const user = await findOrCreateOAuthUser({
        email: devEmail,
        provider,
        providerUserId: `dev-${provider}`,
      });
      await createSessionForUser(user.id);
      return NextResponse.redirect(new URL('/practice', request.url));
    } catch {
      return NextResponse.redirect(new URL('/login?error=oauth_dev_login_failed', request.url));
    }
  }

  if (!config) {
    return NextResponse.redirect(
      new URL('/login?error=provider_not_configured', request.url)
    );
  }

  const state = randomBytes(16).toString('hex');
  const stateStore = await cookies();
  stateStore.set(STATE_COOKIE, `${config.provider}:${state}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  const redirectUri = `${getBaseUrl(request)}/api/auth/oauth/${config.provider}/callback`;

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', config.scope);
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl);
}
