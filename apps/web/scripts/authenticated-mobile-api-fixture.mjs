import { createHash, randomUUID } from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import pg from 'pg';
import {
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
  findExistingAuthenticatedOverlaySyntheticUser,
  normalizeSyntheticEmail,
} from './authenticated-overlay-fixture.mjs';

const { Pool } = pg;
export const AUTHENTICATED_MOBILE_API_MARKER_PATTERN = /^E2E_MOBILE_API_[0-9a-f]{32}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @typedef {{
 *   batchId: string,
 *   rankingCardId: string,
 *   expectedParticipantId: string,
 *   drafts: {approve: {id: string, version: number}, ignore: {id: string, version: number}},
 * }} AuthenticatedMobileApiFixture
 */

/**
 * @typedef {{
 *   deletedBatch: true,
 *   deletedApprovedItems: number,
 *   deletedNote: boolean,
 *   deletedRankingRow: true,
 *   remainingRows: 0,
 * }} AuthenticatedMobileApiCleanup
 */

function required(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required for authenticated mobile API evidence.`);
  return normalized;
}

function markerValue(value) {
  const marker = required(value, 'run marker');
  if (!AUTHENTICATED_MOBILE_API_MARKER_PATTERN.test(marker)) {
    throw new Error('Authenticated mobile API evidence requires a unique run marker.');
  }
  return marker;
}

function fixtureError(code, cause) {
  const error = new Error(code, cause === undefined ? undefined : { cause });
  error.name = 'AuthenticatedMobileApiFixtureError';
  return error;
}

function requireSyntheticUser(user) {
  const userId = required(user?.id, 'synthetic Clerk user ID');
  if (user?.publicMetadata?.girappheSyntheticPurpose !== AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE) {
    throw fixtureError('MOBILE_API_FIXTURE_OWNER_NOT_SYNTHETIC');
  }
  return userId;
}

async function withSyntheticDatabase(options, operation) {
  const emailAddress = normalizeSyntheticEmail(options.emailAddress);
  const clerkClient = createClerkClient({
    secretKey: required(options.secretKey, 'CLERK_SECRET_KEY'),
  });
  const user = await findExistingAuthenticatedOverlaySyntheticUser({
    clerkClient,
    emailAddress,
  });
  const pool = new Pool({
    connectionString: required(options.databaseUrl, 'DATABASE_URL'),
    max: 1,
  });
  try {
    const client = await pool.connect();
    try {
      return await operation(client, user);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

/** @returns {Promise<AuthenticatedMobileApiFixture>} */
export async function createAuthenticatedMobileApiFixtureWithClient(
  client,
  syntheticUser,
  markerInput,
) {
  const userId = requireSyntheticUser(syntheticUser);
  const marker = markerValue(markerInput);
  const batchId = randomUUID();
  const approveDraftId = randomUUID();
  const ignoreDraftId = randomUUID();
  const requestId = `mobile-api-evidence:${marker}`;

  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext(
         'mcp-account-lifecycle:' || public.derive_account_lifecycle_scope_key($1)
       ))`,
      [userId],
    );
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`knowledge-ingestion:${userId}`],
    );
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`mobile-api-ranking:${userId}`],
    );
    const existing = await client.query(
      `SELECT COUNT(*)::integer AS count
       FROM knowledge_ingestion_batches
       WHERE user_id = $1 AND provider = 'other'
         AND scope = 'current_conversation' AND request_id = $2`,
      [userId, requestId],
    );
    if (Number(existing.rows[0]?.count) !== 0) {
      throw fixtureError('MOBILE_API_FIXTURE_MARKER_REUSED');
    }

    await client.query(
      `INSERT INTO knowledge_ingestion_batches
         (id, user_id, source_type, provider, scope, request_id, status)
       VALUES ($1, $2, 'conversation', 'other', 'current_conversation', $3, 'pending')`,
      [batchId, userId, requestId],
    );
    await client.query(
      `INSERT INTO knowledge_card_drafts (
         id, batch_id, user_id, client_card_id, title, summary, explanation,
         topic, tags, proposed_relations, status, version
       ) VALUES
         ($1, $3, $4, 'approve', $5, 'Approved through the deployed mobile API.',
          'Synthetic evidence content.', 'mobile-api-evidence', '[]'::jsonb,
          '[]'::jsonb, 'pending', 1),
         ($2, $3, $4, 'ignore', $6, 'Ignored through the deployed mobile API.',
          'Synthetic evidence content.', 'mobile-api-evidence', '[]'::jsonb,
          '[]'::jsonb, 'pending', 1)`,
      [
        approveDraftId,
        ignoreDraftId,
        batchId,
        userId,
        `${marker}:approve`,
        `${marker}:ignore`,
      ],
    );
    const rankingCard = await client.query(
      `SELECT c.id
       FROM knowledge_cards c
       WHERE NOT EXISTS (
         SELECT 1 FROM user_card_states s
         WHERE s.user_id = $1 AND s.card_id = c.id
       )
       ORDER BY c.id
       LIMIT 1`,
      [userId],
    );
    const rankingCardId = String(rankingCard.rows[0]?.id ?? '');
    if (!rankingCardId) throw fixtureError('MOBILE_API_FIXTURE_RANKING_CARD_UNAVAILABLE');
    await client.query(
      `INSERT INTO user_card_states (user_id, card_id, status, confidence)
       VALUES ($1, $2, 'known', 100)`,
      [userId, rankingCardId],
    );
    await client.query('COMMIT');
    return {
      batchId,
      rankingCardId,
      expectedParticipantId: createHash('sha256')
        .update('girapphe:leaderboard:v1\0')
        .update(userId)
        .digest('hex')
        .slice(0, 12),
      drafts: {
        approve: { id: approveDraftId, version: 1 },
        ignore: { id: ignoreDraftId, version: 1 },
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof Error && error.name === 'AuthenticatedMobileApiFixtureError') throw error;
    throw fixtureError('MOBILE_API_FIXTURE_CREATE_FAILED', error);
  }
}

