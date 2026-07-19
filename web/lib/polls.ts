import { createPublicClient, http } from "viem";
import { prisma } from "@holder-voices/database";
import { bitsInMask, HOLDER_VOICES_ABI } from "@holder-voices/shared";
import { env } from "./env";
import { holderVoicesAddress } from "./contracts";
import { isPollActive } from "./eligibility";

export async function listPolls() {
  const polls = await prisma.pollMetadata.findMany({
    where: { pollId: { not: null } },
    orderBy: { endsAt: "desc" },
  });

  const collections = await prisma.collection.findMany({ where: { isActive: true } });
  const collectionByBit = new Map(collections.map((c) => [c.bitIndex, c]));

  return Promise.all(
    polls.map(async (poll) => {
      const votes = await prisma.indexedVote.findMany({ where: { pollId: poll.pollId! }, select: { choice: true } });
      const results = { yes: 0, no: 0, abstain: 0 };
      for (const v of votes) {
        if (v.choice === 0) results.yes += 1;
        else if (v.choice === 1) results.no += 1;
        else results.abstain += 1;
      }
      const targetCollections = bitsInMask(poll.collectionMask)
        .map((bit) => collectionByBit.get(bit))
        .filter((c): c is NonNullable<typeof c> => Boolean(c))
        .map((c) => ({ id: c.id, name: c.name, bitIndex: c.bitIndex }));

      return {
        pollId: poll.pollId!.toString(),
        title: poll.title,
        question: poll.question,
        createdBy: poll.createdBy,
        createdAt: poll.createdAt.toISOString(),
        endsAt: poll.endsAt.toISOString(),
        isActive: poll.endsAt.getTime() > Date.now(),
        collections: targetCollections,
        uniqueVoters: votes.length,
        results,
      };
    })
  );
}

export type PollDetail = NonNullable<Awaited<ReturnType<typeof getPollDetail>>>;

export async function getPollDetail(pollId: bigint, wallet?: string | null) {
  const metadata = await prisma.pollMetadata.findUnique({ where: { pollId } });
  if (!metadata) return null;

  const collections = await prisma.collection.findMany({ where: { isActive: true } });
  const collectionByBit = new Map(collections.map((c) => [c.bitIndex, c]));
  const targetBits = bitsInMask(metadata.collectionMask);
  const targetCollections = targetBits
    .map((bit) => collectionByBit.get(bit))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  let results = { yes: 0, no: 0, abstain: 0, uniqueVoters: 0 };
  let onchainSyncError = false;
  try {
    const publicClient = createPublicClient({ transport: http(env.rpcUrl()) });
    const onchainPoll = await publicClient.readContract({
      address: holderVoicesAddress(),
      abi: HOLDER_VOICES_ABI,
      functionName: "getPoll",
      args: [pollId],
    });
    results = {
      yes: Number(onchainPoll.yesCount),
      no: Number(onchainPoll.noCount),
      abstain: Number(onchainPoll.abstainCount),
      uniqueVoters: Number(onchainPoll.uniqueVoters),
    };
  } catch {
    onchainSyncError = true;
  }

  const votes = await prisma.indexedVote.findMany({ where: { pollId } });
  const perCollection: Record<string, { yes: number; no: number; abstain: number; total: number }> = {};
  for (const bit of targetBits) {
    const collection = collectionByBit.get(bit);
    if (collection) perCollection[collection.name] = { yes: 0, no: 0, abstain: 0, total: 0 };
  }
  for (const v of votes) {
    for (const bit of bitsInMask(v.collectionMask)) {
      const collection = collectionByBit.get(bit);
      if (!collection || !(collection.name in perCollection)) continue;
      const stats = perCollection[collection.name];
      stats.total += 1;
      if (v.choice === 0) stats.yes += 1;
      else if (v.choice === 1) stats.no += 1;
      else stats.abstain += 1;
    }
  }

  let heldCollections: { id: number; name: string; bitIndex: number }[] = [];
  let collectionMask = 0;
  let hasVoted = false;
  if (wallet) {
    const { computeEligibility } = await import("./eligibility");
    const eligibility = await computeEligibility(wallet, pollId);
    if (eligibility) {
      heldCollections = eligibility.heldCollections;
      collectionMask = eligibility.collectionMask;
    }
    try {
      const publicClient = createPublicClient({ transport: http(env.rpcUrl()) });
      hasVoted = await publicClient.readContract({
        address: holderVoicesAddress(),
        abi: HOLDER_VOICES_ABI,
        functionName: "hasVoted",
        args: [pollId, wallet as `0x${string}`],
      });
    } catch {
      // onchainSyncError already reflects contract-read issues from the getPoll() call above
    }
  }

  return {
    pollId: pollId.toString(),
    title: metadata.title,
    question: metadata.question,
    description: metadata.description,
    createdBy: metadata.createdBy,
    createdAt: metadata.createdAt.toISOString(),
    endsAt: metadata.endsAt.toISOString(),
    isActive: isPollActive(metadata),
    collections: targetCollections.map((c) => ({ id: c.id, name: c.name, bitIndex: c.bitIndex })),
    results,
    onchainSyncError,
    perCollection,
    eligibility: { collectionMask, heldCollections },
    hasVoted,
  };
}
