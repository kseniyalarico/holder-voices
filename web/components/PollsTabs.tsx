"use client";

import { useState } from "react";
import { PollCard, type PollSummary } from "./PollCard";

export function PollsTabs({ active, completed }: { active: PollSummary[]; completed: PollSummary[] }) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const polls = tab === "active" ? active : completed;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 text-sm">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`flex-1 rounded-md px-3 py-1.5 transition ${
            tab === "active" ? "bg-accent text-black font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          Active ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`flex-1 rounded-md px-3 py-1.5 transition ${
            tab === "completed" ? "bg-accent text-black font-medium" : "text-muted hover:text-foreground"
          }`}
        >
          Completed ({completed.length})
        </button>
      </div>

      <section className="flex flex-col gap-3">
        {polls.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {tab === "active" ? "No active proposals yet." : "No completed proposals yet."}
          </p>
        )}
        {polls.map((poll) => (
          <PollCard key={poll.pollId} poll={poll} />
        ))}
      </section>
    </div>
  );
}
