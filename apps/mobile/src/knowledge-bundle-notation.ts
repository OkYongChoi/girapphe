import {
  hasKnowledgeNotation as hasSourceNotation,
  parseKnowledgeText,
  type KnowledgeBundleContent,
  type Locale,
} from '@stem-brain/shared';
import {
  eventChronologyLabel,
  knowledgeBundleConfidenceLabel,
  knowledgeBundleQuestionStatusLabel,
} from './knowledge-bundle-ui';

export type KnowledgeBundleTextTone =
  | 'answer'
  | 'body'
  | 'claim'
  | 'detail'
  | 'hero'
  | 'language'
  | 'meta'
  | 'pronunciation'
  | 'question'
  | 'source'
  | 'status'
  | 'summary'
  | 'title';

export type KnowledgeBundleNotationBlock =
  | { kind: 'text'; source: string; tone: KnowledgeBundleTextTone; legacyDollarMath?: boolean; numberOfLines?: number }
  | { kind: 'lines'; values: string[]; tone: 'good' | 'plain' | 'warn' }
  | { kind: 'pairs'; values: Array<{ first: string; second: string }> }
  | { kind: 'steps'; values: Array<{ number: number; title: string; detail: string }> }
  | { kind: 'chips'; values: string[] }
  | { kind: 'comparison'; values: Array<{ name: string; values: string[] }> }
  | { kind: 'stages'; values: Array<{ title: string; detail: string }> }
  | { kind: 'components'; values: Array<{ depth: number; label: string; role: string }> }
  | { kind: 'expression-hero'; expression: string; pronunciation: string; language: string }
  | { kind: 'evidence'; values: Array<{ statement: string; details: Array<{ source: string; tone: 'detail' | 'source' }> }> };

function hierarchyDepth(content: Extract<KnowledgeBundleContent, { type: 'structure' }>, id: string) {
  let depth = 0;
  let parent = content.components.find((item) => item.id === id)?.parent_id;
  const seen = new Set([id]);
  while (parent && !seen.has(parent) && depth < content.components.length) {
    seen.add(parent);
    depth += 1;
    parent = content.components.find((item) => item.id === parent)?.parent_id;
  }
  return depth;
}

function text(source: string, tone: KnowledgeBundleTextTone, numberOfLines?: number, legacyDollarMath = false): KnowledgeBundleNotationBlock[] {
  return source ? [{
    kind: 'text',
    source,
    tone,
    ...(legacyDollarMath ? { legacyDollarMath: true } : {}),
    ...(numberOfLines ? { numberOfLines } : {}),
  }] : [];
}

function lines(values: string[], tone: 'good' | 'plain' | 'warn' = 'plain'): KnowledgeBundleNotationBlock[] {
  return values.length ? [{ kind: 'lines', values, tone }] : [];
}

function pairs(values: Array<{ first: string; second: string }>): KnowledgeBundleNotationBlock[] {
  return values.length ? [{ kind: 'pairs', values }] : [];
}

export function buildKnowledgeNotationGroupBlocks(
  fields: ReadonlyArray<{ source?: string | null; tone: KnowledgeBundleTextTone; legacyDollarMath?: boolean; numberOfLines?: number }>,
  content?: KnowledgeBundleContent | null,
  locale?: Locale,
): KnowledgeBundleNotationBlock[] {
  return [
    ...fields.flatMap(({ source, tone, legacyDollarMath, numberOfLines }) => source ? text(source, tone, numberOfLines, legacyDollarMath) : []),
    ...(content ? buildKnowledgeBundleNotationBlocks(content, locale) : []),
  ];
}

/**
 * Converts a structured bundle into serializable presentation blocks. Each user
 * field remains a separate source so a fenced code block still starts at index
 * zero of that field instead of being changed by a visual bullet or label.
 */
