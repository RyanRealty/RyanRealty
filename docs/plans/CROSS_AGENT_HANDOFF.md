# Current — 2026-09-15 (SITE-105 oregon-city Mini f9a15b15f pixel fix)

Surface: Cursor cloud `cursor-cloud-site105-20260914` on `cursor/oregon-city-site105-1e22` (PR #234). Do not merge.

- **Done:** Mini `f9a15b15f` score 41 tells: official Alert composition (relative + AlertAction, no house restack / outline pill wrap); listings are shadcn Card Image+Size (lead + sm density), no DELTA when, Built-in reveal inside CardContent. `--ship` stays exit 1 until Mini writes `demoMatch: true`.
- **Next:** Cos / Mini Cursor judge. Leave SITE-105 `in_progress`.
- **Node:** `0e402cf5-3e29-419d-9e14-3f7896687b53` SITE-105
- Skills read: `.claude/skills/site-queue/SKILL.md`, `docs/DATABASE_FOR_AI_AGENTS.md` §0

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
