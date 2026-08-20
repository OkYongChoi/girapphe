'use client';

import { useMemo } from 'react';
import { useWebMcpTools, type WebMcpTool } from '@/lib/webmcp';
import { sortConceptCards } from '@/lib/knowledge-map-time';
import {
  normalizeKnowledgeSearchInput,
  resolveKnowledgeSearchDomain,
  searchPublicKnowledgeCatalog,
  toCompactKnowledgeSearchResults,
  type KnowledgeSearchCard,
  type KnowledgeSearchFilters,
} from './knowledge-map-webmcp';

type Props = {
  cards: readonly KnowledgeSearchCard[];
  publicDomains: readonly string[];
  onApplyFilters: (filters: KnowledgeSearchFilters) => void;
};

export default function KnowledgeMapWebMcpRegistration({
  cards,
  publicDomains,
  onApplyFilters,
}: Props) {
  const tools = useMemo<readonly WebMcpTool[]>(() => [{
    name: 'search_knowledge',
    title: 'Search the Knowledge Map',
    description:
      'Apply explicit case-insensitive keyword or #tag, domain, learning-status, and added-date filters to the visible Girapphe Knowledge Map. This is substring matching only, not semantic search, and it never persists changes. Output contains bounded public catalog metadata only; private cards and mastery state remain local to the page.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          maxLength: 240,
          description: 'Space-separated keywords or #tags. Every term must match.',
        },
        domain: {
          type: 'string',
          maxLength: 80,
          description: 'Exact public Knowledge Map domain key, or all. Matching is case-insensitive.',
        },
        status: {
          type: 'string',
          enum: ['all', 'known', 'saved', 'unstarted'],
          description: 'Learning-status filter applied only to the local Knowledge Map UI.',
        },
        added_within: {
          type: 'string',
          enum: ['all', 'today', 'week', 'month', 'quarter', 'year'],
          description: 'Optional added-date window. Undated curated concepts remain visible.',
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: true,
    },
    execute: (input, { signal }) => {
      if (signal.aborted) return { ok: false, error: 'aborted' };

      const requestedFilters = normalizeKnowledgeSearchInput(input);
      const resolvedDomain = resolveKnowledgeSearchDomain(requestedFilters.domain, publicDomains);
      if (!resolvedDomain) {
        return {
          ok: false,
          error: 'unknown_domain',
          result_scope: 'public_catalog',
          status_filter_applied_to_output: false,
        };
      }

      const nextFilters = { ...requestedFilters, domain: resolvedDomain };
      const publicCatalogMatches = searchPublicKnowledgeCatalog(cards, nextFilters);
      const results = toCompactKnowledgeSearchResults(
        sortConceptCards(publicCatalogMatches, 'title'),
      );

      onApplyFilters(nextFilters);

      return {
        ok: true,
        result_scope: 'public_catalog',
        status_filter_applied_to_output: false,
        ui_filters_applied: true,
        ui_view: 'grid',
        results,
      };
    },
  }], [cards, onApplyFilters, publicDomains]);

  useWebMcpTools(tools);
  return null;
}
