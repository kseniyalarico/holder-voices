import path from "node:path";
import dotenv from "dotenv";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/client";

// Root-level .env is the single source of truth for the whole monorepo.
// Loaded here too so this package works standalone (e.g. invoked directly by
// the indexer workers), not only when a consumer has already loaded it.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

/**
 * Every workspace (web/, workers/*) sets DATABASE_URL to some `file:...`
 * variant of "dev.db" in its own .env, but each workspace's relative path is
 * only meaningful from that workspace's own directory. Rather than trust the
 * directory portion, anchor on the filename and always resolve it against
 * this package's own root (packages/database/dev.db — where `prisma migrate`,
 * run from this package, creates it per prisma.config.ts) — so the SQLite
 * file location never depends on the caller's cwd.
 */
function resolveSqliteUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("file:")) return rawUrl;
  const relativePath = rawUrl.slice("file:".length);
  if (path.isAbsolute(relativePath)) return rawUrl;
  const filename = path.basename(relativePath);
  const absolutePath = path.resolve(__dirname, "..", filename);
  return `file:${absolutePath}`;
}

const databaseUrl = resolveSqliteUrl(process.env.DATABASE_URL ?? "file:./dev.db");

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/client";
