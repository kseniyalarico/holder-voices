/**
 * NFT ownership indexer CLI — thin wrapper around the reusable sync pass in
 * @holder-voices/indexer-core (also used by web/app/api/cron/nft-indexer for
 * hosted deployments). Run continuously (`npm run indexer:nft`) or once with
 * a full resync (`npm run indexer:nft -- --full`).
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { prisma } from "@holder-voices/database";
import { runNftSyncPass } from "@holder-voices/indexer-core";

const POLL_INTERVAL_MS = 10_000;
const isFullResync = process.argv.includes("--full");

async function main() {
  console.log(`nft-indexer starting${isFullResync ? " (--full resync)" : " (polling every 10s)"}...`);
  for (;;) {
    await runNftSyncPass({ full: isFullResync });
    if (isFullResync) {
      console.log("Full resync pass complete, exiting.");
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
