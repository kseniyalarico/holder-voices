/**
 * Upserts the `Collection` DB rows from deployments/testnet/collections.json
 * (written by `forge script DeployCollections`). Run once after deploying the
 * three test collections, and again any time collections.json changes.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

import { prisma } from "@holder-voices/database";

interface CollectionEntry {
  name: string;
  bitIndex: number;
  startBlock: number;
  address: string;
}

interface CollectionsDeployment {
  collectionA: CollectionEntry;
  collectionB: CollectionEntry;
  collectionC: CollectionEntry;
}

async function main() {
  const deploymentPath = path.join(ROOT, "deployments/testnet/collections.json");
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Missing ${deploymentPath} — run \`npm run deploy:test-collections\` first.`);
  }
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8")) as CollectionsDeployment;

  for (const entry of [deployment.collectionA, deployment.collectionB, deployment.collectionC]) {
    await prisma.collection.upsert({
      where: { bitIndex: entry.bitIndex },
      update: {
        name: entry.name,
        contractAddress: entry.address,
        startBlock: BigInt(entry.startBlock),
        isActive: true,
      },
      create: {
        name: entry.name,
        contractAddress: entry.address,
        bitIndex: entry.bitIndex,
        startBlock: BigInt(entry.startBlock),
        isActive: true,
      },
    });
    console.log(`Seeded ${entry.name} (bit ${entry.bitIndex}) -> ${entry.address}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
