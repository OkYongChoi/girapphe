import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  parseStrictKnowledgeTags,
  splitKnowledgeTagInput,
} from '@stem-brain/shared';

const sourceDir = dirname(fileURLToPath(import.meta.url));
const notesSource = readFileSync(join(sourceDir, '../app/(tabs)/notes.tsx'), 'utf8');
const mobileRoute = readFileSync(join(sourceDir, '../../web/src/app/api/mobile/route.ts'), 'utf8');

test('mobile tag entry shares the localized comma parser', () => {
  assert.deepEqual(splitKnowledgeTagInput('alpha، beta，gamma, delta'), [
    'alpha',
    'beta',
    'gamma',
    'delta',
  ]);
  assert.match(notesSource, /splitKnowledgeTagInput\(tags\)/);
  assert.doesNotMatch(notesSource, /tags\.split\(','\)/);
});

test('mobile API applies the strict shared tag contract', () => {
  const astralTag = '𠮷'.repeat(MAX_KNOWLEDGE_TAG_CODE_POINTS);
  assert.deepEqual(parseStrictKnowledgeTags([astralTag]), [astralTag]);
  assert.equal(parseStrictKnowledgeTags([`${astralTag}𠮷`]), null);
  assert.match(mobileRoute, /return parseStrictKnowledgeTags\(value\)/);
});
