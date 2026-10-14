# Safety notice fix
- Keep the notice within 90% of the phone screen, accounting for safe edges, with rounded corners.
- Scroll only the notice text; keep a full-width, minimum 48px “I understand” button pinned below it.
- Dismiss immediately on tap, even when saving fails. Retain the acknowledgement locally and retry next launch.
- Add the requested blocking-notice rule and regression tests.
- Check signed-in behaviour at 320×568, 360×640 and 390×844, at normal and 200% text sizes, in both themes.

## Technical details
Use local state for immediate dismissal, per-user pending acknowledgement storage for retry, and the existing settings mutation for persistence. Keep the existing theme contrast tokens and confine changes to the notice and its tests.