export function browserLogoutOptions(redirectUrl: string, sessionId: string | null | undefined) {
  return sessionId ? { redirectUrl, sessionId } : { redirectUrl };
}
