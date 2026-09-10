export const KNOWLEDGE_DATA_CONTROLS_HANDOFF_PATH = '/account/data-controls-handoff';

export function buildKnowledgeDataControlsHandoffUrl(
  appBaseUrl: string | undefined,
): string | null {
  if (!appBaseUrl) return null;
  try {
    const base = new URL(appBaseUrl);
    if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) return null;
    return new URL(KNOWLEDGE_DATA_CONTROLS_HANDOFF_PATH, base).toString();
  } catch {
    return null;
  }
}
