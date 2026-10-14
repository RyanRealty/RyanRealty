# 2026-10-14 (Cursor, content-queue follow-up)

Surface: Cursor cloud. Time: 2026-10-14T1922Z.
`origin/main` @ `29a0ef159` (includes #601 `65a3dfaf2`). This session: #603.

## Done
- Publisher accepts bare numeric GBP ids (`…9821` / `…4753`). Prefixes stripped. Unit test green (12/12).
- `.github/workflows/content-queue-publish.yml` now passes refresh secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, optional `GOOGLE_BUSINESS_PROFILE_CLIENT_ID` / `GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET`, `X_CLIENT_ID`, `X_CLIENT_SECRET`.
- `gh secret list` 403 `Resource not accessible by integration`. Did not set secrets or `CONTENT_QUEUE_LIVE`.
- #601 merged `65a3dfaf27ea1bac4cfe2fbdf2be8dcd3518427a` at 2026-10-14T19:18:26Z.

## Next
Merge #603 when merge-gate is green, then say ready for `CONTENT_QUEUE_LIVE`. Matt sets the variable.

## Held
Do not set `CONTENT_QUEUE_LIVE` (this token 403s Actions variables). Threads stays off `/api/social/publish`. LinkedIn re-login still needed for company posts.

## Skills read
`.cursor/skills/site-queue/SKILL.md`. `docs/DATABASE_FOR_AI_AGENTS.md` §2j.
