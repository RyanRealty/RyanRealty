# 2026-10-15 (Cursor, Sarah spare-only env)

Surface: Cursor cloud. Branch `cursor/sarah-spare-env-61d7`.

Done:
- Production `RECEPTIONIST_LINES=+15412245025` (spare only). Main `+15417033095` stays off Sarah.
- `RECEPTIONIST_TRANSFER_TEST_TARGET` cleared. Old value `+15005550006` is in `docs/ops/twilio-voice-backup-2026-10-15.json`.
- Voice routes already call `notifyLiveSession`. Alerts PR has not landed; stub still returns `notify-not-wired`.

Next: unknown-From human test of `+15412245025`. Do not add the main line until that passes.

Held: main-line cutover.

Skills: none (env + existing `@/lib/sarah` hooks).
