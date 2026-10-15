// P9: close the loop between a prime's intention and the after-meeting rating.
export type IntentOutcome = "yes" | "partly" | "no";

export const INTENT_OUTCOMES: { value: IntentOutcome; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "partly", label: "Partly" },
  { value: "no", label: "No" },
];

export const OUTCOME_LABEL: Record<IntentOutcome, string> = { yes: "Got it", partly: "Partly", no: "Didn't get it" };

/** Latest written intention per primed meeting. */
export function primeIntents(primes: { event_id: string | null; intention?: string | null; at: string }[]) {
  const m = new Map<string, string>();
  for (const p of [...primes].sort((a, b) => a.at.localeCompare(b.at))) {
    const text = p.intention?.trim();
    if (p.event_id && text) m.set(p.event_id, text);
  }
  return m;
}

/** The outcome is only kept when the meeting was primed with an intention. */
export function afterMeetingRating(o: {
  id: string; rating: number; note?: string; eventId: string; primed: boolean;
  intention: string | null; outcome: IntentOutcome | null; dayKey: string; at: string;
}) {
  return {
    id: o.id,
    kind: "after_meeting",
    rating: o.rating,
    note: o.note?.trim() || null,
    event_id: o.eventId,
    primed: o.primed,
    intent_outcome: o.primed && o.intention ? o.outcome : null,
    local_date: o.dayKey,
    at: o.at,
  };
}
