import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@holder-voices/database";
import { bitsInMask } from "@holder-voices/shared";

export async function GET(request: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const { pollId: pollIdParam } = await params;

  let pollId: bigint;
  try {
    pollId = BigInt(pollIdParam);
  } catch {
    return NextResponse.json({ error: "invalid pollId" }, { status: 400 });
  }

  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? "20")));

  const [votes, total] = await Promise.all([
    prisma.indexedVote.findMany({
      where: { pollId },
      orderBy: { votedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.indexedVote.count({ where: { pollId } }),
  ]);

  const collections = await prisma.collection.findMany({ where: { isActive: true } });
  const collectionByBit = new Map(collections.map((c) => [c.bitIndex, c]));

  return NextResponse.json({
    page,
    pageSize,
    total,
    votes: votes.map((v) => ({
      voter: v.voterAddress,
      choice: v.choice,
      collections: bitsInMask(v.collectionMask)
        .map((bit) => collectionByBit.get(bit)?.name)
        .filter((name): name is string => Boolean(name)),
      txHash: v.txHash,
      votedAt: v.votedAt.toISOString(),
    })),
  });
}
