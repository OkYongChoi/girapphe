import type { KnowledgeBundleType, Locale } from '@stem-brain/shared';

export const MY_NOTES_VIEWS = ['active', 'archive', 'trash'] as const;

export type MyNotesView = (typeof MY_NOTES_VIEWS)[number];
export type MyNotesDateRange = 'all' | 'today' | 'week' | 'month';
export type MyNotesSort = 'created' | 'updated' | 'title';
export type MyNotesTypeFilter = 'all' | 'legacy' | KnowledgeBundleType;
export type MyNotesCalendarPeriod = 'today' | 'this-week' | 'this-month' | 'earlier';

export type MyNotesViewItem = {
  id: string;
  title: string;
  topic: string;
  summary: string;
  content: string;
  tags: string[];
  knowledge_type: KnowledgeBundleType | null;
  central_question: string | null;
  created_at: string;
  updated_at: string;
};

export type MyNotesViewOptions = {
  query: string;
  topic: string;
  knowledgeType: MyNotesTypeFilter;
  dateRange: MyNotesDateRange;
  sortBy: MyNotesSort;
  locale: Locale;
};

export type MyNotesListRow<T extends MyNotesViewItem> =
  | { kind: 'group'; period: MyNotesCalendarPeriod; key: string }
  | { kind: 'note'; note: T; key: string };

export type MyNotesViewCapabilities = {
  showsEditor: boolean;
  canEdit: boolean;
  canArchive: boolean;
  canRestoreArchived: boolean;
  canMoveToTrash: boolean;
  canRestoreTrash: boolean;
};

export type MyNotesViewRequestGuard = {
  begin: () => number;
  isCurrent: (view: MyNotesView, request: number) => boolean;
  isSelected: (view: MyNotesView) => boolean;
  select: (view: MyNotesView) => void;
  selected: () => MyNotesView;
};

export type MyNotesPendingActionGuard = {
  begin: (noteId: string) => boolean;
  finish: (noteId: string) => void;
  isPending: () => boolean;
  pendingId: () => string | null;
};

export type MyNotesEditorRequest = Readonly<{
  revision: number;
  noteId: string | null;
}>;

export type MyNotesEditorRequestGuard = {
  select: (noteId: string | null) => void;
  capture: () => MyNotesEditorRequest;
  isCurrent: (request: MyNotesEditorRequest) => boolean;
};

export type MyNotesStaleReloadResult<T> =
  | { status: 'reloaded'; winner: T | null }
  | { status: 'superseded'; winner: T | null }
  | { status: 'unavailable'; winner: null };

export async function reloadMyNoteAfterStale<T extends { id: string }>(
  noteId: string,
  reloadLatest: () => Promise<readonly T[] | null>,
  isEditorRequestCurrent: () => boolean,
  replaceEditor: (winner: T | null) => void,
): Promise<MyNotesStaleReloadResult<T>> {
  const latestItems = await reloadLatest();
  if (latestItems === null) return { status: 'unavailable', winner: null };
  const winner = latestItems.find((item) => item.id === noteId) ?? null;
  if (!isEditorRequestCurrent()) return { status: 'superseded', winner };
  replaceEditor(winner);
  return {
    status: 'reloaded',
    winner,
  };
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function startOfLocalWeek(value: Date): Date {
  const day = startOfLocalDay(value);
  const mondayOffset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - mondayOffset);
  return day;
}

function startOfLocalMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function nextLocalDay(value: Date): Date {
  const next = startOfLocalDay(value);
  next.setDate(next.getDate() + 1);
  return next;
}

function timestamp(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesDateRange(createdAt: string, range: MyNotesDateRange, now: Date): boolean {
  if (range === 'all') return true;
  const created = timestamp(createdAt);
  if (created === null) return false;
  const start = range === 'today'
    ? startOfLocalDay(now)
    : range === 'week'
      ? startOfLocalWeek(now)
      : startOfLocalMonth(now);
  return created >= start.getTime() && created < nextLocalDay(now).getTime();
}

function matchesType(type: KnowledgeBundleType | null, filter: MyNotesTypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'legacy') return type === null;
  return type === filter;
}

function searchableText(item: MyNotesViewItem): string {
  const tags = item.tags.flatMap((tag) => [tag, `#${tag}`]).join(' ');
  return `${item.title} ${item.topic} ${item.summary} ${item.content} ${item.central_question ?? ''} ${item.knowledge_type ?? ''} ${tags}`;
}

