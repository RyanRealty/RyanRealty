# 2026-10-14 (Claude Code, video freeze, one factory, content process core)

Branch `claude/nifty-rubin-70dvwc`. Nobody pushes main. Nothing sent, posted or rendered for an audience.

**Landed today.**
- #573 (`f16f41b50`): the old /admin/studio video path is frozen at every door (`lib/content/video-freeze.ts`, `ci:video-freeze`). LinkedIn and Threads are removed as posting platforms; their profile links stay. `lib/social/token-heartbeat.ts` checks each posting key; no rotation (Matt).
- #577 (`3b5913486`): the one video factory (`studio:render`, `video:check` with 17 checks, preflight before render), the technique registry with tiers and Matt-only approvals, `docs/plans/CONTENT_PROCESS.md`, the 366-technique research.

- #584 (`0fb7e4094`): the content process core (185 rules with IDs, step stamps, job caps, `npm run studio`, `ci:content-rules` G84), the motion springs and camera, int tests only by name (`npm run test:int`), per-type length windows.

**This PR.** A deploy-found defect is one claimable work node (Matt 2026-10-14): `deploy:verify` files `DEPLOY-<check>-<hash>` nodes through the work-graph DAL, prints who holds each, and closes a node when its check passes. Claim with `npx tsx --conditions=react-server scripts/deploy-defects.ts --claim <id> --owner <tool>-<model>-<date>`. Gate `ci:deploy-defect-filing` (G85).

**Next.** Matt picked the buyer ad's techniques first: `figure_pullout_hook`, `map_area_cells` (aggregate cells only, ODS §5-4; `MIN_SALES_PER_CELL = 3` needs Matt's sign-off), `subframe_motion_blur`, `measured_drop_sync`. Builders run in worktrees `tech-hook`, `tech-cells`, `tech-blurbeat`. Then a showcase reel for Matt, then the buyer ad's board (`docs/plans/BUYER_AD.md`).

**Held for Matt.**
- No ad renders until Matt approves the techniques it uses. Nothing is approved yet.
- New tables are approved (job claims, approvals, signatures, rule-change approvals, approved videos). New tables only.

Skills read: `.claude/skills/ryan-studio/SKILL.md`, `.claude/skills/creative-brain/SKILL.md`, `.claude/skills/motion-design/SKILL.md`, built-in `code-review`.
