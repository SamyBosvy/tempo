# Safety notice fix
- [x] Keep the continue button pinned within safe phone viewport bounds.
- [x] Dismiss immediately, retain failed acknowledgement and retry next launch.
- [x] Add regression tests and the blocking-modal engineering rule.
- [x] Verify signed-in behaviour at all requested phone sizes and 200% text.

# Google Calendar connection fix
- [x] Replace popup coordination with direct navigation, retaining return location (Connect and Reconnect share the same button).
- [x] Redirect callback results into Tempo with specific toasts and calendar refresh.
- [x] Test origin/return rules and Chrome/Firefox desktop/mobile navigation and return messages; six regression tests passed.
- [x] Report exact preview callback URL and verification limitations (no published domain exists yet).
- [ ] Complete live Google consent and confirm real events appear in Today — blocked on interactive Google account consent; browser tests intercepted the Google destination, not the token exchange.
# Bug batch B1–B12
- [x] B1 service-worker notifications, B3 viewport-safe dialogs, B4 queue attention list, B5 focus overtime, B6 history today, B7 min 5, B8 title, B9 local dates, B10 revoke dialog, B11 immediate delete + undo, B12 work hours.
- [ ] Confirm prime notifications on a real Android phone — needs the published app installed on a device.
