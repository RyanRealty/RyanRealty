# 2026-10-14 (Claude Code, video factory, buyer ad, build timeouts, refused writes)

Branch `claude/nifty-rubin-70dvwc`, recreated per PR. Nobody pushes main. Nothing sent, posted or rendered for an audience. Updated 2026-10-15 04:15Z.

**Landed.**
- #665: `getMetrics` keeps #634's 14-day rule and reads only what is left open (the review fixes #658 merged without). Deploy verified on 07255b7.
- #573, #577, #584: the video freeze, the one factory (`studio:render`, `video:check`), the technique registry, the content process core.
- #597: the sitemap fails closed on an unknown matrix decision.
- #605: content step 0, the ad-strategist's plain-English whiteboard (R-186 to R-191).
- #620: listing meta descriptions lead with what tells a listing from its siblings.
- #632: the subdivision sitemap emits only verified plats.

**In flight.**
- #641 (auto-merge on). Build-time database load: a per-worker read memo, the `visitor_events.page_url` trigram index, `authenticator` statement_timeout 30 s, 3 static workers with retry, and `ship` waits for a running production build. #634 already fixed `getMetrics` and the `market_metric` probe, and #641 keeps main's version of both.
- This PR (`fix/rejected-writes`). Postgres had been refusing writes with no log line:
  - `crm_timeline` refused `email_delivered`, `email_bounce`, `email_complaint`, `email_unsubscribe` and `cma_replied` since July 10. At 03:45Z on 2026-10-15 the four Resend kinds were also applied by hand (`20261015034529`, no file); the migration in this PR is a superset that adds `cma_replied` and applies on merge (`supabase-migrations.yml`);
  - `sync_history` refused `delta` because 20260809191000 was never applied;
  - the anon `get_listings_breakdown` call was removed.
  - Refused writes now log through `lib/observability/rejected-write.ts`.
  - The delivery receipt is filed as system, so lead views hide it.
  - `deploy:verify` picks the READY build for a SHA over a CANCELED duplicate.
- Branch `board/ad` (unpushed, worktree `.claude/worktrees/board`). The buyer-ad techniques, `footage_plate`, end card dots and ding (R-197, R-198, `video:check` check 12), and Matt's approvals of `figure_pullout_hook` and `guilloche_field` with the reel. It ships after this PR.

**Next, after this PR.** A follow-up PR gives the Market Truth monthly and HUD window cells their own cron (`/api/cron/compute-market-metric-windows`): a failed daily shadow call had skipped them since 2026-10-12 12:20Z, so they would stop answering on 2026-10-26 under the 14-day rule. The same PR fixes `scripts/worktree-setup.sh` on Linux.

**Held for Matt.**
- No backfill of the refused timeline rows. Matt chose fix-forward on 2026-10-15.
- Vercel On-Demand Concurrent Builds is still "Immediate". Matt is switching it to "Per Branch" (the token can't).
- Supabase compute stays Medium until a day of builds on #641 is read.
- The buyer-ad v2 drafts (`out/studio/buyer-ad-2026-10-{paid,organic}-v2/final.mp4`) wait on Matt's review. Nothing posts.

**Not yet looked at.** Seen in the Postgres logs on 2026-10-14:
- `permission denied for table cmas`, `cma_comps` and `cma_document_registrations`, plus `cmas_publish_requires_cma_doc_type` failures (5 each);
- `visitor_sessions_pkey` duplicates;
- several "column does not exist" errors;
- about 79 migration files with no applied record by name.

**Lesson (2026-10-14).** I redeployed an older commit after a newer one was live, which rolled production back from 21:31Z until #614. Before any manual redeploy or promote, list the production deployments. Redeploy only main's newest commit, and only with nothing else building.

**Lesson (2026-10-15).** #641 and #634 both rewrote `getMetrics` and both added a `market_metric` index within the same hour. Before starting a DB fix, read the open PRs and this folder's notes for the same table.

Skills read: `.claude/skills/ryan-studio/SKILL.md`, `.claude/skills/creative-brain/SKILL.md`, `.claude/skills/motion-design/SKILL.md`, built-in `code-review`.
