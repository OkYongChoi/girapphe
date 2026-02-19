function isPlaceholder(value: string) {
  return value.includes('...') || /your|example|changeme/i.test(value);
}

function isValidPublishableKey(value: string) {
  return /^(pk_test_|pk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isValidSecretKey(value: string) {
  return /^(sk_test_|sk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isLocalLikeBaseUrl(value: string) {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(value);
}

export function hasValidClerkConfig() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  const appBaseUrl = process.env.APP_BASE_URL ?? '';

  const validFormat = isValidPublishableKey(pk) && isValidSecretKey(sk);
  if (!validFormat) return false;

  // Safety guard: local/dev runtime should not use live Clerk keys.
  if (isLocalLikeBaseUrl(appBaseUrl) && (pk.startsWith('pk_live_') || sk.startsWith('sk_live_'))) {
    return false;
  }

  return true;
}
