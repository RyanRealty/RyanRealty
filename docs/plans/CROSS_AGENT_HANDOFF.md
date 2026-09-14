# Current — 2026-09-14 (SITE-97 homepage-v6; PR only; do not merge)

Surface: Cursor cloud, `cursor/homepage-v6-site97-d7fe` → PR #229. Do not merge. Cos cherry-picks Tip Readys.

- **Done:** SITE-97 claimed (`cursor-cloud-site97-20260914`). MorphingSearch live on first paint; Sell tab is catalog `[role=tab]`; rails import `@/components/ui/carousel` + `@/components/motion/number`; live count carries TRACE source; 4-up desktop cards + visible arrows.
- **Tip Ready:** `--ship` still exit 1 until a judge writes `demoMatch: true`. Do not invent it.
- **Next:** `npx tsx scripts/taste-evaluate.ts homepage-v6 --builder grok-4.5` then `--ship`.
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
