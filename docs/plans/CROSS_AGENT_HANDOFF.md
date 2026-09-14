# Current — 2026-09-13 15:20 PT — STOP (Matt: hours, 2 pages, nothing landed)

Surface: Cursor grok-4.6, primary `/Users/matthewryan/RyanRealty` on `main`. Owner `cursor-claude-fable-5.1-2026-09-13` still holds SITE-100 + SITE-90. **Do not merge. Do not start another rewrite/judge cycle unless Matt says go.**

- **Why it sat:** the Cursor grok-4.6 judge is ~15–25 min per scoring × 3 in one call. Two pages scoring at once doubled that. Fable builder lanes died (`usage limit`). A 51→58 rise on market-report still cannot close because `demoMatch` stayed false. About hit 55 + brief true, then the next call flipped `demoMatch` false. That is the process, not two empty pages.
- **SITE-100 worktree** `/Users/matthewryan/RyanRealty-wt-site-100-20260913` (`wt/site-100-20260913`). Table prior 51. Last judge 58 (55/62/58) demo **false**. HEAD `309b0b2d` (open-state shots locked). Judge wants InsightCards + digit-swap visible, not InsightPager chrome. **One more score only** if resumed; do not rewrite first.
- **SITE-90 worktree** `/Users/matthewryan/RyanRealty-wt-site-90-20260913` (`wt/site-90-20260913`). Fold locked at `0b414973` (AboutFirm opener — do not use old 20260912 / AboutFaces). Last judge 55 (51/59/55) demo **false** brief **true**. Need photos not letter-circles + two whole closings (no clipped third). Need 55+ AND demo true on the **same** call. Old worktree `../RyanRealty-wt-site-90-20260912` is the wrong opener — leave it.
- **Main:** `312ece48` identityDrift fix (must be on any rose receipt). Later local main grew unrelated perf commits — do not bundle them into a site-queue push.
- **Next if Matt says go:** one judge at a time; About first (commit fold, two-card closings, photo avatars, one score). Then market-report one score on existing open shots. Else leave claims heartbeating or release.
- Skills read: `.claude/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
