import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  hasKnowledgeNotation,
  knowledgeTextRequiresBlockContainer,
  parseKnowledgeText,
  type KnowledgeTextToken,
} from '@stem-brain/shared';
import { knowledgeMathLiteral, renderKnowledgeMath } from '@/lib/knowledge-katex';

test('parses explicit inline and display math without trimming source content', () => {
  const source = 'Force \\( F = ma \\).\n\\[\nE = mc^2\n\\]\nDone.';
  assert.deepEqual(parseKnowledgeText(source), [
    { type: 'text', value: 'Force ' },
    { type: 'math', value: ' F = ma ', display: false, source: '\\( F = ma \\)' },
    { type: 'text', value: '.\n' },
    { type: 'math', value: '\nE = mc^2\n', display: true, source: '\\[\nE = mc^2\n\\]' },
    { type: 'text', value: '\nDone.' },
  ] satisfies KnowledgeTextToken[]);
});

test('keeps chemistry commands inside math tokens', () => {
  assert.deepEqual(parseKnowledgeText('Reaction: \\(\\ce{2H2 + O2 -> 2H2O}\\), unit \\(\\pu{5 mol}\\).'), [
    { type: 'text', value: 'Reaction: ' },
    { type: 'math', value: '\\ce{2H2 + O2 -> 2H2O}', display: false, source: '\\(\\ce{2H2 + O2 -> 2H2O}\\)' },
    { type: 'text', value: ', unit ' },
    { type: 'math', value: '\\pu{5 mol}', display: false, source: '\\(\\pu{5 mol}\\)' },
    { type: 'text', value: '.' },
  ] satisfies KnowledgeTextToken[]);
});

test('gives inline and fenced code precedence over math delimiters', () => {
  const source = '`\\(not math\\)` then\n```ts\nconst formula = "\\[not math\\]";\n```\n\\(real math\\)';
  assert.deepEqual(parseKnowledgeText(source), [
    { type: 'code', value: '\\(not math\\)', block: false },
    { type: 'text', value: ' then\n' },
    { type: 'code', value: 'const formula = "\\[not math\\]";\n', block: true, language: 'ts' },
    { type: 'text', value: '\n' },
    { type: 'math', value: 'real math', display: false, source: '\\(real math\\)' },
  ] satisfies KnowledgeTextToken[]);
});

