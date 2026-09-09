'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  canonicalizeKnowledgeTag,
  MAX_KNOWLEDGE_TAG_CODE_POINTS,
  MAX_KNOWLEDGE_TAG_SUGGESTIONS,
  MAX_KNOWLEDGE_TAGS,
  normalizeKnowledgeTag,
  sanitizeKnowledgeTagFormValues,
  sanitizeKnowledgeTags,
} from '@/lib/knowledge-tag-normalization';

const MAX_RENDERED_SUGGESTIONS = 24;
const MAX_RAW_DRAFT_CODE_POINTS = 256;
const KnowledgeTagSuggestionsContext = createContext<readonly string[]>([]);

type KnowledgeTagSuggestionsProviderProps = {
  children: ReactNode;
  suggestions: readonly string[];
};

export function KnowledgeTagSuggestionsProvider({
  children,
  suggestions,
}: KnowledgeTagSuggestionsProviderProps) {
  const normalizedSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const suggestion of suggestions) {
      const normalized = normalizeKnowledgeTag(suggestion);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= MAX_KNOWLEDGE_TAG_SUGGESTIONS) break;
    }
    return result;
  }, [suggestions]);

  return (
    <KnowledgeTagSuggestionsContext.Provider value={normalizedSuggestions}>
      {children}
    </KnowledgeTagSuggestionsContext.Provider>
  );
}

type KnowledgeTagInputProps = {
  id: string;
  name: string;
  defaultTags?: readonly string[];
  resetOnFormReset?: boolean;
  labels: {
    label: string;
    placeholder: string;
    select: string;
    search: string;
    noMatches: string;
    close: string;
    help: string;
    limit: string;
    length: string;
    invalid: string;
    remove: string;
  };
};

type Notice = 'length' | 'invalid' | null;

function constrainDraft(value: string) {
  const normalized = value.normalize('NFKC');
  const rawCodePoints = Array.from(normalized);
  const canonicalCodePoints = Array.from(canonicalizeKnowledgeTag(normalized));
  const shouldUseCanonical = canonicalCodePoints.length > MAX_KNOWLEDGE_TAG_CODE_POINTS
    || rawCodePoints.length > MAX_RAW_DRAFT_CODE_POINTS;
  return {
    value: shouldUseCanonical
      ? canonicalCodePoints.slice(0, MAX_KNOWLEDGE_TAG_CODE_POINTS).join('')
      : normalized,
    truncated: shouldUseCanonical,
  };
}

function containsInvalidTag(values: readonly string[]) {
  return values.some((value) => value.trim() && normalizeKnowledgeTag(value) === null);
}

