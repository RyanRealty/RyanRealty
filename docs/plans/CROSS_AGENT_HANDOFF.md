# Current — 2026-09-14 04:30Z (PR #223 About craft; Tip Ready still refused)

Surface: Cursor cloud, branch `cursor/about-firm-story-20f0`, PR https://github.com/RyanRealty/RyanRealty/pull/223. Do not merge. Do not invent `demoMatch`.

- **Done:** Mini Cursor grok-4.6 `taste-evaluate` exit 2. Craft on this PR: FirmClosings shadcn Card rail (photo, address, ClosePrice, date, specs, prev/next, peek); AboutInquiry shadcn Input GET `/contact`; AboutOffice prints firm OREA once. `--about-lock` 0. `--ship` 1. Named shotsHash still `sha256:f95a3b74…`. Scores 52/47/57 prior instrument.
- **Next:** Cos re-runs `npx tsx scripts/taste-evaluate.ts about` on Mini. Leave Tip Ready refused until `--ship` exits 0.
- **Node:** `edabba8e-f8aa-4271-909d-c258914f75ef` (SITE-90).
- Skills read: `design_system/public/TASTE.md`, walkthrough-artifacts, about-lock / taste-receipt.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
