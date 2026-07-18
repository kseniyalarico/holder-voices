import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Root-level .env is the single source of truth for the whole monorepo
// (Vercel injects DATABASE_URL directly, so this is a no-op there).
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
