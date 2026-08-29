export const KNOWLEDGE_BUNDLE_TYPES = [
  'concept',
  'procedure',
  'comparison',
  'mechanism',
  'structure',
  'claim_evidence',
  'question',
  'decision',
  'event',
  'expression',
] as const;

export type KnowledgeBundleType = (typeof KNOWLEDGE_BUNDLE_TYPES)[number];
export const KNOWLEDGE_BUNDLE_SCHEMA_VERSION = 1 as const;

export type KnowledgeBundleMisconception = {
  claim: string;
  correction: string;
};

export type ConceptBundleContent = {
  type: 'concept';
  definition: string;
  key_points: string[];
  examples: string[];
  non_examples: string[];
  misconceptions: KnowledgeBundleMisconception[];
};

export type ProcedureBundleContent = {
  type: 'procedure';
  goal: string;
  prerequisites: string[];
  steps: Array<{ title: string; detail: string }>;
  branches: Array<{ condition: string; action: string }>;
  failure_modes: Array<{ symptom: string; response: string }>;
  done_when: string[];
};

export type ComparisonBundleContent = {
  type: 'comparison';
  targets: string[];
  criteria: Array<{ name: string; values: string[] }>;
  commonalities: string[];
  differences: string[];
  choice_guide: Array<{ condition: string; recommendation: string }>;
};

export type MechanismBundleContent = {
  type: 'mechanism';
  causes: string[];
  stages: Array<{ title: string; detail: string }>;
  results: string[];
  conditions: string[];
  exceptions: string[];
};

export type StructureBundleContent = {
  type: 'structure';
  purpose: string;
  components: Array<{ id: string; label: string; role: string; parent_id?: string }>;
  relations: Array<{ source_id: string; target_id: string; label: string }>;
  boundaries: string[];
};

export type ClaimEvidenceBundleContent = {
  type: 'claim_evidence';
  claim: string;
  evidence: Array<{ statement: string; source?: string }>;
  counterevidence: string[];
  scope: string[];
  limitations: string[];
  confidence?: 'low' | 'medium' | 'high';
};

export type QuestionBundleContent = {
  type: 'question';
  question: string;
  context: string;
  known_facts: string[];
  hypotheses: string[];
  next_steps: string[];
  answer_summary: string;
  status: 'open' | 'answered';
};

export type DecisionBundleContent = {
  type: 'decision';
  decision: string;
  context: string;
  options: Array<{ name: string; tradeoffs: string }>;
  criteria: string[];
  rationale: string[];
  reconsider_when: string[];
  outcome: string;
};

export type EventBundleContent = {
  type: 'event';
  event: string;
  occurred_at: string;
  chronology?: EventChronology;
  context: string;
  changes: string[];
  causes: string[];
  consequences: string[];
};

export const EVENT_TIME_PRECISIONS = [
  'exact',
  'day',
  'month',
  'year',
  'decade',
  'century',
  'approximate',
  'range',
] as const;

export type EventTimePrecision = (typeof EVENT_TIME_PRECISIONS)[number];

export type HistoricalTimePoint = {
  year: number;
  era: 'bce' | 'ce';
  month?: number;
  day?: number;
};

export type EventChronology = {
  start: HistoricalTimePoint;
  end?: HistoricalTimePoint;
  precision: EventTimePrecision;
};

export type ExpressionBundleExample = { text: string; translation?: string; note?: string };

export type ExpressionBundleContent = {
  type: 'expression';
  expression: string;
  language: string;
  pronunciation: string;
  meanings: string[];
  translations: Array<{ language: string; text: string }>;
  register: string;
  nuance: string;
  usage_contexts: string[];
  examples: ExpressionBundleExample[];
  contrasts: Array<{ expression: string; difference: string }>;
  common_mistakes: Array<{ incorrect: string; correction: string }>;
};

export function parseExpressionBundleExamples(value: string): ExpressionBundleExample[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    try {
      const parsed: unknown = JSON.parse(line);
      if (Array.isArray(parsed) && parsed.length >= 1 && parsed.length <= 3 && parsed.every((item) => typeof item === 'string') && parsed[0].trim()) {
        const [text, translation = '', note = ''] = parsed;
        return { text, ...(translation ? { translation } : {}), ...(note ? { note } : {}) };
      }
    } catch {
      // Plain lines remain literal example text, including any "::" delimiters.
    }
    return { text: line };
  });
}

