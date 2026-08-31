import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { parseFragment } from 'parse5';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);
const requiredFeatureSections = [
  'User outcome',
  'Scope',
  'Acceptance criteria',
  'Privacy and data boundaries',
  'Verification',
  'Rollout',
];
const markdownParser = unified().use(remarkParse);

async function repositoryMarkdownFiles() {
  const { stdout } = await execFileAsync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  const candidates = [...new Set(stdout.split('\0').filter(Boolean))]
    .map((relativeFile) => path.join(repositoryRoot, relativeFile));
  return filterExistingFiles(candidates);
}

export async function filterExistingFiles(files) {
  const existing = await Promise.all(files.map(async (file) => {
    try {
      return (await stat(file)).isFile() ? file : null;
    } catch (error) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }));
  return existing.filter(Boolean).sort();
}

function isEscaped(markdown, index) {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && markdown[cursor] === '\\'; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 1;
}

function visitMarkdown(node, visitor) {
  visitor(node);
  for (const child of node.children ?? []) visitMarkdown(child, visitor);
}

function normalizeReferenceIdentifier(identifier) {
  return identifier
    .replace(/\\([!-/:-@\[-`{-~])/gu, '$1')
    .trim()
    .replace(/\s+/gu, ' ')
    .toLowerCase();
}

function withoutEscapedHtmlTags(source, sourceOffset, markdown) {
  const characters = source.split('');
  for (let index = 0; index < characters.length; index += 1) {
    if (characters[index] === '<' && isEscaped(markdown, sourceOffset + index)) {
      characters[index] = ' ';
    }
  }
  return characters.join('');
}

function htmlLinkDestinations(source, sourceOffset, markdown) {
  const parseableSource = withoutEscapedHtmlTags(source, sourceOffset, markdown);
  const fragment = parseFragment(parseableSource, { sourceCodeLocationInfo: true });
  const destinations = [];

  const visit = (node) => {
    for (const attribute of node.attrs ?? []) {
      if (attribute.name !== 'href' && attribute.name !== 'src') continue;
      const location = node.sourceCodeLocation?.attrs?.[attribute.name];
      destinations.push({
        rawDestination: attribute.value,
        index: sourceOffset + (location?.startOffset ?? node.sourceCodeLocation?.startOffset ?? 0),
      });
    }
    for (const child of node.childNodes ?? []) visit(child);
    if (node.content) visit(node.content);
  };

  visit(fragment);
  return destinations;
}

function htmlCodeLikeRanges(markdown, markdownTree) {
  const ranges = [];
  const codeLikeElements = new Set(['code', 'kbd', 'pre', 'samp', 'script', 'style']);
  const htmlNodes = [];
  const openElements = [];

  visitMarkdown(markdownTree, (node) => {
    if (node.type === 'html') htmlNodes.push(node);
  });

  for (const node of htmlNodes) {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? start;
    const source = markdown.slice(start, end);
    const parseableSource = withoutEscapedHtmlTags(source, start, markdown);
    const fragment = parseFragment(parseableSource, { sourceCodeLocationInfo: true });
    let hasCompleteElement = false;

    const visit = (htmlNode) => {
      const location = htmlNode.sourceCodeLocation;
      if (codeLikeElements.has(htmlNode.tagName) && location?.endTag) {
        ranges.push([start + location.startOffset, start + location.endOffset]);
        hasCompleteElement = true;
      }
      for (const child of htmlNode.childNodes ?? []) visit(child);
      if (htmlNode.content) visit(htmlNode.content);
    };
    visit(fragment);

    const trimmed = parseableSource.trimStart();
    const closing = trimmed.match(/^<\/\s*(code|kbd|pre|samp|script|style)\s*>/iu);
    if (closing) {
      const openIndex = openElements.findLastIndex((element) => element.name === closing[1].toLowerCase());
      if (openIndex !== -1) {
        const [opening] = openElements.splice(openIndex, 1);
        ranges.push([opening.start, end]);
      }
      continue;
    }

    const opening = trimmed.match(/^<(code|kbd|pre|samp|script|style)(?:\s|>)/iu);
    if (opening && !hasCompleteElement && !/\/\s*>\s*$/u.test(trimmed)) {
      openElements.push({ name: opening[1].toLowerCase(), start });
    }
  }

  for (const opening of openElements) ranges.push([opening.start, markdown.length]);
  return ranges;
}

function isInRanges(index, ranges) {
  return ranges.some(([start, end]) => index >= start && index < end);
}

function withoutNonRenderedMarkdown(markdown) {
  const tree = markdownParser.parse(markdown);
  const characters = markdown.split('');
  const codeLikeRanges = htmlCodeLikeRanges(markdown, tree);

  for (const [start, end] of codeLikeRanges) {
    for (let index = start; index < end; index += 1) {
      if (characters[index] !== '\n') characters[index] = ' ';
    }
  }

  visitMarkdown(tree, (node) => {
    const start = node.position?.start.offset ?? 0;
    const end = node.position?.end.offset ?? start;
    if (node.type !== 'code' && node.type !== 'html') return;
    for (let index = start; index < end; index += 1) {
      if (characters[index] !== '\n') characters[index] = ' ';
    }
  });

  return characters.join('');
}

function lineNumberAt(content, offset) {
  return content.slice(0, offset).split('\n').length;
}

export function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === ''
    || (relative !== '..'
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative));
}

export function localLinkTarget(rawDestination) {
  const destination = rawDestination.trim();

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
  const tree = markdownParser.parse(markdown);
  const codeLikeRanges = htmlCodeLikeRanges(markdown, tree);
  const destinations = [];
  const definitions = new Set();
  const textNodes = [];

  visitMarkdown(tree, (node) => {
    if (node.type === 'definition') definitions.add(node.identifier);
    if (node.type === 'text') textNodes.push(node);
    if (node.type === 'html') {
      const start = node.position?.start.offset ?? 0;
      const source = markdown.slice(start, node.position?.end.offset ?? start);
      destinations.push(...htmlLinkDestinations(source, start, markdown));
      return;
    }
    if (!['link', 'image', 'definition'].includes(node.type)) return;
    if (node.type !== 'definition'
      && isInRanges(node.position?.start.offset ?? 0, codeLikeRanges)) return;
    destinations.push({
      rawDestination: node.url,
      index: node.position?.start.offset ?? 0,
    });
  });

  const unresolvedReferences = [];
  const referenceUsagePattern = /!?\[((?:\\.|[^\]\\\n])*)\]\[((?:\\.|[^\]\\\n])*)\]/gu;
  for (const node of textNodes) {
    const start = node.position?.start.offset ?? 0;
    const source = markdown.slice(start, node.position?.end.offset ?? start);
    for (const match of source.matchAll(referenceUsagePattern)) {
      const bracketOffset = match[0].startsWith('!') ? 1 : 0;
      const usageIndex = start + match.index;
      if (isInRanges(usageIndex, codeLikeRanges)) continue;
      if (isEscaped(markdown, usageIndex + bracketOffset)) continue;
      const identifier = normalizeReferenceIdentifier(match[2] || match[1]);
      if (identifier && !definitions.has(identifier)) {
        unresolvedReferences.push({ identifier, index: usageIndex });
      }
    }
  }

  return { searchableContent: markdown, destinations, unresolvedReferences };
}

async function checkLocalLinks(markdownFiles) {
  const failures = [];
  for (const file of markdownFiles) {
    const content = await readFile(file, 'utf8');
    if (!content.trim()) {
      failures.push(`${path.relative(repositoryRoot, file)} is empty`);
      continue;
    }
    const { searchableContent, destinations, unresolvedReferences } = markdownLinkDestinations(content);
    for (const reference of unresolvedReferences) {
      failures.push(
        `${path.relative(repositoryRoot, file)}:${lineNumberAt(content, reference.index)} `
        + `uses undefined reference [${reference.identifier}]`,
      );
    }
    for (const destination of destinations) {
      const target = localLinkTarget(destination.rawDestination);
      if (!target) continue;

      const resolvedTarget = path.resolve(path.dirname(file), target);
      if (!isPathInside(repositoryRoot, resolvedTarget)) {
        failures.push(
          `${path.relative(repositoryRoot, file)}:${lineNumberAt(searchableContent, destination.index)} `
          + `links outside the repository: ${destination.rawDestination}`,
        );
        continue;
      }
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

function markdownNodeText(node) {
  if (typeof node.value === 'string') return node.value;
  return (node.children ?? []).map(markdownNodeText).join('');
}

function sectionContent(markdown, sectionName) {
  const tree = markdownParser.parse(markdown);
  const headings = tree.children.filter((node) => node.type === 'heading' && node.depth === 2);
  const sectionIndex = headings.findIndex(
    (heading) => markdownNodeText(heading).trim() === sectionName,
  );
  if (sectionIndex === -1) return null;
  const start = headings[sectionIndex].position?.end.offset ?? 0;
  const end = headings[sectionIndex + 1]?.position?.start.offset ?? markdown.length;
  return markdown.slice(start, end);
}

export function featureSpecFailures(relativeFile, content) {
  const failures = [];
  const structuralContent = withoutNonRenderedMarkdown(content);
  const status = structuralContent.match(
    /^Status: (Draft|Active|Implemented|Superseded)$/mu,
  )?.[1];
  if (!status) {
    failures.push(`${relativeFile} must declare Status: Draft, Active, Implemented, or Superseded`);
  }

  for (const section of requiredFeatureSections) {
    const body = sectionContent(structuralContent, section);
    if (body === null) {
      failures.push(`${relativeFile} is missing the "## ${section}" section`);
    } else if ((status === 'Active' || status === 'Implemented') && !body.trim()) {
      failures.push(`${relativeFile} has an empty "## ${section}" section`);
    }
  }

  const acceptanceCriteria = sectionContent(structuralContent, 'Acceptance criteria') ?? '';
  const checkboxRows = [
    ...acceptanceCriteria.matchAll(
      /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+\[[^\]\n]*\].*$/gmu,
    ),
  ];
  const criterionPattern = /^[ \t]*(?:[-+*]|\d{1,9}[.)])[ \t]+\[([ xX])\][ \t]+`?(AC-\d{2})`?:/u;
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

  const verification = sectionContent(structuralContent, 'Verification') ?? '';
  const verificationMappings = [
    ...verification.matchAll(
      /^[ \t]*\|?[ \t]*`?(AC-\d{2})`?[ \t]*\|((?:\\.|[^|\n])*)\|?[ \t]*$/gmu,
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
  const markdownFiles = await repositoryMarkdownFiles();
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
