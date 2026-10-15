# 2026-10-15 (Cursor, Sarah on the main line)

Surface: Cursor cloud. Branch `cursor/sarah-main-line-7dac`.

Done:
- Matt approved main-line Sarah. Production `RECEPTIONIST_LINES=+15412245025,+15417033095`.
- Code default stays spare-only (rollback). Tests cover both-lines env.
- #662 merged `3a786c0f3`. Spare-env branches already gone.

Next: ship this SHA, wait for production READY, probe unknown main → Sarah conference, CRM-known → Dial Matt, SIP probe. Rollback env to `+15412245025` only if any check fails.

Held: none on this cutover.

Skills: none.
