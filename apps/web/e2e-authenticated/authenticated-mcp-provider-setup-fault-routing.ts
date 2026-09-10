type RouteRequestIdentity = {
  method(): string;
  url(): string;
  headers(): Record<string, string>;
  postData(): string | null;
};

export function targetsExactSettingsDocument(
  requestUrl: string,
  settingsDocumentUrl: string,
): boolean {
  try {
    const request = new URL(requestUrl);
    const settings = new URL(settingsDocumentUrl);
    return request.origin === settings.origin
      && request.pathname === settings.pathname;
  } catch {
    return false;
  }
}

export function isExactMcpCreateServerAction(
  request: RouteRequestIdentity,
  settingsDocumentUrl: string,
  runMarker: string,
): boolean {
  const nextAction = request.headers()['next-action']?.trim();
  const postData = request.postData();
  return request.method() === 'POST'
    && targetsExactSettingsDocument(request.url(), settingsDocumentUrl)
    && Boolean(nextAction)
    && typeof postData === 'string'
    && postData.includes(runMarker);
}
