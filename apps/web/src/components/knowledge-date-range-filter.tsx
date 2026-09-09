'use client';

import { useEffect, useId, useState, type ReactNode } from 'react';

type KnowledgePeriod = 'all' | 'today' | 'week' | 'month' | 'custom';

type KnowledgeDateRangeFilterProps = {
  defaultPeriod: KnowledgePeriod;
  defaultStart: string;
  defaultEnd: string;
  labels: {
    dateRange: string;
    anyDate: string;
    today: string;
    thisWeek: string;
    thisMonth: string;
    customRange: string;
    from: string;
    to: string;
  };
};

type KnowledgeFilterDisclosureProps = {
  label: string;
  activeCount: number;
  defaultOpen: boolean;
  resetKey: string;
  children: ReactNode;
  contentClassName: string;
};

export function KnowledgeFilterDisclosure({
  label,
  activeCount,
  defaultOpen,
  resetKey,
  children,
  contentClassName,
}: KnowledgeFilterDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [isHydrated, setIsHydrated] = useState(false);
  const panelId = useId();

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen, resetKey]);

  return (
    <div className={`min-w-0 rounded-lg border ${open ? 'col-span-2 bg-white' : 'bg-gray-50'}`}>
      <button
        type="button"
        disabled={!isHydrated}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-400 disabled:cursor-wait"
      >
        <span>{label}{activeCount > 0 ? ` (${activeCount})` : ''}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div id={panelId} hidden={!open} className={contentClassName}>
        {children}
      </div>
    </div>
  );
}

export default function KnowledgeDateRangeFilter({
  defaultPeriod,
  defaultStart,
  defaultEnd,
  labels,
}: KnowledgeDateRangeFilterProps) {
  const [period, setPeriod] = useState<KnowledgePeriod>(defaultPeriod);

  return (
    <>
      <select
        name="period"
        value={period}
        onChange={(event) => setPeriod(event.target.value as KnowledgePeriod)}
        className="w-full min-w-0 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        aria-label={labels.dateRange}
      >
        <option value="all">{labels.anyDate}</option>
        <option value="today">{labels.today}</option>
        <option value="week">{labels.thisWeek}</option>
        <option value="month">{labels.thisMonth}</option>
        <option value="custom">{labels.customRange}</option>
      </select>

      {period === 'custom' ? (
        <>
          <label className="text-xs text-gray-600">
            {labels.from}
            <input
              type="date"
              name="start"
              defaultValue={defaultStart}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
          <label className="text-xs text-gray-600">
            {labels.to}
            <input
              type="date"
              name="end"
              defaultValue={defaultEnd}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>
        </>
      ) : null}
    </>
  );
}
