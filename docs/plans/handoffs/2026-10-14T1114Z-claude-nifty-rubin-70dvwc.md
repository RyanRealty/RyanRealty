# 2026-10-14 (Claude Code, video freeze, posting-key check, one content process)

Branch `claude/nifty-rubin-70dvwc`. #529 merged `83d4fdf40`. Nobody pushes main. Nothing sent, posted or rendered for an audience.

**This PR (freeze + key check).**
- The old /admin/studio video path is frozen (Matt 2026-10-14). `lib/content/video-freeze.ts` refuses video at every door: Studio produce, Imagine produce, draft approve, agent approve, the approval-queue routes, publisher-sweep, the publish route (423), `scripts/upload-youtube.mjs`, `scripts/create-fb-ad.mjs`, and `uploadVideo` / `createAdCreative` in `lib/meta-marketing-api.mjs`. `ci:video-freeze` holds it. Images and text still flow.
- Two May publish scripts with hard-coded posts are deleted.
- LinkedIn and Threads are removed as posting platforms (Matt 2026-10-14). The publish route answers 400 for them. Their profile links stay on the footer and About page.
- `lib/social/token-heartbeat.ts` checks each posting key in production. A missing Meta token reads "not connected", not healthy. Keys are not rotated (Matt: no time now).

**Next PR on this branch (after #573 merges): the one factory.**
- Merged here: `integ/one-factory` (studio:render, video:check with 17 checks classed preflight or file-only, pixel OCR, verdict words that must agree with the numbers, technique registry with base and signature tiers, approvals only with `approved_by: "matt"`, a date and a reel), `canon/one-factory` (CLAUDE.md/AGENTS.md video line, Grok bot door, Cursor market-video rule), and the map DAL `getSaleLeveragePoints`.
- `docs/plans/CONTENT_PROCESS.md`: one process for every video, ad and post, Matt's rulings, the build order.
- `.claude/skills/motion-design/references/technique-master-list.md`: the 366-technique research (93 build, 136 adapt, 137 skip) and the 11-dimension rubric.

**After that, in order.** Process core, then the server certifier and the two doors, then the judge, then the technique library and its approval reel. The buyer ad goes last, board first (`docs/plans/BUYER_AD.md`).

**Held for Matt.**
- No ad renders until the technique library is built and Matt approves the techniques it uses.
- New tables are approved (job claims, approvals, signatures, rule-change approvals, approved videos). New tables only.

Skills read: `.claude/skills/ryan-studio/SKILL.md`, `.claude/skills/creative-brain/SKILL.md`, `.claude/skills/motion-design/SKILL.md`, built-in `code-review`.
