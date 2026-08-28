export const KNOWLEDGE_BUNDLE_TYPES = [
  'concept',
  'procedure',
  'comparison',
  'mechanism',
  'structure',
  'claim_evidence',
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

export type KnowledgeBundleContent =
  | ConceptBundleContent
  | ProcedureBundleContent
  | ComparisonBundleContent
  | MechanismBundleContent
  | StructureBundleContent
  | ClaimEvidenceBundleContent;

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
  }

  return {
    summary: preferredSummary.trim() || fallbackSummary.trim(),
    content: sections.filter((section) => section.length > 0).map((section) => section.join('\n')).join('\n\n'),
  };
}
