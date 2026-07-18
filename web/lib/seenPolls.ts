const SEEN_KEY = "holder-voices:seen-polls";
const INIT_KEY = "holder-voices:seen-polls-initialized";

export function getSeenPollIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function saveSeenPollIds(ids: Set<string>) {
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
}

/**
 * On a browser that has never loaded the poll list before, mark every
 * currently-known poll as already seen. Otherwise every pre-existing poll
 * would show a "NEW" badge on first visit — the badge should only mark
 * polls that appeared after the visitor's first load.
 */
export function seedSeenPollIdsOnce(ids: string[]) {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(INIT_KEY)) return;
  saveSeenPollIds(new Set(ids));
  localStorage.setItem(INIT_KEY, "1");
}

export function markPollSeen(pollId: string) {
  if (typeof window === "undefined") return;
  const seen = getSeenPollIds();
  if (seen.has(pollId)) return;
  seen.add(pollId);
  saveSeenPollIds(seen);
}
