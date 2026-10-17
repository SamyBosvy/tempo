# Tempo

**Deep work, steady meetings.**

## What Tempo is

Tempo is a mobile-first web app for protecting focus time and handling high-stakes meetings. It reads a connected Google Calendar, finds the clear windows between meetings, and flags stressful ones. Before a flagged meeting it prompts a short guided breathing session. Focus sessions, interruptions and energy ratings build into insights on when the user works best. It is a self-help tool, not therapy.

- **Today:** day ribbon, focus windows, best window, back-to-back warnings, per-weekday work hours
- **Focus:** full-screen timer, interruption logging (self vs external), park-a-thought, breaks, screen wake lock
- **Prime:** five breathing patterns, eyes-closed mode with tones and haptics, post-meeting intention check
- **Insights:** plain-language findings, hour heatmap, weekly review, meeting-load trend
- **History:** day summaries, search, month view, manual entries
- **Reminders:** Web Push before stressful meetings and at focus end, even when the app is closed

## Access

Private and invite-only. Accounts are created only for invited emails, checked on the server for both email and Google sign-in. Public sign-up is disabled. Search engines are blocked.

## Stack

- TanStack Start, React 19, TypeScript, Tailwind CSS 4
- Lovable Cloud (Supabase) for auth, Postgres and scheduled jobs
- Google Calendar API, read-only
- Web Push (VAPID), installable PWA with offline write queue
- Vitest

## Data

- Row-level security on every table; each user sees only their own data
- Calendar event titles are never stored; only event IDs, times and flags
- No analytics or third-party trackers
- JSON and CSV export, and permanent account deletion (GDPR)

## Development

```bash
npm install
npm run dev
npm test
```

## Rules

Engineering rules live in `AGENTS.md`: per-screen queries, server-side aggregation, no writes from render, explicit error handling, UTC storage with local display, and blocking screens that never trap the user.

© 2026. All rights reserved.
