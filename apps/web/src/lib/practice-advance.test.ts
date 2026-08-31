import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPracticeExcludeIds, runPracticeAdvance } from './practice-advance';

test('preserves every rated card beyond the knowledge-map pagination limit', () => {
  const ratedIds = Array.from({ length: 20_001 }, (_, index) => `rated-${index}`);
  const result = buildPracticeExcludeIds('current', [
    ...ratedIds,
    'current',
    ratedIds[0],
    null,
    '',
  ]);

  assert.equal(result.length, ratedIds.length + 1);
  assert.equal(result[0], 'current');
  assert.equal(result.at(-1), ratedIds.at(-1));
  assert.equal(new Set(result).size, result.length);
});

test('does not load another card or stats when saving fails', async () => {
  let reads = 0;
  const result = await runPracticeAdvance({
    save: async () => ({ success: false }),
    loadNext: async () => {
      reads += 1;
      return 'next';
    },
    loadStats: async () => {
      reads += 1;
      return { explainable: 0, unclear: 0 };
    },
    excludeIds: ['current'],
  });

  assert.deepEqual(result, { success: false });
  assert.equal(reads, 0);
});

test('starts next-card and stats reads only after the rating is saved', async () => {
  const events: string[] = [];
  const result = await runPracticeAdvance({
    save: async () => {
      events.push('save');
      return { success: true };
    },
    loadNext: async (excludeIds) => {
      events.push(`next:${excludeIds?.join(',') ?? 'reset'}`);
      return 'next-card';
    },
    loadStats: async () => {
      events.push('stats');
      return { explainable: 3, unclear: 2 };
    },
    excludeIds: ['current'],
  });

  assert.deepEqual(events, ['save', 'next:current', 'stats']);
  assert.deepEqual(result, {
    success: true,
    nextCard: 'next-card',
    stats: { explainable: 3, unclear: 2 },
    cycled: false,
  });
});

test('resets exclusions inside the same flow when a round is exhausted', async () => {
  const exclusions: Array<string[] | undefined> = [];
  const result = await runPracticeAdvance({
    save: async () => ({ success: true }),
    loadNext: async (excludeIds) => {
      exclusions.push(excludeIds);
      return excludeIds ? null : 'first-card-next-round';
    },
    loadStats: async () => ({ explainable: 1, unclear: 1 }),
    excludeIds: ['rated-card'],
  });

  assert.deepEqual(exclusions, [['rated-card'], undefined]);
  assert.equal(result.success && result.cycled, true);
  assert.equal(result.success && result.nextCard, 'first-card-next-round');
});

test('retries a transient next-card read once without repeating the save', async () => {
  let saves = 0;
  let nextReads = 0;
  const waits: number[] = [];
  const result = await runPracticeAdvance({
    save: async () => ({ success: ++saves > 0 }),
    loadNext: async () => {
      nextReads += 1;
      if (nextReads === 1) throw new Error('transient');
      return 'recovered-card';
    },
    loadStats: async () => ({ explainable: 0, unclear: 0 }),
    excludeIds: ['rated-card'],
    wait: async (delayMs) => {
      waits.push(delayMs);
    },
  });

  assert.equal(saves, 1);
  assert.equal(nextReads, 2);
  assert.deepEqual(waits, [600]);
  assert.equal(result.success && result.nextCard, 'recovered-card');
});
