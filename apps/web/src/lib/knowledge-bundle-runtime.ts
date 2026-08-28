import {
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  isKnowledgeBundleType,
  projectKnowledgeBundleContent,
  type KnowledgeBundleContent,
  type KnowledgeBundleType,
} from '@stem-brain/shared';

export type KnowledgeBundleFields = {
  knowledge_type: KnowledgeBundleType;
  central_question: string;
  structured_content: KnowledgeBundleContent;
  bundle_schema_version: typeof KNOWLEDGE_BUNDLE_SCHEMA_VERSION;
};

type JsonObject = Record<string, unknown>;

function objectWithKeys(value: unknown, keys: readonly string[]): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as JsonObject;
  return Object.keys(record).every((key) => keys.includes(key)) ? record : null;
}

function text(value: unknown, maxLength: number, required = false, fallback = ''): string | null {
  if (value === undefined) return required ? null : fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength && (!required || normalized.length > 0) ? normalized : null;
}

function textList(value: unknown, maxItems: number, maxLength: number, optional = true): string[] | null {
  if (value === undefined) return optional ? [] : null;
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const normalized = value.map((item) => text(item, maxLength, true));
  return normalized.some((item) => item === null) ? null : normalized as string[];
}

function records<T>(value: unknown, maxItems: number, parse: (item: unknown) => T | null): T[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const parsed = value.map(parse);
  return parsed.some((item) => item === null) ? null : parsed as T[];
}

function pair(
  value: unknown,
  left: string,
  right: string,
  rightMax = 4000,
  rightRequired = true,
): Record<string, string> | null {
  const item = objectWithKeys(value, [left, right]);
  if (!item) return null;
  const leftValue = text(item[left], 500, true);
  const rightValue = text(item[right], rightMax, rightRequired);
  return leftValue === null || rightValue === null ? null : { [left]: leftValue, [right]: rightValue };
}

