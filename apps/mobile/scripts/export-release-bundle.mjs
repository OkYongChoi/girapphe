import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import process from 'node:process';
import { basename, resolve } from 'node:path';

const platform = process.argv[2];
if (platform !== 'ios' && platform !== 'android') {
  process.stderr.write('Usage: node scripts/export-release-bundle.mjs <ios|android>\n');
  process.exit(2);
}

const katexVersion = JSON.parse(readFileSync(resolve('node_modules/katex/package.json'), 'utf8')).version;
const katexLayoutCss = readFileSync(resolve('src/components/knowledge-katex-layout.css'), 'utf8');
if (!katexLayoutCss.startsWith(`/* KaTeX ${katexVersion} `)) {
  throw new Error(`The local KaTeX layout CSS does not match KaTeX ${katexVersion}.`);
}
if (katexLayoutCss.includes('url(') || katexLayoutCss.includes('@font-face')) {
  throw new Error('KaTeX layout CSS must not contain unresolved font resources.');
}

const args = [
  'exec',
  'expo',
  'export',
  '--platform',
  platform,
  '--output-dir',
  `dist/${platform}`,
];

// Expo SDK 57 currently installs an x86-64 Linux hermesc binary. ARM64 Linux
// workstations can still validate Metro output; EAS and x86-64 CI retain the
// production Hermes bytecode gate.
if (process.platform === 'linux' && process.arch === 'arm64') {
  process.stderr.write('ARM64 Linux detected: validating the bundle without local Hermes bytecode.\n');
  args.push('--no-bytecode');
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const result = spawnSync(command, args, { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const metadataPath = resolve(`dist/${platform}/metadata.json`);
const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
const bundledAssets = metadata.fileMetadata?.[platform]?.assets ?? [];
const bundledFontHashes = new Set(
  bundledAssets.filter((asset) => asset.ext === 'woff2').map((asset) => basename(asset.path)),
);
const fontDirectory = resolve('assets/katex-fonts');
const expectedFonts = readdirSync(fontDirectory).filter((file) => file.endsWith('.woff2'));
if (expectedFonts.length !== 20) {
  throw new Error(`Expected 20 local KaTeX font sources, found ${expectedFonts.length}.`);
}
const katexFontDirectory = resolve('node_modules/katex/dist/fonts');
const staleFonts = expectedFonts.filter((file) => {
  const localFont = readFileSync(resolve(fontDirectory, file));
  const packageFont = readFileSync(resolve(katexFontDirectory, file));
  return !localFont.equals(packageFont);
});
if (staleFonts.length > 0) {
  throw new Error(`Local KaTeX fonts do not match KaTeX ${katexVersion}: ${staleFonts.join(', ')}`);
}
const missingFonts = expectedFonts.filter((file) => {
  const contentHash = createHash('md5').update(readFileSync(resolve(fontDirectory, file))).digest('hex');
  return !bundledFontHashes.has(contentHash);
});
if (missingFonts.length > 0) {
  throw new Error(`KaTeX fonts missing from the ${platform} bundle: ${missingFonts.join(', ')}`);
}

process.stderr.write(`Verified ${expectedFonts.length} bundled KaTeX fonts for ${platform}.\n`);
