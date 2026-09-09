import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { load as loadYaml } from 'js-yaml';

const defaultRepositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export function toPortableRelativePath(relativePath) {
  return relativePath.replaceAll('\\', '/');
}

const strictSemver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const pluginFields = new Set([
  'id',
  'name',
  'version',
  'description',
  'skills',
  'apps',
  'mcpServers',
  'interface',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
]);
const authorFields = new Set(['name', 'email', 'url']);
const interfaceFields = new Set([
  'displayName',
  'shortDescription',
  'longDescription',
  'developerName',
  'category',
  'capabilities',
  'websiteURL',
  'privacyPolicyURL',
  'termsOfServiceURL',
  'brandColor',
  'composerIcon',
  'logo',
  'logoDark',
  'screenshots',
  'defaultPrompt',
  'default_prompt',
]);
const skillAgentFields = new Set(['interface', 'policy', 'dependencies']);
const skillAgentInterfaceFields = new Set([
  'display_name',
  'short_description',
  'icon_small',
  'icon_large',
  'brand_color',
  'default_prompt',
]);

function assertAllowedFields(value, allowed, label) {
  for (const field of Object.keys(value)) {
    assert.ok(allowed.has(field), `${label}.${field} is not supported`);
  }
}

function assertObject(value, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assertNonEmptyString(value, label) {
  assert.ok(typeof value === 'string' && value.trim(), `${label} must be a non-empty string`);
}

function assertOptionalNonEmptyString(value, label) {
  if (value !== undefined) assertNonEmptyString(value, label);
}

function assertStringArray(value, label) {
  assert.ok(
    Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim()),
    `${label} must be an array of non-empty strings`,
  );
}

function assertOptionalHttpsUrl(value, label) {
  if (value === undefined) return;
  assertNonEmptyString(value, label);
  const url = new URL(value);
  assert.equal(url.protocol, 'https:', `${label} must be an absolute https URL`);
  assert.ok(url.hostname, `${label} must be an absolute https URL`);
}

async function assertArchiveFile(baseDirectory, archiveRoot, relativePath, label) {
  assertNonEmptyString(relativePath, label);
  const absolute = path.resolve(baseDirectory, relativePath);
  const relative = path.relative(archiveRoot, absolute);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `${label} must stay inside the plugin archive`);
  assert.ok((await stat(absolute)).isFile(), `${label} must point to a file`);
}

async function assertPluginFile(pluginRoot, relativePath, label) {
  assertNonEmptyString(relativePath, label);
  assert.ok(relativePath.startsWith('./'), `${label} must start with ./`);
  await assertArchiveFile(pluginRoot, pluginRoot, relativePath, label);
}

function parseYamlObject(source, label) {
  let value;
  try {
    value = loadYaml(source);
  } catch (error) {
    assert.fail(`${label} must contain valid YAML: ${error.message}`);
  }
  assertObject(value, label);
  return value;
}

