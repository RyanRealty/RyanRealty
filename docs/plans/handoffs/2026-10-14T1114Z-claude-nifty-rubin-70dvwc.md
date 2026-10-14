# 2026-10-14 (Claude Code, video freeze, one factory, content process core)

Branch `claude/nifty-rubin-70dvwc`. Nobody pushes main. Nothing sent, posted or rendered for an audience.

**Landed today.**
- #573 (`f16f41b50`): the old /admin/studio video path is frozen at every door (`lib/content/video-freeze.ts`, `ci:video-freeze`). LinkedIn and Threads are removed as posting platforms; their profile links stay. `lib/social/token-heartbeat.ts` checks each posting key; no rotation (Matt).
- #577 (`3b5913486`): the one video factory (`studio:render`, `video:check` with 17 checks, preflight before render), the technique registry with tiers and Matt-only approvals, `docs/plans/CONTENT_PROCESS.md`, the 366-technique research.

**This PR (on top of those).**
- `lib/content/process/`: one rules file (185 rules with IDs; each enforced one proven by a fixture that breaks it), step stamps, job caps, `npm run studio -- rules | run | status`, `ci:content-rules` (G84) and the rule-loosening commit check (loosening needs `Approved-by: matt`).
- Motion foundations: `lib/studio/motion/spring.ts`, `camera.ts`.
- Int tests run only by name (`npm run test:int` sets `RR_INT_RUN=1`); `npm test` names its projects. A helper's bare `vitest run` swept two zztest marker objects from production storage on 2026-10-14 (disclosed to Matt).
- Each video type keeps its own length window in `video_gate.mjs` and the render gate (Matt 2026-10-14).

**Next.** Matt picked the buyer ad's techniques first: `figure_pullout_hook`, `map_area_cells` (aggregate cells only, ODS §5-4; `MIN_SALES_PER_CELL = 3` needs Matt's sign-off), `subframe_motion_blur`, `measured_drop_sync`. Builders run in worktrees `tech-hook`, `tech-cells`, `tech-blurbeat`. Then a showcase reel for Matt, then the buyer ad's board (`docs/plans/BUYER_AD.md`).

**Held for Matt.**
- No ad renders until Matt approves the techniques it uses. Nothing is approved yet.
- New tables are approved (job claims, approvals, signatures, rule-change approvals, approved videos). New tables only.

Skills read: `.claude/skills/ryan-studio/SKILL.md`, `.claude/skills/creative-brain/SKILL.md`, `.claude/skills/motion-design/SKILL.md`, built-in `code-review`.
