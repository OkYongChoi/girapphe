import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type APIResponse, type Page } from '@playwright/test';
import {
  AUTHENTICATED_OVERLAY_AUTH_MODES,
  resolveAuthenticatedOverlayAuthMode,
} from '../scripts/authenticated-overlay-auth.mjs';

const CAPABILITIES = 'expression-v1,event-chronology-v1,causal-relations-v1';
const PRIVATE_CACHE = /(?:^|,)\s*private\b[\s\S]*no-store/i;

type JsonRecord = Record<string, unknown>;

function requirePreviewMobileProject(projectName: string) {
  test.skip(
    projectName !== 'authenticated-mobile'
      || resolveAuthenticatedOverlayAuthMode() !== AUTHENTICATED_OVERLAY_AUTH_MODES.testingToken,
    'Deployed mobile API mutations run once on the isolated Preview synthetic user.',
  );
}

async function json(response: APIResponse, label: string, expectedStatus = 200): Promise<JsonRecord> {
  expect(response.status(), `${label} status`).toBe(expectedStatus);
  const value = await response.json();
  expect(value, `${label} JSON object`).toBeTruthy();
  expect(Array.isArray(value), `${label} must not return an array root`).toBe(false);
  expect(typeof value, `${label} JSON type`).toBe('object');
  return value as JsonRecord;
}

async function privateJson(
  response: APIResponse,
  label: string,
  expectedStatus = 200,
): Promise<JsonRecord> {
  expect(response.headers()['cache-control'] ?? '', `${label} cache policy`).toMatch(PRIVATE_CACHE);
  return json(response, label, expectedStatus);
}

function mobileHeaders() {
  return {
    'X-Girapphe-Knowledge-Capabilities': CAPABILITIES,
  };
}

function privateOnlyCursor(mode: 'new' | 'review') {
  return Buffer.from(JSON.stringify({
    v: 1,
    mode,
    nextSource: 'private',
    publicAfter: null,
    privateAfter: null,
    publicDone: true,
    privateDone: false,
  })).toString('base64url');
}

async function postMobile(page: Page, data: JsonRecord) {
  return page.request.post('/api/mobile', {
    data,
    headers: mobileHeaders(),
  });
}

async function loadNotes(page: Page, view?: 'archive' | 'trash') {
  const suffix = view ? `&view=${view}` : '';
  return privateJson(
    await page.request.get(`/api/mobile?resource=notes&locale=en${suffix}`, {
      headers: mobileHeaders(),
    }),
    `notes ${view ?? 'active'}`,
  );
}

async function findPrivatePracticeCard(page: Page, mode: 'new' | 'review', cardId: string) {
  let cursor: string | null = privateOnlyCursor(mode);
  for (let requestCount = 0; requestCount < 100; requestCount += 1) {
    const payload = await privateJson(
      await page.request.post('/api/mobile?resource=practice&locale=en', {
        data: { mode, cursor, cycleOnEmpty: false },
        headers: mobileHeaders(),
      }),
      `Practice ${mode} traversal`,
    );
    const card = payload.card as JsonRecord | null;
    if (card?.id === cardId) return { payload, requestCount: requestCount + 1 };
    if (card === null || typeof payload.nextCursor !== 'string') break;
    cursor = payload.nextCursor;
  }
  throw new Error(`MOBILE_API_PRIVATE_PRACTICE_CARD_NOT_FOUND:${mode}`);
}

