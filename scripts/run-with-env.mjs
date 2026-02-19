#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

function parseArgs(argv) {
  const sep = argv.indexOf('--');
  if (sep === -1) {
    throw new Error('Usage: node scripts/run-with-env.mjs --file <env-file> -- <command> [args...]');
  }

  const optionArgs = argv.slice(0, sep);
  const commandArgs = argv.slice(sep + 1);
  if (commandArgs.length === 0) {
    throw new Error('Missing command after --');
  }

  let file = null;
  let optional = false;
  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i];
    if (arg === '--file') {
      file = optionArgs[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === '--optional') {
      optional = true;
    }
  }

  if (!file) {
    throw new Error('Missing --file <env-file>');
  }

  return { file, commandArgs, optional };
}

function parseDotenv(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? '';

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    map.set(key, value);
  }

  return map;
}

function loadEnvFromFile(filePath, optional) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) {
    if (optional) return { ...process.env };
    throw new Error(`Env file not found: ${absolute}`);
  }

  const content = fs.readFileSync(absolute, 'utf8');
  const vars = parseDotenv(content);
  const merged = { ...process.env };

  for (const [key, value] of vars.entries()) {
    merged[key] = value;
  }

  return merged;
}

function run(commandArgs, env) {
  const [command, ...args] = commandArgs;
  const child = spawn(command, args, {
    stdio: 'inherit',
    env,
    shell: false,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

function main() {
  try {
    const { file, commandArgs, optional } = parseArgs(process.argv.slice(2));
    const env = loadEnvFromFile(file, optional);
    run(commandArgs, env);
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : 'Failed to run command with env file.'}`);
    process.exit(1);
  }
}

main();