export function filterAndSortMyNotes<T extends MyNotesViewItem>(
  items: readonly T[],
  options: MyNotesViewOptions,
  now = new Date(),
): T[] {
  const query = options.query.trim().toLocaleLowerCase(options.locale);
  return items
    .filter((item) => {
      const matchesQuery = !query
        || searchableText(item).toLocaleLowerCase(options.locale).includes(query);
      const matchesTopic = options.topic === 'all' || item.topic === options.topic;
      return matchesQuery
        && matchesTopic
        && matchesType(item.knowledge_type, options.knowledgeType)
        && matchesDateRange(item.created_at, options.dateRange, now);
    })
    .sort((left, right) => {
      if (options.sortBy === 'title') {
        return left.title.localeCompare(right.title, options.locale);
      }
      const field = options.sortBy === 'updated' ? 'updated_at' : 'created_at';
      return (timestamp(right[field]) ?? 0) - (timestamp(left[field]) ?? 0);
    });
}

export function localCalendarPeriod(createdAt: string, now = new Date()): MyNotesCalendarPeriod {
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) return 'earlier';

  const sameDay = created.getFullYear() === now.getFullYear()
    && created.getMonth() === now.getMonth()
    && created.getDate() === now.getDate();
  if (sameDay) return 'today';

  const createdTime = created.getTime();
  const startOfWeek = startOfLocalWeek(now).getTime();
  const startOfMonth = startOfLocalMonth(now).getTime();
  const endOfToday = nextLocalDay(now).getTime();
  if (createdTime >= startOfWeek && createdTime < endOfToday) return 'this-week';
  if (createdTime >= startOfMonth && createdTime < endOfToday) return 'this-month';
  return 'earlier';
}

export function buildMyNotesListRows<T extends MyNotesViewItem>(
  items: readonly T[],
  sortBy: MyNotesSort = 'created',
  now = new Date(),
): MyNotesListRow<T>[] {
  if (sortBy !== 'created') {
    return items.map((note) => ({ kind: 'note' as const, note, key: `note:${note.id}` }));
  }

  const periodOrder: MyNotesCalendarPeriod[] = ['today', 'this-week', 'this-month', 'earlier'];
  const grouped = new Map<MyNotesCalendarPeriod, T[]>();
  for (const note of items) {
    const period = localCalendarPeriod(note.created_at, now);
    grouped.set(period, [...(grouped.get(period) ?? []), note]);
  }

  const rows: MyNotesListRow<T>[] = [];
  for (const period of periodOrder) {
    const notes = grouped.get(period);
    if (!notes?.length) continue;
    rows.push({ kind: 'group', period, key: `group:${period}` });
    rows.push(...notes.map((note) => ({ kind: 'note' as const, note, key: `note:${note.id}` })));
  }
  return rows;
}

export function myNotesViewCapabilities(view: MyNotesView): MyNotesViewCapabilities {
  return {
    showsEditor: view === 'active',
    canEdit: view === 'active',
    canArchive: view === 'active',
    canRestoreArchived: view === 'archive',
    canMoveToTrash: view !== 'trash',
    canRestoreTrash: view === 'trash',
  };
}

export function createMyNotesPendingActionGuard(): MyNotesPendingActionGuard {
  let pendingNoteId: string | null = null;

  return {
    begin(noteId) {
      if (pendingNoteId !== null) return false;
      pendingNoteId = noteId;
      return true;
    },
    finish(noteId) {
      if (pendingNoteId === noteId) pendingNoteId = null;
    },
    isPending() {
      return pendingNoteId !== null;
    },
    pendingId() {
      return pendingNoteId;
    },
  };
}

export function createMyNotesEditorRequestGuard(
  initialNoteId: string | null = null,
): MyNotesEditorRequestGuard {
  let revision = 0;
  let noteId = initialNoteId;

  return {
    select(nextNoteId) {
      noteId = nextNoteId;
      revision += 1;
    },
    capture() {
      return { revision, noteId };
    },
    isCurrent(request) {
      return request.revision === revision && request.noteId === noteId;
    },
  };
}

export function createMyNotesViewRequestGuard(
  initialView: MyNotesView = 'active',
): MyNotesViewRequestGuard {
  let selectedView = initialView;
  let latestRequest = 0;

  return {
    begin() {
      latestRequest += 1;
      return latestRequest;
    },
    isCurrent(view, request) {
      return selectedView === view && latestRequest === request;
    },
    isSelected(view) {
      return selectedView === view;
    },
    select(view) {
      selectedView = view;
      latestRequest += 1;
    },
    selected() {
      return selectedView;
    },
  };
}
