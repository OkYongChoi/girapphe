import {
  MAX_MOBILE_PRACTICE_CARD_ID_LENGTH,
  MAX_MOBILE_PRACTICE_CURSOR_LENGTH,
  type MobilePracticeMode,
} from '@stem-brain/shared';

export type MobilePracticeLane = 'public' | 'private';

export type MobilePracticeCursorState = {
  v: 1;
  mode: MobilePracticeMode;
  nextSource: MobilePracticeLane;
  publicAfter: string | null;
  privateAfter: string | null;
  publicDone: boolean;
  privateDone: boolean;
};

const CURSOR_KEYS = [
  'mode',
  'nextSource',
  'privateAfter',
  'privateDone',
  'publicAfter',
  'publicDone',
  'v',
];
const CURSOR_ID_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const PRIVATE_CURSOR_ID_PATTERN = /^personal:[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isPublicCursorId(value: unknown): value is string | null {
  return value === null || (
    typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_MOBILE_PRACTICE_CARD_ID_LENGTH
    && !value.startsWith('personal:')
    && !CURSOR_ID_CONTROL_PATTERN.test(value)
  );
}

function isPrivateCursorId(value: unknown): value is string | null {
  return value === null || (
    typeof value === 'string'
    && value.length <= MAX_MOBILE_PRACTICE_CARD_ID_LENGTH
    && PRIVATE_CURSOR_ID_PATTERN.test(value)
  );
}

function parseCursorState(
  value: unknown,
  expectedMode: MobilePracticeMode,
): MobilePracticeCursorState | null {
  if (!isRecord(value)) return null;
  if (Object.keys(value).sort().join(',') !== CURSOR_KEYS.join(',')) return null;
  if (
    value.v !== 1
    || (value.mode !== 'new' && value.mode !== 'review')
    || value.mode !== expectedMode
    || (value.nextSource !== 'public' && value.nextSource !== 'private')
    || !isPublicCursorId(value.publicAfter)
    || !isPrivateCursorId(value.privateAfter)
    || typeof value.publicDone !== 'boolean'
    || typeof value.privateDone !== 'boolean'
  ) {
    return null;
  }
  return value as MobilePracticeCursorState;
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeBytes(raw: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(raw)) return null;
  try {
    const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function createMobilePracticeCursorState(
  mode: MobilePracticeMode,
): MobilePracticeCursorState {
  return {
    v: 1,
    mode,
    nextSource: 'public',
    publicAfter: null,
    privateAfter: null,
    publicDone: false,
    privateDone: false,
  };
}

export function encodeMobilePracticeCursor(state: MobilePracticeCursorState): string {
  const parsed = parseCursorState(state, state.mode);
  if (!parsed) throw new TypeError('Invalid mobile Practice cursor state.');
  const encoded = encodeBytes(new TextEncoder().encode(JSON.stringify(parsed)));
  if (encoded.length > MAX_MOBILE_PRACTICE_CURSOR_LENGTH) {
    throw new RangeError('Mobile Practice cursor exceeds the shared limit.');
  }
  return encoded;
}

export function decodeMobilePracticeCursor(
  raw: string,
  expectedMode: MobilePracticeMode,
): { ok: true; state: MobilePracticeCursorState }
  | { ok: false; reason: 'invalid' | 'mode_mismatch' } {
  if (raw.length === 0 || raw.length > MAX_MOBILE_PRACTICE_CURSOR_LENGTH) {
    return { ok: false, reason: 'invalid' };
  }
  const bytes = decodeBytes(raw);
  if (!bytes) return { ok: false, reason: 'invalid' };
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
    if (
      isRecord(value)
      && (value.mode === 'new' || value.mode === 'review')
      && value.mode !== expectedMode
    ) {
      return { ok: false, reason: 'mode_mismatch' };
    }
    const state = parseCursorState(value, expectedMode);
    return state ? { ok: true, state } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
