import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import db from './db';
import {
  assessmentFeedbackAppliesToNode,
  submitAssessmentWithCooldownRetry,
} from './assessment-retry';
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  readBoundedJsonBody,
} from './bounded-json-body';
import { escapeGraphTooltipText, getPersonalizedNoteGraphAdditions } from './home-graph-notes';
import {
  QuizRateLimitError,
  UnknownGraphNodeError,
  submitDbQuizResult,
} from './knowledge-graph-db';
import {
  getMockCardStatus,
  getMockPracticeStats,
  isCardEligibleForPracticeMode,
} from './practice-queue';

test('bounded JSON parsing rejects actual bytes beyond the declared length', async () => {
  const request = new Request('http://localhost/api/quiz_result', {
    method: 'POST',
    headers: { 'content-length': '2', 'content-type': 'application/json' },
    body: JSON.stringify({ node_id: 'larger-than-header', result: 1 }),
  });

  await assert.rejects(readBoundedJsonBody(request, 16), RequestBodyTooLargeError);
});

test('bounded JSON parsing rejects oversized streaming bodies without Content-Length', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"node_id":"'));
      controller.enqueue(encoder.encode('x'.repeat(32)));
      controller.enqueue(encoder.encode('","result":1}'));
      controller.close();
    },
  });
  const request = new Request('http://localhost/api/quiz_result', {
    method: 'POST',
    body: stream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  assert.equal(request.headers.has('content-length'), false);
  await assert.rejects(readBoundedJsonBody(request, 24), RequestBodyTooLargeError);
});

test('bounded JSON parsing distinguishes malformed JSON', async () => {
  const request = new Request('http://localhost/api/quiz_result', {
    method: 'POST',
    body: '{not-json',
  });

  await assert.rejects(readBoundedJsonBody(request, 128), InvalidJsonBodyError);
});

test('a rate-limited graph assessment retries the same state once', async () => {
  const submissions: Array<{ nodeId: string; result: 0 | 0.5 | 1 }> = [];
  const delays: number[] = [];
  const response = await submitAssessmentWithCooldownRetry({
    nodeId: 'linear_algebra',
    result: 0.5,
    submit: async (nodeId, result) => {
      submissions.push({ nodeId, result });
      if (submissions.length === 1) {
        return {
          success: false,
          node: null,
          propagated_count: 0,
          error: 'rate_limited' as const,
          retry_after_ms: 2_000,
        };
      }
      return { success: true, node: { id: nodeId, knowledge: result }, propagated_count: 0 };
    },
    sleep: async (milliseconds) => { delays.push(milliseconds); },
  });

  assert.equal(response.success, true);
  assert.deepEqual(submissions, [
    { nodeId: 'linear_algebra', result: 0.5 },
    { nodeId: 'linear_algebra', result: 0.5 },
  ]);
  assert.deepEqual(delays, [2_000]);
});

test('quiz feedback stays attached to the node that was submitted', () => {
  assert.equal(assessmentFeedbackAppliesToNode('node-a', 'node-a'), true);
  assert.equal(assessmentFeedbackAppliesToNode('node-a', 'node-b'), false);
  assert.equal(assessmentFeedbackAppliesToNode('node-a', null), false);
});

test('guest review stats and the mock review queue use the same statuses', () => {
  const guestCardCount = 12;
  const statuses = Array.from({ length: guestCardCount }, (_, index) => getMockCardStatus(index));
  const stats = getMockPracticeStats(guestCardCount);

  assert.deepEqual(stats, { explainable: 3, unclear: 2 });
  assert.equal(
    statuses.filter((status) => isCardEligibleForPracticeMode(status, 'review')).length,
    stats.unclear,
  );
  assert.equal(
    statuses.filter((status) => isCardEligibleForPracticeMode(status, 'new')).length,
    guestCardCount - stats.explainable - stats.unclear,
  );
  assert.equal(isCardEligibleForPracticeMode('saved', 'new'), false);
});

test('personal notes become a distinct group linked by topic matches', () => {
  const additions = getPersonalizedNoteGraphAdditions(
    [{ id: 'note-1', title: 'Gradient descent pitfall', topic: 'machine-learning' }],
    [
      { id: 'gradient_descent', label: 'Gradient Descent', domain: 'Optimization' },
      { id: 'neural_networks', label: 'Neural Networks', domain: 'Machine Learning' },
      { id: 'cell_biology', label: 'Cell Biology', domain: 'Biology' },
    ],
  );

  assert.equal(additions.nodes.length, 1);
  assert.equal(additions.nodes[0]?.id, 'personal-note:note-1');
  assert.equal(additions.nodes[0]?.group, 'notes');
  assert.equal(
    additions.links.some(
      (link) =>
        link.source === 'gradient_descent' &&
        link.target === 'personal-note:note-1' &&
        link.relationship === 'topic_match',
    ),
    true,
  );
  assert.equal(additions.links.some((link) => link.source === 'cell_biology'), false);
});

