export const SETTINGS_PREFERENCES_VERSION = 1 as const;
export const SETTINGS_PREFERENCES_STORAGE_KEY = 'girapphe:settings-preferences';

export const AI_CLIENTS = ['chatgpt', 'claude', 'gemini', 'other'] as const;
export const CONTEXT_FORMATS = ['markdown', 'yaml', 'json'] as const;

export type AiConnectionClient = (typeof AI_CLIENTS)[number];
export type ContextPackFormat = (typeof CONTEXT_FORMATS)[number];

export type SettingsPreferences = Readonly<{
  version: typeof SETTINGS_PREFERENCES_VERSION;
  aiClient: AiConnectionClient;
  contextFormat: ContextPackFormat;
}>;

export type SettingsPreferencesStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const DEFAULT_SETTINGS_PREFERENCES: SettingsPreferences = Object.freeze({
  version: SETTINGS_PREFERENCES_VERSION,
  aiClient: 'chatgpt',
  contextFormat: 'markdown',
});

const AI_CLIENT_SET = new Set<string>(AI_CLIENTS);
const CONTEXT_FORMAT_SET = new Set<string>(CONTEXT_FORMATS);

function defaults(): SettingsPreferences {
  return { ...DEFAULT_SETTINGS_PREFERENCES };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isAiClient(value: unknown): value is AiConnectionClient {
  return typeof value === 'string' && AI_CLIENT_SET.has(value);
}

function isContextFormat(value: unknown): value is ContextPackFormat {
  return typeof value === 'string' && CONTEXT_FORMAT_SET.has(value);
}

function normalizeSettingsPreferences(value: unknown): SettingsPreferences {
  if (!isRecord(value) || value.version !== SETTINGS_PREFERENCES_VERSION) return defaults();

  return {
    version: SETTINGS_PREFERENCES_VERSION,
    aiClient: isAiClient(value.aiClient)
      ? value.aiClient
      : DEFAULT_SETTINGS_PREFERENCES.aiClient,
    contextFormat: isContextFormat(value.contextFormat)
      ? value.contextFormat
      : DEFAULT_SETTINGS_PREFERENCES.contextFormat,
  };
}

function getBrowserStorage(): SettingsPreferencesStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function parseSettingsPreferences(raw: string | null | undefined): SettingsPreferences {
  if (!raw) return defaults();
  try {
    return normalizeSettingsPreferences(JSON.parse(raw));
  } catch {
    return defaults();
  }
}

export function readSettingsPreferences(
  storage: SettingsPreferencesStorage | null = getBrowserStorage(),
): SettingsPreferences {
  if (!storage) return defaults();
  try {
    return parseSettingsPreferences(storage.getItem(SETTINGS_PREFERENCES_STORAGE_KEY));
  } catch {
    return defaults();
  }
}

export function writeSettingsPreferences(
  preferences: SettingsPreferences,
  storage: SettingsPreferencesStorage | null = getBrowserStorage(),
): boolean {
  const normalized = normalizeSettingsPreferences(preferences);
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
    return true;
  } catch {
    // Browser privacy settings and storage quotas can make localStorage unavailable.
    return false;
  }
}
