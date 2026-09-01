const GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

export function normalizeDeploymentRevision(value: string | undefined) {
  const revision = value?.trim().toLowerCase() ?? '';
  return GIT_SHA_PATTERN.test(revision) ? revision : null;
}
