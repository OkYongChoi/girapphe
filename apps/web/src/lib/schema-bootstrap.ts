type SchemaBootstrapEnvironment = { NODE_ENV?: string; APP_ENV?: string };

/**
 * Deployed Workers rely on CI migrations so requests never spend their
 * resource budget on schema DDL. Local development retains a bootstrap path.
 */
export function canRunRuntimeSchemaBootstrap(
  env: SchemaBootstrapEnvironment = process.env,
): boolean {
  return env.NODE_ENV !== 'production';
}
