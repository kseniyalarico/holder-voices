import { type NextRequest, NextResponse } from "next/server";
import { runNftSyncPass } from "@holder-voices/indexer-core";

// Generous ceiling for a hosted single sync pass — actual runtime is normally
// well under this once caught up (only a handful of 100-block RPC chunks).
export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * One NFT-ownership sync pass, meant to be called on a schedule (Vercel Cron
 * or an external scheduler such as GitHub Actions — see .github/workflows).
 * Same underlying logic as `npm run indexer:nft`, just one pass per call
 * instead of an infinite poll loop.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runNftSyncPass();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("nft-indexer cron pass failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "sync failed" }, { status: 500 });
  }
}