test('deployed mobile APIs preserve owner-scoped topics, ranking, practice, notes, and candidates', async ({
  page,
}, testInfo) => {
  requirePreviewMobileProject(testInfo.project.name);
  const marker = `E2E_MOBILE_API_${randomBytes(16).toString('hex')}`;
  const {
    cleanupAuthenticatedMobileApiFixture,
    createAuthenticatedMobileApiFixture,
  } = await import('../scripts/authenticated-mobile-api-fixture.mjs');
  const fixture = await createAuthenticatedMobileApiFixture({ marker });
  let noteId: string | null = null;
  let evidenceError: unknown = null;
  let cleanupError: unknown = null;
  let artifactError: unknown = null;
  const evidence = {
    schemaVersion: 1,
    project: testInfo.project.name,
    privateNoStoreReads: 0,
    noteLifecycle: false,
    topicsAndHub: false,
    rankingAnonymous: false,
    practiceNewAndReview: false,
    candidateApproveIgnoreAndStale: false,
    cleanup: false,
  };

  try {
    const createNotePayload = {
      action: 'create-note',
      requestId: marker,
      title: marker,
      summary: 'Synthetic deployed mobile API evidence.',
      content: 'Created only for this owner-scoped Preview run.',
      topic: 'mobile-api-evidence',
      tags: ['e2e', 'mobile-api'],
      knowledge_type: 'concept',
      central_question: 'Does the deployed mobile API preserve the private lifecycle?',
      structured_content: {
        type: 'concept',
        definition: 'A temporary synthetic private note.',
        key_points: [],
        examples: [],
        non_examples: [],
        misconceptions: [],
      },
      bundle_schema_version: 1,
    };
    const createdPayload = await privateJson(
      await postMobile(page, createNotePayload),
      'create note',
      201,
    );
    expect(createdPayload.outcome).toBe('inserted');
    const editedRetryPayload = {
      ...createNotePayload,
      summary: 'This edit happened before the client learned the first save succeeded.',
      content: 'A replay must not overwrite the first saved version or create a duplicate.',
      tags: ['e2e', 'mobile-api', 'edited-retry'],
      central_question: 'Does an edited retry preserve the first owner-scoped save?',
      structured_content: {
        type: 'concept',
        definition: 'This changed definition must remain unsaved after the replay.',
        key_points: [],
        examples: [],
        non_examples: [],
        misconceptions: [],
      },
    };
    expect(editedRetryPayload.requestId).toBe(createNotePayload.requestId);
    const replayedPayload = await privateJson(
      await postMobile(page, editedRetryPayload),
      'replay edited create note',
      200,
    );
    expect(replayedPayload.outcome).toBe('replayed');

    const activeAfterCreate = await loadNotes(page);
    evidence.privateNoStoreReads += 1;
    const matchingNotes = (activeAfterCreate.items as JsonRecord[])
      .filter((item) => item.title === marker);
    expect(matchingNotes, 'idempotent create leaves exactly one owner note').toHaveLength(1);
    const created = matchingNotes[0];
    expect(created, 'created note appears only in owner active notes').toBeTruthy();
    noteId = String(created?.id ?? '');
    expect(noteId).not.toBe('');
    expect(created?.summary).toBe(createNotePayload.summary);
    expect(created?.content).toBe('Definition\nA temporary synthetic private note.');
    expect(created?.tags).toEqual(['e2e', 'mobile-api']);
    expect(created?.knowledge_type).toBe('concept');
    expect(created?.central_question).toBe(createNotePayload.central_question);
    expect(created?.structured_content).toEqual(createNotePayload.structured_content);
    let version = Number(created?.version);
    expect(version).toBe(1);

    const update = await privateJson(await postMobile(page, {
      action: 'update-note',
      id: noteId,
      version,
      title: marker,
      summary: 'Updated through the deployed mobile API.',
      content: 'The optimistic version advanced exactly once.',
      topic: 'mobile-api-evidence',
      tags: ['e2e', 'mobile-api', 'updated'],
      knowledge_type: 'concept',
      central_question: 'Does the deployed mobile API preserve the private lifecycle?',
      structured_content: {
        type: 'concept',
        definition: 'A temporary updated synthetic private note.',
        key_points: [],
        examples: [],
        non_examples: [],
        misconceptions: [],
      },
      bundle_schema_version: 1,
    }), 'update note');
    version = Number(update.version);
    expect(Number.isSafeInteger(version) && version > Number(created?.version)).toBe(true);

    const archived = await privateJson(await postMobile(page, {
      action: 'archive-note',
      id: noteId,
      version,
    }), 'archive note');
    version = Number(archived.version);
    const archiveView = await loadNotes(page, 'archive');
    evidence.privateNoStoreReads += 1;
    expect((archiveView.items as JsonRecord[]).some((item) => item.id === noteId)).toBe(true);

    const restoredArchive = await privateJson(await postMobile(page, {
      action: 'restore-archived-note',
      id: noteId,
      version,
    }), 'restore archived note');
    version = Number(restoredArchive.version);
    await privateJson(await postMobile(page, { action: 'delete-note', id: noteId }), 'trash note');
    const trashView = await loadNotes(page, 'trash');
    evidence.privateNoStoreReads += 1;
    expect((trashView.items as JsonRecord[]).some((item) => item.id === noteId)).toBe(true);
    await privateJson(await postMobile(page, { action: 'restore-note', id: noteId }), 'restore trashed note');
    const activeAfterRestore = await loadNotes(page);
    evidence.privateNoStoreReads += 1;
    const restored = (activeAfterRestore.items as JsonRecord[]).find((item) => item.id === noteId);
    expect(restored?.version).toBe(version + 1);
    expect(restored?.tags).toEqual(['e2e', 'mobile-api', 'updated']);
    evidence.noteLifecycle = true;

    const topics = await privateJson(
      await page.request.get('/api/mobile?resource=topics&locale=en', { headers: mobileHeaders() }),
      'topics',
    );
    evidence.privateNoStoreReads += 1;
    expect((topics.topics as JsonRecord[]).some((topic) => (
      topic.topic === 'mobile-api-evidence' && Number(topic.item_count) >= 1
    ))).toBe(true);
    const hub = await privateJson(
      await page.request.get(
        '/api/mobile?resource=topic-hub&locale=en&topic=mobile-api-evidence',
        { headers: mobileHeaders() },
      ),
      'topic hub',
    );
    evidence.privateNoStoreReads += 1;
    expect(((hub.hub as JsonRecord).items as JsonRecord[]).some((item) => item.id === noteId)).toBe(true);
    evidence.topicsAndHub = true;

    const newPractice = await findPrivatePracticeCard(page, 'new', `personal:${noteId}`);
    evidence.privateNoStoreReads += newPractice.requestCount;
    expect(newPractice.payload.nextCursor).toEqual(expect.any(String));
    await privateJson(await postMobile(page, {
      action: 'rate-card',
      cardId: `personal:${noteId}`,
      status: 'saved',
    }), 'rate private card saved');
    const reviewPractice = await findPrivatePracticeCard(page, 'review', `personal:${noteId}`);
    evidence.privateNoStoreReads += reviewPractice.requestCount;
    expect(reviewPractice.payload.card).toEqual(expect.objectContaining({ id: `personal:${noteId}` }));
    await privateJson(await postMobile(page, {
      action: 'rate-card',
      cardId: `personal:${noteId}`,
      status: 'known',
    }), 'rate private card known');
    evidence.practiceNewAndReview = true;

    const ranking = await privateJson(
      await page.request.get('/api/mobile?resource=ranking&locale=en', { headers: mobileHeaders() }),
      'ranking',
    );
    evidence.privateNoStoreReads += 1;
    const rankingRows = ranking.rows as JsonRecord[];
    expect(Array.isArray(rankingRows)).toBe(true);
    expect(rankingRows.length).toBeGreaterThan(0);
    for (const row of rankingRows) {
      expect(Object.keys(row).sort()).toEqual([
        'avgScore',
        'explainable',
        'isCurrentUser',
        'label',
        'participantId',
        'rank',
      ]);
      expect(row.label).toBe(`Learner ${row.rank}`);
      expect(row.participantId).toMatch(/^[0-9a-f]{12}$/);
      expect(typeof row.isCurrentUser).toBe('boolean');
      expect(JSON.stringify(row)).not.toContain('@');
    }
    const currentRows = rankingRows.filter((row) => row.isCurrentUser === true);
    expect(currentRows).toHaveLength(1);
    expect(currentRows[0]?.participantId).toBe(fixture.expectedParticipantId);
    evidence.rankingAnonymous = true;

    const inbox = await privateJson(
      await page.request.get('/api/mobile?resource=candidate-inbox&locale=en', {
        headers: mobileHeaders(),
      }),
      'candidate inbox',
    );
    evidence.privateNoStoreReads += 1;
    expect((inbox.batches as JsonRecord[]).some((batch) => batch.id === fixture.batchId)).toBe(true);
    const candidateBatch = await privateJson(
      await page.request.get(
        `/api/mobile?resource=candidate-batch&locale=en&batchId=${encodeURIComponent(fixture.batchId)}`,
        { headers: mobileHeaders() },
      ),
      'candidate batch',
    );
    evidence.privateNoStoreReads += 1;
    expect((candidateBatch.drafts as JsonRecord[]).map((draft) => draft.id).sort()).toEqual([
      fixture.drafts.approve.id,
      fixture.drafts.ignore.id,
    ].sort());

    const approved = await privateJson(await postMobile(page, {
      action: 'approve-candidate',
      batchId: fixture.batchId,
      draftId: fixture.drafts.approve.id,
      draftVersion: fixture.drafts.approve.version,
    }), 'approve candidate');
    expect(approved.resolved).toBe(true);
    const staleApprove = await privateJson(await postMobile(page, {
      action: 'approve-candidate',
      batchId: fixture.batchId,
      draftId: fixture.drafts.approve.id,
      draftVersion: fixture.drafts.approve.version,
    }), 'reject stale approved candidate', 409);
    expect(staleApprove.code).toBe('CANDIDATE_STALE');

    const ignored = await privateJson(await postMobile(page, {
      action: 'ignore-candidate',
      batchId: fixture.batchId,
      draftId: fixture.drafts.ignore.id,
      draftVersion: fixture.drafts.ignore.version,
    }), 'ignore candidate');
    expect(ignored.resolved).toBe(true);
    const staleIgnore = await privateJson(await postMobile(page, {
      action: 'ignore-candidate',
      batchId: fixture.batchId,
      draftId: fixture.drafts.ignore.id,
      draftVersion: fixture.drafts.ignore.version,
    }), 'reject stale ignored candidate', 409);
    expect(staleIgnore.code).toBe('CANDIDATE_STALE');
    evidence.candidateApproveIgnoreAndStale = true;
  } catch (error) {
    evidenceError = error;
  } finally {
    try {
      const cleanup = await cleanupAuthenticatedMobileApiFixture({
        marker,
        batchId: fixture.batchId,
        noteId,
        rankingCardId: fixture.rankingCardId,
      });
      expect(cleanup.remainingRows).toBe(0);
      evidence.cleanup = true;
    } catch (error) {
      cleanupError = error;
    }

    if (evidenceError === null && cleanupError === null) {
      try {
        expect(Object.values(evidence).filter((value) => typeof value === 'boolean'))
          .not.toContain(false);
      } catch (error) {
        evidenceError = error;
      }
    }

    try {
      const evidenceDirectory = path.resolve(
        'test-results/authenticated-overlay-performance/mobile-api',
      );
      const serializedEvidence = `${JSON.stringify(evidence, null, 2)}\n`;
      await mkdir(evidenceDirectory, { recursive: true });
      await writeFile(
        path.join(evidenceDirectory, `${testInfo.project.name}.json`),
        serializedEvidence,
        { mode: 0o600 },
      );
      await testInfo.attach('authenticated-mobile-api-evidence', {
        body: Buffer.from(serializedEvidence),
        contentType: 'application/json',
      });
    } catch (error) {
      artifactError = error;
    }
  }

  const failures = [evidenceError, cleanupError, artifactError]
    .filter((error): error is NonNullable<typeof error> => error !== null);
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Authenticated mobile API evidence and cleanup failed.');
  }
});