export default function KnowledgeTagInput({
  id,
  name,
  defaultTags = [],
  resetOnFormReset = false,
  labels,
}: KnowledgeTagInputProps) {
  const suggestions = useContext(KnowledgeTagSuggestionsContext);
  const helpId = useId();
  const suggestionPanelId = `${id}-suggestions`;
  const suggestionSearchId = `${id}-suggestion-search`;
  const rootRef = useRef<HTMLDivElement>(null);
  const progressiveInputRef = useRef<HTMLInputElement>(null);
  const enhancementCapturedRef = useRef(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const suggestionTriggerRef = useRef<HTMLButtonElement>(null);
  const suggestionSearchRef = useRef<HTMLInputElement>(null);
  const [tags, setTags] = useState(() => sanitizeKnowledgeTags(defaultTags));
  const progressiveDefaultValue = useRef(sanitizeKnowledgeTags(defaultTags).join(', ')).current;
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const selectedKeys = useMemo(() => new Set(tags), [tags]);
  const visibleSuggestions = useMemo(() => {
    if (!showSuggestions) return [];
    const query = canonicalizeKnowledgeTag(suggestionQuery);
    const result: string[] = [];
    for (const tag of suggestions) {
      if (selectedKeys.has(tag) || (query && !tag.includes(query))) continue;
      result.push(tag);
      if (result.length >= MAX_RENDERED_SUGGESTIONS) break;
    }
    return result;
  }, [selectedKeys, showSuggestions, suggestionQuery, suggestions]);
  const atLimit = tags.length >= MAX_KNOWLEDGE_TAGS;
  const serializedTags = sanitizeKnowledgeTags([...tags, draft]).join(', ');
  const statusMessage = !isEnhanced
    ? labels.help
    : atLimit
      ? labels.limit
      : notice === 'length'
        ? labels.length
        : notice === 'invalid'
          ? labels.invalid
          : labels.help;

  useEffect(() => {
    if (enhancementCapturedRef.current) return;
    enhancementCapturedRef.current = true;
    const hadFocus = document.activeElement === progressiveInputRef.current;
    const progressiveValue = progressiveInputRef.current?.value ?? progressiveDefaultValue;
    if (progressiveValue === progressiveDefaultValue) {
      setTags(sanitizeKnowledgeTagFormValues([progressiveValue]));
      setDraft('');
    } else {
      const segments = progressiveValue.split(/[,،，]/u);
      const trailing = segments.pop() ?? '';
      const endsWithSeparator = /[,،，]\s*$/u.test(progressiveValue);
      const bounded = constrainDraft(endsWithSeparator ? '' : trailing);
      const committed = endsWithSeparator ? [...segments, trailing] : segments;
      setTags(sanitizeKnowledgeTags(committed));
      setDraft(bounded.value);
      setNotice(
        containsInvalidTag([...committed, trailing])
          ? 'invalid'
          : bounded.truncated
            ? 'length'
            : null,
      );
    }
    setIsEnhanced(true);
    if (hadFocus) requestAnimationFrame(() => tagInputRef.current?.focus());
  }, [progressiveDefaultValue]);

  useEffect(() => {
    if (!showSuggestions) return;
    const frame = requestAnimationFrame(() => suggestionSearchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [showSuggestions]);

  useEffect(() => {
    if (!resetOnFormReset) return;
    const form = rootRef.current?.closest('form');
    if (!form) return;
    const reset = () => {
      setTags(sanitizeKnowledgeTags(defaultTags));
      setDraft('');
      setNotice(null);
      setShowSuggestions(false);
      setSuggestionQuery('');
    };
    form.addEventListener('reset', reset);
    return () => form.removeEventListener('reset', reset);
  }, [defaultTags, resetOnFormReset]);

  function closeSuggestions(focusTrigger: boolean) {
    setShowSuggestions(false);
    setSuggestionQuery('');
    if (focusTrigger) requestAnimationFrame(() => suggestionTriggerRef.current?.focus());
  }

  function commitDraft(value = draft) {
    if (!value.trim() || atLimit) return;
    const normalized = normalizeKnowledgeTag(value);
    if (!normalized) {
      setDraft('');
      setNotice('invalid');
      return;
    }
    const next = sanitizeKnowledgeTags([...tags, normalized]);
    setTags(next);
    setDraft('');
    setNotice(null);
    if (next.length >= MAX_KNOWLEDGE_TAGS) closeSuggestions(false);
  }

  function handleInputChange(value: string) {
    if (atLimit) return;
    if (showSuggestions) closeSuggestions(false);
    const segments = value.split(/[,،，]/u);
    if (segments.length === 1) {
      const bounded = constrainDraft(value);
      setDraft(bounded.value);
      setNotice(containsInvalidTag([value]) ? 'invalid' : bounded.truncated ? 'length' : null);
      return;
    }

    const committed = segments.slice(0, -1);
    const next = sanitizeKnowledgeTags([...tags, ...committed]);
    const trailing = segments.at(-1) ?? '';
    const bounded = constrainDraft(trailing);
    setTags(next);
    setDraft(next.length >= MAX_KNOWLEDGE_TAGS ? '' : bounded.value);
    setNotice(containsInvalidTag([...committed, trailing]) ? 'invalid' : bounded.truncated ? 'length' : null);
    if (next.length >= MAX_KNOWLEDGE_TAGS) closeSuggestions(false);
  }

  function selectSuggestion(value: string) {
    if (atLimit) return;
    const next = sanitizeKnowledgeTags([...tags, value]);
    setTags(next);
    setDraft('');
    setNotice(null);
    closeSuggestions(false);
    requestAnimationFrame(() => tagInputRef.current?.focus());
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((tag) => tag !== tagToRemove));
    setNotice(null);
    requestAnimationFrame(() => tagInputRef.current?.focus());
  }

  return (
    <div ref={rootRef} data-testid={`${id}-tag-picker`} className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-700">{labels.label}</label>
      {isEnhanced ? (
        <>
          <input type="hidden" id={`${id}-value`} name={name} value={serializedTags} readOnly />
          <div className="min-w-0 rounded-lg border px-2 py-2 focus-within:ring-2 focus-within:ring-blue-400">
            {tags.length > 0 ? (
              <ul className="mb-2 flex min-w-0 flex-wrap gap-1.5" aria-label={labels.label}>
                {tags.map((tag) => (
                  <li key={tag} className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-slate-100 ps-3 text-xs font-medium text-slate-700">
                    <span className="min-w-0 break-all py-1.5">#{tag}</span>
                    <button
                      type="button"
                      aria-label={`${labels.remove} #${tag}`}
                      onClick={() => removeTag(tag)}
                      className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <input
              ref={tagInputRef}
              id={id}
              type="text"
              value={draft}
              readOnly={atLimit}
              aria-disabled={atLimit}
              aria-describedby={helpId}
              autoComplete="off"
              placeholder={labels.placeholder}
              onChange={(event) => {
                const nativeEvent = event.nativeEvent as InputEvent;
                if (nativeEvent.isComposing) {
                  const rawCodePoints = Array.from(event.target.value);
                  setDraft(rawCodePoints.slice(0, MAX_RAW_DRAFT_CODE_POINTS).join(''));
                  setNotice(rawCodePoints.length > MAX_RAW_DRAFT_CODE_POINTS ? 'length' : null);
                  return;
                }
                handleInputChange(event.target.value);
              }}
              onCompositionEnd={(event) => handleInputChange(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                const currentValue = event.currentTarget.value;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  if (currentValue.trim()) commitDraft(currentValue);
                  return;
                }
                if ((event.key === ',' || event.key === '،' || event.key === '，') && currentValue.trim()) {
                  event.preventDefault();
                  commitDraft(currentValue);
                }
              }}
              className="min-h-11 w-full min-w-0 border-0 px-1 py-1 text-sm outline-none focus:ring-0 read-only:cursor-not-allowed read-only:bg-slate-50"
            />
          </div>
        </>
      ) : (
        <input
          ref={progressiveInputRef}
          id={id}
          name={name}
          type="text"
          defaultValue={progressiveDefaultValue}
          aria-describedby={helpId}
          autoComplete="off"
          placeholder={labels.placeholder}
          className="min-h-11 w-full min-w-0 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
        />
      )}
      {isEnhanced && !atLimit && !draft.trim() && suggestions.length > 0 ? (
        <>
          <button
            ref={suggestionTriggerRef}
            type="button"
            aria-expanded={showSuggestions}
            aria-controls={suggestionPanelId}
            onClick={() => {
              if (showSuggestions) closeSuggestions(false);
              else setShowSuggestions(true);
            }}
            className="min-h-11 self-start rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {labels.select}
          </button>
          {showSuggestions ? (
            <div
              id={suggestionPanelId}
              className="grid gap-2 rounded-lg border bg-white p-2 shadow-sm"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.target === suggestionSearchRef.current) {
                  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                  event.preventDefault();
                  return;
                }
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeSuggestions(true);
                }
              }}
            >
              <label htmlFor={suggestionSearchId} className="sr-only">{labels.search}</label>
              <input
                ref={suggestionSearchRef}
                id={suggestionSearchId}
                type="search"
                value={suggestionQuery}
                onChange={(event) => setSuggestionQuery(event.target.value)}
                placeholder={labels.search}
                autoComplete="off"
                className="min-h-11 rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              {visibleSuggestions.length > 0 ? (
                <ul data-testid={`${id}-suggestion-list`} className="grid max-h-60 gap-1 overflow-y-auto">
                  {visibleSuggestions.map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        onClick={() => selectSuggestion(tag)}
                        className="min-h-11 w-full break-all rounded-lg px-3 py-2 text-start text-sm text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      >
                        #{tag}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-3 text-sm text-slate-500">{labels.noMatches}</p>
              )}
              <button
                type="button"
                onClick={() => closeSuggestions(true)}
                className="min-h-11 justify-self-end rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {labels.close}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
      <span
        id={helpId}
        role={statusMessage === labels.help ? undefined : 'status'}
        className="text-xs text-gray-500"
      >
        {statusMessage}
      </span>
    </div>
  );
}
