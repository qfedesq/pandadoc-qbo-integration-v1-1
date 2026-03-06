export type DeploymentBuildEnv = Record<string, string | undefined>;

function isTruthyFlag(value: string | undefined) {
  return value === "1" || value === "true";
}

function firstNonEmpty(values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

export function shouldRunBuildMigrations(env: DeploymentBuildEnv) {
  if (isTruthyFlag(env.SKIP_VERCEL_MIGRATIONS)) {
    return false;
  }

  if (isTruthyFlag(env.FORCE_BUILD_MIGRATIONS)) {
    return true;
  }

  return env.VERCEL === "1";
}

export function resolveMigrationDatabaseUrl(env: DeploymentBuildEnv) {
  return firstNonEmpty([
    env.DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
    env.DATABASE_URL,
  ]);
}

export function resolveBuildDatabasePlan(env: DeploymentBuildEnv) {
  const migrationDatabaseUrl = resolveMigrationDatabaseUrl(env);
  const preferredDirectUrl = firstNonEmpty([
    env.DATABASE_URL_UNPOOLED,
    env.POSTGRES_URL_NON_POOLING,
  ]);

  return {
    runMigrations: shouldRunBuildMigrations(env),
    migrationDatabaseUrl,
    usingDirectDatabaseUrl:
      Boolean(preferredDirectUrl) && preferredDirectUrl === migrationDatabaseUrl,
  };
}
