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
