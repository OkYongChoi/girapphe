import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arSA } from '@clerk/localizations/ar-SA';
import { enUS } from '@clerk/localizations/en-US';
import { esES } from '@clerk/localizations/es-ES';
import { hiIN } from '@clerk/localizations/hi-IN';
import { jaJP } from '@clerk/localizations/ja-JP';
import { zhCN } from '@clerk/localizations/zh-CN';
import type { Locale } from '@stem-brain/shared';

const CLERK_LOCALIZATIONS = {
  en: enUS,
  ja: jaJP,
  'zh-CN': zhCN,
  es: esES,
  ar: arSA,
  hi: hiIN,
} satisfies Record<Locale, unknown>;

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const outputDir = path.resolve(scriptDir, '../apps/web/public/localization/clerk');

  await mkdir(outputDir, { recursive: true });
  await Promise.all(Object.entries(CLERK_LOCALIZATIONS).map(([locale, localization]) => (
    writeFile(path.join(outputDir, `${locale}.json`), JSON.stringify(localization), 'utf8')
  )));
}

void main();
