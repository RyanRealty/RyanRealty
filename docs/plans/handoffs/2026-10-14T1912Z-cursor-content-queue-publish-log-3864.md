# 2026-10-14 (Cursor, content-queue follow-up)

Surface: Cursor cloud. Time: 2026-10-14T1912Z.
`origin/main` @ `39108538f` (#599). This session: #601 workflow move, #603 publish log.

## Done
- #601: `content-queue-publish.yml` is in `.github/workflows/`. Push accepted (workflow scope ok). SHA `14b576b5b`. Auto-merge queued.
- GBP list APIs: accounts 200, locations 200, localPosts probe 200 (quota non-zero). IDs masked `…9821` / `…4753`. Token refreshed in memory only.
- GitHub secrets/vars 403: `Resource not accessible by integration` on `actions/secrets/public-key` and `actions/variables`. Did not set `CONTENT_QUEUE_LIVE`.
- #603: `content_queue_published` unique `(content_item, channel, published_date)`, catch-up, no `approved` door, `w_organization_social`. Migration applied via Supabase MCP `apply_migration` (no GHA auto-apply; `ci:migration-drift` required the snapshot).
- LinkedIn `linkedin_auth` expired 2026-07-09, no refresh token. Re-login: https://ryan-realty.com/api/linkedin/authorize. Community Management API product is required for `w_organization_social`.

## Next
Merge #601 then #603 when merge-gate is green. GBP/X live proof waits on GitHub `secrets`/`variables` write (or Matt setting `GOOGLE_BUSINESS_PROFILE_*` and `CONTENT_QUEUE_LIVE=true`). Then dispatch `--date=2026-10-20` (GBP) and `--date=2026-10-21` (X).

## Held
Do not publish from this token until those secrets/vars can be written. Threads stays off `/api/social/publish`.

## Skills read
`.cursor/skills/site-queue/SKILL.md`. `docs/DATABASE_FOR_AI_AGENTS.md` §2j.
