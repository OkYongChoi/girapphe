'use client';

import { useState } from 'react';

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
