# The content process: every video, ad and social post (Matt 2026-10-14)

**Status.** Design, with Matt's rulings below. The build order at the end is in progress. Until a step exists in code, nothing that step would make ships: the old video path is frozen (`lib/content/video-freeze.ts`, `ci:video-freeze`).

**What it guarantees.** Nothing reaches an audience, Matt's approval queue or a share link unless all of the following are true for those exact bytes:
- they passed every rule, in order, at the cheapest step that could check each one;
- every number was pulled fresh from the database by ID, not typed by a bot;
- an independent judge from a different model family scored it above the bar;
- a server signed it with a key no bot holds;
- Matt clicked approve.

**What it can't guarantee:** taste. Four things cover it: techniques Matt approved, a calibrated judge, Matt seeing the storyboard of every video for now, and every "no" from Matt becoming a rule or a judging example.

**Who it binds:** anything in this codebase told to make a video, an ad or a social post, whether Claude, Cursor, the Grok bot or a cron, on any machine. The bot's only job is to fill in a brief. One command, `npm run studio`, does the rest and refuses to move past any failed step.

## The steps

| # | Step | What must pass before the next step | Who checks |
|---|---|---|---|
| 1 | **Brief.** Figure IDs (never typed numbers), asset IDs, every word of copy, chosen techniques. Claims the job, so two bots can't make the same thing. | <ul><li>Numbers are pulled fresh through the data layer; active counts and days on market are cross-checked against Spark (stop if over 1% apart, CLAUDE.md §0).</li><li>One copy check over every string: banned words, fair housing, no names or addresses, no dashes, verdict words that agree with the numbers, no hedges ("about", "roughly"), and the MLS advertising notice on any market stat.</li><li>Footage rights come from the asset library.</li><li>Every technique is one Matt approved, with at least one signature technique.</li><li>The hook device and scene set repeat no earlier film of the type (`video:check` check 16 today).</li></ul> | code |
| 2 | **Voice** (video only) | Synthesized once and cached for every machine. Its real timing must fit the beats. | code |
| 3 | **Stills** | Real footage frames. Generated stills are inspected before anything is animated. Clips are probed for hidden cuts. | code |
| 4 | **Board**: one still per beat at real size and real timing | <ul><li>Measured on the pixels: safe area per placement, text readable over the actual footage, numbers drawn equal the brief, logo only on the end card, palette.</li><li>The judge scores the composition.</li><li>**Matt sees the board of every video for now** and clicks go or no. After five first-try approvals in a row for a type, it relaxes for that type, except buyer ads, brand films, new types and new technique mixes.</li></ul> | judge, then Matt |
| 5 | **Animatic** (video only), with the real voice | Every element moves, no dead time, no strobe, the loop seam works, holds of 2.5 s or more. The judge scores the motion. | judge |
| 6 | **Generated motion**, only if the brief needs it | Through the Imagine web UI only (Matt 2026-09-24). At most 4 takes per shot. | code |
| 7 | **Master**, with a DRAFT stamp burned in | Numbers are re-pulled. Anything that changed since the board stops it. | code |
| 8 | **Certify**, on a protected server | <ul><li>The server re-measures the file itself: format, loudness, frozen frames, cuts, end card, loop, and the text read back off the pixels.</li><li>The judge does a full review.</li><li>If it passes, the server signs the file's fingerprint, the rules version, the number timestamps and the verdict. The signature expires after 7 days, or sooner if a number moves.</li></ul> | server |
| 9 | **Matt** | Approves with a logged-in click in /admin, never via a chat message a bot interprets. The publisher checks the signature again before posting. | Matt |

**By deliverable:**
- **Stills:** the board is nearly the final.
- **Carousels:** every slide is boarded, and the signature covers the whole set.
- **Post copy:** the brief is the final, checked by the copy check plus `marketing_brain_skills/brand-voice/VOICE.md`.
- **Paid ads:** the signature also covers the headline, form and targeting. Targeting is checked for no age, gender or ZIP and a radius of at least 15 miles, plus the Housing category. Ads are created paused; going live is Matt's click (ad spend, CLAUDE.md §1).

## What makes it impossible to go around

- **One door per channel.**
  - Organic posts go through the existing publish route (`app/api/social/publish`). Paid ads go through a new ad route. `lib/social/publish-door.ts` names them.
  - Each door refuses anything without a valid signature and Matt's approval record.
  - The tokens that can post should live only on the production server, with read-only tokens for bots. **Not yet (Matt 2026-10-14: no rotation now).** Until that move happens, a bot holding a write token could post around the doors. The repo check and the doors still cover every path inside this codebase.
  - A repo check (`ci:publish-door`) fails on any other code that can post.
  - The old posting scripts, the old reel scripts and the old Python check are deleted.