function parseContent(value: unknown): KnowledgeBundleContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const type = (value as JsonObject).type;
  if (!isKnowledgeBundleType(type)) return null;

  switch (type) {
    case 'concept': {
      const item = objectWithKeys(value, ['type', 'definition', 'key_points', 'examples', 'non_examples', 'misconceptions']);
      if (!item) return null;
      const definition = text(item.definition, 4000);
      const keyPoints = textList(item.key_points, 24, 6000);
      const examples = textList(item.examples, 24, 500);
      const nonExamples = textList(item.non_examples, 24, 500);
      const misconceptions = records(item.misconceptions, 12, (entry) => pair(entry, 'claim', 'correction'));
      if (definition === null || !keyPoints || !examples || !nonExamples || !misconceptions) return null;
      return { type, definition, key_points: keyPoints, examples, non_examples: nonExamples, misconceptions: misconceptions as Array<{ claim: string; correction: string }> };
    }
    case 'procedure': {
      const item = objectWithKeys(value, ['type', 'goal', 'prerequisites', 'steps', 'branches', 'failure_modes', 'done_when']);
      if (!item) return null;
      const goal = text(item.goal, 4000);
      const prerequisites = textList(item.prerequisites, 24, 500);
      const steps = records(item.steps, 30, (entry) => pair(entry, 'title', 'detail', 4000, false));
      const branches = records(item.branches, 16, (entry) => pair(entry, 'condition', 'action'));
      const failureModes = records(item.failure_modes, 16, (entry) => pair(entry, 'symptom', 'response'));
      const doneWhen = textList(item.done_when, 24, 500);
      if (goal === null || !prerequisites || !steps || !branches || !failureModes || !doneWhen) return null;
      return { type, goal, prerequisites, steps: steps as Array<{ title: string; detail: string }>, branches: branches as Array<{ condition: string; action: string }>, failure_modes: failureModes as Array<{ symptom: string; response: string }>, done_when: doneWhen };
    }
    case 'comparison': {
      const item = objectWithKeys(value, ['type', 'targets', 'criteria', 'commonalities', 'differences', 'choice_guide']);
      if (!item) return null;
      const targets = textList(item.targets, 8, 500);
      const criteria = records(item.criteria, 20, (entry) => {
        const criterion = objectWithKeys(entry, ['name', 'values']);
        if (!criterion) return null;
        const name = text(criterion.name, 500, true);
        const values = textList(criterion.values, 8, 4000, false);
        return name === null || values === null ? null : { name, values };
      });
      const commonalities = textList(item.commonalities, 24, 500);
      const differences = textList(item.differences, 24, 500);
      const choiceGuide = records(item.choice_guide, 16, (entry) => pair(entry, 'condition', 'recommendation'));
      if (!targets || !criteria || !commonalities || !differences || !choiceGuide) return null;
      return { type, targets, criteria, commonalities, differences, choice_guide: choiceGuide as Array<{ condition: string; recommendation: string }> };
    }
    case 'mechanism': {
      const item = objectWithKeys(value, ['type', 'causes', 'stages', 'results', 'conditions', 'exceptions']);
      if (!item) return null;
      const causes = textList(item.causes, 24, 500);
      const stages = records(item.stages, 30, (entry) => pair(entry, 'title', 'detail', 4000, false));
      const results = textList(item.results, 24, 500);
      const conditions = textList(item.conditions, 24, 500);
      const exceptions = textList(item.exceptions, 24, 500);
      if (!causes || !stages || !results || !conditions || !exceptions) return null;
      return { type, causes, stages: stages as Array<{ title: string; detail: string }>, results, conditions, exceptions };
    }
    case 'structure': {
      const item = objectWithKeys(value, ['type', 'purpose', 'components', 'relations', 'boundaries']);
      if (!item) return null;
      const purpose = text(item.purpose, 4000);
      const components = records(item.components, 40, (entry) => {
        const component = objectWithKeys(entry, ['id', 'label', 'role', 'parent_id']);
        if (!component) return null;
        const id = text(component.id, 80, true);
        const label = text(component.label, 500, true);
        const role = text(component.role, 4000);
        const parentId = component.parent_id === undefined ? undefined : text(component.parent_id, 80, true);
        if (id === null || label === null || role === null || parentId === null || !/^[A-Za-z0-9._:-]+$/.test(id) || (parentId && !/^[A-Za-z0-9._:-]+$/.test(parentId))) return null;
        return { id, label, role, ...(parentId ? { parent_id: parentId } : {}) };
      });
      const relations = records(item.relations, 60, (entry) => {
        const relation = objectWithKeys(entry, ['source_id', 'target_id', 'label']);
        if (!relation) return null;
        const sourceId = text(relation.source_id, 80, true);
        const targetId = text(relation.target_id, 80, true);
        const label = text(relation.label, 500, true);
        return sourceId === null || targetId === null || label === null ? null : { source_id: sourceId, target_id: targetId, label };
      });
      const boundaries = textList(item.boundaries, 24, 500);
      if (purpose === null || !components || !relations || !boundaries) return null;
      const ids = new Set(components.map((component) => component.id));
      if (ids.size !== components.length || components.some((component) => component.parent_id && !ids.has(component.parent_id))) return null;
      for (const component of components) {
        const ancestors = new Set([component.id]);
        let parentId = component.parent_id;
        while (parentId) {
          if (ancestors.has(parentId)) return null;
          ancestors.add(parentId);
          parentId = components.find((candidate) => candidate.id === parentId)?.parent_id;
        }
      }
      if (relations.some((relation) => relation.source_id === relation.target_id || !ids.has(relation.source_id) || !ids.has(relation.target_id))) return null;
      return { type, purpose, components, relations, boundaries };
    }
    case 'claim_evidence': {
      const item = objectWithKeys(value, ['type', 'claim', 'evidence', 'counterevidence', 'scope', 'limitations', 'confidence']);
      if (!item) return null;
      const claim = text(item.claim, 4000);
      const evidence = records(item.evidence, 24, (entry) => {
        const evidenceItem = objectWithKeys(entry, ['statement', 'source']);
        if (!evidenceItem) return null;
        const statement = text(evidenceItem.statement, 4000, true);
        const source = evidenceItem.source === undefined ? undefined : text(evidenceItem.source, 1000, true);
        return statement === null || source === null ? null : { statement, ...(source ? { source } : {}) };
      });
      const counterevidence = textList(item.counterevidence, 24, 500);
      const scope = textList(item.scope, 24, 500);
      const limitations = textList(item.limitations, 24, 500);
      const confidence = item.confidence;
      if (claim === null || !evidence || !counterevidence || !scope || !limitations || (confidence !== undefined && confidence !== 'low' && confidence !== 'medium' && confidence !== 'high')) return null;
      return { type, claim, evidence, counterevidence, scope, limitations, ...(confidence ? { confidence } : {}) };
    }
  }
}

export function parseKnowledgeBundleFields(value: unknown): KnowledgeBundleFields | null {
  const item = objectWithKeys(value, ['knowledge_type', 'central_question', 'structured_content', 'bundle_schema_version']);
  if (!item || !isKnowledgeBundleType(item.knowledge_type)) return null;
  const centralQuestion = text(item.central_question, 500, true);
  const structuredContent = parseContent(item.structured_content);
  const version = item.bundle_schema_version ?? KNOWLEDGE_BUNDLE_SCHEMA_VERSION;
  if (centralQuestion === null || !structuredContent || structuredContent.type !== item.knowledge_type || version !== KNOWLEDGE_BUNDLE_SCHEMA_VERSION) return null;
  return { knowledge_type: item.knowledge_type, central_question: centralQuestion, structured_content: structuredContent, bundle_schema_version: KNOWLEDGE_BUNDLE_SCHEMA_VERSION };
}

export function projectKnowledgeBundle(
  fields: Pick<KnowledgeBundleFields, 'structured_content'>,
  preferredSummary = '',
) {
  return projectKnowledgeBundleContent(fields.structured_content, preferredSummary);
}

export function conceptBundleFromLegacyCard(title: string, summary = '', explanation = ''): KnowledgeBundleFields {
  return {
    knowledge_type: 'concept',
    central_question: title.trim(),
    structured_content: {
      type: 'concept',
      definition: summary.trim(),
      key_points: explanation.trim() ? [explanation.trim()] : [],
      examples: [],
      non_examples: [],
      misconceptions: [],
    },
    bundle_schema_version: KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  };
}
