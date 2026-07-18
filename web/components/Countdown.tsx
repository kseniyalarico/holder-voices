"use client";

import { useEffect, useState } from "react";
import { durationBetween, formatDuration } from "@/lib/format";

/** Live "Xd Xh Xm left" countdown to `endsAt`, ticking every 30s. */
export function Countdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const duration = durationBetween(endsAt, now);

  if (duration.totalMs <= 0) {
    return (
      <span className={className} suppressHydrationWarning>
        Voting ended
      </span>
    );
  }

  return (
    <span className={className} suppressHydrationWarning>
      {formatDuration(duration)} left
    </span>
  );
}
