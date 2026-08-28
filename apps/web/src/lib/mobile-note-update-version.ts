export type MobileNoteUpdateVersionResult =
  | { ok: true; version: number; legacy: boolean }
  | { ok: false; reason: 'invalid' | 'not_found' };

/**
 * Current clients provide an optimistic version. Older released clients did
 * not, so they receive a freshly owner-scoped version immediately before the
 * same guarded update instead of being rejected outright.
 */
export async function resolveMobileNoteUpdateVersion(
  requestedVersion: unknown,
  loadCurrentVersion: () => Promise<number | null>,
): Promise<MobileNoteUpdateVersionResult> {
  if (requestedVersion !== undefined) {
    if (!Number.isSafeInteger(requestedVersion) || (requestedVersion as number) <= 0) {
      return { ok: false, reason: 'invalid' };
    }
    return { ok: true, version: requestedVersion as number, legacy: false };
  }

  const currentVersion = await loadCurrentVersion();
  if (typeof currentVersion !== 'number' || !Number.isSafeInteger(currentVersion) || currentVersion <= 0) {
    return { ok: false, reason: 'not_found' };
  }
  return { ok: true, version: currentVersion, legacy: true };
}
