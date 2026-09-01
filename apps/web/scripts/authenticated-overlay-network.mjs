export function isNoArgumentServerActionBody(body) {
  if (typeof body !== 'string') return false;
  try {
    const value = JSON.parse(body);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}
