import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(
  new URL('../../../.github/workflows/deploy-cloudflare.yml', import.meta.url),
  'utf8',
);

test('deployment preserves absent provider lifecycle bindings and writes explicit acquisition gates', () => {
  const productionBulk = workflow.slice(
    workflow.indexOf('- name: Sync Worker runtime secrets (prod)'),
    workflow.indexOf('- name: Deploy Worker'),
  );
  const optionalStart = productionBulk.indexOf('const optional = [');
  const optionalEnd = productionBulk.indexOf('];', optionalStart);
  const optional = productionBulk.slice(optionalStart, optionalEnd);
  assert.doesNotMatch(optional, /CREEM_|SUPERWALL_|STRIPE_|REVENUECAT_|TOSS_/);

  const lifecycleStart = productionBulk.indexOf('const providerLifecycle = [');
  const lifecycleEnd = productionBulk.indexOf('];', lifecycleStart);
  const lifecycle = productionBulk.slice(lifecycleStart, lifecycleEnd);
  assert.match(lifecycle, /CREEM_API_KEY/);
  assert.match(lifecycle, /SUPERWALL_ORGANIZATION_API_KEY/);
  assert.match(productionBulk, /for \(const name of providerLifecycle\) \{\s*if \(process\.env\[name\]\) payload\[name\] = process\.env\[name\];/);
  assert.match(productionBulk, /payload\[name\] = process\.env\[name\] \|\| 'false'/);

  const previewUpload = workflow.slice(
    workflow.indexOf('- name: Deploy preview Worker settings and upload PR version'),
    workflow.indexOf('- name: Smoke test preview'),
  );
  assert.match(previewUpload, /\$\{!key:-false\}/);
  const deletionLoop = previewUpload.slice(
    previewUpload.indexOf('for key in NEXT_PUBLIC_ADSENSE_CLIENT_ID'),
    previewUpload.indexOf('done', previewUpload.indexOf('for key in NEXT_PUBLIC_ADSENSE_CLIENT_ID')),
  );
  assert.doesNotMatch(deletionLoop, /CREEM_|SUPERWALL_/);
});