export function serializeExpressionBundleExamples(examples: ExpressionBundleExample[]): string {
  return examples.map((item) => JSON.stringify([item.text, item.translation ?? '', item.note ?? ''])).join('\n');
}

export type KnowledgeBundleContent =
  | ConceptBundleContent
  | ProcedureBundleContent
  | ComparisonBundleContent
  | MechanismBundleContent
  | StructureBundleContent
  | ClaimEvidenceBundleContent
  | QuestionBundleContent
  | DecisionBundleContent
  | EventBundleContent
  | ExpressionBundleContent;

export type KnowledgeBundleV1 = {
  title: string;
  summary: string;
  topic: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType;
  central_question: string;
  structured_content: KnowledgeBundleContent;
  bundle_schema_version: typeof KNOWLEDGE_BUNDLE_SCHEMA_VERSION;
};

export function isKnowledgeBundleType(value: unknown): value is KnowledgeBundleType {
  return typeof value === 'string' && KNOWLEDGE_BUNDLE_TYPES.includes(value as KnowledgeBundleType);
}

export function createEmptyKnowledgeBundleContent(type: KnowledgeBundleType): KnowledgeBundleContent {
  switch (type) {
    case 'concept':
      return { type, definition: '', key_points: [], examples: [], non_examples: [], misconceptions: [] };
    case 'procedure':
      return { type, goal: '', prerequisites: [], steps: [], branches: [], failure_modes: [], done_when: [] };
    case 'comparison':
      return { type, targets: [], criteria: [], commonalities: [], differences: [], choice_guide: [] };
    case 'mechanism':
      return { type, causes: [], stages: [], results: [], conditions: [], exceptions: [] };
    case 'structure':
      return { type, purpose: '', components: [], relations: [], boundaries: [] };
    case 'claim_evidence':
      return { type, claim: '', evidence: [], counterevidence: [], scope: [], limitations: [] };
    case 'question':
      return { type, question: '', context: '', known_facts: [], hypotheses: [], next_steps: [], answer_summary: '', status: 'open' };
    case 'decision':
      return { type, decision: '', context: '', options: [], criteria: [], rationale: [], reconsider_when: [], outcome: '' };
    case 'event':
      return { type, event: '', occurred_at: '', context: '', changes: [], causes: [], consequences: [] };
    case 'expression':
      return {
        type,
        expression: '',
        language: '',
        pronunciation: '',
        meanings: [],
        translations: [],
        register: '',
        nuance: '',
        usage_contexts: [],
        examples: [],
        contrasts: [],
        common_mistakes: [],
      };
  }
}

/**
 * Starts an explicit legacy-note conversion without dropping the user's original body.
 * The body is placed in the first editable field for the selected bundle type so the
 * user can review and reshape it before saving the conversion.
 */
export function createKnowledgeBundleContentFromLegacy(
  type: KnowledgeBundleType,
  legacyContent: string,
): KnowledgeBundleContent {
  const content = legacyContent.trim();
  const empty = createEmptyKnowledgeBundleContent(type);
  if (!content) return empty;

  switch (empty.type) {
    case 'concept': return { ...empty, definition: content };
    case 'procedure': return { ...empty, goal: content };
    case 'comparison': return { ...empty, targets: [content] };
    case 'mechanism': return { ...empty, causes: [content] };
    case 'structure': return { ...empty, purpose: content };
    case 'claim_evidence': return { ...empty, claim: content };
    case 'question': return { ...empty, question: content };
    case 'decision': return { ...empty, decision: content };
    case 'event': return { ...empty, event: content };
    case 'expression': return { ...empty, expression: content };
  }
}

function lines(title: string, values: string[]): string[] {
  return values.length > 0 ? [title, ...values.map((value) => `- ${value}`)] : [];
}

