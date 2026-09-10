export function isNoArgumentServerActionBody(body) {
  if (typeof body !== 'string') return false;
  try {
    const value = JSON.parse(body);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}

export function isSuccessfulReviewNavigation({
  committed,
  requestSeen,
  responseStatus,
  requestFailed,
}) {
  if (!committed || requestFailed) return false;
  if (!requestSeen) return responseStatus === null;
  return Number.isInteger(responseStatus)
    && responseStatus >= 200
    && responseStatus < 300;
}

export function classifyReviewLocatorActivationFailure(value) {
  const message = value instanceof Error ? value.message : String(value ?? '');
  if (/site header[\s\S]*intercepts pointer events/i.test(message)) {
    return 'REVIEW_LOCATOR_INTERCEPTED_HEADER';
  }
  if (/intercepts pointer events/i.test(message)) {
    return 'REVIEW_LOCATOR_INTERCEPTED_CONTENT';
  }
  if (/element (?:is )?not stable/i.test(message)) {
    return 'REVIEW_LOCATOR_UNSTABLE';
  }
  if (/(?:element|locator).*(?:detached|not attached)/i.test(message)) {
    return 'REVIEW_LOCATOR_DETACHED';
  }
  if (/outside of the viewport/i.test(message)) {
    return 'REVIEW_LOCATOR_OUTSIDE_VIEWPORT';
  }
  if (/(?:does not support tap|hasTouch)/i.test(message)) {
    return 'REVIEW_LOCATOR_TOUCH_UNAVAILABLE';
  }
  if (/waiting for (?:scheduled )?navigations? to finish/i.test(message)) {
    return 'REVIEW_LOCATOR_NAVIGATION_WAIT';
  }
  if (/Timeout [0-9]+ms exceeded/i.test(message)) {
    return 'REVIEW_LOCATOR_TIMEOUT';
  }
  return 'REVIEW_LOCATOR_ACTIVATION_FAILED';
}
