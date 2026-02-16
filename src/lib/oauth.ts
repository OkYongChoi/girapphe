export type OAuthProvider = 'google' | 'openai' | 'claude' | 'grok';

export type OAuthConfig = {
  provider: OAuthProvider;
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
};

function isDevMode() {
  return process.env.NODE_ENV !== 'production';
}

function mustEnv(name: string): string {
  return process.env[name] ?? '';
}

export function getOAuthConfig(provider: OAuthProvider): OAuthConfig | null {
  if (provider === 'google') {
    const clientId = mustEnv('GOOGLE_CLIENT_ID');
    const clientSecret = mustEnv('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;

    return {
      provider,
      displayName: 'Google',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile',
      clientId,
      clientSecret,
    };
  }

  const prefix = provider.toUpperCase();
  const clientId = mustEnv(`${prefix}_OAUTH_CLIENT_ID`);
  const clientSecret = mustEnv(`${prefix}_OAUTH_CLIENT_SECRET`);
  const authUrl = mustEnv(`${prefix}_OAUTH_AUTH_URL`);
  const tokenUrl = mustEnv(`${prefix}_OAUTH_TOKEN_URL`);
  const userInfoUrl = mustEnv(`${prefix}_OAUTH_USERINFO_URL`);
  const scope = mustEnv(`${prefix}_OAUTH_SCOPE`) || 'openid email profile';

  if (!clientId || !clientSecret || !authUrl || !tokenUrl || !userInfoUrl) {
    return null;
  }

  const displayName =
    provider === 'openai' ? 'OpenAI' : provider === 'claude' ? 'Claude' : 'Grok';

  return {
    provider,
    displayName,
    authUrl,
    tokenUrl,
    userInfoUrl,
    scope,
    clientId,
    clientSecret,
  };
}

export function getEnabledOAuthProviders(): OAuthProvider[] {
  const providers: OAuthProvider[] = ['google', 'openai', 'claude', 'grok'];
  if (isDevMode()) {
    return ['google'];
  }
  return providers.filter((p) => Boolean(getOAuthConfig(p)));
}
