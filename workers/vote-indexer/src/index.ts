/**
 * Vote indexer — watches HolderVoices for PollCreated + VoteCast events.
 * PollCreated links a pending PollMetadata row (matched by metadataHash) to
 * its onchain pollId; VoteCast records one IndexedVote row per wallet/poll.
 * Run continuously (`npm run indexer:votes`) or once with a full resync
 * (`npm run indexer:votes -- --full`, wipes IndexedVote/VoteSyncState and
 * replays every log from the contract's deploy block — this alone fully
 * reconstructs vote tallies and poll linkage, since both are idempotent
 * derivations of onchain events).
 */
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { createPublicClient, http, type Address, type Log } from "viem";
import { prisma } from "@holder-voices/database";
import networkConfig from "../../../config/testnet/network.json";

const ROOT = path.resolve(__dirname, "../../..");
const CHUNK_SIZE = 2000n;
const POLL_INTERVAL_MS = 60_000;
const CONFIRMATIONS = BigInt(networkConfig.confirmations ?? 5);
const isFullResync = process.argv.includes("--full");

const POLL_CREATED_EVENT = {
  type: "event",
  name: "PollCreated",
  inputs: [
    { name: "pollId", type: "uint256", indexed: true },
    { name: "author", type: "address", indexed: true },
    { name: "endsAt", type: "uint64", indexed: false },
    { name: "allowedCollectionMask", type: "uint32", indexed: false },
    { name: "metadataHash", type: "bytes32", indexed: false },
  ],
} as const;

const VOTE_CAST_EVENT = {
  type: "event",
  name: "VoteCast",
  inputs: [
    { name: "pollId", type: "uint256", indexed: true },
    { name: "voter", type: "address", indexed: true },
    { name: "choice", type: "uint8", indexed: false },
    { name: "collectionMask", type: "uint32", indexed: false },
    { name: "ownershipCheckedAt", type: "uint64", indexed: false },
  ],
} as const;

function loadDeployment(): { address: Address; deployBlock: bigint } {
  const deploymentPath = path.join(ROOT, "deployments/testnet/holder-voices.json");
  if (fs.existsSync(deploymentPath)) {
    const data = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));
    return { address: data.address as Address, deployBlock: BigInt(data.deployBlock) };
  }
  const address = process.env.HOLDER_VOICES_ADDRESS as Address | undefined;
  const deployBlock = process.env.HOLDER_VOICES_DEPLOY_BLOCK;
  if (!address || !deployBlock) {
    throw new Error(
      "Missing deployments/testnet/holder-voices.json (or HOLDER_VOICES_ADDRESS/HOLDER_VOICES_DEPLOY_BLOCK in .env) — run `npm run deploy:testnet` first."
    );
  }
  return { address, deployBlock: BigInt(deployBlock) };
}

const publicClient = createPublicClient({
  transport: http(process.env.MONAD_TESTNET_RPC_URL ?? networkConfig.rpcUrl),
});

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "P2002";
}

async function handlePollCreated(log: Log & { args: { pollId: bigint; metadataHash: `0x${string}` } }) {
  const { pollId, metadataHash } = log.args;
  const existing = await prisma.pollMetadata.findUnique({ where: { metadataHash } });
  if (!existing) {
    console.warn(`PollCreated pollId=${pollId} has no matching pending metadata (hash ${metadataHash}) — skipping link.`);
    return;
  }
  if (existing.pollId !== null && existing.pollId !== pollId) {
    console.warn(`metadataHash ${metadataHash} already linked to a different pollId — skipping.`);
    return;
  }
  await prisma.pollMetadata.update({
    where: { metadataHash },
    data: { pollId, txHash: log.transactionHash ?? undefined },
  });
  console.log(`Linked poll ${pollId} -> "${existing.title}"`);
}

async function handleVoteCast(
  log: Log & { args: { pollId: bigint; voter: Address; choice: number; collectionMask: number; ownershipCheckedAt: bigint } }
) {
  const { pollId, voter, choice, collectionMask, ownershipCheckedAt } = log.args;
  if (log.transactionHash === null || log.blockNumber === null || log.logIndex === null) return;

  try {
    await prisma.indexedVote.create({
      data: {
        pollId,
        voterAddress: voter.toLowerCase(),
        choice,
        collectionMask,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber: log.blockNumber,
        votedAt: new Date(Number(ownershipCheckedAt) * 1000),
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) return; // already processed this vote/log — no-op
    throw err;
  }
}

async function main() {
  const { address, deployBlock } = loadDeployment();
  console.log(`vote-indexer starting${isFullResync ? " (--full resync)" : " (polling every 60s)"}...`);

  if (isFullResync) {
    await prisma.indexedVote.deleteMany({});
    await prisma.voteSyncState.deleteMany({});
    console.log("[full resync] cleared indexed_votes + vote_sync_state");
  }

  for (;;) {
    const syncState = await prisma.voteSyncState.findUnique({ where: { id: 1 } });
    const fromBlock = syncState ? syncState.lastSyncedBlock + 1n : deployBlock;

    const latestBlock = await publicClient.getBlockNumber();
    const safeTip = latestBlock > CONFIRMATIONS ? latestBlock - CONFIRMATIONS : 0n;

    let cursor = fromBlock;
    while (cursor <= safeTip) {
      const chunkEnd = cursor + CHUNK_SIZE - 1n > safeTip ? safeTip : cursor + CHUNK_SIZE - 1n;

      const logs = await publicClient.getLogs({
        address,
        events: [POLL_CREATED_EVENT, VOTE_CAST_EVENT],
        fromBlock: cursor,
        toBlock: chunkEnd,
      });

      for (const log of logs) {
        if (log.eventName === "PollCreated") {
          await handlePollCreated(log as Parameters<typeof handlePollCreated>[0]);
        } else if (log.eventName === "VoteCast") {
          await handleVoteCast(log as Parameters<typeof handleVoteCast>[0]);
        }
      }

      await prisma.voteSyncState.upsert({
        where: { id: 1 },
        update: { lastSyncedBlock: chunkEnd, lastSyncedAt: new Date() },
        create: { id: 1, lastSyncedBlock: chunkEnd, lastSyncedAt: new Date() },
      });

      console.log(`synced blocks ${cursor}-${chunkEnd} (${logs.length} events)`);
      cursor = chunkEnd + 1n;
    }

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