test('does not close math across inline or fenced code boundaries', () => {
  assert.deepEqual(parseKnowledgeText('before \\(open `\\)` after'), [
    { type: 'text', value: 'before \\(open ' },
    { type: 'code', value: '\\)', block: false },
    { type: 'text', value: ' after' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before \\(open `code` \\) after'), [
    { type: 'text', value: 'before \\(open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' \\) after' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before \\(open `\\)` then \\(real\\)'), [
    { type: 'text', value: 'before \\(open ' },
    { type: 'code', value: '\\)', block: false },
    { type: 'text', value: ' then ' },
    { type: 'math', value: 'real', display: false, source: '\\(real\\)' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('\\(done\\) then `\\)`'), [
    { type: 'math', value: 'done', display: false, source: '\\(done\\)' },
    { type: 'text', value: ' then ' },
    { type: 'code', value: '\\)', block: false },
  ] satisfies KnowledgeTextToken[]);

  const fenced = 'before \\(open\n```txt\n\\)\n```\nafter';
  assert.deepEqual(parseKnowledgeText(fenced), [
    { type: 'text', value: 'before \\(open\n' },
    { type: 'code', value: '\\)\n', block: true, language: 'txt' },
    { type: 'text', value: '\nafter' },
  ] satisfies KnowledgeTextToken[]);

  const displayFenced = 'before \\[open\n```txt\n\\]\n```\nafter';
  assert.deepEqual(parseKnowledgeText(displayFenced), [
    { type: 'text', value: 'before \\[open\n' },
    { type: 'code', value: '\\]\n', block: true, language: 'txt' },
    { type: 'text', value: '\nafter' },
  ] satisfies KnowledgeTextToken[]);
});

test('does not treat unsupported backtick runs or invalid fences as code barriers', () => {
  assert.deepEqual(parseKnowledgeText('\\(a ``` b\\)'), [
    { type: 'math', value: 'a ``` b', display: false, source: '\\(a ``` b\\)' },
  ] satisfies KnowledgeTextToken[]);

  const invalidFence = '\\(a\n```not valid!\n\\)';
  assert.deepEqual(parseKnowledgeText(invalidFence), [
    { type: 'math', value: 'a\n```not valid!\n', display: false, source: invalidFence },
  ] satisfies KnowledgeTextToken[]);
});

test('does not close legacy dollar math across code boundaries', () => {
  assert.deepEqual(parseKnowledgeText('before $open `$` after', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: '$', block: false },
    { type: 'text', value: ' after' },
  ] satisfies KnowledgeTextToken[]);

  const fenced = 'before $$open\n```txt\n$$\n```\nafter';
  assert.deepEqual(parseKnowledgeText(fenced, { legacyDollarMath: true }), [
    { type: 'text', value: 'before $$open\n' },
    { type: 'code', value: '$$\n', block: true, language: 'txt' },
    { type: 'text', value: '\nafter' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `code` $ after $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' $ after ' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `$` after $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: '$', block: false },
    { type: 'text', value: ' after ' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `code` $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' $real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `code` $$real$$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' ' },
    { type: 'math', value: 'real', display: true, source: '$$real$$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $$open `code` $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $$open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' ' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(
    parseKnowledgeText('before $open `code` \\(inside $ closer\\) after $real$', { legacyDollarMath: true }),
    [
      { type: 'text', value: 'before $open ' },
      { type: 'code', value: 'code', block: false },
      { type: 'text', value: ' ' },
      { type: 'math', value: 'inside $ closer', display: false, source: '\\(inside $ closer\\)' },
      { type: 'text', value: ' after ' },
      { type: 'math', value: 'real', display: false, source: '$real$' },
    ] satisfies KnowledgeTextToken[],
  );

  assert.deepEqual(
    parseKnowledgeText('before $$open `code` \\[inside $$ closer\\] after $$real$$', { legacyDollarMath: true }),
    [
      { type: 'text', value: 'before $$open ' },
      { type: 'code', value: 'code', block: false },
      { type: 'text', value: ' ' },
      { type: 'math', value: 'inside $$ closer', display: true, source: '\\[inside $$ closer\\]' },
      { type: 'text', value: ' after ' },
      { type: 'math', value: 'real', display: true, source: '$$real$$' },
    ] satisfies KnowledgeTextToken[],
  );

  const inlineAcrossFence = 'before $open\n```txt\ncode\n```\n$real$';
  assert.deepEqual(parseKnowledgeText(inlineAcrossFence, { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open\n' },
    { type: 'code', value: 'code\n', block: true, language: 'txt' },
    { type: 'text', value: '\n' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `code`\n$real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: '\n' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(parseKnowledgeText('before $open `multi\nline` $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $open ' },
    { type: 'code', value: 'multi\nline', block: false },
    { type: 'text', value: ' ' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  assert.deepEqual(
    parseKnowledgeText('before $open `code` \\[inside\nmath\\] after $real$', { legacyDollarMath: true }),
    [
      { type: 'text', value: 'before $open ' },
      { type: 'code', value: 'code', block: false },
      { type: 'text', value: ' ' },
      { type: 'math', value: 'inside\nmath', display: true, source: '\\[inside\nmath\\]' },
      { type: 'text', value: ' after ' },
      { type: 'math', value: 'real', display: false, source: '$real$' },
    ] satisfies KnowledgeTextToken[],
  );

  assert.deepEqual(parseKnowledgeText('before $a\n$b$ `code` $real$', { legacyDollarMath: true }), [
    { type: 'text', value: 'before $a\n' },
    { type: 'math', value: 'b', display: false, source: '$b$' },
    { type: 'text', value: ' ' },
    { type: 'code', value: 'code', block: false },
    { type: 'text', value: ' ' },
    { type: 'math', value: 'real', display: false, source: '$real$' },
  ] satisfies KnowledgeTextToken[]);

  const resynchronizedDisplay = 'before $$open\n```txt\ncode\n```\n$$ after $$real$$';
  assert.deepEqual(parseKnowledgeText(resynchronizedDisplay, { legacyDollarMath: true }), [
    { type: 'text', value: 'before $$open\n' },
    { type: 'code', value: 'code\n', block: true, language: 'txt' },
    { type: 'text', value: '\n$$ after ' },
    { type: 'math', value: 'real', display: true, source: '$$real$$' },
  ] satisfies KnowledgeTextToken[]);
});

test('parses a language-free fence and preserves blank lines and indentation', () => {
  const source = 'Before\n```\nfirst\n\n  second\n```\nAfter';
  assert.deepEqual(parseKnowledgeText(source), [
    { type: 'text', value: 'Before\n' },
    { type: 'code', value: 'first\n\n  second\n', block: true },
    { type: 'text', value: '\nAfter' },
  ] satisfies KnowledgeTextToken[]);
});

test('requires a block container for display math and fenced code only', () => {
  assert.equal(knowledgeTextRequiresBlockContainer(parseKnowledgeText('plain \\(x\\) and `code`')), false);
  assert.equal(knowledgeTextRequiresBlockContainer(parseKnowledgeText('\\[x\\]')), true);
  assert.equal(knowledgeTextRequiresBlockContainer(parseKnowledgeText('```ts\nconst x = 1;\n```')), true);
});

test('preserves unmatched explicit delimiters and code fences as literal text', () => {
  const sources = [
    'Unmatched \\(x + y',
    'Unmatched \\[x + y',
    'Unmatched `code',
    '```ts\nconst value = 1;',
  ];
  for (const source of sources) {
    assert.deepEqual(parseKnowledgeText(source), [{ type: 'text', value: source }]);
    assert.equal(hasKnowledgeNotation(source), false);
  }
});

test('keeps notation inside an unclosed fenced block literal', () => {
  const source = 'Before\n```ts\nconst formula = "\\(x\\)";\nconst code = `x`;';
  assert.deepEqual(parseKnowledgeText(source), [{ type: 'text', value: source }]);
  assert.equal(hasKnowledgeNotation(source), false);

  assert.deepEqual(parseKnowledgeText('\\(outside\\)\n```ts\n\\(inside\\)'), [
    { type: 'math', value: 'outside', display: false, source: '\\(outside\\)' },
    { type: 'text', value: '\n```ts\n\\(inside\\)' },
  ] satisfies KnowledgeTextToken[]);
});

test('keeps notation inside an unclosed inline code span literal', () => {
  for (const source of ['Before `open \\(x\\)', 'Before ``open \\(x\\)']) {
    assert.deepEqual(parseKnowledgeText(source), [{ type: 'text', value: source }]);
    assert.equal(hasKnowledgeNotation(source), false);
  }

  const legacySource = 'Before `open $x$';
  assert.deepEqual(parseKnowledgeText(legacySource, { legacyDollarMath: true }), [{ type: 'text', value: legacySource }]);
  assert.equal(hasKnowledgeNotation(legacySource, { legacyDollarMath: true }), false);

  assert.deepEqual(parseKnowledgeText('\\(outside\\) then `open \\(inside\\)'), [
    { type: 'math', value: 'outside', display: false, source: '\\(outside\\)' },
    { type: 'text', value: ' then `open \\(inside\\)' },
  ] satisfies KnowledgeTextToken[]);
});

test('skips whole mismatched closing backtick runs', () => {
  for (const source of ['`a``', '`a```', '``a```', '``a````']) {
    assert.deepEqual(parseKnowledgeText(source), [{ type: 'text', value: source }]);
    assert.equal(hasKnowledgeNotation(source), false);
  }

  assert.deepEqual(parseKnowledgeText('`a``b`'), [
    { type: 'code', value: 'a``b', block: false },
  ] satisfies KnowledgeTextToken[]);
  assert.deepEqual(parseKnowledgeText('``a````b``'), [
    { type: 'code', value: 'a````b', block: false },
  ] satisfies KnowledgeTextToken[]);
});

test('handles many unmatched explicit math openers in linear time', () => {
  const source = '\\('.repeat(30_000);
  const startedAt = performance.now();
  const tokens = parseKnowledgeText(source);
  const elapsedMs = performance.now() - startedAt;

  assert.deepEqual(tokens, [{ type: 'text', value: source }]);
  assert.ok(elapsedMs < 1_000, `expected a linear scan, received ${elapsedMs.toFixed(1)}ms`);
});

test('leaves legacy dollar math literal unless explicitly enabled', () => {
  const source = 'Inline $x + y$ and display $$z = 3$$.';
  assert.deepEqual(parseKnowledgeText(source), [{ type: 'text', value: source }]);
  assert.equal(hasKnowledgeNotation(source), false);
  assert.deepEqual(parseKnowledgeText(source, { legacyDollarMath: true }), [
    { type: 'text', value: 'Inline ' },
    { type: 'math', value: 'x + y', display: false, source: '$x + y$' },
    { type: 'text', value: ' and display ' },
    { type: 'math', value: 'z = 3', display: true, source: '$$z = 3$$' },
    { type: 'text', value: '.' },
  ] satisfies KnowledgeTextToken[]);
});

test('preserves unmatched legacy dollar delimiters when compatibility is enabled', () => {
  for (const source of ['$x + y', '$$x + y', '$$x + y$']) {
    assert.deepEqual(parseKnowledgeText(source, { legacyDollarMath: true }), [{ type: 'text', value: source }]);
    assert.equal(hasKnowledgeNotation(source, { legacyDollarMath: true }), false);
  }
});

test('detects only complete supported notation and handles empty input', () => {
  assert.deepEqual(parseKnowledgeText(''), []);
  assert.equal(hasKnowledgeNotation('plain text'), false);
  assert.equal(hasKnowledgeNotation('\\(x\\)'), true);
  assert.equal(hasKnowledgeNotation('`x`'), true);
  assert.equal(hasKnowledgeNotation('```json\n{}\n```'), true);
});

test('rejects untrusted KaTeX HTML commands and preserves exact literal source', () => {
  const commands = [
    String.raw`\htmlClass{attacker-class}{x}`,
    String.raw`\htmlId{attacker-id}{x}`,
    String.raw`\htmlStyle{background:url(https://attacker.test/pixel)}{x}`,
  ];

  for (const command of commands) {
    const source = String.raw`\(${command}\)`;
    const rendered = renderKnowledgeMath(command, false);

    assert.equal(rendered, null, `expected no KaTeX HTML for ${command}`);
    assert.equal(knowledgeMathLiteral(command, false), source);
  }
});

test('falls back to the exact source for KaTeX commands that require trust', () => {
  const commands = [
    String.raw`\href{https://attacker.test/x}{click}`,
    String.raw`\url{https://attacker.test/x}`,
    String.raw`\includegraphics{https://attacker.test/x.png}`,
  ];

  for (const command of commands) {
    const markup = renderKnowledgeMath(command, false);
    assert.equal(markup, null);
    assert.equal(knowledgeMathLiteral(command, false), `\\(${command}\\)`);
  }
});

test('preserves legacy dollar delimiters when trusted commands are rejected', () => {
  const source = String.raw`$\href{https://attacker.test/x}{click}$`;
  const [token] = parseKnowledgeText(source, { legacyDollarMath: true });

  assert.equal(token?.type, 'math');
  if (token?.type !== 'math') return;
  assert.equal(renderKnowledgeMath(token.value, token.display), null);
  assert.equal(token.source, source);
});

test('renders formulas, chemistry, and units with visual KaTeX plus MathML', () => {
  const inputs = [String.raw`E = mc^2`, String.raw`\ce{2H2 + O2 -> 2H2O}`, String.raw`\pu{9.81 m/s^2}`];

  for (const input of inputs) {
    const markup = renderKnowledgeMath(input, false);
    assert.ok(markup);
    assert.match(markup, /class="katex"/);
    assert.match(markup, /class="katex-mathml"/);
    assert.match(markup, /<math\b/);
  }
});

test('renders the draft resolution heading through the rich knowledge renderer', () => {
  const source = readFileSync(
    new URL('../app/knowledge-inbox/[batchId]/[draftId]/resolve/page.tsx', import.meta.url),
    'utf8',
  );

  assert.match(
    source,
    /<h1[^>]*><KnowledgeText text=\{context\.draft\.title\} allowCodeCopy=\{false\} \/><\/h1>/,
  );
});
