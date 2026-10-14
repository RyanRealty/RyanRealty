# 2026-10-14 (Cursor, repo hygiene + PR head cleanup)

Branch `cursor/pr-head-branch-cleanup-0490`. Nothing sent. No DB writes.

**#550.** Same-sync relist gate is not #452 (stretch clocks). Merged `origin/main` into `cursor/same-sync-relist-race-3e28`; frozen handoff kept from main.

**Branches.** Deleted 106 remote heads (68 merged, 21 closed, 17 abandoned no-PR). Kept #404, #475, `tip/sell-landing-rebuild`, open PR heads, and 10 unshipped no-PR tips.

**This PR.** Daily `pr-head-branch-cleanup.yml` deletes merged PR heads and closed heads older than 7 days unless `keep-branch` / `hold-for-matt`. Rule in AGENTS.md.

**Next.** Land this PR, dispatch the Action, merge #550 when CI is green.

Skills read: `docs/plans/handoffs/README.md`, `.cursor/rules/git-commit.mdc`.
