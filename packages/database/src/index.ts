import path from "node:path";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client";

// Root-level .env is the single source of truth for the whole monorepo.
// Loaded here too so this package works standalone (e.g. invoked directly by
// the indexer workers), not only when a consumer has already loaded it.
// On Vercel, DATABASE_URL is already injected — this is a harmless no-op there.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Prisma 7's generated "client" engine always requires an explicit adapter
  // (no implicit env-var-only connection, even for Postgres).
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/client";