- **The old /admin/studio video path is frozen** (Matt 2026-10-14). The new process replaces it.
- **Rules live in one file, each with an ID.**
  - Each rule records which step enforces it, the code that enforces it, and an example that breaks it. A test proves every example is rejected at its step.
  - A rule without an ID fails the build.
  - `npm run studio -- rules <type>` prints the rules from that file. Instruction files may not restate numbers, so they can't drift.
- **Rules can tighten freely; loosening waits for Matt.** Any change that loosens a threshold pauses signing until Matt approves it in /admin. Tightening shows in a daily digest.
- **No stale copies.**
  - The skill copies on the Mac and the box become pointers to the repo.
  - `npm run studio` refuses to run on a checkout that's behind main.

## What keeps it from burning time and tokens

- **Hard limits per job:** 3 boards, 2 animatics, 2 masters, 90 minutes, and a spend cap. Then it stops and reports.
- **A failure at step 8 after a clean animatic is a factory bug.** The bot doesn't retry; the factory gets fixed.
- **Bots read only the printed rules for their type,** not hundreds of pages.
- **Paid steps run late and once:** voice after the brief, generated footage after the board.

## Taste

- **Technique library:** everything researched, in `.claude/skills/motion-design/references/technique-master-list.md`: 366 techniques reviewed (273 from cinetic, 93 from three other libraries and the prompt-motion gallery), 93 to build, 136 to adapt to navy and cream, 137 skipped with reasons. Each is built with a short showcase clip. Matt approves or kills each one from a reel, and only approved ones can be used. "Ready" means the renderer actually runs it.
- **The judge:**
  - It's a different model family from the builder. Grok judges Claude's and Cursor's work; Claude judges Grok's.
  - It sees only the frames, the transcript and the one-sentence idea, never the builder's notes.
  - It scores on the researched 11-dimension rubric (master list section 3), adapted for cream and Amboqia, plus hard fails: a first frame that doesn't stop the scroll, anything that reads as a template, any hard-to-read text.
  - It's calibrated on Matt's approved and rejected videos. It must rank those correctly before its scores count.
  - On a fail, one revision at the step that owns the problem; a second fail kills the idea. If the judge is down, everything waits. No self-review, ever.
- **Matt's "no" becomes permanent:** a rule if it's mechanical, a judging example if it's taste.

## Matt's rulings, 2026-10-14

1. **Sound splits by use.** Ads bake in the voice and our composed music. Organic Reels bake in the voice; Matt adds the song in the picker at the start time we give, and the big number lands on the drop.
2. **Matt sees every video's board for now.**
3. **The old video path is frozen.**
4. **Rule loosening waits for Matt's click.** Tightening flows, with a daily digest.
5. **No ads render until the library is built** and Matt has approved the techniques they use. **Narrowed the same day:** the buyer ad's techniques are built first (the full-screen $10,000, the map lighting up area cells, motion blur, the number landing on the beat). Matt approves each from a short showcase reel, then sees the buyer ad's board. The rest of the library keeps building alongside.
6. **Verdict words must agree with the numbers.** No "buyers have leverage" beside 3.5 months of supply.
7. **New database tables: yes.** Job claims and limits, approvals, signatures, rule-change approvals and the approved-video list. New tables only; nothing existing changes.
8. **Posting keys:** production must hold every one so the doors can post, checked by `lib/social/token-heartbeat.ts`. No rotation now, so copies on bot machines remain a known gap.
9. **LinkedIn and Threads are removed as posting platforms.** Their profile links stay on the footer and About page.

**Contradictions settled by the newest rule:**
- The paid xAI API is out (RULEBOOK, 2026-09-24).
- Each video type keeps its own length window. The render gate's fixed 15 to 30 s length check (`video_render_gate.py`, #520) gets the per-type window when the rules file lands.
- The old Cursor video rule is replaced.
- "#1 on the drop" applies to Matt's picker song; our composed music stays calm, with no drops.

**MLS compliance (ODS §5-4, §7-3):** sold homes are never shown one by one in a public ad. The buyer-ad map lights up area cells, not individual homes, and every market stat in an ad carries the source notice.

## Order of the build

1. **Ship the factory branch to main,** with the check fixes and the before-build rules. The freeze ships first (#573).
2. **Process core:** the steps, the stamps, the rules file, the job limits and the printed rules.
3. **The server certifier, the two doors and the token move.**
4. **The judge:** rubric, anchors, calibration.
5. **The buyer ad's techniques first** (Matt 2026-10-14), each with a showcase reel for Matt's approval; then the rest of the technique library, built in parallel.
6. **The buyer ad** (`docs/plans/BUYER_AD.md`): its board first.
