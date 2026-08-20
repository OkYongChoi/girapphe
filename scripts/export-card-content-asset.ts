import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_CONTENT } from '../packages/graph-engine/src/data/card-content';

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(scriptDir, '../apps/web/public/localization');
  const outputPath = path.join(outputDir, 'card-content.json');
  const summaryOutputPath = path.join(outputDir, 'card-summary.json');
  const summaries = Object.fromEntries(
    Object.entries(CARD_CONTENT).map(([id, content]) => [
      id,
      {
        summary: content.summary,
        hasContent: content.summary.trim().length >= 20 && content.explanation.trim().length >= 80,
      },
    ])
  );

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(outputPath, JSON.stringify(CARD_CONTENT), 'utf8'),
    writeFile(summaryOutputPath, JSON.stringify(summaries), 'utf8'),
  ]);
}

void main();
