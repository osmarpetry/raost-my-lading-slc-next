import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/server/storage/postgres/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.POSTGRES_URL ?? "postgresql://postgres:postgres@localhost:5432/slc",
  },
});
