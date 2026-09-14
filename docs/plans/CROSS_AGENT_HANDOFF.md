# Current — 2026-09-14 (PR #223 Tip Ready evidence; do not merge)

Surface: Cursor cloud, `cursor/about-firm-story-20f0`, PR https://github.com/RyanRealty/RyanRealty/pull/223. Do not merge. Cos cherry-picks after `--ship` 0.

- **Done:** Process tip `54bb8acf` merged. `competitiveBriefEvidence` re-landed from About source. `--ship` 0, `demoMatch` true.
- **Next:** Cos Mini cherry-pick onto Mini after `--ship` 0. Do not merge this PR to main.
- **Node:** `edabba8e-f8aa-4271-909d-c258914f75ef` (SITE-90).
- Skills read: about-lock, taste-receipt, site-queue.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