export function projectKnowledgeBundleContent(
  content: KnowledgeBundleContent,
  preferredSummary = '',
): { summary: string; content: string } {
  const sections: string[][] = [];
  let fallbackSummary = '';

  switch (content.type) {
    case 'concept':
      fallbackSummary = content.definition || content.key_points[0] || '';
      sections.push(
        content.definition ? ['Definition', content.definition] : [],
        lines('Key points', content.key_points),
        lines('Examples', content.examples),
        lines('Non-examples', content.non_examples),
        content.misconceptions.length > 0
          ? ['Misconceptions', ...content.misconceptions.map((item) => `- ${item.claim} -> ${item.correction}`)]
          : [],
      );
      break;
    case 'procedure':
      fallbackSummary = content.goal || content.steps[0]?.title || '';
      sections.push(
        content.goal ? ['Goal', content.goal] : [],
        lines('Prerequisites', content.prerequisites),
        content.steps.length > 0
          ? ['Steps', ...content.steps.map((step, index) => `${index + 1}. ${step.title}${step.detail ? ` - ${step.detail}` : ''}`)]
          : [],
        content.branches.length > 0
          ? ['Branches', ...content.branches.map((item) => `- If ${item.condition}: ${item.action}`)]
          : [],
        content.failure_modes.length > 0
          ? ['Failure modes', ...content.failure_modes.map((item) => `- ${item.symptom}: ${item.response}`)]
          : [],
        lines('Done when', content.done_when),
      );
      break;
    case 'comparison':
      fallbackSummary = content.differences[0] || content.commonalities[0] || content.targets.join(' vs ');
      sections.push(
        lines('Targets', content.targets),
        content.criteria.length > 0
          ? ['Criteria', ...content.criteria.map((item) => `- ${item.name}: ${item.values.join(' | ')}`)]
          : [],
        lines('Commonalities', content.commonalities),
        lines('Differences', content.differences),
        content.choice_guide.length > 0
          ? ['Choice guide', ...content.choice_guide.map((item) => `- ${item.condition}: ${item.recommendation}`)]
          : [],
      );
      break;
    case 'mechanism':
      fallbackSummary = content.results[0] || content.stages[0]?.detail || content.causes[0] || '';
      sections.push(
        lines('Causes', content.causes),
        content.stages.length > 0
          ? ['Process', ...content.stages.map((stage, index) => `${index + 1}. ${stage.title}${stage.detail ? ` - ${stage.detail}` : ''}`)]
          : [],
        lines('Results', content.results),
        lines('Conditions', content.conditions),
        lines('Exceptions', content.exceptions),
      );
      break;
    case 'structure':
      fallbackSummary = content.purpose || content.components[0]?.role || '';
      sections.push(
        content.purpose ? ['Purpose', content.purpose] : [],
        content.components.length > 0
          ? ['Components', ...content.components.map((item) => `- ${item.label}: ${item.role}`)]
          : [],
        content.relations.length > 0
          ? ['Internal relations', ...content.relations.map((item) => `- ${item.source_id} -> ${item.target_id}: ${item.label}`)]
          : [],
        lines('Boundaries', content.boundaries),
      );
      break;
    case 'claim_evidence':
      fallbackSummary = content.claim || content.evidence[0]?.statement || '';
      sections.push(
        content.claim ? ['Claim', content.claim] : [],
        content.evidence.length > 0
          ? ['Evidence', ...content.evidence.map((item) => `- ${item.statement}${item.source ? ` (${item.source})` : ''}`)]
          : [],
        lines('Counterevidence', content.counterevidence),
        lines('Scope', content.scope),
        lines('Limitations', content.limitations),
        content.confidence ? ['Confidence', content.confidence] : [],
      );
      break;
    case 'question':
      fallbackSummary = content.answer_summary || content.question || content.next_steps[0] || '';
      sections.push(
        content.question ? ['Question', content.question] : [],
        content.context ? ['Context', content.context] : [],
        lines('Known facts', content.known_facts),
        lines('Hypotheses', content.hypotheses),
        lines('Next steps', content.next_steps),
        content.answer_summary ? ['Answer summary', content.answer_summary] : [],
        ['Status', content.status],
      );
      break;
    case 'decision':
      fallbackSummary = content.decision || content.outcome || content.rationale[0] || '';
      sections.push(
        content.decision ? ['Decision', content.decision] : [],
        content.context ? ['Context', content.context] : [],
        content.options.length > 0
          ? ['Options', ...content.options.map((item) => `- ${item.name}: ${item.tradeoffs}`)]
          : [],
        lines('Criteria', content.criteria),
        lines('Rationale', content.rationale),
        lines('Reconsider when', content.reconsider_when),
        content.outcome ? ['Outcome', content.outcome] : [],
      );
      break;
    case 'event':
      fallbackSummary = content.event || content.changes[0] || content.consequences[0] || '';
      sections.push(
        content.event ? ['Event', content.event] : [],
        content.occurred_at ? ['Occurred at', content.occurred_at] : [],
        content.context ? ['Context', content.context] : [],
        lines('Changes', content.changes),
        lines('Causes', content.causes),
        lines('Consequences', content.consequences),
      );
      break;
    case 'expression':
      fallbackSummary = content.meanings[0] || content.translations[0]?.text || content.expression || '';
      sections.push(
        content.expression ? ['Expression', content.expression] : [],
        content.language ? ['Language', content.language] : [],
        content.pronunciation ? ['Pronunciation', content.pronunciation] : [],
        lines('Meanings', content.meanings),
        content.translations.length > 0
          ? ['Translations', ...content.translations.map((item) => `- ${item.language}: ${item.text}`)]
          : [],
        content.register ? ['Register', content.register] : [],
        content.nuance ? ['Nuance', content.nuance] : [],
        lines('Usage contexts', content.usage_contexts),
        content.examples.length > 0
          ? ['Examples', ...content.examples.map((item) => `- ${item.text}${item.translation ? ` -> ${item.translation}` : ''}${item.note ? ` (${item.note})` : ''}`)]
          : [],
        content.contrasts.length > 0
          ? ['Contrasts', ...content.contrasts.map((item) => `- ${item.expression}: ${item.difference}`)]
          : [],
        content.common_mistakes.length > 0
          ? ['Common mistakes', ...content.common_mistakes.map((item) => `- ${item.incorrect} -> ${item.correction}`)]
          : [],
      );
      break;
  }

  return {
    summary: preferredSummary.trim() || fallbackSummary.trim(),
    content: sections.filter((section) => section.length > 0).map((section) => section.join('\n')).join('\n\n'),
  };
}

