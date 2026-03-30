import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "";
const isPg = databaseUrl.startsWith("postgres");

export default defineConfig(
  isPg
    ? {
        schema: "./src/db/schema.ts",
        out: "./drizzle",
        dialect: "postgresql",
        dbCredentials: {
          url: databaseUrl,
        },
      }
    : {
        schema: "./src/db/schema-sqlite.ts",
        out: "./drizzle-sqlite",
        dialect: "sqlite",
        dbCredentials: {
          url: "./local.db",
        },
      }
);
