import assert from 'node:assert/strict';
import test from 'node:test';
import {
  localDateTimeToIso,
  localDateTimeInputValue,
  prepareKnowledgeLifecycleFormData,
  prepareKnowledgeVerificationFormData,
  readCompatibleTimestampPatchField,
  readKnowledgeResolutionTimestampField,
  readOptionalTimestampPatchField,
  type KnowledgeLifecycleExactDefaults,
  type KnowledgeLifecycleLocalDefaults,
} from './local-datetime';

test('converts an Asia/Seoul wall time to the intended UTC instant', () => {
  assert.equal(localDateTimeToIso('2026-08-28T09:30', -540), '2026-08-28T00:30:00.000Z');
});

test('rejects invalid and normalized-away local datetimes', () => {
  assert.throws(() => localDateTimeToIso('2026-02-30T09:30', -540), /Invalid local date and time/);
  assert.throws(() => localDateTimeToIso('2026-08-28T09:30Z', -540), /Invalid local date and time/);
});

const targetDefaults: KnowledgeLifecycleLocalDefaults = {
  observed_at: '2026-08-28T09:30',
  review_at: '2026-09-28T09:30',
  valid_from: '2026-08-01T09:30',
  valid_to: '2026-08-31T09:30',
};

const createDefaults: KnowledgeLifecycleLocalDefaults = {
  observed_at: '2026-08-27T14:05',
  review_at: '',
  valid_from: '',
  valid_to: '',
};

const createExactDefaults: KnowledgeLifecycleExactDefaults = {
  observed_at: '2026-08-27T05:05:19.456Z',
  review_at: null,
  valid_from: null,
  valid_to: null,
};

function lifecycleFormData(values: KnowledgeLifecycleLocalDefaults) {
  const formData = new FormData();
  for (const [name, value] of Object.entries(values)) formData.set(name, value);
  return formData;
}

test('omits untouched target lifecycle fields so merge preserves full timestamp precision', () => {
  const formData = lifecycleFormData(targetDefaults);
  prepareKnowledgeLifecycleFormData(
    formData,
    'merge',
    targetDefaults,
    createDefaults,
    createExactDefaults,
  );
  assert.equal(formData.has('observed_at'), false);
  assert.equal(formData.has('review_at'), false);
  assert.equal(formData.has('valid_from'), false);
  assert.equal(formData.has('valid_to'), false);
});

test('keeps explicit lifecycle clears and normalizes edited values for update', () => {
  const formData = lifecycleFormData({
    ...targetDefaults,
    observed_at: '',
    valid_to: '2026-09-01T18:45',
  });
  prepareKnowledgeLifecycleFormData(
    formData,
    'update',
    targetDefaults,
    createDefaults,
    createExactDefaults,
  );
  assert.equal(formData.get('observed_at'), '');
  assert.equal(formData.get('valid_to'), new Date(2026, 8, 1, 18, 45).toISOString());
  assert.equal(formData.has('review_at'), false);
  assert.equal(formData.has('valid_from'), false);
});

test('Save New preserves the exact candidate event instant behind minute-precision inputs', () => {
  const formData = lifecycleFormData(createDefaults);
  prepareKnowledgeLifecycleFormData(
    formData,
    'create',
    null,
    createDefaults,
    createExactDefaults,
  );
  assert.equal(formData.get('observed_at'), createExactDefaults.observed_at);
  assert.equal(formData.has('review_at'), false);
  assert.equal(formData.has('valid_from'), false);
  assert.equal(formData.has('valid_to'), false);
});

test('timestamp patch parsing distinguishes omitted fields from explicit clears', () => {
  const formData = new FormData();
  assert.equal(readOptionalTimestampPatchField(formData, 'review_at'), undefined);
  formData.set('review_at', '');
  assert.equal(readOptionalTimestampPatchField(formData, 'review_at'), null);
  formData.set('review_at', '2026-08-28T03:02:19.456Z');
  assert.equal(readOptionalTimestampPatchField(formData, 'review_at'), '2026-08-28T03:02:19.456Z');
  formData.set('review_at', 'not-a-date');
  assert.throws(() => readOptionalTimestampPatchField(formData, 'review_at'), /Invalid review_at/);
});

test('verification preserves an unchanged schedule while retaining explicit clear and set patches', () => {
  const initialReviewAt = localDateTimeInputValue('2026-09-28T04:05:06.789Z');
  const untouched = new FormData();
  untouched.set('review_at', initialReviewAt);
  prepareKnowledgeVerificationFormData(untouched, initialReviewAt);
  assert.equal(untouched.has('review_at'), false);

  const cleared = new FormData();
  cleared.set('review_at', '');
  prepareKnowledgeVerificationFormData(cleared, initialReviewAt);
  assert.equal(cleared.get('review_at'), '');
  assert.equal(readOptionalTimestampPatchField(cleared, 'review_at'), null);

  const scheduled = new FormData();
  scheduled.set('review_at', '2026-09-28T09:30');
  prepareKnowledgeVerificationFormData(scheduled, '');
  assert.equal(scheduled.get('review_at'), new Date(2026, 8, 28, 9, 30).toISOString());
});

test('legacy resolution forms preserve blank target timestamps while marked forms can clear them', () => {
  const formData = new FormData();
  formData.set('review_at', '');
  assert.equal(readCompatibleTimestampPatchField(formData, 'review_at', false), undefined);
  assert.equal(readCompatibleTimestampPatchField(formData, 'review_at', true), null);
});

test('legacy target resolutions ignore the old auto-filled event time without dropping explicit date edits', () => {
  const formData = new FormData();
  formData.set('observed_at', '2026-08-28T03:02:19.456Z');
  formData.set('review_at', '');
  formData.set('valid_from', '2026-08-20T01:02:03.456Z');

  assert.equal(readKnowledgeResolutionTimestampField(formData, 'observed_at', 'merge'), undefined);
  assert.equal(readKnowledgeResolutionTimestampField(formData, 'observed_at', 'update'), undefined);
  assert.equal(
    readKnowledgeResolutionTimestampField(formData, 'observed_at', 'create'),
    '2026-08-28T03:02:19.456Z',
  );
  assert.equal(readKnowledgeResolutionTimestampField(formData, 'review_at', 'merge'), undefined);
  assert.equal(
    readKnowledgeResolutionTimestampField(formData, 'valid_from', 'merge'),
    '2026-08-20T01:02:03.456Z',
  );
});
