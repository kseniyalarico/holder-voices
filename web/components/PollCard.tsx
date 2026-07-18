import Link from "next/link";

export interface PollSummary {
  pollId: string;
  title: string;
  question: string;
  endsAt: string;
  isActive: boolean;
  collections: { id: number; name: string; bitIndex: number }[];
  uniqueVoters: number;
}

export function PollCard({ poll }: { poll: PollSummary }) {
  return (
    <Link
      href={`/polls/${poll.pollId}`}
      className="block rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium text-foreground">{poll.question}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            poll.isActive ? "bg-success/15 text-success" : "bg-border text-muted"
          }`}
        >
          {poll.isActive ? "Voting open" : "Voting closed"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {poll.collections.map((c) => (
          <span key={c.id} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
            {c.name}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span>{poll.uniqueVoters} unique voter{poll.uniqueVoters === 1 ? "" : "s"}</span>
        <span>Ends {new Date(poll.endsAt).toLocaleString()}</span>
      </div>
    </Link>
  );
}
