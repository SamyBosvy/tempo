// One attempt per key at a time; failed delivery remains retryable.
const inFlight = new Set<string>();
export async function attemptReminder(key: string, claim: () => Promise<boolean>, deliver: () => Promise<boolean>, release: () => Promise<void>, remember: () => void) {
  if (inFlight.has(key)) return;
  inFlight.add(key);
  let claimed = false;
  try {
    claimed = await claim();
    if (!claimed) return;
    if (await deliver()) remember();
    else await release();
  } catch {
    if (claimed) await release().catch(() => {});
  } finally { inFlight.delete(key); }
}