'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import { type WebMcpTool, useWebMcpTools } from '@/lib/webmcp';
import {
  selectPendingReview,
  type PendingReviewSummary,
} from '@/components/webmcp-page-tools';

type OpenPendingReviewWebMcpProps = {
  batches: readonly PendingReviewSummary[];
};

function readRequestedBatchId(input: Record<string, unknown>): string | null | undefined {
  const batchId = input.batch_id;
  if (batchId === undefined) return undefined;
  if (typeof batchId !== 'string' || !batchId.trim()) return null;
  return batchId.trim();
}

export default function OpenPendingReviewWebMcp({ batches }: OpenPendingReviewWebMcpProps) {
  const router = useRouter();
  const { locale } = useI18n();
  const tools = useMemo<readonly WebMcpTool[]>(() => [
    {
      name: 'open_pending_review',
      title: 'Open a pending review',
      description:
        'Open one pending Girapphe knowledge-card batch for the user to inspect and edit. Omit batch_id to open the first pending batch. This only navigates; it never approves or discards drafts.',
      inputSchema: {
        type: 'object',
        properties: {
          batch_id: {
            type: 'string',
            minLength: 1,
            maxLength: 160,
            description: 'Optional exact ID of a pending batch currently shown in the inbox.',
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute(input) {
        const requestedBatchId = readRequestedBatchId(input);
        if (requestedBatchId === null) {
          return { status: 'invalid_request' };
        }

        const batch = selectPendingReview(batches, requestedBatchId);
        if (!batch) {
          return { status: batches.length === 0 ? 'empty' : 'not_found' };
        }

        router.push(localizePathname(`/knowledge-inbox/${encodeURIComponent(batch.id)}`, locale));
        return { status: 'opened' };
      },
    },
  ], [batches, locale, router]);

  useWebMcpTools(tools);
  return null;
}
