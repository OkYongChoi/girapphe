import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SETTINGS_PREFERENCES,
  SETTINGS_PREFERENCES_STORAGE_KEY,
  parseSettingsPreferences,
  readSettingsPreferences,
  writeSettingsPreferences,
  type SettingsPreferencesStorage,
} from './settings-preferences';

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;
  const storage: SettingsPreferencesStorage = {
    getItem(key) {
      assert.equal(key, SETTINGS_PREFERENCES_STORAGE_KEY);
      return value;
    },
    setItem(key, nextValue) {
      assert.equal(key, SETTINGS_PREFERENCES_STORAGE_KEY);
      value = nextValue;
    },
  };
  return { storage, value: () => value };
}

test('uses stable defaults when browser preferences are absent or malformed', () => {
  assert.deepEqual(parseSettingsPreferences(null), DEFAULT_SETTINGS_PREFERENCES);
  assert.deepEqual(parseSettingsPreferences('not-json'), DEFAULT_SETTINGS_PREFERENCES);
  assert.deepEqual(parseSettingsPreferences('[]'), DEFAULT_SETTINGS_PREFERENCES);
});

test('accepts only the current version and supported enum values', () => {
  assert.deepEqual(parseSettingsPreferences(JSON.stringify({
    version: 1,
    aiClient: 'claude',
    contextFormat: 'yaml',
    ignored: 'not persisted by the contract',
  })), {
    version: 1,
    aiClient: 'claude',
    contextFormat: 'yaml',
  });

  assert.deepEqual(parseSettingsPreferences(JSON.stringify({
    version: 2,
    aiClient: 'gemini',
    contextFormat: 'json',
  })), DEFAULT_SETTINGS_PREFERENCES);
});

test('falls back field by field when a current-version enum is unsupported', () => {
  assert.deepEqual(parseSettingsPreferences(JSON.stringify({
    version: 1,
    aiClient: 'unsupported-client',
    contextFormat: 'json',
  })), {
    version: 1,
    aiClient: DEFAULT_SETTINGS_PREFERENCES.aiClient,
    contextFormat: 'json',
  });
});

test('reads valid browser-local preferences and tolerates unavailable storage', () => {
  const stored = memoryStorage(JSON.stringify({
    version: 1,
    aiClient: 'gemini',
    contextFormat: 'json',
  }));
  assert.deepEqual(readSettingsPreferences(stored.storage), {
    version: 1,
    aiClient: 'gemini',
    contextFormat: 'json',
  });

  const unavailable: SettingsPreferencesStorage = {
    getItem() { throw new Error('storage unavailable'); },
    setItem() { throw new Error('storage unavailable'); },
  };
  assert.deepEqual(readSettingsPreferences(unavailable), DEFAULT_SETTINGS_PREFERENCES);
  assert.deepEqual(readSettingsPreferences(null), DEFAULT_SETTINGS_PREFERENCES);
});

test('writes only normalized versioned preferences and tolerates write failures', () => {
  const stored = memoryStorage();
  const written = writeSettingsPreferences({
    version: 1,
    aiClient: 'other',
    contextFormat: 'yaml',
  }, stored.storage);

  assert.equal(written, true);
  assert.equal(stored.value(), JSON.stringify({
    version: 1,
    aiClient: 'other',
    contextFormat: 'yaml',
  }));

  const normalized = writeSettingsPreferences({
    version: 1,
    aiClient: 'unsupported-client',
    contextFormat: 'xml',
    ignored: true,
  } as unknown as Parameters<typeof writeSettingsPreferences>[0], stored.storage);
  assert.equal(normalized, true);
  assert.equal(stored.value(), JSON.stringify(DEFAULT_SETTINGS_PREFERENCES));

  const unavailable: SettingsPreferencesStorage = {
    getItem() { return null; },
    setItem() { throw new Error('quota exceeded'); },
  };
  assert.equal(writeSettingsPreferences(DEFAULT_SETTINGS_PREFERENCES, unavailable), false);
  assert.equal(writeSettingsPreferences(DEFAULT_SETTINGS_PREFERENCES, null), false);
});
