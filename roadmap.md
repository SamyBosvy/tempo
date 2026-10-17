# Pre-publish audit
- [x] Verify hosted signup restrictions, role gates, RPC/table permissions and cron protection.
- [x] Sweep 42 phone screens and core saved-data flows in six size/theme combinations; fix confirmed bugs; 167 tests passed.
- [x] Report findings and explicitly distinguish incomplete checks.
- [ ] Finish live Calendar/Google consent and email invitation/resend/recovery delivery — requires interactive Google consent and a real recipient inbox.
- [ ] Finish installed-phone push, lock-screen, shortcuts and update checks — requires publication and physical devices.

# Safety notice fix
# Final polish X6–X10
- [x] Illustrated empty states and install card/shortcuts.
- [x] Private push subscriptions, five-minute scheduling and shared dedupe.
- [x] Deferred update notice, exports/deletion, 158 tests and phone checks.
- [ ] Confirm real installed-device shortcut launches, closed-app push/taps and waiting-version refresh — needs published app and physical devices.

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

# Sign-in page upgrade
- [x] L1–L8 built and tested.

# Today upgrade
- [x] T1–T13 built, migrated and tested.

# Focus upgrade
- [x] F1–F13 built, migrated and tested.
- [ ] Confirm the end notification while the phone is locked — needs the published app on a real phone.

# Prime upgrade
- [x] P1–P5 phase cues, quiet room, meeting context and remembered eyes-closed mode.
- [x] Test phase logic, full suite (75 tests), signed-in phone views in both themes and reduced motion; saved a real Prime session, read it back in History and removed it.

## Prime upgrade 2 (P6–P10)
- [x] P6 resume from timestamp + wake lock
- [x] P7 notification auto-start with Starting… countdown
- [x] P8 60-second reset (Today, back-to-back, app shortcut)
- [x] P9 intention outcome on check-ins, History, export, Insights
- [x] P10 coherent + extended exhale patterns

# Insights upgrade (I1–I12)
- [x] Period-aware, gap-filled private aggregates and server-side findings.
- [x] Insights charts, comparison cards, and Monday weekly review.
- [x] Rule tests (92 passed), temporary-data phone checks in both themes, cleanup and full suite; Monday dismissal and remembered period verified.
- [ ] Verify live calendar-derived meeting bars and 12-week load — account has no connected calendar; zero/unavailable states and calculation rules verified.

# History upgrade (H1–H7)
- [x] Private week search and month-total RPCs, generated types.
- [x] Collapsible summaries, entry details, filters/month navigation, add and edit past sessions.
- [x] Regression suite (100 passed), signed-in phone flows in both themes, temporary session removed; build clean.

# History fixes and Settings S1–S5
- [x] All-time filtered History, visible month scale and rule tests.
- [x] Reorganise Settings, security sheet, keyword chips, live System theme, sync status.
- [x] Migration and generated types, full suite, signed-in 320×568 and 390×844 checks in both themes; temporary History rows removed and preferences restored.
