import { notFound } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
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
    <div className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-background">
      <NavBar />
      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <PollView pollId={pollId} initialData={poll} />
      </div>
      <Footer />
    </div>
  );
}
