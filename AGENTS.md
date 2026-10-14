<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Tempo engineering rules
- Per-screen queries load only what each screen needs (see src/lib/day-data.ts); no global data dumps.
- Lists that can exceed 1,000 rows page (history by week, access lists by 20) or aggregate server-side; Insights numbers come from the security-invoker `get_insights` RPC.
- No database writes from render or effects based on computed values; writes only from explicit user actions.
- Check `{ error }` on every database and Google call, toast on failure, roll back optimistic updates.
- Invalidate the right query keys after every mutation.
- Store times in UTC, show local; "today" is the user's local day. All-day events are shown at the top and excluded from focus-window maths.
- Logs (focus_sessions, interruptions, energy_ratings, prime_sessions) go through src/lib/offline-queue.ts with client-generated ids — so offline writes replay idempotently.
- Event titles/descriptions/attendees are never stored in the database; only Google event id, times and flags — data minimisation.
- Google refresh tokens live encrypted (AES-GCM, TOKEN_ENCRYPTION_KEY) in `google_tokens`, service-role only; all calendar calls go through server functions.
- Accounts are created only by the `setupAccount` server function (public sign-up is disabled); the owner role comes solely from the OWNER_EMAIL secret.
- Focus timer state lives in localStorage and is computed from timestamps, so reloads never lose it.
- Service worker is registered only via src/lib/pwa.ts, never in dev or Lovable preview.
- Every blocking modal or gate screen (disclaimers, onboarding, consent) must have a clearly visible, always-reachable primary button to continue (e.g. 'I understand'), pinned in view on every screen size, and must never trap the user if a save fails.
- Safety acknowledgements use per-user pending local storage and session dismissal independent of settings rollback; replay only the explicit pending acknowledgement once next launch so failed saves never reopen the gate.
