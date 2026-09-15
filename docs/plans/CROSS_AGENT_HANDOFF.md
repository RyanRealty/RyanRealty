# Current — 2026-09-15 (SITE-105 Tip Ready, Cos landing)

Surface: Cursor cloud `cursor-cloud-site105-20260914` on `cursor/oregon-city-site105-1e22`. Do not merge from this checkout.

- **Done:** Mini Cursor on tip `987236e4d`: `demoMatch` true, `--ship` exit 0. Cos is landing on Mini (`npm run push` from main). No more craft unless that land fails.
- **Next:** After Cos push, SITE-105 is marked done. This worker holds the claim and does not patch the page.
- **Node:** `0e402cf5-3e29-419d-9e14-3f7896687b53` SITE-105
- Skills read: `.cursor/skills/site-queue/SKILL.md`, `.claude/skills/site-queue/SKILL.md`

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
