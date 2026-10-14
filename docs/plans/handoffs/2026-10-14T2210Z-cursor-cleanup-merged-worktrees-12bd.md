# 2026-10-14 (Cursor, merged-worktree cleanup)

Branch: `cursor/cleanup-merged-worktrees-12bd`. PR opening this session.

**Landed.** Agents must remove their own worktree or clone after the PR merges or closes. Rule is in AGENTS.md / CLAUDE.md CORE RULES, GROK_BOT_BRAIN.md, GROK_BOT_COMPANY.md, and `.cursor/rules/cleanup-merged-worktrees.mdc`. Script: `scripts/cleanup-merged-worktrees.sh` (`npm run wt:cleanup` / `wt:cleanup:dry`). Refuses dirty, unpushed, stashed, in-use, and recently-touched checkouts. Wired: husky post-merge + post-checkout, `npm run ship`, G86 `ci:worktree-cleanup`. Tests prove skip + remove.

**Matt once on the Mini:** `bash scripts/install-cleanup-launchd.sh` from the primary checkout. Hourly launchd is what cleans leftovers when no session is pulling.

**Next.** Merge this PR after the CI skip lands (product-diff `changes` job; scripts-only package.json does not prerender Next). Load the launchd job on the Mini. Then `npm run wt:cleanup:dry` there.

**Held.** Standing holds unchanged. No sends.

**Skills read.** AGENTS.md Worktrees, check-core-rules-prefix, check-gates-wired, husky hook layout.
