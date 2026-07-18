import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@holder-voices/shared", "@holder-voices/database"],
  // better-sqlite3 (via the Prisma adapter) uses a native addon — keep it
  // external to the server bundle rather than letting the bundler try to
  // process the .node binary.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
