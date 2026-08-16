import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_CONTENT } from '../packages/graph-engine/src/data/card-content';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(scriptDir, '../apps/web/public/localization');
  const outputPath = path.join(outputDir, 'card-content.json');

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, JSON.stringify(CARD_CONTENT), 'utf8');
}

void main();
