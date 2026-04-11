import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./frontend/lib/schema/index.ts",
  out: "./migrations/v2",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres",
  },
});
