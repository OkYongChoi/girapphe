type SchemaBootstrapEnvironment = { NODE_ENV?: string; APP_ENV?: string };

/**
 * Preview Workers use isolated databases without CI migrations. Production
 * must rely on the migration job so requests never spend subrequests on DDL.
 */
export function canRunRuntimeSchemaBootstrap(
  env: SchemaBootstrapEnvironment = process.env,
): boolean {
  return env.NODE_ENV !== 'production' || env.APP_ENV === 'preview';
}
