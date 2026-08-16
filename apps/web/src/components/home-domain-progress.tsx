'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n/client';
import type { Translate } from '@/i18n/core';

export type HomeDomainProgressRow = {
  label: string;
  value: number;
  tone: string;
};

const FRAME_SIZE = 4;
const ROTATION_INTERVAL_MS = 3200;

export default function HomeDomainProgress({
  rows,
  demo = false,
}: {
  rows: HomeDomainProgressRow[];
  demo?: boolean;
}) {
  const { t, formatNumber } = useI18n();
  const frames = useMemo(() => buildFrames(rows, demo, t), [rows, demo, t]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);
    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || frames.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [frames.length, prefersReducedMotion]);

  const activeRows = frames[frames.length > 0 ? frameIndex % frames.length : 0] ?? [];

  return (
    <div className="mt-6 space-y-3" aria-live="polite">
      {activeRows.map((row) => {
        const value = clampPercent(row.value);

        return (
          <div key={`${row.label}-${value}`} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-xs">
            <span className="truncate text-slate-400" title={row.label}>{row.label}</span>
            <span
              className="h-1.5 overflow-hidden rounded-full bg-white/10"
              role="progressbar"
              aria-label={t('home.domainProgressAria', { label: row.label, value })}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <span
                className={`home-progress-line block h-full rounded-full ${row.tone}`}
                style={{ width: `${value}%` }}
              />
            </span>
            <span className="text-end text-slate-500">{formatNumber(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function buildFrames(rows: HomeDomainProgressRow[], demo: boolean, t: Translate) {
  if (demo) return getDemoProgressFrames(t);
  if (rows.length <= FRAME_SIZE) return [rows];

  return rows.map((_, index) => {
    return Array.from({ length: FRAME_SIZE }, (_item, offset) => rows[(index + offset) % rows.length]);
  });
}

function getDemoProgressFrames(t: Translate): HomeDomainProgressRow[][] {
  return [
    [
      { label: t('home.fallbackLinearSystems'), value: 82, tone: 'bg-emerald-300' },
      { label: t('home.fallbackBayesRule'), value: 64, tone: 'bg-sky-300' },
      { label: t('home.fallbackFourierAnalysis'), value: 48, tone: 'bg-amber-300' },
      { label: t('home.fallbackGraphSearch'), value: 72, tone: 'bg-cyan-300' },
    ],
    [
      { label: t('home.fallbackNeuralNetworks'), value: 76, tone: 'bg-emerald-300' },
      { label: t('home.fallbackThermodynamics'), value: 58, tone: 'bg-sky-300' },
      { label: t('home.fallbackOrganicChemistry'), value: 69, tone: 'bg-amber-300' },
      { label: t('home.fallbackDataStructures'), value: 87, tone: 'bg-cyan-300' },
    ],
    [
      { label: t('home.fallbackProbability'), value: 71, tone: 'bg-emerald-300' },
      { label: t('home.fallbackOperatingSystems'), value: 52, tone: 'bg-sky-300' },
      { label: t('home.fallbackCellBiology'), value: 63, tone: 'bg-amber-300' },
      { label: t('home.fallbackSignalProcessing'), value: 79, tone: 'bg-cyan-300' },
    ],
  ];
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
