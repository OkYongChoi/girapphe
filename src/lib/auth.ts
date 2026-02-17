import { cookies } from 'next/headers';
import { randomBytes, randomUUID, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pool from '@/lib/db';

const scrypt = promisify(_scrypt);

const SESSION_COOKIE = 'psb_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export type AuthUser = {
  id: string;
  email: string;
};

type MemoryUser = AuthUser & {
  passwordHash: string | null;
  authProvider?: string | null;
  providerUserId?: string | null;
};

type MemorySession = {
  userId: string;
  expiresAt: number;
};

const memoryUsersByEmail = new Map<string, MemoryUser>();
const memoryUsersById = new Map<string, MemoryUser>();
const memorySessions = new Map<string, MemorySession>();
const DEV_AUTH_STORE_PATH = path.join(process.cwd(), '.local', 'auth-store.json');

let schemaReady = false;
let memoryStoreLoaded = false;

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

type PersistedMemoryAuthStore = {
  users: MemoryUser[];
  sessions: Array<{ id: string; userId: string; expiresAt: number }>;
};

async function ensureMemoryStoreLoaded() {
  if (hasDatabase() || memoryStoreLoaded) return;

  try {
    const raw = await readFile(DEV_AUTH_STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as PersistedMemoryAuthStore;

    memoryUsersByEmail.clear();
    memoryUsersById.clear();
    memorySessions.clear();

    for (const user of parsed.users ?? []) {
      memoryUsersByEmail.set(user.email, user);
      memoryUsersById.set(user.id, user);
    }

    for (const session of parsed.sessions ?? []) {
      memorySessions.set(session.id, {
        userId: session.userId,
        expiresAt: session.expiresAt,
      });
    }
  } catch {
    // No local auth file yet is normal in dev.
  } finally {
    memoryStoreLoaded = true;
  }
}

async function persistMemoryStore() {
  if (hasDatabase()) return;

  const data: PersistedMemoryAuthStore = {
    users: Array.from(memoryUsersById.values()),
    sessions: Array.from(memorySessions.entries()).map(([id, session]) => ({
      id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    })),
  };

  await mkdir(path.dirname(DEV_AUTH_STORE_PATH), { recursive: true });
  await writeFile(DEV_AUTH_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const derived = (await scrypt(password, salt, expected.length)) as Buffer;
  return timingSafeEqual(expected, derived);
}

async function ensureAuthSchema() {
  if (!hasDatabase() || schemaReady) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      auth_provider TEXT,
      provider_user_id TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
  `);

  await pool.query(`
    ALTER TABLE auth_users
    ALTER COLUMN password_hash DROP NOT NULL;
  `);

  await pool.query(`
    ALTER TABLE auth_users
    ADD COLUMN IF NOT EXISTS auth_provider TEXT;
  `);

  await pool.query(`
    ALTER TABLE auth_users
    ADD COLUMN IF NOT EXISTS provider_user_id TEXT;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_provider_identity
    ON auth_users(auth_provider, provider_user_id)
    WHERE auth_provider IS NOT NULL AND provider_user_id IS NOT NULL;
  `);

  schemaReady = true;
}

async function setSessionCookie(sessionId: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

async function syncLegacyUserRow(userId: string, email: string) {
  if (!hasDatabase()) return;

  try {
    await pool.query(
      `
      INSERT INTO users (id, clerk_id, email)
      VALUES ($1::uuid, $2, $3)
      ON CONFLICT (id)
      DO UPDATE SET email = EXCLUDED.email;
      `,
      [userId, `local:${userId}`, email]
    );
  } catch (error) {
    console.warn('Legacy users sync skipped:', error);
  }
}

export async function signUpWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (hasDatabase()) {
    try {
      await ensureAuthSchema();

      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM auth_users WHERE email = $1 LIMIT 1',
        [normalizedEmail]
      );

      if (existing.rows.length > 0) {
        return { success: false as const, error: 'Email is already registered.' };
      }

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);

      await pool.query(
        'INSERT INTO auth_users (id, email, password_hash, auth_provider) VALUES ($1, $2, $3, $4)',
        [userId, normalizedEmail, passwordHash, 'password']
      );
      await syncLegacyUserRow(userId, normalizedEmail);

      await createSession(userId);
      return { success: true as const };
    } catch (error) {
      console.error('signUpWithPassword DB error:', error);
      return { success: false as const, error: 'Unable to sign up right now. Please try again.' };
    }
  }

  await ensureMemoryStoreLoaded();

  if (memoryUsersByEmail.has(normalizedEmail)) {
    return { success: false as const, error: 'Email is already registered.' };
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const user: MemoryUser = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    authProvider: 'password',
    providerUserId: null,
  };

  memoryUsersByEmail.set(normalizedEmail, user);
  memoryUsersById.set(userId, user);
  await persistMemoryStore();

  await createSession(userId);
  return { success: true as const };
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (hasDatabase()) {
    try {
      await ensureAuthSchema();

      const result = await pool.query<{ id: string; email: string; password_hash: string | null }>(
        'SELECT id, email, password_hash FROM auth_users WHERE email = $1 LIMIT 1',
        [normalizedEmail]
      );

      const row = result.rows[0];
      if (!row) {
        return { success: false as const, error: 'Invalid email or password.' };
      }

      if (!row.password_hash) {
        return { success: false as const, error: 'This account uses social login.' };
      }

      const valid = await verifyPassword(password, row.password_hash);
      if (!valid) {
        return { success: false as const, error: 'Invalid email or password.' };
      }

      await syncLegacyUserRow(row.id, row.email);
      await createSession(row.id);
      return { success: true as const };
    } catch (error) {
      console.error('signInWithPassword DB error:', error);
      return { success: false as const, error: 'Unable to log in right now. Please try again.' };
    }
  }

  await ensureMemoryStoreLoaded();

  const user = memoryUsersByEmail.get(normalizedEmail);
  if (!user) {
    return { success: false as const, error: 'Invalid email or password.' };
  }

  if (!user.passwordHash) {
    return { success: false as const, error: 'This account uses social login.' };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { success: false as const, error: 'Invalid email or password.' };
  }

  await createSession(user.id);
  return { success: true as const };
}

async function createSession(userId: string) {
  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  if (hasDatabase()) {
    await ensureAuthSchema();
    await pool.query(
      'INSERT INTO auth_sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
      [sessionId, userId, expiresAt.toISOString()]
    );
  } else {
    await ensureMemoryStoreLoaded();
    memorySessions.set(sessionId, { userId, expiresAt: expiresAt.getTime() });
    await persistMemoryStore();
  }

  await setSessionCookie(sessionId, expiresAt);
}

export async function createSessionForUser(userId: string) {
  await createSession(userId);
}

export async function findOrCreateOAuthUser(params: {
  email: string;
  provider: string;
  providerUserId: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const { provider, providerUserId } = params;

  if (hasDatabase()) {
    await ensureAuthSchema();

    const providerMatch = await pool.query<{ id: string; email: string }>(
      `
      SELECT id, email
      FROM auth_users
      WHERE auth_provider = $1 AND provider_user_id = $2
      LIMIT 1
      `,
      [provider, providerUserId]
    );

    if (providerMatch.rows[0]) {
      await syncLegacyUserRow(providerMatch.rows[0].id, providerMatch.rows[0].email);
      return providerMatch.rows[0];
    }

    const emailMatch = await pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM auth_users WHERE email = $1 LIMIT 1',
      [normalizedEmail]
    );

    if (emailMatch.rows[0]) {
      const existing = emailMatch.rows[0];
      await pool.query(
        `
        UPDATE auth_users
        SET auth_provider = COALESCE(auth_provider, $2),
            provider_user_id = COALESCE(provider_user_id, $3)
        WHERE id = $1
        `,
        [existing.id, provider, providerUserId]
      );
      await syncLegacyUserRow(existing.id, existing.email);
      return existing;
    }

    const userId = randomUUID();
    await pool.query(
      `
      INSERT INTO auth_users (id, email, password_hash, auth_provider, provider_user_id)
      VALUES ($1, $2, NULL, $3, $4)
      `,
      [userId, normalizedEmail, provider, providerUserId]
    );
    await syncLegacyUserRow(userId, normalizedEmail);

    return { id: userId, email: normalizedEmail };
  }

  await ensureMemoryStoreLoaded();

  const byEmail = memoryUsersByEmail.get(normalizedEmail);
  if (byEmail) {
    if (!byEmail.authProvider) {
      byEmail.authProvider = provider;
      byEmail.providerUserId = providerUserId;
      await persistMemoryStore();
    }
    return { id: byEmail.id, email: byEmail.email };
  }

  const userId = randomUUID();
  const user: MemoryUser = {
    id: userId,
    email: normalizedEmail,
    passwordHash: null,
    authProvider: provider,
    providerUserId,
  };
  memoryUsersByEmail.set(normalizedEmail, user);
  memoryUsersById.set(userId, user);
  await persistMemoryStore();
  return { id: userId, email: normalizedEmail };
}

export async function signOutCurrentUser() {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;

  if (sessionId) {
    if (hasDatabase()) {
      await ensureAuthSchema();
      await pool.query('DELETE FROM auth_sessions WHERE id = $1', [sessionId]);
    } else {
      await ensureMemoryStoreLoaded();
      memorySessions.delete(sessionId);
      await persistMemoryStore();
    }
  }

  await clearSessionCookie();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  if (hasDatabase()) {
    await ensureAuthSchema();

    const result = await pool.query<{ id: string; email: string; expires_at: string }>(
      `
      SELECT u.id, u.email, s.expires_at
      FROM auth_sessions s
      JOIN auth_users u ON u.id = s.user_id
      WHERE s.id = $1
      LIMIT 1
      `,
      [sessionId]
    );

    const row = result.rows[0];
    if (!row) {
      await clearSessionCookie();
      return null;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await pool.query('DELETE FROM auth_sessions WHERE id = $1', [sessionId]);
      await clearSessionCookie();
      return null;
    }

    return { id: row.id, email: row.email };
  }

  await ensureMemoryStoreLoaded();

  const session = memorySessions.get(sessionId);
  if (!session) {
    await clearSessionCookie();
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    memorySessions.delete(sessionId);
    await persistMemoryStore();
    await clearSessionCookie();
    return null;
  }

  const user = memoryUsersById.get(session.userId);
  if (!user) {
    memorySessions.delete(sessionId);
    await persistMemoryStore();
    await clearSessionCookie();
    return null;
  }

  return { id: user.id, email: user.email };
}

export async function requireCurrentUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
