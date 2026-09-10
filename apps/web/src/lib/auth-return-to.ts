export const DEFAULT_AUTH_RETURN_TO = '/practice' as const;

const AUTH_RETURN_TARGETS = [
  DEFAULT_AUTH_RETURN_TO,
  '/subscription',
  '/account/delete',
  '/account/data-controls-handoff',
] as const;

export type AuthReturnTo = (typeof AUTH_RETURN_TARGETS)[number];

export function resolveAuthReturnTo(value: string | string[] | undefined): AuthReturnTo {
  if (typeof value !== 'string') return DEFAULT_AUTH_RETURN_TO;
  return (AUTH_RETURN_TARGETS as readonly string[]).includes(value)
    ? value as AuthReturnTo
    : DEFAULT_AUTH_RETURN_TO;
}
