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

export function hasHorizontalLayoutOverflow({ documentWidth, rootClientWidth }) {
  if (!Number.isFinite(documentWidth) || !Number.isFinite(rootClientWidth)) return true;
  if (documentWidth < 0 || rootClientWidth <= 0) return true;
  return documentWidth > rootClientWidth + 1;
}

function classifyLocatorActivationFailure(prefix, value) {
  const message = value instanceof Error ? value.message : String(value ?? '');
  const exactCode = new RegExp(`^${prefix}_(?:LAYOUT_OVERFLOW|TARGET_OUTSIDE_VISUAL_VIEWPORT|TARGET_NOT_ACTIONABLE)$`, 'i')
    .exec(message)?.[0];
  if (exactCode) {
    return exactCode.toUpperCase();
  }
  if (/site header[\s\S]*intercepts pointer events/i.test(message)) {
    return `${prefix}_LOCATOR_INTERCEPTED_HEADER`;
  }
  if (/intercepts pointer events/i.test(message)) {
    return `${prefix}_LOCATOR_INTERCEPTED_CONTENT`;
  }
  if (/element (?:is )?not stable/i.test(message)) {
    return `${prefix}_LOCATOR_UNSTABLE`;
  }
  if (/(?:element|locator).*(?:detached|not attached)/i.test(message)) {
    return `${prefix}_LOCATOR_DETACHED`;
  }
  if (/outside of the viewport/i.test(message)) {
    return `${prefix}_LOCATOR_OUTSIDE_VIEWPORT`;
  }
  if (/(?:does not support tap|hasTouch)/i.test(message)) {
    return `${prefix}_LOCATOR_TOUCH_UNAVAILABLE`;
  }
  if (/waiting for (?:scheduled )?navigations? to finish/i.test(message)) {
    return `${prefix}_LOCATOR_NAVIGATION_WAIT`;
  }
  if (/Timeout [0-9]+ms exceeded/i.test(message)) {
    return `${prefix}_LOCATOR_TIMEOUT`;
  }
  return `${prefix}_LOCATOR_ACTIVATION_FAILED`;
}

export function classifyReviewLocatorActivationFailure(value) {
  return classifyLocatorActivationFailure('REVIEW', value);
}

export function classifyConfirmLocatorActivationFailure(value) {
  return classifyLocatorActivationFailure('CONFIRM', value);
}
