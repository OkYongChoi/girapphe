import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClerkClient } from '@clerk/backend';
import pg from 'pg';
import {
  AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_EMAIL_MARKER,
  AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
} from './authenticated-overlay-constants.mjs';

export {
  AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_EMAIL_MARKER,
  AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX,
  AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
} from './authenticated-overlay-constants.mjs';

const { Pool } = pg;
const IMPORT_BATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const THINKING_HISTORY_IMPORT_MARKER_PATTERN = /^E2E_SELECTED_QUESTION_A_[0-9a-f]{32}$/;
const SELECTED_EXPORT_SESSION_SUFFIX = /:session:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

function authenticatedOverlayFixtureError(code, cause) {
  const suffix = cause === undefined
    ? ''
    : `:${createHash('sha256')
      .update(cause instanceof Error ? `${cause.name}\0${cause.message}` : String(cause))
      .digest('hex')
      .slice(0, 12)}`;
  const error = new Error(`${code}${suffix}`);
  error.name = 'AuthenticatedOverlayFixtureError';
  return error;
}

function requireValue(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required for authenticated overlay evidence.`);
  return normalized;
}

function requireSyntheticFixtureUser(userInput) {
  const userId = requireValue(userInput?.id, 'Clerk user ID');
  if (userInput?.publicMetadata?.girappheSyntheticPurpose !== AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE) {
    throw new Error('Database fixture mutations require the dedicated authenticated overlay synthetic user.');
  }
  return userId;
}

function publishedStateFromRow(row = {}) {
  const count = (key) => {
    const value = Number(row[key]);
    if (!Number.isInteger(value) || value < 0) {
      throw authenticatedOverlayFixtureError('SYNTHETIC_PUBLISHED_STATE_INVALID');
    }
    return value;
  };
  const digest = String(row.published_digest ?? '');
  if (!/^[0-9a-f]{32}$/.test(digest)) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_PUBLISHED_STATE_INVALID');
  }
  return {
    canonicalKnowledge: count('canonical_knowledge'),
    privateGraphNodes: count('private_graph_nodes'),
    privateGraphEdges: count('private_graph_edges'),
    publicGraphNodes: count('public_graph_nodes'),
    publicGraphEdges: count('public_graph_edges'),
    privateMasteryRows: count('private_mastery_rows'),
    publicMasteryRows: count('public_mastery_rows'),
    rankingRows: count('ranking_rows'),
    digest,
  };
}

export async function readAuthenticatedOverlayPublishedStateWithClient(client, syntheticUser) {
  const userId = requireSyntheticFixtureUser(syntheticUser);
  const result = await client.query(
    `SELECT
       (SELECT COUNT(*)::integer FROM user_knowledge_items WHERE user_id = $1) AS canonical_knowledge,
       (SELECT COUNT(*)::integer FROM user_graph_nodes WHERE user_id = $1) AS private_graph_nodes,
       (SELECT COUNT(*)::integer FROM user_graph_edges WHERE user_id = $1) AS private_graph_edges,
       (SELECT COUNT(*)::integer FROM graph_nodes) AS public_graph_nodes,
       (SELECT COUNT(*)::integer FROM graph_edges) AS public_graph_edges,
       (SELECT COUNT(*)::integer FROM user_private_card_states WHERE user_id = $1) AS private_mastery_rows,
       (SELECT COUNT(*)::integer FROM user_knowledge_states WHERE user_id = $1) AS public_mastery_rows,
       (SELECT COUNT(*)::integer FROM user_card_states WHERE user_id = $1) AS ranking_rows,
       md5(concat_ws(E'\\n',
         'knowledge:' || COALESCE((
           SELECT string_agg(to_jsonb(i)::text, E'\\n' ORDER BY i.id)
           FROM user_knowledge_items i WHERE i.user_id = $1
         ), ''),
         'private-nodes:' || COALESCE((
           SELECT string_agg(to_jsonb(n)::text, E'\\n' ORDER BY n.id)
           FROM user_graph_nodes n WHERE n.user_id = $1
         ), ''),
         'private-edges:' || COALESCE((
           SELECT string_agg(to_jsonb(e)::text, E'\\n' ORDER BY e.id)
           FROM user_graph_edges e WHERE e.user_id = $1
         ), ''),
         'public-nodes:' || COALESCE((
           SELECT string_agg(to_jsonb(n)::text, E'\\n' ORDER BY n.id)
           FROM graph_nodes n
         ), ''),
         'public-edges:' || COALESCE((
           SELECT string_agg(to_jsonb(e)::text, E'\\n' ORDER BY e.id)
           FROM graph_edges e
         ), ''),
         'private-mastery:' || COALESCE((
           SELECT string_agg(to_jsonb(s)::text, E'\\n' ORDER BY s.knowledge_item_id)
           FROM user_private_card_states s WHERE s.user_id = $1
         ), ''),
         'public-mastery:' || COALESCE((
           SELECT string_agg(to_jsonb(s)::text, E'\\n' ORDER BY s.node_id)
           FROM user_knowledge_states s WHERE s.user_id = $1
         ), ''),
         'ranking:' || COALESCE((
           SELECT string_agg(to_jsonb(s)::text, E'\\n' ORDER BY s.card_id)
           FROM user_card_states s WHERE s.user_id = $1
         ), '')
       )) AS published_digest`,
    [userId],
  );
  return publishedStateFromRow(result.rows[0]);
}

export async function assertPendingAuthenticatedOverlayImportIsInertWithClient(
  client,
  syntheticUser,
  { batchId: batchIdInput, marker: markerInput, expectedDraftCount = 2 },
) {
  const userId = requireSyntheticFixtureUser(syntheticUser);
  const batchId = String(batchIdInput ?? '').trim();
  const marker = String(markerInput ?? '').trim();
  if (!IMPORT_BATCH_ID_PATTERN.test(batchId)) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_PENDING_BATCH_INVALID');
  }
  if (!THINKING_HISTORY_IMPORT_MARKER_PATTERN.test(marker)) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_PENDING_MARKER_INVALID');
  }
  if (!Number.isInteger(expectedDraftCount) || expectedDraftCount < 1 || expectedDraftCount > 100) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_PENDING_COUNT_INVALID');
  }

  const result = await client.query(
    `WITH target_batch AS MATERIALIZED (
       SELECT b.id, b.user_id
       FROM knowledge_ingestion_batches b
       WHERE b.id = $1 AND b.user_id = $2
         AND b.provider = 'chatgpt' AND b.scope = 'selected_export'
         AND b.status = 'pending'
     ), target_drafts AS MATERIALIZED (
       SELECT d.* FROM knowledge_card_drafts d
       JOIN target_batch b ON b.id = d.batch_id AND b.user_id = d.user_id
     ), candidate_nodes AS MATERIALIZED (
       SELECT n.id, n.knowledge_item_id
       FROM user_graph_nodes n
       WHERE n.user_id = $2 AND (
         n.source_batch_id = $1 OR n.knowledge_item_id IN (
           SELECT d.knowledge_item_id FROM target_drafts d WHERE d.knowledge_item_id IS NOT NULL
         )
       )
     ) SELECT
       (SELECT COUNT(*)::integer FROM target_batch) AS target_batch_count,
       (SELECT COUNT(*)::integer FROM target_drafts) AS draft_count,
       (SELECT COUNT(*)::integer FROM target_drafts WHERE status = 'pending') AS pending_drafts,
       (SELECT COUNT(*)::integer FROM target_drafts WHERE central_question = $3) AS marker_matches,
       (SELECT COUNT(*)::integer FROM knowledge_card_drafts d
        WHERE d.batch_id = $1 AND d.user_id <> $2) AS foreign_drafts,
       (SELECT COUNT(*)::integer FROM target_drafts WHERE knowledge_item_id IS NOT NULL) AS canonical_links,
       (SELECT COUNT(*)::integer FROM knowledge_card_sources s
        WHERE s.batch_id = $1 OR s.draft_id IN (SELECT id FROM target_drafts)) AS source_rows,
       (SELECT COUNT(*)::integer FROM candidate_nodes) AS private_graph_nodes,
       (SELECT COUNT(*)::integer FROM user_graph_edges e
        WHERE e.user_id = $2 AND (
          e.source_batch_id = $1
          OR e.source_private_node_id IN (SELECT id FROM candidate_nodes)
          OR e.target_private_node_id IN (SELECT id FROM candidate_nodes)
        )) AS private_graph_edges,
       (SELECT COUNT(*)::integer FROM user_private_card_states s
        WHERE s.user_id = $2 AND s.knowledge_item_id IN (
          SELECT d.knowledge_item_id FROM target_drafts d WHERE d.knowledge_item_id IS NOT NULL
        )) AS private_mastery_rows,
       (SELECT COUNT(*)::integer FROM knowledge_item_revisions r
        WHERE r.user_id = $2 AND r.knowledge_item_id IN (
          SELECT d.knowledge_item_id FROM target_drafts d WHERE d.knowledge_item_id IS NOT NULL
        )) AS revision_rows,
       (SELECT COUNT(*)::integer FROM knowledge_item_activity a
        WHERE a.user_id = $2 AND a.knowledge_item_id IN (
          SELECT d.knowledge_item_id FROM target_drafts d WHERE d.knowledge_item_id IS NOT NULL
        )) AS activity_rows`,
    [batchId, userId, marker],
  );
  const row = result.rows[0] ?? {};
  const counts = Object.fromEntries(Object.entries({
    targetBatch: row.target_batch_count,
    drafts: row.draft_count,
    pendingDrafts: row.pending_drafts,
    markerMatches: row.marker_matches,
    foreignDrafts: row.foreign_drafts,
    canonicalLinks: row.canonical_links,
    sourceRows: row.source_rows,
    privateGraphNodes: row.private_graph_nodes,
    privateGraphEdges: row.private_graph_edges,
    privateMasteryRows: row.private_mastery_rows,
    revisionRows: row.revision_rows,
    activityRows: row.activity_rows,
  }).map(([key, value]) => [key, Number(value)]));
  const activationCounts = [
    counts.foreignDrafts,
    counts.canonicalLinks,
    counts.sourceRows,
    counts.privateGraphNodes,
    counts.privateGraphEdges,
    counts.privateMasteryRows,
    counts.revisionRows,
    counts.activityRows,
  ];
  if (
    counts.targetBatch !== 1
    || counts.drafts !== expectedDraftCount
    || counts.pendingDrafts !== expectedDraftCount
    || counts.markerMatches !== 1
    || activationCounts.some((value) => value !== 0)
  ) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_PENDING_IMPORT_NOT_INERT');
  }
  return counts;
}

export function normalizeSyntheticEmail(value) {
  const email = requireValue(value, 'E2E_CLERK_USER_EMAIL').toLowerCase();
  const [localPart, domain, ...extra] = email.split('@');
  if (
    extra.length > 0
    || !localPart
    || !domain
    || !domain.includes('.')
    || !localPart.includes(AUTHENTICATED_OVERLAY_EMAIL_MARKER)
  ) {
    throw new Error(
      `E2E_CLERK_USER_EMAIL must use the dedicated ${AUTHENTICATED_OVERLAY_EMAIL_MARKER} marker.`,
    );
  }
  return email;
}

export function fixtureIdsForUser(userIdInput) {
  const userId = requireValue(userIdInput, 'Clerk user ID');
  const suffix = createHash('sha256')
    .update(`girapphe:${AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE}:${userId}`)
    .digest('hex')
    .slice(0, 20);

  return {
    suffix,
    itemIds: ['a', 'b', 'c', 'd'].map((label) => `e2e_overlay_item_${suffix}_${label}`),
    nodeIds: ['a', 'b', 'c', 'd'].map((label) => `e2e_overlay_node_${suffix}_${label}`),
    privateEdgeId: `e2e_overlay_edge_${suffix}_private`,
    secondaryPrivateEdgeId: `e2e_overlay_edge_${suffix}_private_secondary`,
    publicEdgeId: `e2e_overlay_edge_${suffix}_public`,
  };
}

export async function ensureSyntheticClerkUser({ clerkClient, emailAddress }) {
  const email = normalizeSyntheticEmail(emailAddress);
  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 2 });
  if (users.length > 1) {
    throw new Error('The authenticated overlay synthetic email resolved to multiple Clerk users.');
  }

  if (users.length === 1) {
    const purpose = users[0].publicMetadata?.girappheSyntheticPurpose;
    if (purpose !== AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE) {
      throw new Error(
        'The authenticated overlay email already belongs to a Clerk user that is not marked as this synthetic fixture.',
      );
    }
    return { user: users[0], created: false };
  }

  const password = `Aa1!${randomBytes(32).toString('base64url')}`;
  const user = await clerkClient.users.createUser({
    emailAddress: [email],
    password,
    firstName: 'Girapphe',
    lastName: 'Overlay E2E',
    publicMetadata: {
      girappheSyntheticPurpose: AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE,
    },
  });
  return { user, created: true };
}

export async function findExistingAuthenticatedOverlaySyntheticUser({
  clerkClient,
  emailAddress,
}) {
  const email = normalizeSyntheticEmail(emailAddress);
  const { data: users } = await clerkClient.users.getUserList({ emailAddress: [email], limit: 2 });
  if (users.length !== 1) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_OWNER_NOT_UNIQUE');
  }
  requireSyntheticFixtureUser(users[0]);
  return users[0];
}

export async function deleteExactAuthenticatedOverlayImportWithClient(
  client,
  syntheticUser,
  { batchId: batchIdInput, marker: markerInput },
) {
  const userId = requireSyntheticFixtureUser(syntheticUser);
  const batchId = String(batchIdInput ?? '').trim();
  const marker = String(markerInput ?? '').trim();
  if (!IMPORT_BATCH_ID_PATTERN.test(batchId)) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_BATCH_INVALID');
  }
  if (!THINKING_HISTORY_IMPORT_MARKER_PATTERN.test(marker)) {
    throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_MARKER_INVALID');
  }

  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext(
         'mcp-account-lifecycle:' || public.derive_account_lifecycle_scope_key($1)
       ))`,
      [userId],
    );
    await client.query(
      `INSERT INTO mcp_deleted_account_markers (scope_key, deleted_at)
       SELECT scope_key, deleted_at
       FROM mcp_deleted_account_markers
       WHERE scope_key = public.derive_account_lifecycle_scope_key($1)`,
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

    const eligible = await client.query(
      `SELECT b.id, b.request_id,
         (SELECT COUNT(*)::integer
          FROM knowledge_card_drafts marker_draft
          WHERE marker_draft.batch_id = b.id
            AND marker_draft.user_id = b.user_id
            AND marker_draft.central_question = $3) AS marker_matches,
         (SELECT COUNT(*)::integer
          FROM knowledge_card_drafts protected_draft
          WHERE protected_draft.batch_id = b.id
            AND protected_draft.user_id = b.user_id
            AND (protected_draft.status = 'approved'
              OR protected_draft.knowledge_item_id IS NOT NULL)) AS protected_drafts,
         (SELECT COUNT(*)::integer
          FROM knowledge_card_drafts foreign_draft
          WHERE foreign_draft.batch_id = b.id
            AND foreign_draft.user_id <> b.user_id) AS foreign_drafts,
         (SELECT COUNT(*)::integer
          FROM knowledge_card_sources source
          WHERE source.batch_id = b.id OR source.draft_id IN (
            SELECT linked_draft.id
            FROM knowledge_card_drafts linked_draft
            WHERE linked_draft.batch_id = b.id
          )) AS linked_sources
       FROM knowledge_ingestion_batches b
       WHERE b.id = $1
         AND b.user_id = $2
         AND b.provider = 'chatgpt'
         AND b.scope = 'selected_export'
         AND b.status IN ('pending', 'partial', 'discarded')
       FOR UPDATE`,
      [batchId, userId, marker],
    );
    const target = eligible.rows[0];
    if (
      eligible.rows.length !== 1
      || Number(target?.marker_matches) !== 1
      || Number(target?.protected_drafts) !== 0
      || Number(target?.foreign_drafts) !== 0
      || Number(target?.linked_sources) !== 0
    ) {
      throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_TARGET_NOT_ELIGIBLE');
    }

    const importSessionId = String(target.request_id ?? '')
      .match(SELECTED_EXPORT_SESSION_SUFFIX)?.[1];
    if (!importSessionId) {
      throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_SESSION_INVALID');
    }
    const batchSubjectHash = createHash('sha256')
      .update(`${userId}\0${batchId}`)
      .digest('hex');
    const sessionSubjectHash = createHash('sha256')
      .update(`${userId}\0${importSessionId}`)
      .digest('hex');
    // Match production batch deletion and also remove any pre-reassignment
    // session events left by a failed finalization. Both subjects are exact,
    // owner-derived hashes; event type must not narrow the cleanup.
    await client.query(
      `DELETE FROM knowledge_product_events
       WHERE user_id = $1
         AND subject_id = ANY($2::text[])`,
      [userId, [batchSubjectHash, sessionSubjectHash]],
    );

    const deletion = await client.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE id = $1
         AND user_id = $2
         AND provider = 'chatgpt'
         AND scope = 'selected_export'
       RETURNING id`,
      [batchId, userId],
    );
    if (deletion.rows.length !== 1) {
      throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_DELETE_MISSED');
    }

    const verification = await client.query(
      `SELECT
         (SELECT COUNT(*)::integer
          FROM knowledge_ingestion_batches
          WHERE id = $1 AND user_id = $2) AS remaining_batches,
         (SELECT COUNT(*)::integer
          FROM knowledge_card_drafts
          WHERE batch_id = $1) AS remaining_drafts,
         (SELECT COUNT(*)::integer
          FROM knowledge_product_events
          WHERE user_id = $2 AND subject_id = ANY($3::text[])) AS remaining_events`,
      [batchId, userId, [batchSubjectHash, sessionSubjectHash]],
    );
    const remaining = verification.rows[0] ?? {};
    const result = {
      deleted: true,
      remainingBatches: Number(remaining.remaining_batches),
      remainingDrafts: Number(remaining.remaining_drafts),
      remainingEvents: Number(remaining.remaining_events),
    };
    if (
      result.remainingBatches !== 0
      || result.remainingDrafts !== 0
      || result.remainingEvents !== 0
    ) {
      throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_VERIFICATION_FAILED');
    }
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK').catch(() => undefined);
    if (error instanceof Error && error.name === 'AuthenticatedOverlayFixtureError') throw error;
    throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_DATABASE_FAILED', error);
  }
}

/**
 * @param {{
 *   batchId: string,
 *   marker: string,
 *   emailAddress?: string,
 *   secretKey?: string,
 *   databaseUrl?: string,
 * }} options
 */
export async function deleteExactAuthenticatedOverlayImport({
  batchId,
  marker,
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
}) {
  try {
    const email = normalizeSyntheticEmail(emailAddress);
    const clerkClient = createClerkClient({
      secretKey: requireValue(secretKey, 'CLERK_SECRET_KEY'),
    });
    const user = await findExistingAuthenticatedOverlaySyntheticUser({
      clerkClient,
      emailAddress: email,
    });
    const pool = new Pool({
      connectionString: requireValue(databaseUrl, 'DATABASE_URL'),
      max: 1,
    });
    try {
      const client = await pool.connect();
      try {
        return await deleteExactAuthenticatedOverlayImportWithClient(
          client,
          user,
          { batchId, marker },
        );
      } finally {
        client.release();
      }
    } finally {
      await pool.end();
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthenticatedOverlayFixtureError') throw error;
    throw authenticatedOverlayFixtureError('SYNTHETIC_CLEANUP_FAILED', error);
  }
}

async function withExistingAuthenticatedOverlayDatabase(
  { emailAddress, secretKey, databaseUrl },
  operation,
) {
  const email = normalizeSyntheticEmail(emailAddress);
  const clerkClient = createClerkClient({
    secretKey: requireValue(secretKey, 'CLERK_SECRET_KEY'),
  });
  const user = await findExistingAuthenticatedOverlaySyntheticUser({
    clerkClient,
    emailAddress: email,
  });
  const pool = new Pool({
    connectionString: requireValue(databaseUrl, 'DATABASE_URL'),
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

export async function readAuthenticatedOverlayPublishedState({
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
} = {}) {
  return withExistingAuthenticatedOverlayDatabase(
    { emailAddress, secretKey, databaseUrl },
    (client, user) => readAuthenticatedOverlayPublishedStateWithClient(client, user),
  );
}

export async function inspectPendingAuthenticatedOverlayImport({
  batchId,
  marker,
  expectedDraftCount = 2,
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
}) {
  return withExistingAuthenticatedOverlayDatabase(
    { emailAddress, secretKey, databaseUrl },
    async (client, user) => ({
      activation: await assertPendingAuthenticatedOverlayImportIsInertWithClient(
        client,
        user,
        { batchId, marker, expectedDraftCount },
      ),
      publishedState: await readAuthenticatedOverlayPublishedStateWithClient(client, user),
    }),
  );
}

export async function seedAuthenticatedOverlayFixtureWithClient(
  client,
  syntheticUser,
  { resetMcpAccessTokens = false } = {},
) {
  const userId = requireSyntheticFixtureUser(syntheticUser);
  const ids = fixtureIdsForUser(userId);
  const items = [
    {
      id: ids.itemIds[0],
      nodeId: ids.nodeIds[0],
      title: `${AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX} A`,
      summary: 'Synthetic private node A for authenticated overlay evidence.',
      content: 'This synthetic item exists only to verify the owner-scoped graph overlay.',
      dedupeKey: `e2e-overlay-${ids.suffix}-a`,
    },
    {
      id: ids.itemIds[1],
      nodeId: ids.nodeIds[1],
      title: `${AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX} B`,
      summary: 'Synthetic private node B for authenticated overlay evidence.',
      content: 'This synthetic item forms one private relationship with fixture node A.',
      dedupeKey: `e2e-overlay-${ids.suffix}-b`,
    },
    {
      id: ids.itemIds[2],
      nodeId: ids.nodeIds[2],
      title: `${AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX} C`,
      summary: 'Synthetic private node C for independent Thinking History evidence.',
      content: 'This synthetic item starts a second owner-scoped private relationship.',
      dedupeKey: `e2e-overlay-${ids.suffix}-c`,
    },
    {
      id: ids.itemIds[3],
      nodeId: ids.nodeIds[3],
      title: `${AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX} D`,
      summary: 'Synthetic private node D for independent Thinking History dismissal.',
      content: 'This synthetic item completes the second private relationship.',
      dedupeKey: `e2e-overlay-${ids.suffix}-d`,
    },
  ];

  await client.query('BEGIN');
  try {
    const draftProbeTitles = [
      'Unsaved create draft',
      `${AUTHENTICATED_OVERLAY_DRAFT_PROBE_TITLE_PREFIX} %`,
    ];
    const mobileApiTitlePattern = 'E2E\\_MOBILE\\_API\\_%';
    await client.query(
      `DELETE FROM user_graph_nodes
       WHERE user_id = $1
         AND knowledge_item_id IN (
           SELECT id
           FROM user_knowledge_items
           WHERE user_id = $1
             AND (title = $2 OR title LIKE $3 OR title LIKE $4 ESCAPE '\\')
         )`,
      [userId, ...draftProbeTitles, mobileApiTitlePattern],
    );
    await client.query(
      `DELETE FROM user_knowledge_items
       WHERE user_id = $1
         AND (title = $2 OR title LIKE $3 OR title LIKE $4 ESCAPE '\\')`,
      [userId, ...draftProbeTitles, mobileApiTitlePattern],
    );
    // This Clerk account is dedicated to synthetic Preview evidence. Remove
    // any public-card state left by an interrupted mobile API evidence run.
    await client.query(
      'DELETE FROM user_card_states WHERE user_id = $1',
      [userId],
    );

    if (resetMcpAccessTokens) {
      // Keep repeated Preview evidence runs below the immutable application
      // quota without widening cleanup beyond the validated synthetic owner.
      await client.query(
        'DELETE FROM mcp_access_tokens WHERE user_id = $1',
        [userId],
      );
    }

    // The setup caller validates the dedicated marker-owned Clerk account.
    // Clear failed-run import residue for this exact owner so every evidence
    // run starts with no partial pending content; never broaden the predicates.
    await client.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE user_id = $1 AND scope = 'selected_export'`,
      [userId],
    );
    await client.query(
      `DELETE FROM knowledge_ingestion_batches
       WHERE user_id = $1 AND provider = 'other'
         AND scope = 'current_conversation'
         AND request_id LIKE 'mobile-api-evidence:E2E\\_MOBILE\\_API\\_%' ESCAPE '\\'`,
      [userId],
    );
    await client.query(
      `DELETE FROM knowledge_ingestion_request_tombstones
       WHERE user_id = $1 AND provider = 'chatgpt'`,
      [userId],
    );
    const productEventsTable = await client.query(
      `SELECT to_regclass('public.knowledge_product_events') IS NOT NULL AS available`,
    );
    if (productEventsTable.rows[0]?.available) {
      await client.query(
        'DELETE FROM knowledge_product_events WHERE user_id = $1',
        [userId],
      );
    }

    // Context-pack creation records one reuse activity row per selected item.
    // Reset only the deterministic fixture items so repeated Preview evidence
    // cannot grow the next synthetic context pack until it reaches the output
    // size limit. The dedicated synthetic owner and exact IDs keep real user
    // activity outside this cleanup boundary.
    await client.query(
      `DELETE FROM knowledge_item_activity
       WHERE user_id = $1 AND knowledge_item_id = ANY($2::text[])`,
      [userId, ids.itemIds],
    );

    for (const item of items) {
      await client.query(
        `INSERT INTO user_knowledge_items (
           id, user_id, title, summary, content, topic, tags, version, dedupe_key,
           knowledge_type, central_question, structured_content, bundle_schema_version,
           created_at, updated_at, deleted_at, purge_at, archived_at
         ) VALUES (
           $1, $2, $3, $4, $5, 'synthetic-overlay', $6::jsonb, 1, $7,
           NULL, NULL, NULL, NULL, NOW(), NOW(), NULL, NULL, NULL
         )
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           content = EXCLUDED.content,
           topic = EXCLUDED.topic,
           tags = EXCLUDED.tags,
           dedupe_key = EXCLUDED.dedupe_key,
           knowledge_type = NULL,
           central_question = NULL,
           structured_content = NULL,
           bundle_schema_version = NULL,
           updated_at = NOW(),
           deleted_at = NULL,
           purge_at = NULL,
           archived_at = NULL
         WHERE user_knowledge_items.user_id = EXCLUDED.user_id`,
        [
          item.id,
          userId,
          item.title,
          item.summary,
          item.content,
          JSON.stringify(['e2e', 'synthetic', 'authenticated-overlay']),
          item.dedupeKey,
        ],
      );

      await client.query(
        `INSERT INTO user_graph_nodes (
           id, user_id, knowledge_item_id, label, topic, origin,
           source_batch_id, created_at, updated_at, deleted_at, purge_at
         ) VALUES ($1, $2, $3, $4, 'synthetic-overlay', 'manual', NULL, NOW(), NOW(), NULL, NULL)
         ON CONFLICT (id) DO UPDATE SET
           knowledge_item_id = EXCLUDED.knowledge_item_id,
           label = EXCLUDED.label,
           topic = EXCLUDED.topic,
           origin = 'manual',
           source_batch_id = NULL,
           updated_at = NOW(),
           deleted_at = NULL,
           purge_at = NULL
         WHERE user_graph_nodes.user_id = EXCLUDED.user_id`,
        [item.nodeId, userId, item.id, item.title],
      );
    }

    const publicNodeResult = await client.query(
      'SELECT id FROM graph_nodes ORDER BY id LIMIT 1',
    );
    const publicNodeId = publicNodeResult.rows[0]?.id;

    for (const [edgeId, sourceNodeId, targetNodeId] of [
      [ids.privateEdgeId, ids.nodeIds[0], ids.nodeIds[1]],
      [ids.secondaryPrivateEdgeId, ids.nodeIds[2], ids.nodeIds[3]],
    ]) {
      await client.query(
        `INSERT INTO user_graph_edges (
           id, user_id, source_private_node_id, source_public_node_id,
           target_private_node_id, target_public_node_id, type, weight, origin,
           relation_origin, confirmed_at, source_batch_id, created_at, deleted_at, purge_at
         ) VALUES (
           $1, $2, $3, NULL, $4, NULL, 'related', 1, 'manual',
           'explicit_user', NOW(), NULL, NOW(), NULL, NULL
         )
         ON CONFLICT (id) DO UPDATE SET
           source_private_node_id = EXCLUDED.source_private_node_id,
           source_public_node_id = NULL,
           target_private_node_id = EXCLUDED.target_private_node_id,
           target_public_node_id = NULL,
           type = 'related',
           weight = 1,
           origin = 'manual',
           relation_origin = 'explicit_user',
           confirmed_at = NOW(),
           source_batch_id = NULL,
           deleted_at = NULL,
           purge_at = NULL
         WHERE user_graph_edges.user_id = EXCLUDED.user_id`,
        [edgeId, userId, sourceNodeId, targetNodeId],
      );
    }

    if (publicNodeId) {
      await client.query(
        `INSERT INTO user_graph_edges (
           id, user_id, source_private_node_id, source_public_node_id,
           target_private_node_id, target_public_node_id, type, weight, origin,
           relation_origin, confirmed_at, source_batch_id, created_at, deleted_at, purge_at
         ) VALUES (
           $1, $2, NULL, $3, $4, NULL, 'related', 1, 'manual',
           'explicit_user', NOW(), NULL, NOW(), NULL, NULL
         )
         ON CONFLICT (id) DO UPDATE SET
           source_private_node_id = NULL,
           source_public_node_id = EXCLUDED.source_public_node_id,
           target_private_node_id = EXCLUDED.target_private_node_id,
           target_public_node_id = NULL,
           type = 'related',
           weight = 1,
           origin = 'manual',
           relation_origin = 'explicit_user',
           confirmed_at = NOW(),
           source_batch_id = NULL,
           deleted_at = NULL,
           purge_at = NULL
         WHERE user_graph_edges.user_id = EXCLUDED.user_id`,
        [ids.publicEdgeId, userId, String(publicNodeId), ids.nodeIds[0]],
      );
    }

    const verification = await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM user_graph_nodes
          WHERE user_id = $1 AND id = ANY($2::text[]) AND deleted_at IS NULL) AS private_nodes,
         (SELECT COUNT(*)::int FROM user_graph_edges
          WHERE user_id = $1 AND id = ANY($3::text[]) AND deleted_at IS NULL) AS private_edges,
         (SELECT COUNT(*)::int FROM user_graph_edges
          WHERE user_id = $1 AND id = $4 AND source_public_node_id IS NOT NULL
            AND target_private_node_id IS NOT NULL AND deleted_at IS NULL) AS public_links,
         (SELECT COUNT(*)::int FROM user_knowledge_items
          WHERE user_id = $1 AND (title = $5 OR title LIKE $6)) AS draft_probes,
         (SELECT COUNT(*)::int FROM user_knowledge_items
          WHERE user_id = $1 AND title LIKE $7 ESCAPE '\\') AS mobile_api_items,
         (SELECT COUNT(*)::int FROM knowledge_ingestion_batches
          WHERE user_id = $1 AND provider = 'other'
            AND scope = 'current_conversation'
            AND request_id LIKE 'mobile-api-evidence:E2E\\_MOBILE\\_API\\_%' ESCAPE '\\') AS mobile_api_batches,
         (SELECT COUNT(*)::int FROM user_card_states
          WHERE user_id = $1) AS mobile_api_ranking_rows,
         (SELECT COUNT(*)::int FROM knowledge_product_events
          WHERE user_id = $1 AND event_name IN (
            'conversation_import_started', 'conversation_import_parsed'
          )) AS import_submission_events`,
      [
        userId,
        ids.nodeIds,
        [ids.privateEdgeId, ids.secondaryPrivateEdgeId],
        ids.publicEdgeId,
        ...draftProbeTitles,
        mobileApiTitlePattern,
      ],
    );
    const counts = verification.rows[0] ?? {};
    if (
      Number(counts.private_nodes) < 4
      || Number(counts.private_edges) < 2
      || Number(counts.draft_probes) !== 0
      || Number(counts.mobile_api_items) !== 0
      || Number(counts.mobile_api_batches) !== 0
      || Number(counts.mobile_api_ranking_rows) !== 0
      || Number(counts.import_submission_events) !== 0) {
      throw new Error('Authenticated overlay fixture verification did not find the required owner-scoped rows.');
    }

    await client.query('COMMIT');
    return {
      ...ids,
      counts: {
        privateNodes: Number(counts.private_nodes),
        privateEdges: Number(counts.private_edges),
        publicLinks: Number(counts.public_links),
        importSubmissionEvents: Number(counts.import_submission_events),
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export async function ensureAuthenticatedOverlayFixture({
  emailAddress = process.env.E2E_CLERK_USER_EMAIL,
  secretKey = process.env.CLERK_SECRET_KEY,
  databaseUrl = process.env.DATABASE_URL,
  resetMcpAccessTokens = false,
} = {}) {
  const email = normalizeSyntheticEmail(emailAddress);
  const clerkClient = createClerkClient({ secretKey: requireValue(secretKey, 'CLERK_SECRET_KEY') });
  const { user, created } = await ensureSyntheticClerkUser({ clerkClient, emailAddress: email });
  const pool = new Pool({ connectionString: requireValue(databaseUrl, 'DATABASE_URL'), max: 1 });
  const client = await pool.connect();
  try {
    const fixture = await seedAuthenticatedOverlayFixtureWithClient(
      client,
      user,
      { resetMcpAccessTokens },
    );
    return { user, createdClerkUser: created, fixture };
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMain) {
  ensureAuthenticatedOverlayFixture()
    .then((result) => {
      console.log(JSON.stringify({
        createdClerkUser: result.createdClerkUser,
        ...result.fixture.counts,
      }));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
