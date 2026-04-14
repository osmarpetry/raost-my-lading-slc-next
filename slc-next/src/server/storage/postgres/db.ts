import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "@/server/storage/postgres/schema";

export function createPostgresPool(url: string) {
  return new Pool({ connectionString: url });
}

export function createPostgresDb(pool: Pool) {
  return drizzle(pool, { schema });
}

export type PostgresDb = ReturnType<typeof createPostgresDb>;
