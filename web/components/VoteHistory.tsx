"use client";

import { useEffect, useState } from "react";
import { Choice, CHOICE_LABELS } from "@holder-voices/shared";
import { shortAddress, explorerTxUrl, formatDateUTC } from "@/lib/format";

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
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">Vote history</h2>
      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {votes.map((v) => (
          <div key={v.txHash} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
            <span className="font-mono text-xs">{shortAddress(v.voter)}</span>
            <span className="text-xs text-muted">{v.collections.join(", ")}</span>
            <span className="font-medium">{CHOICE_LABELS[v.choice]}</span>
            <span className="text-xs text-muted">{formatDateUTC(v.votedAt)}</span>
            <a
              href={explorerTxUrl(v.txHash)}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-strong hover:underline"
            >
              view tx
            </a>
          </div>
        ))}
      </div>
      {votes.length < total && (
        <button
          type="button"
          onClick={() => setPage((p) => p + 1)}
          className="self-start text-xs text-muted hover:text-foreground"
        >
          Load more
        </button>
      )}
    </section>
  );
}
