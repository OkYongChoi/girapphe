const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function localDateTimeToIso(value: string, offsetMinutes?: number): string {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value.trim());
  if (!match) throw new Error('Invalid local date and time.');
  const [, year, month, day, hour, minute, second = '0'] = match;
  const parts = [year, month, day, hour, minute, second].map(Number);
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = parts;
  const local = new Date(yearNumber!, monthNumber! - 1, dayNumber!, hourNumber!, minuteNumber!, secondNumber!);
  if (
    local.getFullYear() !== yearNumber
    || local.getMonth() !== monthNumber! - 1
    || local.getDate() !== dayNumber
    || local.getHours() !== hourNumber
    || local.getMinutes() !== minuteNumber
    || local.getSeconds() !== secondNumber
  ) {
    throw new Error('Invalid local date and time.');
  }
  if (offsetMinutes === undefined) return local.toISOString();
  return new Date(Date.UTC(
    yearNumber!,
    monthNumber! - 1,
    dayNumber!,
    hourNumber!,
    minuteNumber!,
    secondNumber!,
  ) + offsetMinutes * 60_000).toISOString();
}

export function normalizeLocalDateTimeFields(formData: FormData, fieldNames: string[]) {
  for (const fieldName of fieldNames) {
    const value = formData.get(fieldName);
    if (typeof value === 'string' && value.trim()) formData.set(fieldName, localDateTimeToIso(value));
  }
}

export function localDateTimeInputValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/**
 * An unchanged verification field means "keep the exact current schedule".
 * A cleared prefilled value remains present so the server can distinguish an
 * explicit clear from an untouched value.
 */
export function prepareKnowledgeVerificationFormData(formData: FormData, initialReviewAt: string) {
  const reviewAt = formData.get('review_at');
  if (typeof reviewAt === 'string' && reviewAt === initialReviewAt) {
    formData.delete('review_at');
    return;
  }
  normalizeLocalDateTimeFields(formData, ['review_at']);
}

export const KNOWLEDGE_LIFECYCLE_FIELDS = [
  'observed_at',
  'review_at',
  'valid_from',
  'valid_to',
] as const;

export type KnowledgeLifecycleField = (typeof KNOWLEDGE_LIFECYCLE_FIELDS)[number];
export type KnowledgeLifecycleLocalDefaults = Record<KnowledgeLifecycleField, string>;
export type KnowledgeLifecycleExactDefaults = Record<KnowledgeLifecycleField, string | null>;

export function readOptionalTimestampPatchField(
  formData: FormData,
  name: string,
): string | null | undefined {
  if (!formData.has(name)) return undefined;
  const rawValue = formData.get(name);
  if (typeof rawValue !== 'string') throw new Error(`Invalid ${name}.`);
  const value = rawValue.normalize('NFKC').trim();
  if (Array.from(value).length > 100) throw new Error(`Invalid ${name}.`);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid ${name}.`);
  return parsed.toISOString();
}

export function readCompatibleTimestampPatchField(
  formData: FormData,
  name: string,
  supportsExplicitClears: boolean,
): string | null | undefined {
  const value = readOptionalTimestampPatchField(formData, name);
  return !supportsExplicitClears && value === null ? undefined : value;
}

export function readKnowledgeResolutionTimestampField(
  formData: FormData,
  name: KnowledgeLifecycleField,
  action: 'create' | 'merge' | 'update',
): string | null | undefined {
  const supportsExplicitClears = formData.get('lifecycle_patch_semantics') === 'tri_state_v1';
  // Before tri-state forms, observed_at was populated from the candidate event
  // even while resolving into an existing target. It cannot be distinguished
  // from an edit, so preserve the target instead of replaying that old default.
  if (!supportsExplicitClears && name === 'observed_at' && action !== 'create') return undefined;
  return readCompatibleTimestampPatchField(formData, name, supportsExplicitClears);
}

/**
 * Keeps an untouched merge/update field out of FormData so the server can
 * preserve the target's full-precision timestamp. Untouched create defaults
 * are restored from their exact ISO values after the minute-precision browser
 * input is normalized.
 */
export function prepareKnowledgeLifecycleFormData(
  formData: FormData,
  action: string,
  targetDefaults: KnowledgeLifecycleLocalDefaults | null,
  createDefaults: KnowledgeLifecycleLocalDefaults,
  createExactDefaults: KnowledgeLifecycleExactDefaults,
) {
  const untouchedCreateFields = new Set<KnowledgeLifecycleField>();
  for (const fieldName of KNOWLEDGE_LIFECYCLE_FIELDS) {
    const value = formData.get(fieldName);
    if (typeof value !== 'string') continue;
    if ((action === 'merge' || action === 'update')
      && targetDefaults
      && value === targetDefaults[fieldName]) {
      formData.delete(fieldName);
    } else if (action === 'create' && value === createDefaults[fieldName]) {
      untouchedCreateFields.add(fieldName);
    }
  }
  normalizeLocalDateTimeFields(formData, [...KNOWLEDGE_LIFECYCLE_FIELDS]);
  for (const fieldName of untouchedCreateFields) {
    const exactValue = createExactDefaults[fieldName];
    if (exactValue) formData.set(fieldName, exactValue);
    else formData.delete(fieldName);
  }
}
