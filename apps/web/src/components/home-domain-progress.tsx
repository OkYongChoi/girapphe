'use client';

import { useEffect, useMemo, useState } from 'react';

export type HomeDomainProgressRow = {
  label: string;
  value: number;
  tone: string;
};

const DEMO_PROGRESS_FRAMES: HomeDomainProgressRow[][] = [
  [
    { label: 'Linear systems', value: 82, tone: 'bg-emerald-300' },
    { label: 'Bayes rule', value: 64, tone: 'bg-sky-300' },
    { label: 'Fourier analysis', value: 48, tone: 'bg-amber-300' },
    { label: 'Graph search', value: 72, tone: 'bg-cyan-300' },
  ],
  [
    { label: 'Neural networks', value: 76, tone: 'bg-emerald-300' },
    { label: 'Thermodynamics', value: 58, tone: 'bg-sky-300' },
    { label: 'Organic chemistry', value: 69, tone: 'bg-amber-300' },
    { label: 'Data structures', value: 87, tone: 'bg-cyan-300' },
  ],
  [
    { label: 'Probability', value: 71, tone: 'bg-emerald-300' },
    { label: 'Operating systems', value: 52, tone: 'bg-sky-300' },
    { label: 'Cell biology', value: 63, tone: 'bg-amber-300' },
    { label: 'Signal processing', value: 79, tone: 'bg-cyan-300' },
  ],
];

const FRAME_SIZE = 4;
const ROTATION_INTERVAL_MS = 3200;

export default function HomeDomainProgress({
  rows,
  demo = false,
}: {
  rows: HomeDomainProgressRow[];
  demo?: boolean;
}) {
  const frames = useMemo(() => buildFrames(rows, demo), [rows, demo]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) return undefined;

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [frames.length]);

  const activeRows = frames[frames.length > 0 ? frameIndex % frames.length : 0] ?? [];

  return (
    <div className="mt-6 space-y-3" aria-live="polite">
      {activeRows.map((row) => {
        const value = clampPercent(row.value);

        return (
          <div key={`${row.label}-${value}`} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-3 text-xs">
            <span className="truncate text-slate-400" title={row.label}>{row.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className={`home-progress-line block h-full rounded-full ${row.tone}`}
                style={{ width: `${value}%` }}
              />
            </span>
            <span className="text-right text-slate-500">{value}</span>
          </div>
        );
      })}
    </div>
  );
}

function buildFrames(rows: HomeDomainProgressRow[], demo: boolean) {
  if (demo) return DEMO_PROGRESS_FRAMES;
  if (rows.length <= FRAME_SIZE) return [rows];

  return rows.map((_, index) => {
    return Array.from({ length: FRAME_SIZE }, (_item, offset) => rows[(index + offset) % rows.length]);
  });
}

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)));
}
