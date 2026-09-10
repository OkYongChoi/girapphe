import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  buildMobileAuthContinuationParams,
  resolveMobileAuthContinuation,
  type MobileAuthContinuation,
} from './auth-continuation';

const sourceDir = dirname(fileURLToPath(import.meta.url));

function findAuthRequiredRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findAuthRequiredRoutes(path);
    if (!entry.isFile() || !entry.name.endsWith('.tsx')) return [];
    return readFileSync(path, 'utf8').includes('<AuthRequired') ? [path] : [];
  });
}

test('protected mobile destinations round-trip through an enumerated continuation', () => {
  const cases: Array<[MobileAuthContinuation, unknown]> = [
    [{ destination: 'admin' }, '/admin'],
    [{ destination: 'candidate-inbox' }, '/candidate-inbox'],
    [{ destination: 'knowledge-data-controls' }, '/knowledge-data-controls'],
    [{ destination: 'notes' }, '/(tabs)/notes'],
    [{ destination: 'progress' }, '/(tabs)/progress'],
    [{ destination: 'ranking' }, '/(tabs)/ranking'],
    [{ destination: 'review' }, '/(tabs)/review'],
    [{ destination: 'subscription' }, '/subscription'],
    [{ destination: 'topics' }, '/knowledge-topics'],
    [
      { destination: 'knowledge-topic', topic: 'AI/ML 기초' },
      { pathname: '/knowledge-topic/[topic]', params: { topic: 'AI/ML 기초' } },
    ],
  ];

  for (const [continuation, expected] of cases) {
    assert.deepEqual(
      resolveMobileAuthContinuation(buildMobileAuthContinuationParams(continuation)),
      expected,
    );
  }
});

test('mobile continuation rejects arbitrary, ambiguous, and malformed route state', () => {
  assert.equal(resolveMobileAuthContinuation({
    continueAction: 'https://attacker.invalid',
    continueDestination: 'notes',
  }), null);
  assert.equal(resolveMobileAuthContinuation({
    continueAction: 'open-protected-route',
    continueDestination: 'https://attacker.invalid',
  }), null);
  assert.equal(resolveMobileAuthContinuation({
    continueAction: 'open-protected-route',
    continueDestination: ['notes', 'admin'],
  }), null);
  assert.equal(resolveMobileAuthContinuation({
    continueAction: 'open-protected-route',
    continueDestination: 'knowledge-topic',
    continueTopic: 'bad\nroute',
  }), null);
  assert.equal(resolveMobileAuthContinuation({
    continueAction: 'open-protected-route',
    continueDestination: 'knowledge-topic',
    continueTopic: 'x'.repeat(121),
  }), null);

  assert.deepEqual(
    resolveMobileAuthContinuation(buildMobileAuthContinuationParams({
      destination: 'knowledge-topic',
      topic: '',
    })),
    '/knowledge-topics',
  );
});

test('every AuthRequired route supplies its exact continuation and sign-in preserves public-copy priority', () => {
  const routeExpectations = new Map([
    ['../app/admin.tsx', "destination: 'admin'"],
    ['../app/candidate-inbox.tsx', "destination: 'candidate-inbox'"],
    ['../app/knowledge-data-controls.tsx', "destination: 'knowledge-data-controls'"],
    ['../app/(tabs)/notes.tsx', "destination: 'notes'"],
    ['../app/(tabs)/progress.tsx', "destination: 'progress'"],
    ['../app/(tabs)/ranking.tsx', "destination: 'ranking'"],
    ['../app/(tabs)/review.tsx', "destination: 'review'"],
    ['../app/knowledge-topics.tsx', "destination: 'topics'"],
    ['../app/knowledge-topic/[topic].tsx', "destination: 'knowledge-topic'"],
  ]);
  assert.deepEqual(
    findAuthRequiredRoutes(join(sourceDir, '../app')).sort(),
    Array.from(routeExpectations.keys(), (relativePath) => join(sourceDir, relativePath)).sort(),
    'the continuation matrix covers every AuthRequired app route',
  );

  for (const [relativePath, expected] of routeExpectations) {
    const source = readFileSync(join(sourceDir, relativePath), 'utf8');
    assert.match(source, /<AuthRequired continuation=/, relativePath + ' supplies continuation state');
    assert.ok(source.includes(expected), relativePath + ' preserves its exact destination');
  }

  const authRequiredSource = readFileSync(join(sourceDir, 'components/auth-required.tsx'), 'utf8');
  assert.match(authRequiredSource, /buildMobileAuthContinuationParams\(continuation\)/);
  assert.match(authRequiredSource, /pathname: '\/sign-in'/);
  assert.match(
    authRequiredSource,
    /if \(isSignedIn\) return <Fragment key=\{userId\}>\{children\}<\/Fragment>/,
    'switching directly between signed-in owners remounts private route state',
  );

  const signInSource = readFileSync(join(sourceDir, '../app/sign-in.tsx'), 'utf8');
  const subscriptionSource = readFileSync(join(sourceDir, '../app/subscription.tsx'), 'utf8');
  const navigationBody = signInSource.match(
    /const navigateAfterAuthentication = useCallback\(\(\) => \{([\s\S]*?)\n {2}\}, \[/,
  )?.[1] ?? '';
  assert.ok(
    navigationBody.indexOf('if (publicCopyContinuation)')
      < navigationBody.indexOf('if (protectedRouteContinuation)'),
    'the provenance-sensitive public-copy continuation remains first',
  );
  assert.match(navigationBody, /router\.replace\(protectedRouteContinuation\)/);
  assert.match(subscriptionSource, /buildMobileAuthContinuationParams\(\{ destination: 'subscription' \}\)/);
});
