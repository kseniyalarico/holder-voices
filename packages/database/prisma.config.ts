import path from "node:path";
import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

// Root-level .env is the single source of truth for the whole monorepo.
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Anchor on this file's own directory (packages/database), not process.cwd(),
// so `prisma migrate` always targets the same file regardless of where it's invoked from.
const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const databaseUrl = rawUrl.startsWith("file:")
  ? `file:${path.resolve(__dirname, path.basename(rawUrl.slice("file:".length)))}`
  : rawUrl;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
