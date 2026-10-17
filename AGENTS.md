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
- Per-screen queries load only needed data (day-data.ts); no global dumps.
- Lists that can exceed 1,000 rows page (history by week, access lists by 20) or aggregate server-side; Insights numbers come from the security-invoker `get_insights` RPC.
- Writes only from explicit user actions, never from render or effects on computed values. Check `{ error }` on every database and Google call, toast on failure, roll back optimistic updates, and invalidate the right query keys after every mutation.
- Store times in UTC, show local; "today" is the user's local day. All-day events are shown at the top and excluded from focus-window maths.
- Logs use the per-user offline queue with client-generated ids; timers/cache switch with identity to prevent cross-account disclosure.
- Event titles/descriptions/attendees are never stored in the database; only Google event id, times and flags — data minimisation.
- Google refresh tokens live encrypted (AES-GCM, TOKEN_ENCRYPTION_KEY) in `google_tokens`, service-role only; all calendar calls go through server functions.
- Public signup stays disabled; setup requires inbox ownership and Google checks invitations. OWNER_EMAIL alone grants owner. RLS/functions/push require membership; invitation locks prevent admission racing revoke. Child rows require owned parents.
- Focus timer state lives in localStorage and is computed from timestamps, so reloads never lose it.
- Register service workers only via src/lib/pwa.ts, never in dev/preview; prompt updates defer during focus/prime.
- InstallTempo shares platform fallback instructions; permanent buttons ignore prompt availability and dismissal.
- Every blocking modal or gate screen must have a clearly visible, always-reachable primary button to continue (e.g. 'I understand'), pinned on every screen size, and must never trap the user if a save fails.
- Safety acknowledgements use per-user pending local storage and session dismissal independent of settings rollback; replay only the explicit pending acknowledgement once next launch so failed saves never reopen the gate.
- Calendar OAuth uses direct navigation, a validated Origin, signed restricted return path and sessionStorage; consume results once in the shell and refresh Calendar queries.
- Recurring blocks expand client-side; occurrence replacements, series conversions and session Undo use invoker RPC transactions to prevent partial writes.
- FocusEndSignal owns wake lock and one signal per target via `signalled`; timestamp timers survive reloads. Breaks use separate localStorage, never focus logs.
- Prime derives phases from elapsed timestamps; audio is created by Begin and disposed on finish, route exit or tab hiding. Running prime state lives in localStorage (src/lib/prime-session.ts) from startedAt, so locks and reloads resume at the right phase.

- Insights/reviews share security-invoker aggregates. Calendar evidence is paged, memory-only; meeting-load uses weekday hours and counts overlaps once.
- History uses security-invoker weekly browsing with within-week continuation, all-time filtered search with bounded pages, and per-month day aggregates; add-session logs use the queue, edits preserve ids, and validation compares local input against UTC timestamps.
- Theme resolution lives in a shared browser hook that listens to device preference changes and reads theme-colour from CSS tokens, so System stays live without persisting computed choices.
- Sync status observes successful non-manual query cache updates and queue deliveries; the release identifier lives in a build constant, so status never claims an optimistic edit was synced.
- Every screen resolves weekday hours through work-hours.ts (legacy fallback); days off yield no focus slots.
- Calendar colours come from calendarList at read time and are applied only to strips/segments when several calendars are included, never text.
- Metronome pulse (`animate-metronome`) only on live elements — running focus dot, prime due now, sign-in ribbon; everything else uses the one-shot `animate-enter` (175ms fade + 4px rise).
- Notification settings live only in Settings. Push/open-app reminders share atomic claims; cron verifies managed auth, reads titles transiently, stores only deadlines and presence, and removes expired subscriptions. Timer actions sync deadlines; presence heartbeats are delivery coordination, never logs.
- CSV exports (focus sessions, energy ratings) go through src/lib/csv.ts: BOM + CRLF, quoted cells, local dates; invite status is derived by matching allowed_emails against the paged member list, never stored.
