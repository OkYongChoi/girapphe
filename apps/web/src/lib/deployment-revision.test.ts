import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDeploymentRevision } from './deployment-revision';

test('deployment revision exposes only a full normalized Git SHA', () => {
  assert.equal(
    normalizeDeploymentRevision(' D0C3411EEE9A1E3596ED00DEA9B8D70197DF8B5D '),
    'd0c3411eee9a1e3596ed00dea9b8d70197df8b5d',
  );
  assert.equal(normalizeDeploymentRevision('d0c3411'), null);
  assert.equal(normalizeDeploymentRevision(undefined), null);
});
