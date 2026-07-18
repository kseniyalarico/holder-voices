import path from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "../generated/client";

// Root-level .env is the single source of truth for the whole monorepo.
// Loaded here too so this package works standalone (e.g. invoked directly by
// the indexer workers), not only when a consumer has already loaded it.
// On Vercel, DATABASE_URL is already injected — this is a harmless no-op there.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "../generated/client";
