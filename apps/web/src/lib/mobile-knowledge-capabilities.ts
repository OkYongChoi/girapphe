import type { KnowledgeBundleContent } from '@stem-brain/shared';

export const MOBILE_CAUSAL_RELATION_TYPES = new Set(['causes', 'contributes_to', 'enables', 'inhibits']);

export type MobileKnowledgeCapabilities = {
  expression: boolean;
  eventChronology: boolean;
  causalRelations: boolean;
};

export function readMobileKnowledgeCapabilities(header: string | null): MobileKnowledgeCapabilities {
  const values = new Set((header ?? '').split(',').map((value) => value.trim()));
  return {
    expression: values.has('expression-v1'),
    eventChronology: values.has('event-chronology-v1'),
    causalRelations: values.has('causal-relations-v1'),
  };
}

export function withMobileKnowledgeCompatibility<T extends {
  knowledge_type?: string | null;
  central_question?: string | null;
  structured_content?: KnowledgeBundleContent | null;
  bundle_schema_version?: number | null;
}>(item: T, capabilities: MobileKnowledgeCapabilities): T {
  if (item.knowledge_type === 'expression' && !capabilities.expression) {
    return { ...item, knowledge_type: null, central_question: null, structured_content: null, bundle_schema_version: null };
  }
  if (item.structured_content?.type === 'event' && item.structured_content.chronology && !capabilities.eventChronology) {
    const legacyEvent = { ...item.structured_content };
    delete legacyEvent.chronology;
    return { ...item, structured_content: legacyEvent };
  }
  return item;
}

export function withMobileKnowledgeListCompatibility<T extends {
  knowledge_type?: string | null;
  central_question?: string | null;
  structured_content?: KnowledgeBundleContent | null;
  bundle_schema_version?: number | null;
}>(items: T[], capabilities: MobileKnowledgeCapabilities): T[] {
  return items.map((item) => withMobileKnowledgeCompatibility(item, capabilities));
}

export function withMobileRelationCompatibility<T extends { type: string }>(
  relations: T[],
  capabilities: MobileKnowledgeCapabilities,
): T[] {
  return capabilities.causalRelations
    ? relations
    : relations.filter((relation) => !MOBILE_CAUSAL_RELATION_TYPES.has(relation.type));
}

export function mobileKnowledgeEditRequiresCapability(
  item: { structured_content?: KnowledgeBundleContent | null } | null | undefined,
  capabilities: MobileKnowledgeCapabilities,
): boolean {
  return Boolean(
    (item?.structured_content?.type === 'expression' && !capabilities.expression)
    || (item?.structured_content?.type === 'event'
      && item.structured_content.chronology
      && !capabilities.eventChronology),
  );
}

export function mobileCandidateApprovalRequiresCapability(
  draft: {
    structured_content?: KnowledgeBundleContent | null;
    relations?: Array<{ type: string }>;
  } | null | undefined,
  capabilities: MobileKnowledgeCapabilities,
): boolean {
  return Boolean(
    mobileKnowledgeEditRequiresCapability(draft, capabilities)
    || (!capabilities.causalRelations
      && draft?.relations?.some((relation) => MOBILE_CAUSAL_RELATION_TYPES.has(relation.type))),
  );
}

export function mobileCandidateRequiresDetailedCausalReview(
  draft: { relations?: Array<{ type: string }> } | null | undefined,
): boolean {
  return Boolean(draft?.relations?.some((relation) => MOBILE_CAUSAL_RELATION_TYPES.has(relation.type)));
}