const GRANDFATHERED_LANGUAGE_TAGS = new Set([
  'art-lojban', 'cel-gaulish', 'en-gb-oed', 'i-ami', 'i-bnn', 'i-default', 'i-enochian',
  'i-hak', 'i-klingon', 'i-lux', 'i-mingo', 'i-navajo', 'i-pwn', 'i-tao', 'i-tay',
  'i-tsu', 'no-bok', 'no-nyn', 'sgn-be-fr', 'sgn-be-nl', 'sgn-ch-de', 'zh-guoyu',
  'zh-hakka', 'zh-min', 'zh-min-nan', 'zh-xiang',
]);

export function isKnowledgeLanguageTag(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 2 || value.length > 255) return false;
  const normalized = value.toLowerCase();
  if (GRANDFATHERED_LANGUAGE_TAGS.has(normalized)) return true;

  const subtags = normalized.split('-');
  if (subtags.some((subtag) => !/^[a-z0-9]{1,8}$/.test(subtag))) return false;
  if (subtags[0] === 'x') return subtags.length > 1;

  const language = subtags[0] ?? '';
  if (!/^[a-z]{2,8}$/.test(language)) return false;
  let index = 1;
  if (language.length <= 3) {
    let extlangCount = 0;
    while (extlangCount < 3 && /^[a-z]{3}$/.test(subtags[index] ?? '')) {
      extlangCount += 1;
      index += 1;
    }
  }
  if (/^[a-z]{4}$/.test(subtags[index] ?? '')) index += 1;
  if (/^(?:[a-z]{2}|[0-9]{3})$/.test(subtags[index] ?? '')) index += 1;

  const variants = new Set<string>();
  while (/^(?:[a-z0-9]{5,8}|[0-9][a-z0-9]{3})$/.test(subtags[index] ?? '')) {
    const variant = subtags[index]!;
    if (variants.has(variant)) return false;
    variants.add(variant);
    index += 1;
  }

  const extensionSingletons = new Set<string>();
  while (/^[0-9a-wy-z]$/.test(subtags[index] ?? '')) {
    const singleton = subtags[index]!;
    if (extensionSingletons.has(singleton)) return false;
    extensionSingletons.add(singleton);
    index += 1;
    const extensionStart = index;
    while (/^[a-z0-9]{2,8}$/.test(subtags[index] ?? '')) index += 1;
    if (index === extensionStart) return false;
  }

  if (subtags[index] === 'x') {
    index += 1;
    const privateUseStart = index;
    while (/^[a-z0-9]{1,8}$/.test(subtags[index] ?? '')) index += 1;
    if (index === privateUseStart) return false;
  }
  return index === subtags.length;
}

/** Converts BCE/CE points to one monotonically increasing integer without relying on Date parsing. */
export function historicalTimePointKey(point: HistoricalTimePoint): number {
  const astronomicalYear = point.era === 'bce' ? 1 - point.year : point.year;
  return astronomicalYear * 372 + ((point.month ?? 1) - 1) * 31 + ((point.day ?? 1) - 1);
}
