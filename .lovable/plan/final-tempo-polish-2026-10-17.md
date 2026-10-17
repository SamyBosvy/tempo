# Final Tempo polish

## What changes
- **X6:** Shared token-coloured ribbon illustrations for the requested empty states, preserving existing actions.
- **X7–X8:** Device-dismissed Today install card, permanent Settings install access, and three home-screen shortcuts.
- **X9:** Private push subscriptions and a five-minute reminder job for Prime, focus end, check-in and Monday review. Existing switches remain authoritative. Calendar titles are read transiently and never stored or included in pushes.
- **X10:** A refresh toast for waiting updates, deferred until focus and breathing finish.

## Technical details
- Keep the existing guarded PWA registration. Use a dedicated push handler imported by the generated worker; preview never registers workers.
- Generate a server-only secret for stable VAPID key material. Use a Worker-compatible Web Push implementation.
- Store subscriptions, minimal active-focus deadlines, presence and unique reminder claims with own-row access. Open-app and scheduled reminders share claims; expired endpoints are removed.
- Update JSON export and account deletion, add concrete scheduling/install/update tests, run the suite and check both requested phone sizes/themes.

## Limits to verify honestly
- Five-minute checks can deliver reminders up to five minutes after their due time; paused or offline timer changes require connectivity to update closed-app deadlines.
- Installation, real push taps, iPhone home-screen push and installed app shortcuts require a published app on physical devices; they cannot be confirmed inside the editor preview.