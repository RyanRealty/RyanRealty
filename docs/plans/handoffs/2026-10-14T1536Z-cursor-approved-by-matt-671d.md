# 2026-10-14 (Cursor, approved-by-matt unholds)

Branch `cursor/approved-by-matt-671d`. Nothing sent.

**Done.** Auto-merge now treats `approved-by-matt` (or `.github/approved-prs`) as Matt's approval. That removes `hold-for-matt`, skips a title re-hold, and queues squash merge when `merge-gate` is green. Session token 403s creating the label; the workflow `--ensure-labels` step should create it.

**Next.** Land this PR. Then open a docs-only hold-title PR, add `approved-by-matt`, and prove the hold drops and it merges.

Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/tdd/SKILL.md`, review-and-ship, `docs/plans/handoffs/README.md`.
