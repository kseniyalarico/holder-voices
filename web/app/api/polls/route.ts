import { type NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { z } from "zod";
import { prisma } from "@holder-voices/database";
import { combineMask, computeMetadataHash } from "@holder-voices/shared";
import { listPolls } from "@/lib/polls";

export async function GET() {
  return NextResponse.json(await listPolls());
}

const CreatePollSchema = z.object({
  title: z.string().trim().min(1).max(200),
  question: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000),
  endsAt: z.string(),
  collectionIds: z.array(z.number().int()).min(1),
  createdBy: z.string(),
});

/**
 * Registers a poll's off-chain text and returns the metadataHash + collectionMask
 * the client must pass to `HolderVoices.createPoll()` from its own connected
 * wallet — this endpoint never submits the on-chain transaction itself. The
 * row starts "pending" (pollId null) and is linked once the vote indexer
 * observes the matching PollCreated event.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = CreatePollSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { title, question, description, endsAt, collectionIds, createdBy } = parsed.data;

  if (!isAddress(createdBy)) {
    return NextResponse.json({ error: "createdBy must be a valid address" }, { status: 400 });
  }

  const endsAtDate = new Date(endsAt);
  if (Number.isNaN(endsAtDate.getTime()) || endsAtDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: "endsAt must be a valid future date" }, { status: 400 });
  }

  const collections = await prisma.collection.findMany({
    where: { id: { in: collectionIds }, isActive: true },
  });
  if (collections.length === 0) {
    return NextResponse.json({ error: "at least one valid collection must be selected" }, { status: 400 });
  }
  const collectionMask = combineMask(collections.map((c) => c.bitIndex));
  const endsAtIso = endsAtDate.toISOString();
  const metadataHash = computeMetadataHash({ title, question, description, endsAt: endsAtIso, collectionMask });

  await prisma.pollMetadata.create({
    data: {
      metadataHash,
      title,
      question,
      description,
      createdBy: createdBy.toLowerCase(),
      endsAt: endsAtDate,
      collectionMask,
    },
  });

  return NextResponse.json({
    metadataHash,
    collectionMask,
    endsAtUnix: Math.floor(endsAtDate.getTime() / 1000).toString(),
  });
}
