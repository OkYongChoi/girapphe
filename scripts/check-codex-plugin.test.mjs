import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  toPortableRelativePath,
  validateCodexPlugin,
} from './check-codex-plugin.mjs';

async function writeFixture(root, packagedContent = '# Skill\n') {
  const sourceSkill = path.join(root, '.codex', 'skills', 'example');
  const packagedSkill = path.join(root, 'plugins', 'girapphe', 'skills', 'example');
  await Promise.all([
    mkdir(sourceSkill, { recursive: true }),
    mkdir(packagedSkill, { recursive: true }),
    mkdir(path.join(root, 'plugins', 'girapphe', '.codex-plugin'), { recursive: true }),
    mkdir(path.join(root, '.agents', 'plugins'), { recursive: true }),
  ]);
  const skill = '---\nname: example\ndescription: Example skill.\n---\n\n# Skill\n';
  await Promise.all([
    writeFile(path.join(sourceSkill, 'SKILL.md'), skill),
    writeFile(path.join(packagedSkill, 'SKILL.md'), packagedContent === '# Skill\n' ? skill : packagedContent),
    writeFile(path.join(root, 'plugins', 'girapphe', '.codex-plugin', 'plugin.json'), JSON.stringify({
      name: 'girapphe',
      version: '0.1.0',
      description: 'Girapphe repository workflows.',
      author: { name: 'Example Maintainer', url: 'https://example.com' },
      skills: './skills/',
      interface: {
        displayName: 'Girapphe',
        shortDescription: 'Maintain Girapphe.',
        longDescription: 'Repository-aware Girapphe maintenance workflows.',
        developerName: 'Example Maintainer',
        category: 'Developer Tools',
        capabilities: ['Validation'],
        websiteURL: 'https://example.com',
        defaultPrompt: ['Validate this Girapphe change.'],
      },
    })),
    writeFile(path.join(root, '.agents', 'plugins', 'marketplace.json'), JSON.stringify({
      name: 'girapphe',
      plugins: [{
        name: 'girapphe',
        source: { source: 'local', path: './plugins/girapphe' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Developer Tools',
      }],
    })),
  ]);
}

async function editFixtureManifest(root, edit) {
  const manifestPath = path.join(root, 'plugins', 'girapphe', '.codex-plugin', 'plugin.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  edit(manifest);
  await writeFile(manifestPath, JSON.stringify(manifest));
}

async function writeFixtureSkillFile(root, relativePath, contents) {
  const sourceFile = path.join(root, '.codex', 'skills', 'example', relativePath);
  const packagedFile = path.join(root, 'plugins', 'girapphe', 'skills', 'example', relativePath);
  await Promise.all([
    mkdir(path.dirname(sourceFile), { recursive: true }),
    mkdir(path.dirname(packagedFile), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(sourceFile, contents),
    writeFile(packagedFile, contents),
  ]);
}

test('accepts a marketplace-backed plugin whose packaged skills match the project skills', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-valid-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root);
  await validateCodexPlugin(root);
});

test('normalizes Windows skill paths before manifest discovery', () => {
  assert.equal(
    toPortableRelativePath('girapphe-validation\\SKILL.md'),
    'girapphe-validation/SKILL.md',
  );
});

test('rejects stale packaged skill content', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-stale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root, '# Stale skill\n');
  await assert.rejects(validateCodexPlugin(root), /packaged copy is current/u);
});

test('rejects missing required plugin ingestion metadata', async (t) => {
  const cases = [
    ['description', (manifest) => { delete manifest.description; }, /plugin manifest\.description/u],
    ['author.name', (manifest) => { delete manifest.author.name; }, /plugin manifest\.author\.name/u],
    ['interface.displayName', (manifest) => { delete manifest.interface.displayName; }, /plugin manifest\.interface\.displayName/u],
    ['interface.defaultPrompt', (manifest) => { delete manifest.interface.defaultPrompt; }, /plugin manifest\.interface\.default_prompt/u],
  ];

  for (const [label, edit, expectedError] of cases) {
    await t.test(label, async (subtest) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-required-'));
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await writeFixture(root);
      await editFixtureManifest(root, edit);
      await assert.rejects(validateCodexPlugin(root), expectedError);
    });
  }
});

test('rejects unsupported plugin manifest fields', async (t) => {
  const cases = [
    ['top-level', (manifest) => { manifest.hooks = './hooks.json'; }, /plugin manifest\.hooks/u],
    ['author', (manifest) => { manifest.author.handle = 'maintainer'; }, /plugin manifest\.author\.handle/u],
    ['interface', (manifest) => { manifest.interface.subtitle = 'Girapphe'; }, /plugin manifest\.interface\.subtitle/u],
  ];

  for (const [label, edit, expectedError] of cases) {
    await t.test(label, async (subtest) => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-unsupported-'));
      subtest.after(() => rm(root, { recursive: true, force: true }));
      await writeFixture(root);
      await editFixtureManifest(root, edit);
      await assert.rejects(validateCodexPlugin(root), expectedError);
    });
  }
});

test('parses and validates every packaged skill frontmatter', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-skill-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root);
  await writeFixtureSkillFile(root, 'SKILL.md', '---\nname: example\n---\n\n# Skill\n');

  await assert.rejects(validateCodexPlugin(root), /frontmatter\.description/u);
});

test('parses and validates optional skill agent metadata', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'girapphe-plugin-agent-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFixture(root);
  await writeFixtureSkillFile(root, 'agents/openai.yaml', [
    'interface:',
    '  display_name: Example',
    '  short_description: Example skill',
    '  unsupported_field: invalid',
    '',
  ].join('\n'));

  await assert.rejects(validateCodexPlugin(root), /interface\.unsupported_field/u);
});

test('card-hygiene cleanup uses one Neon HTTP transaction', async () => {
  const source = await readFile(
    path.join(
      process.cwd(),
      '.codex',
      'skills',
      'girapphe-card-hygiene',
      'scripts',
      'audit-card-hygiene.mjs',
    ),
    'utf8',
  );

  assert.match(source, /await sql\.transaction\(/u);
  assert.doesNotMatch(source, /sql\.query\(['"](?:BEGIN|COMMIT|ROLLBACK)['"]\)/u);
});
