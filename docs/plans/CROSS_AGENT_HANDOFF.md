# Current — 2026-09-14 (SITE-97 homepage-v6; PR only; do not merge)

Surface: Cursor cloud, `cursor/homepage-v6-site97-d7fe` → PR #229. Do not merge.

- **Done:** Featured = FirmClosings carousel+Card (photo, lead figure, footer). Places towns = photo Cards + live counts. Resorts = photo Card carousel (no empty chips). Researchy 1–8 visible. Open shots include search-open, sell-tab, places-resorts.
- **Next:** Mini Cursor judge writes demoMatch true + competitiveBriefPass true (verbatim brief quotes). Then `--ship`. Leave SITE-97 in_progress until exit 0.
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
