import "dotenv/config";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { getServerEnv } from "@/server/config/env";
import { createPostgresDb, createPostgresPool } from "@/server/storage/postgres/db";

async function main() {
  const env = getServerEnv();

  if (!env.postgres.url) {
    throw new Error("POSTGRES_URL missing");
  }

  const pool = createPostgresPool(env.postgres.url);

  try {
    const db = createPostgresDb(pool);
    await migrate(db, {
      migrationsFolder: "drizzle",
    });
  } finally {
    await pool.end();
  }
}

void main().catch((error) => {
  console.error("[drizzle] migrate failed", error);
  process.exit(1);
});
