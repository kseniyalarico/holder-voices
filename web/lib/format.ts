export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** All dates in this app are shown in UTC — Holder Voices has no per-user timezone setting. */
export function formatDateUTC(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
  totalMs: number;
}

/** Absolute time span between `target` and `from` (defaults to now) — sign kept in `totalMs`. */
export function durationBetween(target: string | Date, from: number = Date.now()): Duration {
  const targetMs = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const totalMs = targetMs - from;
  const totalMinutes = Math.floor(Math.abs(totalMs) / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  return { days, hours, minutes, totalMs };
}

export function formatDuration(d: Duration): string {
  const parts: string[] = [];
  if (d.days > 0) parts.push(`${d.days}d`);
  if (d.days > 0 || d.hours > 0) parts.push(`${d.hours}h`);
  parts.push(`${d.minutes}m`);
  return parts.join(" ");
}

/** Short relative time ("2 mins ago", "3h ago") for feeds — not for absolute timestamps. */
export function timeAgo(iso: string, from: number = Date.now()): string {
  const ms = from - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const EXPLORER_BASE = process.env.NEXT_PUBLIC_MONADVISION_URL ?? "https://testnet.monadvision.com";

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}
