import { type NextRequest, NextResponse } from "next/server";
import { getPollDetail } from "@/lib/polls";

export async function GET(request: NextRequest, { params }: { params: Promise<{ pollId: string }> }) {
  const { pollId: pollIdParam } = await params;

  let pollId: bigint;
  try {
    pollId = BigInt(pollIdParam);
  } catch {
    return NextResponse.json({ error: "invalid pollId" }, { status: 400 });
  }

  const wallet = request.nextUrl.searchParams.get("wallet");
  const detail = await getPollDetail(pollId, wallet);
  if (!detail) {
    return NextResponse.json({ error: "poll not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
