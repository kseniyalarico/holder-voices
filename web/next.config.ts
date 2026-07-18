import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@holder-voices/shared", "@holder-voices/database", "@holder-voices/indexer-core"],
};

export default nextConfig;
