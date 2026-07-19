"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDuration, durationBetween } from "@/lib/format";

export interface PollSummary {
  pollId: string;
  title: string;
  question: string;
  createdAt: string;
  endsAt: string;
  isActive: boolean;
  collections: { id: number; name: string; bitIndex: number }[];
  uniqueVoters: number;
  results: { yes: number; no: number; abstain: number };
}

const pad = (n: number) => String(n).padStart(2, "0");

function useCountdown(endsAt: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const totalSeconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  return {
    hh: pad(Math.floor(totalSeconds / 3600)),
    mm: pad(Math.floor((totalSeconds % 3600) / 60)),
    ss: pad(totalSeconds % 60),
    done: totalSeconds <= 0,
  };
}

function yesShare(results: PollSummary["results"]): number {
  const total = results.yes + results.no + results.abstain;
  return total === 0 ? 0 : Math.round((results.yes / total) * 100);
}

export function PollCard({ poll, isNew, featured }: { poll: PollSummary; isNew?: boolean; featured?: boolean }) {
  const { hh, mm, ss, done } = useCountdown(poll.endsAt);

  if (featured) {
    return (
      <Link
        href={`/polls/${poll.pollId}`}
        className="relative flex min-h-[300px] flex-col justify-between rounded-2xl border border-accent bg-[#6C4FE0] p-6 shadow-[8px_8px_0px_var(--background)] transition-all hover:-translate-y-1 hover:shadow-[12px_12px_0px_var(--background)] md:col-span-2"
      >
        {isNew && (
          <div className="absolute -right-4 -top-4 z-10 -rotate-3 rounded-full border-2 border-background bg-success px-4 py-2 text-xs font-bold uppercase text-black">
            New
          </div>
        )}
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {poll.collections.map((c) => (
              <span key={c.id} className="rounded-full border border-accent bg-surface px-3 py-1 text-xs font-bold text-foreground">
                {c.name}
              </span>
            ))}
          </div>
          <h2 className="mb-6 line-clamp-3 text-2xl font-extrabold text-white">{poll.question}</h2>
        </div>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          {poll.isActive && !done ? (
            <div className="rounded-lg border-2 border-accent bg-surface-2 p-4">
              <div className="mb-1 text-xs font-bold uppercase text-accent">Ends in</div>
              <div className="font-mono text-4xl font-black tracking-tight text-success" suppressHydrationWarning>
                {hh}:{mm}:{ss}
              </div>
            </div>
          ) : (
            <span className="text-sm font-semibold text-white/70">Voting closed</span>
          )}
          <span className="rounded-full border-2 border-accent px-6 py-3 text-sm font-bold uppercase text-accent transition-colors hover:bg-accent hover:text-black">
            Vote now
          </span>
        </div>
      </Link>
    );
  }

  const duration = durationBetween(poll.endsAt);
  const share = yesShare(poll.results);

  return (
    <Link
      href={`/polls/${poll.pollId}`}
      className="flex min-h-[300px] flex-col justify-between rounded-2xl border-2 border-surface-2 bg-surface p-6 transition-colors hover:border-accent"
    >
      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          {poll.collections.slice(0, 2).map((c) => (
            <span key={c.id} className="rounded-full border border-accent bg-surface-2 px-3 py-1 text-xs font-bold text-foreground">
              {c.name}
            </span>
          ))}
        </div>
        <h2 className="mb-6 line-clamp-3 text-lg font-extrabold text-foreground">{poll.question}</h2>
      </div>

      <div className="mt-4">
        <div className="mb-2 h-4 overflow-hidden rounded-full border border-border bg-border">
          <div className="h-full rounded-full bg-success" style={{ width: `${share}%` }} />
        </div>
        <div className="flex justify-between text-xs font-bold">
          <span className="text-success">{share}% YES</span>
          <span className="text-muted">{poll.uniqueVoters} voter{poll.uniqueVoters === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-4 border-t border-border pt-4 text-center text-xs font-bold uppercase text-accent-strong">
          {poll.isActive ? (done ? "Voting ended" : `Ends in ${formatDuration(duration)}`) : "Voting closed"}
        </div>
      </div>
    </Link>
  );
}
