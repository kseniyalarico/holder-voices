import { type NextRequest, NextResponse } from "next/server";
import { runVoteSyncPass } from "@holder-voices/indexer-core";

export const maxDuration = 60;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * One vote-indexer sync pass (PollCreated + VoteCast), meant to be called on
 * a schedule (Vercel Cron or an external scheduler — see .github/workflows).
 * Same underlying logic as `npm run indexer:votes`, one pass per call.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await runVoteSyncPass();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("vote-indexer cron pass failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "sync failed" }, { status: 500 });
  }
}
