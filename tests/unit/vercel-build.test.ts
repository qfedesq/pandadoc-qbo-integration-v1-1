import {
  resolveBuildDatabasePlan,
  resolveMigrationDatabaseUrl,
  shouldRunBuildMigrations,
} from "@/lib/deployment/vercel-build";

describe("vercel build deployment plan", () => {
  it("runs migrations automatically on Vercel", () => {
    expect(shouldRunBuildMigrations({ VERCEL: "1" })).toBe(true);
  });

  it("prefers the unpooled database URL for migrations", () => {
    expect(
      resolveMigrationDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        DATABASE_URL_UNPOOLED: "postgres://direct",
        POSTGRES_URL_NON_POOLING: "postgres://direct-fallback",
      }),
    ).toBe("postgres://direct");
  });

  it("falls back to the non-pooling Vercel Postgres URL", () => {
    expect(
      resolveBuildDatabasePlan({
        VERCEL: "1",
        DATABASE_URL: "postgres://pooled",
        POSTGRES_URL_NON_POOLING: "postgres://non-pooling",
      }),
    ).toEqual({
      runMigrations: true,
      migrationDatabaseUrl: "postgres://non-pooling",
      usingDirectDatabaseUrl: true,
    });
  });

  it("allows migrations to be skipped explicitly", () => {
    expect(
      shouldRunBuildMigrations({
        VERCEL: "1",
        SKIP_VERCEL_MIGRATIONS: "true",
      }),
    ).toBe(false);
  });

  it("can force build-time migrations outside Vercel", () => {
    expect(
      resolveBuildDatabasePlan({
        FORCE_BUILD_MIGRATIONS: "true",
        DATABASE_URL: "postgres://local",
      }),
    ).toEqual({
      runMigrations: true,
      migrationDatabaseUrl: "postgres://local",
      usingDirectDatabaseUrl: false,
    });
  });
});
