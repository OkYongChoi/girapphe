import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markdownEntrypoints = [
  'AGENTS.md',
  'README.md',
  'DEPLOY.md',
  'ENVIRONMENTS.md',
  'apps/mobile/SETUP.md',
  'docs',
  'specs',
];
const requiredFeatureSections = [
  'User outcome',
  'Scope',
  'Acceptance criteria',
  'Privacy and data boundaries',
  'Verification',
  'Rollout',
];

async function collectMarkdownFiles(entrypoint) {
  const absolutePath = path.join(repositoryRoot, entrypoint);
  const entrypointStat = await stat(absolutePath);
  if (entrypointStat.isFile()) return [absolutePath];

  const entries = await readdir(absolutePath, { withFileTypes: true });
  const nestedFiles = await Promise.all(entries.map(async (entry) => {
    const child = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) return collectMarkdownFiles(path.relative(repositoryRoot, child));
    return entry.isFile() && entry.name.endsWith('.md') ? [child] : [];
  }));
  return nestedFiles.flat();
}

function withoutFencedCode(markdown) {
  let fence = null;
  return markdown.split('\n').map((line) => {
    const fenceMatch = line.match(/^[ \t]{0,3}([`~]{3,})(.*)$/u);
    if (!fence) {
      if (!fenceMatch || new Set(fenceMatch[1]).size !== 1) return line;
      fence = { character: fenceMatch[1][0], length: fenceMatch[1].length };
      return '';
    }

    if (fenceMatch
      && new Set(fenceMatch[1]).size === 1
      && fenceMatch[1][0] === fence.character
      && fenceMatch[1].length >= fence.length
      && fenceMatch[2].trim() === '') {
      fence = null;
    }
    return '';
  }).join('\n');
}

function withoutInlineCode(markdown) {
  let output = '';
  let cursor = 0;

  while (cursor < markdown.length) {
    if (markdown[cursor] !== '`') {
      output += markdown[cursor];
      cursor += 1;
      continue;
    }

    const openingStart = cursor;
    while (markdown[cursor] === '`') cursor += 1;
    const delimiterLength = cursor - openingStart;
    const delimiter = '`'.repeat(delimiterLength);
    let closingStart = markdown.indexOf(delimiter, cursor);

    while (closingStart !== -1) {
      const isExactRun = markdown[closingStart - 1] !== '`'
        && markdown[closingStart + delimiterLength] !== '`';
      if (isExactRun) break;
      closingStart = markdown.indexOf(delimiter, closingStart + 1);
    }

    if (closingStart === -1) {
      output += delimiter;
      continue;
    }

    const closingEnd = closingStart + delimiterLength;
    output += markdown.slice(openingStart, closingEnd).replace(/[^\n]/gu, '');
    cursor = closingEnd;
  }

  return output;
}

function lineNumberAt(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

export function localLinkTarget(rawDestination) {
  const trimmed = rawDestination.trim();
  const destination = trimmed.startsWith('<')
    ? trimmed.slice(1, trimmed.indexOf('>'))
    : trimmed.split(/\s+/u, 1)[0];

  if (!destination || destination.startsWith('#') || destination.startsWith('/')) return null;
  if (/^[a-z][a-z\d+.-]*:/iu.test(destination)) return null;

  const pathOnly = destination.split(/[?#]/u, 1)[0]
    .replace(/\\([^\p{L}\p{N}\s])/gu, '$1');
  if (!pathOnly) return null;
  try {
    return decodeURIComponent(pathOnly);
  } catch {
    return pathOnly;
  }
}

export function markdownLinkDestinations(markdown) {
  const searchableContent = withoutInlineCode(withoutFencedCode(markdown));
  const destinations = [];

  for (let index = 0; index < searchableContent.length - 1; index += 1) {
    if (searchableContent[index] !== ']' || searchableContent[index + 1] !== '(') continue;
    const labelStart = searchableContent.lastIndexOf('[', index);
    if (labelStart === -1 || searchableContent[labelStart - 1] === '\\') continue;

    const destinationStart = index + 2;
    let cursor = destinationStart;
    let nestedParentheses = 0;
    let quote = null;
    let angleDestinationEnd = null;
    let closingParenthesis = null;

    while (cursor < searchableContent.length) {
      const character = searchableContent[cursor];
      if (character === '\\' && cursor + 1 < searchableContent.length) {
        cursor += 2;
        continue;
      }

      if (quote) {
        if (character === quote) quote = null;
        cursor += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        cursor += 1;
        continue;
      }
      if (searchableContent[destinationStart] === '<' && angleDestinationEnd === null) {
        if (character === '>') angleDestinationEnd = cursor;
        cursor += 1;
        continue;
      }
      if (character === '(') {
        nestedParentheses += 1;
      } else if (character === ')') {
        if (nestedParentheses === 0) {
          closingParenthesis = cursor;
          break;
        }
        nestedParentheses -= 1;
      }
      cursor += 1;
    }

    if (closingParenthesis === null) continue;
    const destinationEnd = angleDestinationEnd === null
      ? closingParenthesis
      : angleDestinationEnd + 1;
    destinations.push({
      rawDestination: searchableContent.slice(destinationStart, destinationEnd),
      index: destinationStart,
    });
    index = closingParenthesis;
  }

  const referenceDefinitionPattern = /^[ \t]{0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]+>|[^\s]+)(?:[ \t]+.*)?$/gmu;
  for (const match of searchableContent.matchAll(referenceDefinitionPattern)) {
    if (match[1].startsWith('^')) continue;
    destinations.push({
      rawDestination: match[2],
      index: match.index + match[0].indexOf(match[2]),
    });
  }

  return { searchableContent, destinations };
}

async function checkLocalLinks(markdownFiles) {
  const failures = [];
  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8');
    if (!content.trim()) {
      failures.push(`${path.relative(repositoryRoot, file)} is empty`);
      continue;
    }
    const { searchableContent, destinations } = markdownLinkDestinations(content);
    for (const destination of destinations) {
      const target = localLinkTarget(destination.rawDestination);
      if (!target) continue;

      const resolvedTarget = path.resolve(path.dirname(file), target);
      try {
        await stat(resolvedTarget);
      } catch {
        failures.push(
          `${path.relative(repositoryRoot, file)}:${lineNumberAt(searchableContent, destination.index)} `
          + `links to missing path ${destination.rawDestination}`,
        );
      }
    }
  }
  return failures;
}

function sectionContent(markdown, sectionName) {
  const headings = [...markdown.matchAll(/^## ([^\n]+)$/gmu)];
  const sectionIndex = headings.findIndex((heading) => heading[1].trim() === sectionName);
  if (sectionIndex === -1) return null;
  const start = headings[sectionIndex].index + headings[sectionIndex][0].length;
  const end = headings[sectionIndex + 1]?.index ?? markdown.length;
  return markdown.slice(start, end);
}

export function featureSpecFailures(relativeFile, content) {
  const failures = [];
  const status = content.match(/^Status: (Draft|Active|Implemented|Superseded)$/mu)?.[1];
  if (!status) {
    failures.push(`${relativeFile} must declare Status: Draft, Active, Implemented, or Superseded`);
  }

  for (const section of requiredFeatureSections) {
    if (sectionContent(content, section) === null) {
      failures.push(`${relativeFile} is missing the "## ${section}" section`);
    }
  }

  const acceptanceCriteria = sectionContent(content, 'Acceptance criteria') ?? '';
  const checkboxRows = [
    ...acceptanceCriteria.matchAll(/^[ \t]*[-+*][ \t]+\[[^\]\n]*\].*$/gmu),
  ];
  const criterionPattern = /^[ \t]*[-+*][ \t]+\[([ xX])\][ \t]+`?(AC-\d{2})`?:/u;
  const malformedRows = checkboxRows.filter((match) => !criterionPattern.test(match[0]));
  for (const malformedRow of malformedRows) {
    failures.push(
      `${relativeFile} has malformed acceptance criterion checkbox: ${malformedRow[0]}`,
    );
  }

  const criterionMatches = checkboxRows
    .map((match) => match[0].match(criterionPattern))
    .filter(Boolean);
  if (criterionMatches.length === 0) {
    failures.push(`${relativeFile} must define checkbox criteria with stable AC-01 style identifiers`);
    return failures;
  }

  const criterionIds = criterionMatches.map((match) => match[2]);
  const duplicateIds = criterionIds.filter((id, index) => criterionIds.indexOf(id) !== index);
  for (const duplicateId of new Set(duplicateIds)) {
    failures.push(`${relativeFile} repeats acceptance criterion ${duplicateId}`);
  }

  if (status === 'Implemented') {
    const incomplete = criterionMatches.filter((match) => match[1].toLowerCase() !== 'x');
    if (incomplete.length > 0) {
      failures.push(`${relativeFile} is Implemented but has incomplete acceptance criteria`);
    }
  }

  const verification = sectionContent(content, 'Verification') ?? '';
  const verificationMappings = [
    ...verification.matchAll(
      /^[ \t]*\|[ \t]*`?(AC-\d{2})`?[ \t]*\|([^|\n]*)\|[ \t]*$/gmu,
    ),
  ];
  for (const criterionId of criterionIds) {
    const mappings = verificationMappings.filter((mapping) => mapping[1] === criterionId);
    if (mappings.length === 0 || mappings.every((mapping) => !mapping[2].trim())) {
      failures.push(
        `${relativeFile} does not map ${criterionId} to non-empty evidence in the Verification table`,
      );
    } else if (mappings.length > 1) {
      failures.push(`${relativeFile} repeats verification mapping ${criterionId}`);
    }
  }

  return failures;
}

async function checkFeatureSpecs() {
  const featureDirectory = path.join(repositoryRoot, 'specs/features');
  const entries = await readdir(featureDirectory, { withFileTypes: true });
  const markdownEntries = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.md'));
  const specFiles = markdownEntries
    .filter((entry) => !entry.name.startsWith('_'))
    .map((entry) => path.join(featureDirectory, entry.name))
    .sort();
  const failures = [];
  const template = markdownEntries.find((entry) => entry.name === '_template.md');
  if (!template) failures.push('specs/features/_template.md is required');
  const validatedFiles = [
    ...(template ? [path.join(featureDirectory, template.name)] : []),
    ...specFiles,
  ];

  for (const file of validatedFiles) {
    const relativeFile = path.relative(repositoryRoot, file);
    const content = await readFile(file, 'utf8');
    failures.push(...featureSpecFailures(relativeFile, content));
  }

  return { failures, specCount: specFiles.length };
}

export async function checkDocumentation() {
  const markdownFiles = (await Promise.all(markdownEntrypoints.map(collectMarkdownFiles))).flat().sort();
  const linkFailures = await checkLocalLinks(markdownFiles);
  const featureSpecs = await checkFeatureSpecs();
  const failures = [...linkFailures, ...featureSpecs.failures];

  if (failures.length > 0) {
    throw new Error(`Documentation validation failed:\n- ${failures.join('\n- ')}`);
  }

  return { markdownCount: markdownFiles.length, specCount: featureSpecs.specCount };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await checkDocumentation();
    console.log(
      `Documentation checks passed (${result.markdownCount} Markdown files, `
      + `${result.specCount} feature specs).`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
