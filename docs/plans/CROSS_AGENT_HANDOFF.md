# Current — 2026-09-14 (SITE-97 homepage-v6 Tip Ready landed on main)

Surface: Mini Cos land of PR #229 tip `0440ecbd0` → main @ `5b17821c`.

- **Done:** Re-ran `node scripts/lib/taste-receipt.mjs --ship design_system/ryan-realty/ui_kits/homepage-v6/parity.json` on Mini at tip and on main after cherry-pick — exit 0 (`ship OK — demoMatch true · competitiveBriefPass true · open-state · catalog-install`). Score median 52 ignored per Cos north star (Tip Ready = --ship exit 0 only). Cherry-picked 11 commits onto main.
- **Next:** `npm run push` / deploy verify. Mark SITE-97 done with Tip Ready evidence.
- **Node:** SITE-97 Tip Ready → done after push.
- Skills read: `.claude/skills/site-queue/SKILL.md`.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
