"use client";

import { useEffect, useState } from "react";
import { Choice, CHOICE_LABELS } from "@holder-voices/shared";
import { shortAddress, explorerTxUrl, timeAgo } from "@/lib/format";

const CHOICE_TEXT_COLOR: Record<Choice, string> = {
  [Choice.Yes]: "text-success",
  [Choice.No]: "text-[#ff007f]",
  [Choice.Abstain]: "text-accent-strong",
};

interface VoteEntry {
  voter: string;
  choice: Choice;
  collections: string[];
  txHash: string;
  votedAt: string;
}

const PAGE_SIZE = 20;

export function VoteHistory({ pollId }: { pollId: string }) {
  const [votes, setVotes] = useState<VoteEntry[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch(`/api/polls/${pollId}/votes?page=${page}&pageSize=${PAGE_SIZE}`)
      .then((r) => r.json())
      .then((data) => {
        setVotes((prev) => (page === 1 ? data.votes : [...prev, ...data.votes]));
        setTotal(data.total);
      })
      .catch(() => {});
  }, [pollId, page]);

  if (total === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-4 text-xs font-bold uppercase tracking-wide text-foreground">Live feed</h2>
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto pr-1">
        {votes.map((v) => (
          <a
            key={v.txHash}
            href={explorerTxUrl(v.txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 text-sm transition hover:border-accent"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[10px] text-muted">
                {v.voter.slice(2, 4).toUpperCase()}
              </span>
              <div>
                <div className="font-mono text-xs text-foreground">{shortAddress(v.voter)}</div>
                <div className="text-[11px] text-muted">{timeAgo(v.votedAt)}</div>
              </div>
            </div>
            <span className={`text-xs font-bold uppercase ${CHOICE_TEXT_COLOR[v.choice]}`}>
              {CHOICE_LABELS[v.choice]}
            </span>
          </a>
        ))}
      </div>
      {votes.length < total && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="mt-3 self-start text-xs text-muted hover:text-foreground"
        >
          Load more
        </button>
      )}
    </section>
  );
}
