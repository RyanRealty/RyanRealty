# 2026-10-14 (Claude Code, video freeze, posting-key check, one content process)

Branch `claude/nifty-rubin-70dvwc`. #529 merged `83d4fdf40`. Nobody pushes main. Nothing sent, posted or rendered for an audience.

**This PR (freeze + key check).**
- The old /admin/studio video path is frozen (Matt 2026-10-14). `lib/content/video-freeze.ts` refuses video at every door: Studio produce, Imagine produce, draft approve, agent approve, the approval-queue routes, publisher-sweep, the publish route (423), `scripts/upload-youtube.mjs`, `scripts/create-fb-ad.mjs`, and `uploadVideo` / `createAdCreative` in `lib/meta-marketing-api.mjs`. `ci:video-freeze` holds it. Images and text still flow.
- Two May publish scripts with hard-coded posts are deleted.
- LinkedIn and Threads are removed as posting platforms (Matt 2026-10-14). The publish route answers 400 for them. Their profile links stay on the footer and About page.
- `lib/social/token-heartbeat.ts` checks each posting key in production. A missing Meta token reads "not connected", not healthy. Keys are not rotated (Matt: no time now).

**Next, in order.**
1. Ship the one factory: worktree `integ/one-factory` (studio:render, video:check with preflight before render, pixel OCR, verdict words that must agree with the numbers, technique registry with tiers), `canon/one-factory` (CLAUDE.md/AGENTS.md video line, Grok bot door), and the map DAL `getSaleLeveragePoints` (branch `worktree-agent-a4664ce53feb2f62b`). None pushed yet.
2. Commit `docs/plans/CONTENT_PROCESS.md`: one process for every video, ad and post. Brief with figure IDs, voice, stills, board, animatic, master with a DRAFT stamp, a server signature, then Matt's click in /admin. One door per channel.
3. Build that process, then the judge, then the technique library and its approval reel.
4. Buyer ad last, board first (`docs/plans/BUYER_AD.md`).

**Held for Matt.**
- The main checkout at `/home/user/RyanRealty` has `core.bare=true` in `.git/config`, set by a worker's test. A worker's attempt to restore it was blocked, so it waits for Matt's yes. Worktrees still work.
- No ad renders until the technique library is built and Matt approves the techniques it uses.
- New tables are approved (job claims, approvals, signatures, rule-change approvals, approved videos). New tables only.

Skills read: `.claude/skills/ryan-studio/SKILL.md`, `.claude/skills/creative-brain/SKILL.md`, `.claude/skills/motion-design/SKILL.md`, built-in `code-review`.
