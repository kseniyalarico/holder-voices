import { type NextRequest, NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { prisma } from "@holder-voices/database";
import { computeEligibility, isPollActive } from "@/lib/eligibility";
import { signEligibilityProof, generateNonce } from "@/lib/eip712-signer";

const PROOF_TTL_SECONDS = 5 * 60;

/**
 * Issues a signed EligibilityProof for `HolderVoices.vote()`. This is the
 * only place a wallet's collectionMask is turned into something the
 * frontend can pass to the contract — the frontend itself never constructs
 * or chooses this value (spec: "frontend is not the source of truth").
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const wallet = body?.wallet as string | undefined;
  const pollIdRaw = body?.pollId as string | number | undefined;

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "wallet must be a valid address" }, { status: 400 });
  }
  if (pollIdRaw === undefined || pollIdRaw === null) {
    return NextResponse.json({ error: "pollId is required" }, { status: 400 });
  }

  let pollId: bigint;
  try {
    pollId = BigInt(pollIdRaw);
  } catch {
    return NextResponse.json({ error: "pollId must be an integer" }, { status: 400 });
  }

  const result = await computeEligibility(wallet, pollId);
  if (!result) {
    return NextResponse.json({ error: "poll not found" }, { status: 404 });
  }
  if (!isPollActive(result.poll)) {
    return NextResponse.json({ error: "poll is not active" }, { status: 403 });
  }
  if (result.collectionMask === 0) {
    return NextResponse.json(
      { error: "wallet does not hold any collection eligible for this poll" },
      { status: 403 }
    );
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const ownershipCheckedAt = BigInt(nowSeconds);
  const expiresAt = BigInt(nowSeconds + PROOF_TTL_SECONDS);
  const nonce = generateNonce();

  await prisma.eligibilityNonce.create({
    data: {
      nonce: nonce.toString(),
      walletAddress: wallet.toLowerCase(),
      pollId,
      collectionMask: result.collectionMask,
      expiresAt: new Date(nowSeconds * 1000 + PROOF_TTL_SECONDS * 1000),
    },
  });

  const signature = await signEligibilityProof({
    pollId,
    voter: wallet as Address,
    collectionMask: result.collectionMask,
    ownershipCheckedAt,
    expiresAt,
    nonce,
  });

  return NextResponse.json({
    pollId: pollId.toString(),
    voter: wallet,
    collectionMask: result.collectionMask,
    ownershipCheckedAt: ownershipCheckedAt.toString(),
    expiresAt: expiresAt.toString(),
    nonce: nonce.toString(),
    signature,
  });
}
