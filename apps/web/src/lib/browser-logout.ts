type BrowserSignOut = (options: { redirectUrl: string; sessionId: string }) => Promise<void>;

export async function completeBrowserLogout({
  redirectUrl,
  sessionId,
  signOut,
  redirect,
}: {
  redirectUrl: string;
  sessionId: string | null | undefined;
  signOut: BrowserSignOut;
  redirect: (url: string) => void;
}) {
  if (!sessionId) {
    redirect(redirectUrl);
    return;
  }

  await signOut({ redirectUrl, sessionId });
}
