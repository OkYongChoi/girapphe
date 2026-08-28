import {
  KNOWLEDGE_BUNDLE_SCHEMA_VERSION,
} from '@stem-brain/shared';
import { z } from 'zod';

const shortText = z.string().trim().max(500);
const detailText = z.string().trim().max(4000);
const shortTextList = z.array(shortText.min(1)).max(24).default([]);
const detailTextList = z.array(z.string().trim().min(1).max(6000)).max(24).default([]);

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

export const knowledgeBundleContentSchema = z.discriminatedUnion('type', [
  conceptContentSchema,
  procedureContentSchema,
  comparisonContentSchema,
  mechanismContentSchema,
  structureContentSchema,
  claimEvidenceContentSchema,
]);

export const knowledgeBundleFieldsSchema = z.object({
  knowledge_type: z.enum(['concept', 'procedure', 'comparison', 'mechanism', 'structure', 'claim_evidence']),
  central_question: z.string().trim().min(1).max(500),
  structured_content: knowledgeBundleContentSchema,
  bundle_schema_version: z.literal(KNOWLEDGE_BUNDLE_SCHEMA_VERSION).default(KNOWLEDGE_BUNDLE_SCHEMA_VERSION),
}).strict().superRefine((value, ctx) => {
  if (value.knowledge_type !== value.structured_content.type) {
    ctx.addIssue({ code: 'custom', path: ['structured_content', 'type'], message: 'structured_content.type must match knowledge_type.' });
  }
});