async function readOptionalFile(file) {
  try {
    return await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function validateSkillAgentManifest(skillRoot, pluginRoot, source) {
  const label = `skill ${path.basename(skillRoot)} agents/openai.yaml`;
  const manifest = parseYamlObject(source, label);
  assertAllowedFields(manifest, skillAgentFields, label);

  assertObject(manifest.interface, `${label}.interface`);
  assertAllowedFields(manifest.interface, skillAgentInterfaceFields, `${label}.interface`);
  assertNonEmptyString(manifest.interface.display_name, `${label}.interface.display_name`);
  assertNonEmptyString(manifest.interface.short_description, `${label}.interface.short_description`);
  for (const field of ['icon_small', 'icon_large']) {
    if (manifest.interface[field] !== undefined) {
      await assertArchiveFile(skillRoot, pluginRoot, manifest.interface[field], `${label}.interface.${field}`);
    }
  }
  if (manifest.interface.brand_color !== undefined) {
    assert.match(manifest.interface.brand_color, /^#[0-9A-F]{6}$/iu, `${label}.interface.brand_color must use #RRGGBB`);
  }
  assertOptionalNonEmptyString(manifest.interface.default_prompt, `${label}.interface.default_prompt`);

  if (manifest.policy !== undefined) {
    assertObject(manifest.policy, `${label}.policy`);
    assertAllowedFields(manifest.policy, new Set(['allow_implicit_invocation']), `${label}.policy`);
    if (manifest.policy.allow_implicit_invocation !== undefined) {
      assert.equal(typeof manifest.policy.allow_implicit_invocation, 'boolean', `${label}.policy.allow_implicit_invocation must be a boolean`);
    }
  }
  if (manifest.dependencies !== undefined) {
    assertObject(manifest.dependencies, `${label}.dependencies`);
    assertAllowedFields(manifest.dependencies, new Set(['tools']), `${label}.dependencies`);
  }
}

async function validateSkillManifest(skillRoot, pluginRoot) {
  const skillName = path.basename(skillRoot);
  const label = `skill ${skillName} SKILL.md`;
  const source = await readFile(path.join(skillRoot, 'SKILL.md'), 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u);
  assert.ok(frontmatter, `${label} must start with closed YAML frontmatter`);
  const manifest = parseYamlObject(frontmatter[1], `${label} frontmatter`);
  assertNonEmptyString(manifest.name, `${label} frontmatter.name`);
  assert.equal(manifest.name, skillName, `${label} frontmatter.name must match its directory`);
  assertNonEmptyString(manifest.description, `${label} frontmatter.description`);
  const disableModelInvocation = manifest['disable-model-invocation']
    ?? manifest.disable_model_invocation;
  assert.ok(
    disableModelInvocation === undefined || disableModelInvocation === false,
    `${label} frontmatter.disable-model-invocation must be false when present`,
  );

  const agentManifest = await readOptionalFile(path.join(skillRoot, 'agents', 'openai.yaml'));
  if (agentManifest !== undefined) {
    await validateSkillAgentManifest(skillRoot, pluginRoot, agentManifest);
  }
}

async function validateManifestMetadata(manifest, pluginRoot) {
  assertObject(manifest, 'plugin manifest');
  assertAllowedFields(manifest, pluginFields, 'plugin manifest');

  assertNonEmptyString(manifest.name, 'plugin manifest.name');
  assert.match(manifest.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, 'plugin manifest.name must be kebab-case');
  assertNonEmptyString(manifest.version, 'plugin manifest.version');
  assert.match(manifest.version, strictSemver, 'plugin manifest.version must be strict semver');
  assertNonEmptyString(manifest.description, 'plugin manifest.description');
  assertOptionalNonEmptyString(manifest.id, 'plugin manifest.id');
  assertOptionalNonEmptyString(manifest.homepage, 'plugin manifest.homepage');
  assertOptionalNonEmptyString(manifest.repository, 'plugin manifest.repository');
  assertOptionalNonEmptyString(manifest.license, 'plugin manifest.license');
  if (manifest.keywords !== undefined) assertStringArray(manifest.keywords, 'plugin manifest.keywords');

  assertObject(manifest.author, 'plugin manifest.author');
  assertAllowedFields(manifest.author, authorFields, 'plugin manifest.author');
  assertNonEmptyString(manifest.author.name, 'plugin manifest.author.name');
  assertOptionalNonEmptyString(manifest.author.email, 'plugin manifest.author.email');
  assertOptionalHttpsUrl(manifest.author.url, 'plugin manifest.author.url');

  assertObject(manifest.interface, 'plugin manifest.interface');
  assertAllowedFields(manifest.interface, interfaceFields, 'plugin manifest.interface');
  for (const field of [
    'displayName',
    'shortDescription',
    'longDescription',
    'developerName',
    'category',
  ]) {
    assertNonEmptyString(manifest.interface[field], `plugin manifest.interface.${field}`);
  }
  assertStringArray(manifest.interface.capabilities, 'plugin manifest.interface.capabilities');
  const promptField = manifest.interface.defaultPrompt === undefined
    ? 'default_prompt'
    : 'defaultPrompt';
  assertStringArray(manifest.interface[promptField], `plugin manifest.interface.${promptField}`);
  assert.ok(manifest.interface[promptField].length <= 3, `plugin manifest.interface.${promptField} must contain at most 3 prompts`);
  assert.ok(
    manifest.interface[promptField].every((prompt) => prompt.length <= 128),
    `plugin manifest.interface.${promptField} prompts must be at most 128 characters`,
  );
  for (const field of ['websiteURL', 'privacyPolicyURL', 'termsOfServiceURL']) {
    assertOptionalHttpsUrl(manifest.interface[field], `plugin manifest.interface.${field}`);
  }
  if (manifest.interface.brandColor !== undefined) {
    assert.match(manifest.interface.brandColor, /^#[0-9A-F]{6}$/iu, 'plugin manifest.interface.brandColor must use #RRGGBB');
  }

  for (const field of ['composerIcon', 'logo', 'logoDark']) {
    if (manifest.interface[field] !== undefined) {
      await assertPluginFile(pluginRoot, manifest.interface[field], `plugin manifest.interface.${field}`);
    }
  }
  if (manifest.interface.screenshots !== undefined) {
    assertStringArray(manifest.interface.screenshots, 'plugin manifest.interface.screenshots');
    for (const screenshot of manifest.interface.screenshots) {
      assert.ok(screenshot.startsWith('./assets/') && screenshot.endsWith('.png'), 'plugin screenshots must be PNG files under ./assets/');
      await assertPluginFile(pluginRoot, screenshot, 'plugin manifest.interface.screenshots');
    }
  }

  if (manifest.apps !== undefined) {
    assert.equal(manifest.apps, './.app.json');
    await assertPluginFile(pluginRoot, manifest.apps, 'plugin manifest.apps');
  }
  if (typeof manifest.mcpServers === 'string') {
    assert.equal(manifest.mcpServers, './.mcp.json');
    await assertPluginFile(pluginRoot, manifest.mcpServers, 'plugin manifest.mcpServers');
  } else if (manifest.mcpServers !== undefined) {
    assertObject(manifest.mcpServers, 'plugin manifest.mcpServers');
  }
}

async function relativeFiles(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`plugin packaging must not rely on symlinks: ${absolute}`);
    }
    if (entry.isDirectory()) {
      files.push(...await relativeFiles(root, absolute));
    } else if (entry.isFile()) {
      files.push(toPortableRelativePath(path.relative(root, absolute)));
    }
  }

  return files.sort();
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function validateCodexPlugin(repositoryRoot = defaultRepositoryRoot) {
  const sourceSkills = path.join(repositoryRoot, '.codex', 'skills');
  const pluginRoot = path.join(repositoryRoot, 'plugins', 'girapphe');
  const packagedSkills = path.join(pluginRoot, 'skills');
  const manifest = await readJson(path.join(pluginRoot, '.codex-plugin', 'plugin.json'));
  const marketplace = await readJson(
    path.join(repositoryRoot, '.agents', 'plugins', 'marketplace.json'),
  );

  await validateManifestMetadata(manifest, pluginRoot);
  assert.equal(manifest.name, path.basename(pluginRoot));
  assert.equal(manifest.skills, './skills/');
  assert.ok(!JSON.stringify(manifest).includes('[TODO:'), 'plugin manifest has no TODO placeholders');

  assert.equal(marketplace.name, 'girapphe');
  const entries = marketplace.plugins.filter((entry) => entry?.name === manifest.name);
  assert.equal(entries.length, 1, 'marketplace has exactly one Girapphe entry');
  assert.deepEqual(entries[0].source, {
    source: 'local',
    path: './plugins/girapphe',
  });
  assert.deepEqual(entries[0].policy, {
    installation: 'AVAILABLE',
    authentication: 'ON_INSTALL',
  });
  assert.equal(entries[0].category, manifest.interface.category);

  const sourceFiles = await relativeFiles(sourceSkills);
  const packagedFiles = await relativeFiles(packagedSkills);
  assert.deepEqual(packagedFiles, sourceFiles, 'packaged skill file list matches .codex/skills');

  const skillManifests = sourceFiles.filter((file) => file.endsWith('/SKILL.md'));
  assert.ok(skillManifests.length > 0, 'at least one skill is packaged');
  for (const relativeFile of sourceFiles) {
    const [source, packaged] = await Promise.all([
      readFile(path.join(sourceSkills, relativeFile)),
      readFile(path.join(packagedSkills, relativeFile)),
    ]);
    assert.deepEqual(packaged, source, `packaged copy is current: ${relativeFile}`);
  }

  for (const relativeFile of skillManifests) {
    const expectedName = relativeFile.split('/')[0];
    await validateSkillManifest(path.join(packagedSkills, expectedName), pluginRoot);
  }
}

if (process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await validateCodexPlugin();
  console.log('Codex plugin packaging check passed.');
}