test('home graph tooltips escape stored note titles before the non-React tooltip sink', () => {
  const escaped = escapeGraphTooltipText('<img src=x onerror="alert(1)">&\'');

  assert.equal(escaped, '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
  assert.equal(escaped.includes('<'), false);
  assert.equal(escaped.includes('>'), false);
});

test('the memory quiz path rejects unknown graph node IDs', async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  try {
    await assert.rejects(
      submitDbQuizResult('stabilization-test-user', 'not_a_real_graph_node', 1),
      UnknownGraphNodeError,
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
});

test('unknown database quiz nodes consume cooldown before later graph queries', async (context) => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const originalQuery = db.query;
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  let claimCalls = 0;

  context.after(() => {
    db.query = originalQuery;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  });

  process.env.DATABASE_URL = 'postgres://stabilization-test.invalid/girapphe';
  db.query = (async (text: string, params?: unknown[]) => {
    calls.push({ text, params });
    if (text.includes('INSERT INTO user_quiz_rate_limits')) {
      claimCalls += 1;
      return {
        rows: claimCalls === 1 ? [{ user_id: 'stabilization-test-user' }] : [],
      };
    }
    return { rows: [] };
  }) as typeof db.query;

  await assert.rejects(
    submitDbQuizResult('stabilization-test-user', 'not_a_real_graph_node', 1),
    UnknownGraphNodeError,
  );
  assert.equal(calls.length, 4);
  assert.match(calls[0].text, /INSERT INTO user_quiz_rate_limits/);

  const callsBeforeRateRejection = calls.length;
  await assert.rejects(
    submitDbQuizResult('stabilization-test-user', 'another_unknown_graph_node', 1),
    QuizRateLimitError,
  );
  assert.equal(calls.length, callsBeforeRateRejection + 1);
  assert.match(calls.at(-1)?.text ?? '', /INSERT INTO user_quiz_rate_limits/);
  assert.equal(claimCalls, 2);
});

test('mobile private graph summaries are invalidated on account transitions', async () => {
  const [homeSource, browseSource] = await Promise.all([
    readFile(new URL('../../../mobile/app/(tabs)/index.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../../mobile/app/(tabs)/browse.tsx', import.meta.url), 'utf8'),
  ]);

  for (const source of [homeSource, browseSource]) {
    assert.match(source, /useFocusEffect\(/);
    assert.match(source, /let active = true;/);
    assert.match(source, /if \(!isSignedIn \|\| !userId\)/);
    assert.match(source, /if \(!active\)|if \(active\)/);
    assert.match(source, /return \(\) => \{ active = false; \};/);
    assert.match(source, /\[isSignedIn, (?:locale, )?userId\]/);
    assert.match(source, /isCurrentPrivateGraphOwner\(isSignedIn, userId, graphOwnerId\)/);
    assert.match(source, /setGraphOwnerId\(requestUserId\)/);
    assert.match(source, /isSignedIn && userId && currentPersonalNotes\.length > 0/);
  }
  assert.match(browseSource, /mergeBrowseConcepts\(publicNodes, visiblePersonalNotes\)/);
  assert.match(browseSource, /data=\{concepts\}/);
});

test('web Concepts includes current guest notes without enabling the signed-in private graph', async () => {
  const sources = await Promise.all([
    readFile(new URL('../app/grid/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../app/knowledge/page.tsx', import.meta.url), 'utf8'),
  ]);

  for (const source of sources) {
    assert.match(source, /getUserKnowledgeItems\(\),/);
    assert.doesNotMatch(
      source,
      /actor\.isGuest \? Promise\.resolve\(\[\]\) : getUserKnowledgeItems\(\)/,
    );
    assert.match(source, /const personalMapItems = personalItems\.map/);
    assert.match(source, /personalItems=\{personalMapItems\}/);
    assert.doesNotMatch(source, /personalItems=\{personalItems\}/);
    assert.doesNotMatch(source, /user_id|source_provider|source_batch_id/);
    assert.match(source, /actor\.isGuest \? Promise\.resolve\(null\) : getPrivateKnowledgeGraph\(\)/);
  }
});
