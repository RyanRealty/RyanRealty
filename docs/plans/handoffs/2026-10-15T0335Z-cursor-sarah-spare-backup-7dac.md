# 2026-10-15 (Cursor, Sarah spare backup follow-up)

Surface: Cursor cloud. Branch `cursor/sarah-spare-backup-7dac`. Follow-up to merged #656.

Done:
- #656 merged as `c26b07640` (spare-only Sarah, empty transfer target treated as unset).
- Production key `RECEPTIONIST_TRANSFER_TEST_TARGET` renamed to `RECEPTIONIST_TRANSFER_TEST_TARGET_REMOVED` so it is unset. Old value `+15005550006`.
- Signed TwiML: spare unknown → Sarah conference; CRM-known spare → Dial `+15412136706`; main unknown → Dial Matt, not Sarah.
- SIP probe `CA3a313619809ba24d259471e8d3832eaa` spare → xAI SIP answered.

Next: land this backup note; wait for production READY on a SHA after the env rename (`8b83ba47d` was building). Do not add the main line.

Held: main-line cutover.

Skills: none.