/** @returns {Promise<AuthenticatedMobileApiCleanup>} */
export async function cleanupAuthenticatedMobileApiFixtureWithClient(
  client,
  syntheticUser,
  {
    marker: markerInput,
    batchId: batchIdInput,
    noteId: noteIdInput,
    rankingCardId: rankingCardIdInput,
  },
) {
  const userId = requireSyntheticUser(syntheticUser);
  const marker = markerValue(markerInput);
  const batchId = required(batchIdInput, 'candidate batch ID');
  if (!UUID_PATTERN.test(batchId)) throw fixtureError('MOBILE_API_FIXTURE_BATCH_INVALID');
  const noteId = noteIdInput === undefined || noteIdInput === null
    ? null
    : required(noteIdInput, 'mobile note ID');
  if (noteId !== null && (!UUID_PATTERN.test(noteId) && !/^e2e_[A-Za-z0-9_-]+$/.test(noteId))) {
    throw fixtureError('MOBILE_API_FIXTURE_NOTE_INVALID');
  }
  const rankingCardId = required(rankingCardIdInput, 'ranking card ID');
  if (rankingCardId.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(rankingCardId)) {
    throw fixtureError('MOBILE_API_FIXTURE_RANKING_CARD_INVALID');
  }

  await client.query('BEGIN');
  try {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext(
         'mcp-account-lifecycle:' || public.derive_account_lifecycle_scope_key($1)
       ))`,
      [userId],
    );
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`knowledge-ingestion:${userId}`],
    );
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`knowledge-import:${userId}:${batchId}`],
    );
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`mobile-api-ranking:${userId}`],
    );

    const eligible = await client.query(
      `SELECT b.id,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts d
          WHERE d.batch_id = b.id AND d.user_id = b.user_id) AS owner_drafts,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts d
          WHERE d.batch_id = b.id AND d.user_id <> b.user_id) AS foreign_drafts,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts d
          WHERE d.batch_id = b.id AND d.user_id = b.user_id
            AND d.title IN ($4, $5)) AS marker_drafts
       FROM knowledge_ingestion_batches b
       WHERE b.id = $1 AND b.user_id = $2
         AND b.provider = 'other' AND b.scope = 'current_conversation'
         AND b.request_id = $3
       FOR UPDATE`,
      [batchId, userId, `mobile-api-evidence:${marker}`, `${marker}:approve`, `${marker}:ignore`],
    );
    const target = eligible.rows[0] ?? {};
    if (
      eligible.rows.length !== 1
      || Number(target.owner_drafts) !== 2
      || Number(target.foreign_drafts) !== 0
      || Number(target.marker_drafts) !== 2
    ) {
      throw fixtureError('MOBILE_API_FIXTURE_CLEANUP_NOT_ELIGIBLE');
    }

    const noteRows = await client.query(
      `SELECT id FROM user_knowledge_items
       WHERE user_id = $1 AND title = $2
       FOR UPDATE`,
      [userId, marker],
    );
    if (
      noteRows.rows.length > 1
      || (noteId !== null && noteRows.rows.length === 1 && String(noteRows.rows[0].id) !== noteId)
      || (noteId !== null && noteRows.rows.length === 0)
    ) {
      throw fixtureError('MOBILE_API_FIXTURE_NOTE_NOT_ELIGIBLE');
    }
    const cleanupNoteId = noteRows.rows.length === 1 ? String(noteRows.rows[0].id) : null;

    const approvedItems = await client.query(
      `SELECT DISTINCT d.knowledge_item_id AS id
       FROM knowledge_card_drafts d
       JOIN user_knowledge_items i
         ON i.id = d.knowledge_item_id AND i.user_id = d.user_id
       WHERE d.batch_id = $1 AND d.user_id = $2
         AND d.knowledge_item_id IS NOT NULL`,
      [batchId, userId],
    );
    const approvedItemIds = approvedItems.rows.map((row) => String(row.id));
    if (approvedItemIds.length > 0) {
      await client.query(
        'DELETE FROM user_knowledge_items WHERE user_id = $1 AND id = ANY($2::text[])',
        [userId, approvedItemIds],
      );
    }
    if (cleanupNoteId !== null) {
      const noteDeletion = await client.query(
        `DELETE FROM user_knowledge_items
         WHERE id = $1 AND user_id = $2 AND title = $3
         RETURNING id`,
        [cleanupNoteId, userId, marker],
      );
      if (noteDeletion.rows.length !== 1) {
        throw fixtureError('MOBILE_API_FIXTURE_NOTE_DELETE_MISSED');
      }
    }

    const rankingDeletion = await client.query(
      `DELETE FROM user_card_states
       WHERE user_id = $1 AND card_id = $2 AND status = 'known' AND confidence = 100
       RETURNING card_id`,
      [userId, rankingCardId],
    );
    if (rankingDeletion.rows.length !== 1) {
      throw fixtureError('MOBILE_API_FIXTURE_RANKING_DELETE_MISSED');
    }

    const subjectHash = createHash('sha256').update(`${userId}\0${batchId}`).digest('hex');
    await client.query(
      'DELETE FROM knowledge_product_events WHERE user_id = $1 AND subject_id = $2',
      [userId, subjectHash],
    );
    await client.query(
      `DELETE FROM user_knowledge_create_requests
       WHERE user_id = $1 AND request_id = $2`,
      [userId, marker],
    );
    const batchDeletion = await client.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1 AND user_id = $2
         AND provider = 'other' AND scope = 'current_conversation'
       RETURNING id`,
      [batchId, userId],
    );
    if (batchDeletion.rows.length !== 1) {
      throw fixtureError('MOBILE_API_FIXTURE_BATCH_DELETE_MISSED');
    }

    const remaining = (await client.query(
      `SELECT
         (SELECT COUNT(*)::integer FROM knowledge_ingestion_batches
          WHERE id = $1 OR (user_id = $2 AND request_id = $3)) AS batches,
         (SELECT COUNT(*)::integer FROM knowledge_card_drafts
          WHERE batch_id = $1) AS drafts,
         (SELECT COUNT(*)::integer FROM knowledge_product_events
          WHERE user_id = $2 AND subject_id = $4) AS events,
         (SELECT COUNT(*)::integer FROM user_knowledge_items
          WHERE user_id = $2 AND (id = ANY($5::text[]) OR id = $6)) AS items,
         (SELECT COUNT(*)::integer FROM user_card_states
          WHERE user_id = $2 AND card_id = $7) AS ranking_rows,
         (SELECT COUNT(*)::integer FROM user_private_card_states
          WHERE user_id = $2 AND (knowledge_item_id = ANY($5::text[]) OR knowledge_item_id = $6)) AS private_states,
         (SELECT COUNT(*)::integer FROM user_knowledge_create_requests
          WHERE user_id = $2 AND request_id = $8) AS create_requests`,
      [
        batchId,
        userId,
        `mobile-api-evidence:${marker}`,
        subjectHash,
        approvedItemIds,
        cleanupNoteId ?? '',
        rankingCardId,
        marker,
      ],
    )).rows[0] ?? {};
    if (['batches', 'drafts', 'events', 'items', 'ranking_rows', 'private_states', 'create_requests']
      .some((key) => Number(remaining[key]) !== 0)) {
      throw fixtureError('MOBILE_API_FIXTURE_CLEANUP_VERIFICATION_FAILED');
    }
    await client.query('COMMIT');
    return {
      deletedBatch: true,
      deletedApprovedItems: approvedItemIds.length,
      deletedNote: cleanupNoteId !== null,
      deletedRankingRow: true,
      remainingRows: 0,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof Error && error.name === 'AuthenticatedMobileApiFixtureError') throw error;
    throw fixtureError('MOBILE_API_FIXTURE_CLEANUP_FAILED', error);
  }
}

/**
 * @param {{marker: string, emailAddress?: string, secretKey?: string, databaseUrl?: string}} [options]
 * @returns {Promise<AuthenticatedMobileApiFixture>}
 */
export async function createAuthenticatedMobileApiFixture({
  marker,
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  return withSyntheticDatabase(
    { emailAddress, secretKey, databaseUrl },
    (client, user) => createAuthenticatedMobileApiFixtureWithClient(client, user, marker),
  );
}

/**
 * @param {{marker: string, batchId: string, noteId?: string | null, rankingCardId: string, emailAddress?: string, secretKey?: string, databaseUrl?: string}} [options]
 * @returns {Promise<AuthenticatedMobileApiCleanup>}
 */
export async function cleanupAuthenticatedMobileApiFixture({
  marker,
  batchId,
  noteId,
  rankingCardId,
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  return withSyntheticDatabase(
    { emailAddress, secretKey, databaseUrl },
    (client, user) => cleanupAuthenticatedMobileApiFixtureWithClient(
      client,
      user,
      { marker, batchId, noteId, rankingCardId },
    ),
  );
}
