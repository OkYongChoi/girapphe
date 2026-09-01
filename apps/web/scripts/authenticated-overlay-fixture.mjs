import { createHash, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createClerkClient } from '@clerk/backend';
import pg from 'pg';

const { Pool } = pg;

export const AUTHENTICATED_OVERLAY_FIXTURE_TITLE_PREFIX = 'Girapphe authenticated overlay fixture';
export const AUTHENTICATED_OVERLAY_SYNTHETIC_PURPOSE = 'authenticated-overlay-e2e';
export const AUTHENTICATED_OVERLAY_EMAIL_MARKER = '+clerk_test_girapphe_overlay_e2e';

function requireValue(value, name) {
  const normalized = String(value ?? '').trim();
  if (!normalized) throw new Error(`${name} is required for authenticated overlay evidence.`);
  return normalized;
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
    itemIds: [`e2e_overlay_item_${suffix}_a`, `e2e_overlay_item_${suffix}_b`],
    nodeIds: [`e2e_overlay_node_${suffix}_a`, `e2e_overlay_node_${suffix}_b`],
    privateEdgeId: `e2e_overlay_edge_${suffix}_private`,
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

export async function seedAuthenticatedOverlayFixtureWithClient(client, userIdInput) {
  const userId = requireValue(userIdInput, 'Clerk user ID');
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
  ];

  await client.query('BEGIN');
  try {
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

    await client.query(
      `INSERT INTO user_graph_edges (
         id, user_id, source_private_node_id, source_public_node_id,
         target_private_node_id, target_public_node_id, type, weight, origin,
         relation_origin, confirmed_at, source_batch_id, created_at, deleted_at, purge_at
       ) VALUES (
         $1, $2, $3, NULL, $4, NULL, 'supports', 1, 'manual',
         'explicit_user', NOW(), NULL, NOW(), NULL, NULL
       )
       ON CONFLICT (id) DO UPDATE SET
         source_private_node_id = EXCLUDED.source_private_node_id,
         source_public_node_id = NULL,
         target_private_node_id = EXCLUDED.target_private_node_id,
         target_public_node_id = NULL,
         type = 'supports',
         weight = 1,
         origin = 'manual',
         relation_origin = 'explicit_user',
         confirmed_at = NOW(),
         source_batch_id = NULL,
         deleted_at = NULL,
         purge_at = NULL
       WHERE user_graph_edges.user_id = EXCLUDED.user_id`,
      [ids.privateEdgeId, userId, ids.nodeIds[0], ids.nodeIds[1]],
    );

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
          WHERE user_id = $1 AND id = $3 AND deleted_at IS NULL) AS private_edges,
         (SELECT COUNT(*)::int FROM user_graph_edges
          WHERE user_id = $1 AND id = $4 AND source_public_node_id IS NOT NULL
            AND target_private_node_id IS NOT NULL AND deleted_at IS NULL) AS public_links`,
      [userId, ids.nodeIds, ids.privateEdgeId, ids.publicEdgeId],
    );
    const counts = verification.rows[0] ?? {};
    if (Number(counts.private_nodes) < 2 || Number(counts.private_edges) < 1) {
      throw new Error('Authenticated overlay fixture verification did not find the required owner-scoped rows.');
    }

    await client.query('COMMIT');
    return {
      ...ids,
      counts: {
        privateNodes: Number(counts.private_nodes),
        privateEdges: Number(counts.private_edges),
        publicLinks: Number(counts.public_links),
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
} = {}) {
  const email = normalizeSyntheticEmail(emailAddress);
  const clerkClient = createClerkClient({ secretKey: requireValue(secretKey, 'CLERK_SECRET_KEY') });
  const { user, created } = await ensureSyntheticClerkUser({ clerkClient, emailAddress: email });
  const pool = new Pool({ connectionString: requireValue(databaseUrl, 'DATABASE_URL'), max: 1 });
  const client = await pool.connect();
  try {
    const fixture = await seedAuthenticatedOverlayFixtureWithClient(client, user.id);
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
