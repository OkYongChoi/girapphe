import {
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  EVENT_TIME_PRECISIONS,
  historicalTimePointKey,
  isKnowledgeLanguageTag,
  isKnowledgeBundleType,
  projectKnowledgeBundleContent,
  type EventChronology,
  type HistoricalTimePoint,
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

function integer(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function daysInHistoricalMonth(year: number, era: 'bce' | 'ce', month: number) {
  if (month === 2) {
    const astronomicalYear = era === 'bce' ? 1 - year : year;
    const leap = astronomicalYear % 4 === 0 && (astronomicalYear % 100 !== 0 || astronomicalYear % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseHistoricalTimePoint(value: unknown): HistoricalTimePoint | null {
  const item = objectWithKeys(value, ['year', 'era', 'month', 'day']);
  if (!item || (item.era !== 'bce' && item.era !== 'ce')) return null;
  const year = integer(item.year, 1, 999_999);
  const month = item.month === undefined ? undefined : integer(item.month, 1, 12);
  const day = item.day === undefined ? undefined : integer(item.day, 1, 31);
  if (year === null || month === null || day === null || (day !== undefined && month === undefined)) return null;
  if (day !== undefined && month !== undefined && day > daysInHistoricalMonth(year, item.era, month)) return null;
  return { year, era: item.era, ...(month !== undefined ? { month } : {}), ...(day !== undefined ? { day } : {}) };
}

function parseEventChronology(value: unknown): EventChronology | null {
  const item = objectWithKeys(value, ['start', 'end', 'precision']);
  if (!item || !EVENT_TIME_PRECISIONS.includes(item.precision as EventChronology['precision'])) return null;
  const start = parseHistoricalTimePoint(item.start);
  const end = item.end === undefined ? undefined : parseHistoricalTimePoint(item.end);
  if (!start || end === null || (item.precision === 'range') !== Boolean(end)) return null;
  if (end && historicalTimePointKey(end) < historicalTimePointKey(start)) return null;
  return { start, ...(end ? { end } : {}), precision: item.precision as EventChronology['precision'] };
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
    case 'question': {
      const item = objectWithKeys(value, ['type', 'question', 'context', 'known_facts', 'hypotheses', 'next_steps', 'answer_summary', 'status']);
      if (!item) return null;
      const question = text(item.question, 4000);
      const context = text(item.context, 4000);
      const knownFacts = textList(item.known_facts, 24, 6000);
      const hypotheses = textList(item.hypotheses, 24, 6000);
      const nextSteps = textList(item.next_steps, 24, 6000);
      const answerSummary = text(item.answer_summary, 4000);
      const status = item.status ?? 'open';
      if (question === null || context === null || !knownFacts || !hypotheses || !nextSteps || answerSummary === null || (status !== 'open' && status !== 'answered')) return null;
      return { type, question, context, known_facts: knownFacts, hypotheses, next_steps: nextSteps, answer_summary: answerSummary, status };
    }
    case 'decision': {
      const item = objectWithKeys(value, ['type', 'decision', 'context', 'options', 'criteria', 'rationale', 'reconsider_when', 'outcome']);
      if (!item) return null;
      const decision = text(item.decision, 4000);
      const context = text(item.context, 4000);
      const options = records(item.options, 24, (entry) => pair(entry, 'name', 'tradeoffs', 4000, false));
      const criteria = textList(item.criteria, 24, 6000);
      const rationale = textList(item.rationale, 24, 6000);
      const reconsiderWhen = textList(item.reconsider_when, 24, 6000);
      const outcome = text(item.outcome, 4000);
      if (decision === null || context === null || !options || !criteria || !rationale || !reconsiderWhen || outcome === null) return null;
      return { type, decision, context, options: options as Array<{ name: string; tradeoffs: string }>, criteria, rationale, reconsider_when: reconsiderWhen, outcome };
    }
    case 'event': {
      const item = objectWithKeys(value, ['type', 'event', 'occurred_at', 'chronology', 'context', 'changes', 'causes', 'consequences']);
      if (!item) return null;
      const event = text(item.event, 4000);
      const occurredAt = text(item.occurred_at, 500);
      const chronology = item.chronology === undefined ? undefined : parseEventChronology(item.chronology);
      const context = text(item.context, 4000);
      const changes = textList(item.changes, 24, 6000);
      const causes = textList(item.causes, 24, 6000);
      const consequences = textList(item.consequences, 24, 6000);
      if (event === null || occurredAt === null || chronology === null || context === null || !changes || !causes || !consequences) return null;
      return { type, event, occurred_at: occurredAt, ...(chronology ? { chronology } : {}), context, changes, causes, consequences };
    }
    case 'expression': {
      const item = objectWithKeys(value, [
        'type', 'expression', 'language', 'pronunciation', 'meanings', 'translations', 'register', 'nuance',
        'usage_contexts', 'examples', 'contrasts', 'common_mistakes',
      ]);
      if (!item) return null;
      const expression = text(item.expression, 4000);
      const language = text(item.language, 35, true);
      const pronunciation = text(item.pronunciation, 500);
      const meanings = textList(item.meanings, 24, 6000);
      const translations = records(item.translations, 24, (entry) => {
        const translation = objectWithKeys(entry, ['language', 'text']);
        if (!translation) return null;
        const targetLanguage = text(translation.language, 35, true);
        const translatedText = text(translation.text, 4000, true);
        return targetLanguage && isKnowledgeLanguageTag(targetLanguage) && translatedText
          ? { language: targetLanguage, text: translatedText }
          : null;
      });
      const register = text(item.register, 500);
      const nuance = text(item.nuance, 4000);
      const usageContexts = textList(item.usage_contexts, 24, 6000);
      const examples = records(item.examples, 24, (entry) => {
        const example = objectWithKeys(entry, ['text', 'translation', 'note']);
        if (!example) return null;
        const exampleText = text(example.text, 4000, true);
        const translation = example.translation === undefined ? undefined : text(example.translation, 4000, true);
        const note = example.note === undefined ? undefined : text(example.note, 4000, true);
        return exampleText && translation !== null && note !== null
          ? { text: exampleText, ...(translation ? { translation } : {}), ...(note ? { note } : {}) }
          : null;
      });
      const contrasts = records(item.contrasts, 24, (entry) => pair(entry, 'expression', 'difference'));
      const commonMistakes = records(item.common_mistakes, 24, (entry) => pair(entry, 'incorrect', 'correction'));
      if (expression === null || language === null || !isKnowledgeLanguageTag(language)
        || pronunciation === null || !meanings || !translations || register === null || nuance === null
        || !usageContexts || !examples || !contrasts || !commonMistakes) return null;
      return {
        type,
        expression,
        language,
        pronunciation,
        meanings,
        translations,
        register,
        nuance,
        usage_contexts: usageContexts,
        examples,
        contrasts: contrasts as Array<{ expression: string; difference: string }>,
        common_mistakes: commonMistakes as Array<{ incorrect: string; correction: string }>,
      };
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