export function buildKnowledgeBundleNotationBlocks(content: KnowledgeBundleContent, locale?: Locale): KnowledgeBundleNotationBlock[] {
  switch (content.type) {
    case 'concept':
      return [
        ...text(content.definition, 'hero'),
        ...lines(content.key_points),
        ...lines(content.examples, 'good'),
        ...lines(content.non_examples, 'warn'),
        ...pairs(content.misconceptions.map((item) => ({ first: item.claim, second: item.correction }))),
      ];
    case 'procedure':
      return [
        ...text(content.goal, 'hero'),
        ...lines(content.prerequisites),
        ...(content.steps.length ? [{
          kind: 'steps' as const,
          values: content.steps.map((step, index) => ({ number: index + 1, title: step.title, detail: step.detail })),
        }] : []),
        ...pairs(content.branches.map((item) => ({ first: item.condition, second: item.action }))),
        ...pairs(content.failure_modes.map((item) => ({ first: item.symptom, second: item.response }))),
        ...lines(content.done_when, 'good'),
      ];
    case 'comparison':
      return [
        ...(content.targets.length ? [{ kind: 'chips' as const, values: content.targets }] : []),
        ...(content.criteria.length ? [{ kind: 'comparison' as const, values: content.criteria }] : []),
        ...lines(content.commonalities, 'good'),
        ...lines(content.differences, 'warn'),
        ...pairs(content.choice_guide.map((item) => ({ first: item.condition, second: item.recommendation }))),
      ];
    case 'mechanism':
      return [
        ...lines(content.causes),
        ...(content.stages.length ? [{ kind: 'stages' as const, values: content.stages }] : []),
        ...lines(content.results, 'good'),
        ...lines(content.conditions),
        ...lines(content.exceptions, 'warn'),
      ];
    case 'structure':
      return [
        ...text(content.purpose, 'hero'),
        ...(content.components.length ? [{
          kind: 'components' as const,
          values: content.components.map((item) => ({
            depth: hierarchyDepth(content, item.id),
            label: item.label,
            role: item.role,
          })),
        }] : []),
        ...pairs(content.relations.map((item) => ({ first: `${item.source_id} → ${item.target_id}`, second: item.label }))),
        ...lines(content.boundaries, 'warn'),
      ];
    case 'question':
      return [
        ...text(content.question, 'hero'),
        ...text(content.context, 'detail'),
        ...lines(content.known_facts, 'good'),
        ...lines(content.hypotheses),
        ...lines(content.next_steps),
        ...text(content.answer_summary, 'answer'),
        ...(locale ? text(knowledgeBundleQuestionStatusLabel(locale, content.status), 'status') : []),
      ];
    case 'decision':
      return [
        ...text(content.decision, 'hero'),
        ...text(content.context, 'detail'),
        ...pairs(content.options.map((item) => ({ first: item.name, second: item.tradeoffs }))),
        ...lines(content.criteria),
        ...lines(content.rationale, 'good'),
        ...lines(content.reconsider_when, 'warn'),
        ...text(content.outcome, 'answer'),
      ];
    case 'event': {
      const chronology = content.chronology ? eventChronologyLabel(content.chronology) : content.occurred_at;
      return [
        ...text(content.event, 'hero'),
        ...(chronology ? [{ kind: 'text' as const, source: chronology, tone: 'status' as const }] : []),
        ...text(content.context, 'detail'),
        ...lines(content.changes, 'good'),
        ...lines(content.causes),
        ...lines(content.consequences, 'warn'),
      ];
    }
    case 'expression':
      return [
        {
          kind: 'expression-hero',
          expression: content.expression,
          pronunciation: content.pronunciation,
          language: content.language,
        },
        ...lines(content.meanings),
        ...pairs(content.translations.map((item) => ({ first: item.language, second: item.text }))),
        ...text(content.register, 'status'),
        ...text(content.nuance, 'detail'),
        ...lines(content.usage_contexts),
        ...(content.examples.length ? [{
          kind: 'evidence' as const,
          values: content.examples.map((item) => ({
            statement: item.text,
            details: [
              ...(item.translation ? [{ source: item.translation, tone: 'detail' as const }] : []),
              ...(item.note ? [{ source: item.note, tone: 'source' as const }] : []),
            ],
          })),
        }] : []),
        ...pairs(content.contrasts.map((item) => ({ first: item.expression, second: item.difference }))),
        ...pairs(content.common_mistakes.map((item) => ({ first: item.incorrect, second: item.correction }))),
      ];
    case 'claim_evidence':
      return [
        ...text(content.claim, 'claim'),
        ...(content.evidence.length ? [{
          kind: 'evidence' as const,
          values: content.evidence.map((item) => ({
            statement: item.statement,
            details: item.source ? [{ source: item.source, tone: 'source' as const }] : [],
          })),
        }] : []),
        ...lines(content.counterevidence, 'warn'),
        ...lines(content.scope),
        ...lines(content.limitations, 'warn'),
        ...(locale && content.confidence ? text(knowledgeBundleConfidenceLabel(locale, content.confidence), 'status') : []),
      ];
  }
}

