import {
  EVENT_TIME_PRECISIONS,
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
  KNOWLEDGE_BUNDLE_TYPES,
  historicalTimePointKey,
  isKnowledgeLanguageTag,
} from '@stem-brain/shared';
import { z } from 'zod';

const shortText = z.string().trim().max(500);
const detailText = z.string().trim().max(4000);
const shortTextList = z.array(shortText.min(1)).max(24).default([]);
const detailTextList = z.array(z.string().trim().min(1).max(6000)).max(24).default([]);
const languageTag = z.string().trim().min(2).max(255).refine(isKnowledgeLanguageTag, 'Invalid BCP 47 language tag.');

function daysInHistoricalMonth(year: number, era: 'bce' | 'ce', month: number) {
  if (month === 2) {
    const astronomicalYear = era === 'bce' ? 1 - year : year;
    const leap = astronomicalYear % 4 === 0 && (astronomicalYear % 100 !== 0 || astronomicalYear % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const historicalTimePointSchema = z.object({
  year: z.number().int().min(1).max(999_999),
  era: z.enum(['bce', 'ce']),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.day !== undefined && value.month === undefined) {
    ctx.addIssue({ code: 'custom', path: ['day'], message: 'A historical day requires a month.' });
  } else if (value.day !== undefined && value.month !== undefined
    && value.day > daysInHistoricalMonth(value.year, value.era, value.month)) {
    ctx.addIssue({ code: 'custom', path: ['day'], message: 'The day is outside the selected historical month.' });
  }
});

const eventChronologySchema = z.object({
  start: historicalTimePointSchema,
  end: historicalTimePointSchema.optional(),
  precision: z.enum(EVENT_TIME_PRECISIONS),
}).strict().superRefine((value, ctx) => {
  if (value.precision === 'range' && !value.end) {
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'A range requires an end point.' });
  }
  if (value.precision !== 'range' && value.end) {
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'Only range precision accepts an end point.' });
  }
  if (value.end && historicalTimePointKey(value.end) < historicalTimePointKey(value.start)) {
    ctx.addIssue({ code: 'custom', path: ['end'], message: 'The chronology end must not be before its start.' });
  }
});

const conceptContentSchema = z.object({
  type: z.literal('concept'),
  definition: detailText.default(''),
  key_points: detailTextList,
  examples: shortTextList,
  non_examples: shortTextList,
  misconceptions: z.array(z.object({
    claim: shortText.min(1),
    correction: detailText.min(1),
  }).strict()).max(12).default([]),
}).strict();

const procedureContentSchema = z.object({
  type: z.literal('procedure'),
  goal: detailText.default(''),
  prerequisites: shortTextList,
  steps: z.array(z.object({
    title: shortText.min(1),
    detail: detailText.default(''),
  }).strict()).max(30).default([]),
  branches: z.array(z.object({
    condition: shortText.min(1),
    action: detailText.min(1),
  }).strict()).max(16).default([]),
  failure_modes: z.array(z.object({
    symptom: shortText.min(1),
    response: detailText.min(1),
  }).strict()).max(16).default([]),
  done_when: shortTextList,
}).strict();

const comparisonContentSchema = z.object({
  type: z.literal('comparison'),
  targets: z.array(shortText.min(1)).max(8).default([]),
  criteria: z.array(z.object({
    name: shortText.min(1),
    values: z.array(detailText.min(1)).max(8),
  }).strict()).max(20).default([]),
  commonalities: shortTextList,
  differences: shortTextList,
  choice_guide: z.array(z.object({
    condition: shortText.min(1),
    recommendation: detailText.min(1),
  }).strict()).max(16).default([]),
}).strict();

const mechanismContentSchema = z.object({
  type: z.literal('mechanism'),
  causes: shortTextList,
  stages: z.array(z.object({
    title: shortText.min(1),
    detail: detailText.default(''),
  }).strict()).max(30).default([]),
  results: shortTextList,
  conditions: shortTextList,
  exceptions: shortTextList,
}).strict();

