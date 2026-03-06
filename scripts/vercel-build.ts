import { spawnSync } from "node:child_process";

import { resolveBuildDatabasePlan } from "../lib/deployment/vercel-build";

const NPX_COMMAND = process.platform === "win32" ? "npx.cmd" : "npx";

function runStep(
  label: string,
  args: string[],
  options?: {
    env?: NodeJS.ProcessEnv;
  },
) {
  console.log(`\n[vercel-build] ${label}`);
  const result = spawnSync(NPX_COMMAND, args, {
    stdio: "inherit",
    env: options?.env ?? process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  runStep("Generating Prisma client", ["prisma", "generate"]);

  const plan = resolveBuildDatabasePlan(process.env);

  if (plan.runMigrations) {
    if (!plan.migrationDatabaseUrl) {
      console.error(
        "[vercel-build] Missing DATABASE_URL for build-time migrations.",
      );
      process.exit(1);
    }

    console.log(
      `[vercel-build] Applying Prisma migrations with ${
        plan.usingDirectDatabaseUrl ? "direct" : "default"
      } database URL.`,
    );

    runStep("Applying Prisma migrations", ["prisma", "migrate", "deploy"], {
      env: {
        ...process.env,
        DATABASE_URL: plan.migrationDatabaseUrl,
      },
    });
  } else {
    console.log("[vercel-build] Skipping build-time Prisma migrations.");
  }

  runStep("Running Next.js production build", ["next", "build"]);
}

main();
