# 2026-10-15 (Cursor, Sarah hook import)

Surface: Cursor cloud. Branch `cursor/sarah-hooks-import-61d7`.

Done: voice routes import `notifyLiveSession`, `sarahSessionConferenceJoin`, `mattConferenceJoin`, `sarahLiveConferenceName`, `evaluateSarahTurn`, `buildSarahSystemPrompt`, `sarahGreeting` from `@/lib/sarah`. Removed local conference-name and barge-flag duplicates. SIP participant label is `session`.

Next: land PR; post-deploy spare test from an unknown From; then main-line `RECEPTIONIST_LINES` cutover. Do not remove `RECEPTIONIST_TRANSFER_TEST_TARGET` until that cutover.

Held: `notifyLiveSession` is still the stub. Main line not switched.

Skills: none beyond lib/sarah hooks on main after #647.
