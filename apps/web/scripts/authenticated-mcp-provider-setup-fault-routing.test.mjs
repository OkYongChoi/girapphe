import assert from 'node:assert/strict';
import test from 'node:test';
import faultRouting from '../e2e-authenticated/authenticated-mcp-provider-setup-fault-routing.ts';

const {
  isExactMcpCreateServerAction,
  targetsExactSettingsDocument,
} = faultRouting;

const SETTINGS_DOCUMENT = 'https://pr-192-girapphe-preview.example.workers.dev/en/settings#ai-connections';
const RUN_MARKER = 'authenticated-overlay-e2e:mcp-pat:00000000-0000-4000-8000-000000000000';

function request({
  method = 'POST',
  url = 'https://pr-192-girapphe-preview.example.workers.dev/en/settings',
  headers = { 'next-action': 'server-action-id' },
  postData = `label=PAT+${RUN_MARKER}`,
} = {}) {
  return {
    method: () => method,
    url: () => url,
    headers: () => headers,
    postData: () => postData,
  };
}

test('recognizes only the marker-bearing Settings create Server Action', () => {
  assert.equal(
    isExactMcpCreateServerAction(request(), SETTINGS_DOCUMENT, RUN_MARKER),
    true,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://pr-192-girapphe-preview.example.workers.dev/en/settings?_rsc=route',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    true,
  );
  assert.equal(
    targetsExactSettingsDocument(
      'https://pr-192-girapphe-preview.example.workers.dev/en/settings?_rsc=route',
      SETTINGS_DOCUMENT,
    ),
    true,
  );
});

test('does not arm the fault for Clerk or unrelated browser traffic', () => {
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://example.clerk.accounts.dev/v1/client',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({ headers: {} }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({ method: 'GET', postData: null }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      url: 'https://pr-192-girapphe-preview.example.workers.dev/en/practice',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
  assert.equal(
    isExactMcpCreateServerAction(request({
      postData: 'label=PAT+authenticated-overlay-e2e%3Amcp-pat%3Aother-run',
    }), SETTINGS_DOCUMENT, RUN_MARKER),
    false,
  );
});