const structureContentSchema = z.object({
  type: z.literal('structure'),
  purpose: detailText.default(''),
  components: z.array(z.object({
    id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/),
    label: shortText.min(1),
    role: detailText.default(''),
    parent_id: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9._:-]+$/).optional(),
  }).strict()).max(40).default([]),
  relations: z.array(z.object({
    source_id: z.string().trim().min(1).max(80),
    target_id: z.string().trim().min(1).max(80),
    label: shortText.min(1),
  }).strict()).max(60).default([]),
  boundaries: shortTextList,
}).strict().superRefine((value, ctx) => {
  const ids = new Set<string>();
  value.components.forEach((component, index) => {
    if (ids.has(component.id)) {
      ctx.addIssue({ code: 'custom', path: ['components', index, 'id'], message: 'Component ids must be unique within a bundle.' });
    }
    ids.add(component.id);
  });
  value.components.forEach((component, index) => {
    if (component.parent_id && !ids.has(component.parent_id)) {
      ctx.addIssue({ code: 'custom', path: ['components', index, 'parent_id'], message: 'parent_id must reference a component in this bundle.' });
    }
    const ancestors = new Set([component.id]);
    let parentId = component.parent_id;
    while (parentId) {
      if (ancestors.has(parentId)) {
        ctx.addIssue({ code: 'custom', path: ['components', index, 'parent_id'], message: 'Component hierarchy must not contain a cycle.' });
        break;
      }
      ancestors.add(parentId);
      parentId = value.components.find((candidate) => candidate.id === parentId)?.parent_id;
    }
  });
  value.relations.forEach((relation, index) => {
    if (!ids.has(relation.source_id) || !ids.has(relation.target_id) || relation.source_id === relation.target_id) {
      ctx.addIssue({ code: 'custom', path: ['relations', index], message: 'Internal relations must reference two different components in this bundle.' });
    }
  });
});

const claimEvidenceContentSchema = z.object({
  type: z.literal('claim_evidence'),
  claim: detailText.default(''),
  evidence: z.array(z.object({
    statement: detailText.min(1),
    source: z.string().trim().min(1).max(1000).optional(),
  }).strict()).max(24).default([]),
  counterevidence: shortTextList,
  scope: shortTextList,
  limitations: shortTextList,
  confidence: z.enum(['low', 'medium', 'high']).optional(),
}).strict();

const questionContentSchema = z.object({
  type: z.literal('question'),
  question: detailText.default(''),
  context: detailText.default(''),
  known_facts: detailTextList,
  hypotheses: detailTextList,
  next_steps: detailTextList,
  answer_summary: detailText.default(''),
  status: z.enum(['open', 'answered']).default('open'),
}).strict();

const decisionContentSchema = z.object({
  type: z.literal('decision'),
  decision: detailText.default(''),
  context: detailText.default(''),
  options: z.array(z.object({
    name: shortText.min(1),
    tradeoffs: detailText.default(''),
  }).strict()).max(24).default([]),
  criteria: detailTextList,
  rationale: detailTextList,
  reconsider_when: detailTextList,
  outcome: detailText.default(''),
}).strict();

const eventContentSchema = z.object({
  type: z.literal('event'),
  event: detailText.default(''),
  occurred_at: shortText.default(''),
  chronology: eventChronologySchema.optional(),
  context: detailText.default(''),
  changes: detailTextList,
  causes: detailTextList,
  consequences: detailTextList,
}).strict();

const expressionContentSchema = z.object({
  type: z.literal('expression'),
  expression: detailText.default(''),
  language: languageTag,
  pronunciation: shortText.default(''),
  meanings: detailTextList,
  translations: z.array(z.object({
    language: languageTag,
    text: detailText.min(1),
  }).strict()).max(24).default([]),
  register: shortText.default(''),
  nuance: detailText.default(''),
  usage_contexts: detailTextList,
  examples: z.array(z.object({
    text: detailText.min(1),
    translation: detailText.min(1).optional(),
    note: detailText.min(1).optional(),
  }).strict()).max(24).default([]),
  contrasts: z.array(z.object({
    expression: shortText.min(1),
    difference: detailText.min(1),
  }).strict()).max(24).default([]),
  common_mistakes: z.array(z.object({
    incorrect: shortText.min(1),
    correction: detailText.min(1),
  }).strict()).max(24).default([]),
}).strict();

export const knowledgeBundleContentSchema = z.discriminatedUnion('type', [
  conceptContentSchema,
  procedureContentSchema,
  comparisonContentSchema,
  mechanismContentSchema,
  structureContentSchema,
  claimEvidenceContentSchema,
  questionContentSchema,
  decisionContentSchema,
  eventContentSchema,
  expressionContentSchema,
]);

export const knowledgeBundleFieldsSchema = z.object({
  knowledge_type: z.enum(KNOWLEDGE_BUNDLE_TYPES),
  central_question: z.string().trim().min(1).max(500),
  structured_content: knowledgeBundleContentSchema,
  bundle_schema_version: z.literal(KNOWLEDGE_BUNDLE_SCHEMA_VERSION).default(KNOWLEDGE_BUNDLE_SCHEMA_VERSION),
}).strict().superRefine((value, ctx) => {
  if (value.knowledge_type !== value.structured_content.type) {
    ctx.addIssue({ code: 'custom', path: ['structured_content', 'type'], message: 'structured_content.type must match knowledge_type.' });
  }
});
