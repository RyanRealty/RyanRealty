# Current — 2026-09-14 (SITE-97 homepage-v6; PR only; do not merge)

Surface: Cursor cloud, `cursor/homepage-v6-site97-d7fe` @ `25c2319f8` + shots hash commit → PR #229. Do not merge.

- **Done:** Featured = shadcn Carousel+Card+AnimatedNumber. Places = catalog Card + live town counts. Researchy 1–8 baked as visible claims. Open shots: MorphingSearch results + Sell street address. `--ship` still exit 1 until Mini writes demoMatch true + competitiveBriefPass true.
- **Next:** Mini Cursor `npx tsx scripts/taste-evaluate.ts homepage-v6 --builder grok-4.5`, copy evaluatorModel, write real receipt, then `--ship`.
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`, `TASTE.md`.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
