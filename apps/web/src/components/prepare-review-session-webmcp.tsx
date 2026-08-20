'use client';

import { useMemo } from 'react';
import { localizePathname } from '@stem-brain/shared';
import { useI18n } from '@/i18n/client';
import { type WebMcpTool, useWebMcpTools } from '@/lib/webmcp';
import {
  resolvePracticeMode,
  type PracticeMode,
} from '@/components/webmcp-page-tools';

type PrepareReviewSessionWebMcpProps = {
  currentMode: PracticeMode;
};

export default function PrepareReviewSessionWebMcp({
  currentMode,
}: PrepareReviewSessionWebMcpProps) {
  const { locale } = useI18n();
  const tools = useMemo<readonly WebMcpTool[]>(() => [
    {
      name: 'prepare_review_session',
      title: 'Prepare a review session',
      description:
        'Prepare the Girapphe Practice page in an explicitly selected new-card or review mode. This only navigates; it never reveals answers or records ratings.',
      inputSchema: {
        type: 'object',
        properties: {
          mode: {
            type: 'string',
            enum: ['new', 'review'],
            description: 'Required practice mode: new cards or cards that need review.',
          },
        },
        required: ['mode'],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
      },
      execute(input) {
        const mode = resolvePracticeMode(input.mode);
        if (!mode) {
          return {
            status: 'invalid_request',
            allowed_modes: ['new', 'review'],
          };
        }

        if (mode !== currentMode) {
          globalThis.location.assign(localizePathname(`/practice?mode=${mode}`, locale));
        }

        return {
          status: 'prepared',
          mode,
        };
      },
    },
  ], [currentMode, locale]);

  useWebMcpTools(tools);
  return null;
}
