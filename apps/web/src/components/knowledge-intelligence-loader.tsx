'use client';

import dynamic from 'next/dynamic';
import { useI18n } from '@/i18n/client';
import type { KnowledgeIntelligencePanelProps } from '@/components/knowledge-intelligence-panel';

function LoadingThinkingHistory() {
  const { t } = useI18n();
  return <section aria-busy="true" className="thinking-loading">{t('common.loading')}</section>;
}

const KnowledgeIntelligencePanel = dynamic(
  () => import('@/components/knowledge-intelligence-panel'),
  { ssr: false, loading: LoadingThinkingHistory },
);

export default function KnowledgeIntelligenceLoader(props: KnowledgeIntelligencePanelProps) {
  return <KnowledgeIntelligencePanel {...props} />;
}
