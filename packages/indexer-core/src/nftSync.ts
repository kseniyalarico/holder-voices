import { type Address, type GetLogsReturnType } from "viem";
import { prisma } from "@holder-voices/database";
import { CHUNK_SIZE, CONFIRMATIONS, getPublicClient, throttleChunk } from "./network";

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

type TransferLogs = GetLogsReturnType<typeof TRANSFER_EVENT>;

interface CollectionRow {
  id: number;
  name: string;
  contractAddress: string;
  startBlock: bigint;
}

async function resyncCollectionIfRequested(collectionId: number, full: boolean) {
  if (!full) return;
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

async function syncCollection(collection: CollectionRow, full: boolean) {
  const publicClient = getPublicClient();
  await resyncCollectionIfRequested(collection.id, full);

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
    if (cursor <= safeTip) await throttleChunk();
  }
}

export interface NftSyncOptions {
  /** Wipes holders + sync state for every active collection and replays from startBlock. */
  full?: boolean;
}

/** One pass over every active Collection — safe to call repeatedly (poll loop or cron tick). */
export async function runNftSyncPass(options: NftSyncOptions = {}): Promise<void> {
  const collections = await prisma.collection.findMany({ where: { isActive: true } });
  if (collections.length === 0) {
    console.warn("No active collections in DB — run `npm run seed:collections` after deploying.");
    return;
  }
  for (const collection of collections) {
    try {
      await syncCollection(collection, options.full ?? false);
    } catch (err) {
      console.error(`[${collection.name}] sync error:`, err);
    }
  }
}
