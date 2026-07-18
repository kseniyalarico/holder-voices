import Link from "next/link";
import { ConnectButton } from "@/components/ConnectButton";
import { PollsTabs } from "@/components/PollsTabs";
import { listPolls } from "@/lib/polls";

export default async function HomePage() {
  const polls = await listPolls();
  const active = polls.filter((p) => p.isActive);
  const completed = polls.filter((p) => !p.isActive);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Holder Voices</h1>
          <p className="mt-1 text-sm text-accent-strong">One proposal. Many communities.</p>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Public onchain voting for NFT holders across Monad. Connect a wallet, and Holder
            Voices automatically finds which supported NFT communities you belong to — vote
            once, and it counts toward every community you hold.
          </p>
        </div>
        <ConnectButton />
      </header>

      <div className="flex items-center justify-end">
        <Link
          href="/polls/new"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition hover:border-accent"
        >
          Create poll
        </Link>
      </div>

      <PollsTabs active={active} completed={completed} />
    </div>
  );
}
