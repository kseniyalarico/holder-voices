import { prisma } from "@holder-voices/database";
import { bitsInMask, combineMask } from "@holder-voices/shared";

export async function findPollByPollId(pollId: bigint) {
  return prisma.pollMetadata.findUnique({ where: { pollId } });
}

export function isPollActive(poll: { endsAt: Date }): boolean {
  return poll.endsAt.getTime() > Date.now();
}

export interface EligibilityResult {
  poll: NonNullable<Awaited<ReturnType<typeof findPollByPollId>>>;
  heldCollections: { id: number; name: string; bitIndex: number }[];
  collectionMask: number;
  minSyncedBlock: bigint | null;
}

/**
 * Restricted to the poll's own allowedCollectionMask — a wallet holding a
 * collection outside the poll's target set never contributes to its mask.
 */
export async function computeEligibility(walletAddress: string, pollId: bigint): Promise<EligibilityResult | null> {
  const poll = await findPollByPollId(pollId);
  if (!poll) return null;

  const allowedBits = bitsInMask(poll.collectionMask);
  const collections = await prisma.collection.findMany({
    where: { bitIndex: { in: allowedBits }, isActive: true },
    include: { syncState: true },
  });

  if (collections.length === 0) {
    return { poll, heldCollections: [], collectionMask: 0, minSyncedBlock: null };
  }

  const wallet = walletAddress.toLowerCase();
  const holderRows = await prisma.collectionHolder.findMany({
    where: {
      walletAddress: wallet,
      tokenBalance: { gt: 0 },
      collectionId: { in: collections.map((c) => c.id) },
    },
  });
  const heldIds = new Set(holderRows.map((h) => h.collectionId));
  const heldCollections = collections.filter((c) => heldIds.has(c.id));
  const collectionMask = combineMask(heldCollections.map((c) => c.bitIndex));

  const syncedBlocks = collections
    .map((c) => c.syncState?.lastSyncedBlock)
    .filter((b): b is bigint => b !== undefined && b !== null);
  const minSyncedBlock = syncedBlocks.length > 0 ? syncedBlocks.reduce((a, b) => (a < b ? a : b)) : null;

  return {
    poll,
    heldCollections: heldCollections.map((c) => ({ id: c.id, name: c.name, bitIndex: c.bitIndex })),
    collectionMask,
    minSyncedBlock,
  };
}
