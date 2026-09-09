import {
  getAccessiblePublicNodeById,
  getNodeExplanation,
  getNodeSummary,
} from '@/knowledge';
import type { LocalizedContent } from '@/api';

type RouteValue = string | string[] | undefined;

export type PublicConceptDraftRouteParams = {
  draftKey?: RouteValue;
  draftSourceId?: RouteValue;
};

export type PublicConceptCopyContinuationParams = PublicConceptDraftRouteParams & {
  continueAction?: RouteValue;
};

export type PublicConceptDraft = {
  draftKey: string;
  sourceId: string;
  title: string;
  topic: string;
  summary: string;
  content: string;
};

export function createPublicConceptDraftLocalizationGuard() {
  let revision = 0;
  return {
    begin() {
      revision += 1;
      return revision;
    },
    invalidate() {
      revision += 1;
    },
    isCurrent(candidate: number) {
      return revision === candidate;
    },
  };
}

function boundedRouteValue(value: RouteValue, maxLength: number): string {
  const first = Array.isArray(value) ? value[0] : value;
  return typeof first === 'string' ? first.trim().slice(0, maxLength) : '';
}

export function parsePublicConceptDraftRoute(
  params: PublicConceptDraftRouteParams,
): { draftKey: string; sourceId: string } | null {
  const draftKey = boundedRouteValue(params.draftKey, 320);
  const sourceId = boundedRouteValue(params.draftSourceId, 160);
  return draftKey && sourceId ? { draftKey, sourceId } : null;
}

export function resolvePublicConceptCopyContinuation(
  params: PublicConceptCopyContinuationParams,
): { draftKey: string; sourceId: string } | null {
  if (boundedRouteValue(params.continueAction, 64) !== 'copy-public-concept') return null;
  return parsePublicConceptDraftRoute(params);
}

export function resolvePublicConceptDraft(
  params: PublicConceptDraftRouteParams,
  fullPublicMap = false,
): PublicConceptDraft | null {
  const route = parsePublicConceptDraftRoute(params);
  if (!route) return null;

  const node = getAccessiblePublicNodeById(route.sourceId, fullPublicMap);
  if (!node) return null;

  return {
    draftKey: route.draftKey,
    sourceId: node.id,
    title: node.label.slice(0, 240),
    topic: node.domain.slice(0, 120),
    summary: getNodeSummary(node.id).slice(0, 500),
    content: getNodeExplanation(node.id).slice(0, 8_000),
  };
}

function localizedValue(value: string | undefined, fallback: string, maxLength: number): string {
  return typeof value === 'string' && value.trim() ? value.slice(0, maxLength) : fallback;
}

export function withTrustedLocalizedPublicConceptContent(
  draft: PublicConceptDraft,
  localized: LocalizedContent | undefined,
): PublicConceptDraft {
  if (!localized || localized.id !== draft.sourceId) return draft;
  return {
    ...draft,
    title: localizedValue(localized.label ?? localized.title, draft.title, 240),
    summary: localizedValue(localized.summary, draft.summary, 500),
    content: localizedValue(localized.explanation, draft.content, 8_000),
  };
}
