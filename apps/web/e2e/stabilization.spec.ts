import { expect, test } from '@playwright/test';
import {
  InvalidJsonBodyError,
  RequestBodyTooLargeError,
  readBoundedJsonBody,
} from '../src/lib/bounded-json-body';
import { submitAssessmentWithCooldownRetry } from '../src/lib/assessment-retry';
import {
  getMockCardStatus,
  getMockPracticeStats,
  isCardEligibleForPracticeMode,
} from '../src/lib/practice-queue';
import { getPersonalizedNoteGraphAdditions } from '../src/lib/home-graph-notes';
import {
  UnknownGraphNodeError,
  submitDbQuizResult,
} from '../src/lib/knowledge-graph-db';

test.describe('main stabilization regressions', () => {
  test('bounded JSON parsing rejects actual bytes beyond the limit', async () => {
    const request = new Request('http://localhost/api/quiz_result', {
      method: 'POST',
      headers: {
        'content-length': '2',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ node_id: 'larger-than-header', result: 1 }),
    });

    await expect(readBoundedJsonBody(request, 16)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
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

    expect(request.headers.has('content-length')).toBe(false);
    await expect(readBoundedJsonBody(request, 24)).rejects.toBeInstanceOf(
      RequestBodyTooLargeError
    );
  });

  test('bounded JSON parsing distinguishes malformed JSON', async () => {
    const request = new Request('http://localhost/api/quiz_result', {
      method: 'POST',
      body: '{not-json',
    });

    await expect(readBoundedJsonBody(request, 128)).rejects.toBeInstanceOf(
      InvalidJsonBodyError
    );
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
        return {
          success: true,
          node: { id: nodeId, knowledge: result },
          propagated_count: 0,
        };
      },
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
    });

    expect(response.success).toBe(true);
    expect(submissions).toEqual([
      { nodeId: 'linear_algebra', result: 0.5 },
      { nodeId: 'linear_algebra', result: 0.5 },
    ]);
    expect(delays).toEqual([2_000]);
  });

  test('guest review stats and the mock review queue use the same statuses', () => {
    const guestCardCount = 12;
    const statuses = Array.from({ length: guestCardCount }, (_, index) =>
      getMockCardStatus(index)
    );
    const stats = getMockPracticeStats(guestCardCount);

    expect(stats).toEqual({ explainable: 3, unclear: 2 });
    expect(statuses.filter((status) => isCardEligibleForPracticeMode(status, 'review')))
      .toHaveLength(stats.unclear);
    expect(statuses.filter((status) => isCardEligibleForPracticeMode(status, 'new')))
      .toHaveLength(guestCardCount - stats.explainable - stats.unclear);
    expect(isCardEligibleForPracticeMode('saved', 'new')).toBe(false);
  });

  test('personal notes become a distinct group linked by topic matches', () => {
    const additions = getPersonalizedNoteGraphAdditions(
      [{ id: 'note-1', title: 'Gradient descent pitfall', topic: 'machine-learning' }],
      [
        { id: 'gradient_descent', label: 'Gradient Descent', domain: 'Optimization' },
        { id: 'neural_networks', label: 'Neural Networks', domain: 'Machine Learning' },
        { id: 'cell_biology', label: 'Cell Biology', domain: 'Biology' },
      ]
    );

    expect(additions.nodes).toEqual([
      expect.objectContaining({ id: 'personal-note:note-1', group: 'notes' }),
    ]);
    expect(additions.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'gradient_descent',
          target: 'personal-note:note-1',
          relationship: 'topic_match',
        }),
      ])
    );
    expect(additions.links.some((link) => link.source === 'cell_biology')).toBe(false);
  });

  test('the memory quiz path rejects unknown graph node IDs', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    try {
      await expect(
        submitDbQuizResult('stabilization-test-user', 'not_a_real_graph_node', 1)
      ).rejects.toBeInstanceOf(UnknownGraphNodeError);
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  test('clearing filters in My Notes trash keeps the trash view', async ({ page }) => {
    await page.goto('/my-knowledge?view=trash&q=no-match');

    await expect(page.getByRole('heading', { name: 'Knowledge Trash' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Clear', exact: true })).toHaveAttribute(
      'href',
      '/my-knowledge?view=trash'
    );
  });
});
