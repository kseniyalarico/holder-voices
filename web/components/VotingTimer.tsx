"use client";

import { useEffect, useState } from "react";

function remaining(endsAt: string, now: number) {
  const totalSeconds = Math.max(0, Math.floor((new Date(endsAt).getTime() - now) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, done: totalSeconds <= 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Big boxed HRS:MIN:SEC countdown, ticking every second. */
export function VotingTimer({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { hours, minutes, seconds, done } = remaining(endsAt, now);

  return (
    <div className="flex -rotate-1 flex-col items-center justify-center rounded-2xl border-2 border-success bg-background p-6 transition-transform hover:rotate-0">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-accent">
        {done ? "Voting ended" : "Voting ends in"}
      </div>
      {!done && (
        <div className="flex items-center gap-4 text-center text-4xl font-black text-success" suppressHydrationWarning>
          <div>
            <span>{pad(hours)}</span>
            <div className="mt-1 text-xs font-bold text-accent">HRS</div>
          </div>
          <span className="text-accent">:</span>
          <div>
            <span>{pad(minutes)}</span>
            <div className="mt-1 text-xs font-bold text-accent">MIN</div>
          </div>
          <span className="text-accent">:</span>
          <div>
            <span>{pad(seconds)}</span>
            <div className="mt-1 text-xs font-bold text-accent">SEC</div>
          </div>
        </div>
      )}
    </div>
  );
}