export function knowledgeBundleNotationSources(blocks: KnowledgeBundleNotationBlock[]): string[] {
  return blocks.flatMap((block) => {
    switch (block.kind) {
      case 'text': return [block.source];
      case 'lines':
      case 'chips': return block.values;
      case 'pairs': return block.values.flatMap((item) => [item.first, item.second]);
      case 'steps': return block.values.flatMap((item) => [item.title, item.detail]);
      case 'comparison': return block.values.flatMap((item) => [item.name, ...item.values]);
      case 'stages': return block.values.flatMap((item) => [item.title, item.detail]);
      case 'components': return block.values.flatMap((item) => [item.label, item.role]);
      case 'expression-hero': return [block.expression, block.pronunciation, block.language];
      case 'evidence': return block.values.flatMap((item) => [item.statement, ...item.details.map((detail) => detail.source)]);
    }
  });
}

export function hasKnowledgeBundleNotation(content: KnowledgeBundleContent) {
  return knowledgeBundleNotationBlocksHaveNotation(buildKnowledgeBundleNotationBlocks(content));
}

export function knowledgeBundleNotationBlocksHaveNotation(blocks: KnowledgeBundleNotationBlock[]) {
  return blocks.some((block) => {
    if (block.kind === 'text') {
      return hasSourceNotation(block.source, { legacyDollarMath: block.legacyDollarMath });
    }
    return knowledgeBundleNotationSources([block]).some((source) => hasSourceNotation(source));
  });
}

export function knowledgeSourceAccessibilityText(source: string, legacyDollarMath = false) {
  const tokens = parseKnowledgeText(source, { legacyDollarMath });
  if (!tokens.some((token) => token.type === 'flow' || token.type === 'timeline')) return source;

  return tokens.map((token) => {
    if (token.type === 'text') return token.value;
    if (token.type === 'math') return token.source;
    if (token.type === 'flow') {
      return token.edges.map((edge) => `${edge.from} — ${edge.relation} — ${edge.to}`).join('\n');
    }
    if (token.type === 'timeline') {
      return token.entries.map((entry) => [entry.when, entry.title, entry.detail].filter(Boolean).join(' — ')).join('\n');
    }
    return token.block
      ? `\`\`\`${token.language ?? ''}\n${token.value}\n\`\`\``
      : `\`${token.value}\``;
  }).join('');
}

export function knowledgeBundleNotationAccessibilityText(blocks: KnowledgeBundleNotationBlock[]) {
  return blocks.flatMap((block) => {
    if (block.kind === 'text') {
      return knowledgeSourceAccessibilityText(block.source, block.legacyDollarMath);
    }
    return knowledgeBundleNotationSources([block]).map((source) => knowledgeSourceAccessibilityText(source));
  }).filter(Boolean).join('\n');
}
