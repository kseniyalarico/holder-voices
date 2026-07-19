"use client";

import { useEffect, useMemo, useState } from "react";
import { PollCard, type PollSummary } from "./PollCard";
import { getSeenPollIds, seedSeenPollIdsOnce } from "@/lib/seenPolls";

type SortKey = "newest" | "oldest" | "ending-soon" | "ending-late";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest", label: "Newest created" },
  { value: "oldest", label: "Oldest created" },
  { value: "ending-soon", label: "Deadline: soonest" },
  { value: "ending-late", label: "Deadline: latest" },
];

function sortPolls(polls: PollSummary[], sort: SortKey): PollSummary[] {
  const copy = [...polls];
  const byCreatedAsc = (a: PollSummary, b: PollSummary) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  const byEndsAsc = (a: PollSummary, b: PollSummary) => new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();

  switch (sort) {
    case "newest":
      return copy.sort((a, b) => -byCreatedAsc(a, b));
    case "oldest":
      return copy.sort(byCreatedAsc);
    case "ending-soon":
      return copy.sort(byEndsAsc);
    case "ending-late":
      return copy.sort((a, b) => -byEndsAsc(a, b));
  }
}

const POLL_INTERVAL_MS = 10_000;

export function PollsTabs({ active, completed }: { active: PollSummary[]; completed: PollSummary[] }) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [sort, setSort] = useState<SortKey>("newest");
  const [allPolls, setAllPolls] = useState<PollSummary[]>(() => [...active, ...completed]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    seedSeenPollIdsOnce(allPolls.map((p) => p.pollId));
    setSeenIds(getSeenPollIds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/polls");
        if (!res.ok) return;
        const fresh: PollSummary[] = await res.json();
        setAllPolls(fresh);
      } catch {
        // transient network error — next tick retries
      }
      setSeenIds(getSeenPollIds());
    }

    const id = setInterval(refresh, POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const activePolls = useMemo(() => sortPolls(allPolls.filter((p) => p.isActive), sort), [allPolls, sort]);
  const completedPolls = useMemo(() => sortPolls(allPolls.filter((p) => !p.isActive), sort), [allPolls, sort]);
  const polls = tab === "active" ? activePolls : completedPolls;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-surface-2 pb-2">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setTab("active")}
            className={`-mb-[10px] border-b-4 pb-2 text-2xl font-extrabold uppercase transition ${
              tab === "active" ? "border-success text-success" : "border-transparent text-muted hover:text-accent-strong"
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab("completed")}
            className={`-mb-[10px] border-b-4 pb-2 text-2xl font-extrabold uppercase transition ${
              tab === "completed" ? "border-success text-success" : "border-transparent text-muted hover:text-accent-strong"
            }`}
          >
            Completed
          </button>
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-muted outline-none focus:border-success"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <section className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {polls.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted md:col-span-2 lg:col-span-3">
            {tab === "active" ? "No active proposals yet." : "No completed proposals yet."}
          </p>
        )}
        {polls.map((poll, i) => (
          <PollCard key={poll.pollId} poll={poll} isNew={!seenIds.has(poll.pollId)} featured={i === 0} />
        ))}
      </section>
    </div>
  );
}
