import { type NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { computeEligibility } from "@/lib/eligibility";

/**
 * Read-only eligibility check — no signature involved, safe to call as soon
 * as a wallet connects, purely to drive UI ("You can vote as a holder of...").
 * The binding, signature-producing check is POST /api/eligibility/sign.
 */
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get("wallet");
  const pollIdParam = request.nextUrl.searchParams.get("pollId");

  if (!wallet || !isAddress(wallet)) {
    return NextResponse.json({ error: "wallet query param must be a valid address" }, { status: 400 });
  }
  if (!pollIdParam) {
    return NextResponse.json({ error: "pollId query param is required" }, { status: 400 });
  }

  let pollId: bigint;
  try {
    pollId = BigInt(pollIdParam);
  } catch {
    return NextResponse.json({ error: "pollId must be an integer" }, { status: 400 });
  }

  const result = await computeEligibility(wallet, pollId);
  if (!result) {
    return NextResponse.json({ error: "poll not found" }, { status: 404 });
  }

  return NextResponse.json({
    pollId: pollId.toString(),
    collections: result.heldCollections,
    collectionMask: result.collectionMask,
    checkedAt: new Date().toISOString(),
    syncedBlock: result.minSyncedBlock?.toString() ?? null,
  });
}
