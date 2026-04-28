function isPlaceholder(value: string) {
  return value.includes('...') || /your|example|changeme/i.test(value);
}

function isValidPublishableKey(value: string) {
  return /^(pk_test_|pk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isValidSecretKey(value: string) {
  return /^(sk_test_|sk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function usesLiveKeysInDevelopment(publishableKey: string, secretKey: string) {
  return (
    process.env.NODE_ENV === 'development' &&
    (publishableKey.startsWith('pk_live_') || secretKey.startsWith('sk_live_'))
  );
}

export function getClerkConfigProblem() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';

  if (!isValidPublishableKey(pk) || !isValidSecretKey(sk)) {
    return 'Clerk keys are missing or still set to placeholder values.';
  }

  if (usesLiveKeysInDevelopment(pk, sk)) {
    return 'Live Clerk keys cannot be used by the local dev server. Use test keys in .env.local, or unset the keys to continue in guest mode.';
  }

  return null;
}

export function hasValidClerkConfig() {
  return getClerkConfigProblem() === null;
}
