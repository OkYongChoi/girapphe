export const AUTHENTICATED_OVERLAY_AUTH_MODES = {
  testingToken: 'testing-token',
  signInToken: 'sign-in-token',
};

function requireValue(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required for authenticated overlay evidence.`);
  return normalized;
}

export function resolveAuthenticatedOverlayAuthMode({
  configuredMode = process.env.E2E_CLERK_AUTH_MODE,
  secretKey = process.env.CLERK_SECRET_KEY,
} = {}) {
  const normalizedSecretKey = requireValue(secretKey, 'CLERK_SECRET_KEY');
  const inferredMode = normalizedSecretKey.startsWith('sk_live_')
    ? AUTHENTICATED_OVERLAY_AUTH_MODES.signInToken
    : AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken;
  const mode = String(configuredMode ?? '').trim() || inferredMode;

  if (!Object.values(AUTHENTICATED_OVERLAY_AUTH_MODES).includes(mode)) {
    throw new Error('E2E_CLERK_AUTH_MODE must be testing-token or sign-in-token.');
  }
  if (
    normalizedSecretKey.startsWith('sk_live_')
    && mode === AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken
  ) {
    throw new Error('Production Clerk instances cannot use Clerk testing tokens.');
  }
  return mode;
}

export async function createSyntheticSignInTicket({ clerkClient, userId }) {
  const normalizedUserId = requireValue(userId, 'Clerk user ID');
  const result = await clerkClient.signInTokens.createSignInToken({
    userId: normalizedUserId,
    expiresInSeconds: 300,
  });
  return requireValue(result?.token, 'Clerk sign-in token');
}
