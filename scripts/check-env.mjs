#!/usr/bin/env node

import path from 'node:path';
import { getEnvMap, parseArgs, validate } from './check-env-core.mjs';

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!['dev', 'preview', 'prod'].includes(options.env)) {
    console.error('Usage: node scripts/check-env.mjs --env <dev|preview|prod> [--file <path>] [--allow-placeholders]');
    process.exit(2);
  }

  let map;
  try {
    map = getEnvMap(options.file, process.cwd());
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : 'Unable to load env source.'}`);
    process.exit(1);
  }

  const { errors, warnings } = validate({
    envName: options.env,
    map,
    allowPlaceholders: options.allowPlaceholders,
  });

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`[ERROR] ${error}`);
    }
    process.exit(1);
  }

  const source = options.file ? path.resolve(process.cwd(), options.file) : 'process.env';
  console.log(`[OK] Environment validation passed (${options.env}, source: ${source})`);
}

main();
