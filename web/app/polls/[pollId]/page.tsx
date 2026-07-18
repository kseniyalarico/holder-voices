import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { PollView } from "@/components/PollView";
import { getPollDetail } from "@/lib/polls";

export const dynamic = "force-dynamic";

export default async function PollPage({ params }: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await params;

  let id: bigint;
  try {
    id = BigInt(pollId);
  } catch {
    notFound();
  }

  const poll = await getPollDetail(id, null);
  if (!poll) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          ← Holder Voices
        </Link>
        <ConnectButton />
      </header>
      <PollView pollId={pollId} initialData={poll} />
    </div>
  );
}
