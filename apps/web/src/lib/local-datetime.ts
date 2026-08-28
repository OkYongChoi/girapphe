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
