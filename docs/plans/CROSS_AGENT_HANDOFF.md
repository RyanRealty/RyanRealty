# Current — 2026-09-14 (CMA blank-subdivision pocket + CompArea extras; PR only)

Surface: Cursor cloud, `cursor/cma-blank-subdivision-pocket-5c80`. Craft PR. Do not merge.

- **Done:** Blank `SubdivisionName` infers pocket (plat / nearest mapped neighbor ≤0.35 mi) before mile rings. Extras band uses CompArea + shared ±10% inventory; city-wide `getCmaBandInventory` only when CompArea is absent.
- **Next:** Review PR. Do not merge.
- **Node:** none (Tip Ready geo; not a queue claim).
- Skills read: tdd, git-commit, database-canonical-reference (CMA extras).

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
