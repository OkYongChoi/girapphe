function isPlaceholder(value: string) {
  return value.includes('...') || /your|example|changeme/i.test(value);
}

function isValidPublishableKey(value: string) {
  return /^(pk_test_|pk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

function isValidSecretKey(value: string) {
  return /^(sk_test_|sk_live_)[A-Za-z0-9_]+$/.test(value) && value.length > 20 && !isPlaceholder(value);
}

export function hasValidClerkConfig() {
  const pk = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';
  const sk = process.env.CLERK_SECRET_KEY ?? '';
  return isValidPublishableKey(pk) && isValidSecretKey(sk);
}
