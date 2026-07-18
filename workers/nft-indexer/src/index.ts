/**
 * NFT ownership indexer — polls Transfer events for every active Collection
 * in the DB, keeps CollectionHolder balances (and CollectionSyncState cursors)
 * up to date. Run continuously (`npm run indexer:nft`) or once with a full
 * resync (`npm run indexer:nft -- --full`, wipes + replays from startBlock).
 */
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createPublicClient, http, type Address, type GetLogsReturnType } from "viem";
import { prisma } from "@holder-voices/database";
import networkConfig from "../../../config/testnet/network.json";

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "tokenId", type: "uint256", indexed: true },
  ],
} as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// The public testnet-rpc.monad.xyz endpoint hard-caps eth_getLogs at a
// 100-block range ("eth_getLogs is limited to a 100 range") — chunk to match.
const CHUNK_SIZE = 100n;
const POLL_INTERVAL_MS = 60_000;
const CONFIRMATIONS = BigInt(networkConfig.confirmations ?? 5);
const isFullResync = process.argv.includes("--full");

const publicClient = createPublicClient({
  transport: http(process.env.MONAD_TESTNET_RPC_URL ?? networkConfig.rpcUrl),
});

type TransferLogs = GetLogsReturnType<typeof TRANSFER_EVENT>;

interface CollectionRow {
  id: number;
  name: string;
  contractAddress: string;
  startBlock: bigint;
}

async function resyncCollectionIfRequested(collectionId: number) {
  if (!isFullResync) return;
  await prisma.collectionHolder.deleteMany({ where: { collectionId } });
  await prisma.collectionSyncState.deleteMany({ where: { collectionId } });
  console.log(`[full resync] cleared holders + sync state for collection ${collectionId}`);
}

async function adjustBalance(collectionId: number, wallet: Address, delta: number, blockNumber: bigint) {
  const walletAddress = wallet.toLowerCase();
  const existing = await prisma.collectionHolder.findUnique({
    where: { collectionId_walletAddress: { collectionId, walletAddress } },
  });
  const newBalance = Math.max(0, (existing?.tokenBalance ?? 0) + delta);

  await prisma.collectionHolder.upsert({
    where: { collectionId_walletAddress: { collectionId, walletAddress } },
    update: { tokenBalance: newBalance, lastUpdatedBlock: blockNumber },
    create: { collectionId, walletAddress, tokenBalance: newBalance, lastUpdatedBlock: blockNumber },
  });
}

async function applyTransfers(collectionId: number, logs: TransferLogs) {
  // Sequential on purpose: keeps balance read-then-write per wallet race-free
  // without needing a DB transaction, and log order within a chunk matters
  // (a mint immediately followed by a transfer must apply in that order).
  for (const log of logs) {
    const { from, to } = log.args;
    const blockNumber = log.blockNumber;
    if (!from || !to || blockNumber === null) continue;

    if (from.toLowerCase() !== ZERO_ADDRESS) {
      await adjustBalance(collectionId, from, -1, blockNumber);
    }
    if (to.toLowerCase() !== ZERO_ADDRESS) {
      await adjustBalance(collectionId, to, 1, blockNumber);
    }
  }
}

async function syncCollection(collection: CollectionRow) {
  await resyncCollectionIfRequested(collection.id);

  const syncState = await prisma.collectionSyncState.findUnique({ where: { collectionId: collection.id } });
  const fromBlock = syncState ? syncState.lastSyncedBlock + 1n : collection.startBlock;

  const latestBlock = await publicClient.getBlockNumber();
  const safeTip = latestBlock > CONFIRMATIONS ? latestBlock - CONFIRMATIONS : 0n;
  if (fromBlock > safeTip) return;

  let cursor = fromBlock;
  while (cursor <= safeTip) {
    const chunkEnd = cursor + CHUNK_SIZE - 1n > safeTip ? safeTip : cursor + CHUNK_SIZE - 1n;

    const logs = await publicClient.getLogs({
      address: collection.contractAddress as Address,
      event: TRANSFER_EVENT,
      fromBlock: cursor,
      toBlock: chunkEnd,
    });

    await applyTransfers(collection.id, logs);

    await prisma.collectionSyncState.upsert({
      where: { collectionId: collection.id },
      update: { lastSyncedBlock: chunkEnd, lastSyncedAt: new Date() },
      create: { collectionId: collection.id, lastSyncedBlock: chunkEnd, lastSyncedAt: new Date() },
    });

    console.log(`[${collection.name}] synced blocks ${cursor}-${chunkEnd} (${logs.length} transfers)`);
    cursor = chunkEnd + 1n;
  }
}

async function syncAllCollections() {
  const collections = await prisma.collection.findMany({ where: { isActive: true } });
  if (collections.length === 0) {
    console.warn("No active collections in DB — run `npm run seed:collections` after deploying.");
    return;
  }
  for (const collection of collections) {
    try {
      await syncCollection(collection);
    } catch (err) {
      console.error(`[${collection.name}] sync error:`, err);
    }
  }
}

async function main() {
  console.log(`nft-indexer starting${isFullResync ? " (--full resync)" : " (polling every 60s)"}...`);
  for (;;) {
    await syncAllCollections();
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
