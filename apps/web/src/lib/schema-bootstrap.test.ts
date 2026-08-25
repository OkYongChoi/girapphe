import assert from 'node:assert/strict';
import test from 'node:test';
import { canRunRuntimeSchemaBootstrap } from './schema-bootstrap';

test('production Workers only use checked-in migrations for schema changes', () => {
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production', APP_ENV: 'prod' }), false);
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production', APP_ENV: 'preview' }), false);
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'production' }), false);
});

test('local development retains schema bootstrap support', () => {
  assert.equal(canRunRuntimeSchemaBootstrap({ NODE_ENV: 'development' }), true);
});
