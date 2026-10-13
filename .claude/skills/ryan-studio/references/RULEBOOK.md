# RULEBOOK: every locked Matt rule (Ryan Realty social and Reels)

These rules override any older brief or skill. Each rule carries the date it was set (PT). Source "Matt" means his own words in chat; "lock" means he said it is final.
To change a rule: Matt has to say so. Add the new rule with its date, strike the old one (~~like this~~), and log it in LEARNINGS.md.

---

## 1. End card (Matt lock, 2026-10-08)
- Cream `#faf8f4` field. **Real logo at the top**: `assets/endcard-logo.png` (= `/workspace/motion-clips/assets/logo-blue.png`, byte-identical to `RyanRealty/public/brand/wordmark-stacked-navy.png`). Never retyped or generated.
- **"Quality"** lands center, then **slides left**.
- **"Local"** flashes center.
- **"Service"** flashes center, then **slides right**.
- The three words take **about 1 s total**, fast and poppy, each on a music hit.
- **"Call now"** with **541.703.3095** at the bottom, on the next hit.
- No dot separators. No URL unless Matt asks. Hold through the end; never cut a note.
- Full spec: `templates/END_CARD_SPEC.md`.

## 2. Visual style (Matt, 2026-10-08, 5:05 PM)
- **Everything animated and moving.** No plain or static text, ever. Words arrive with motion (~~slam, punch, kinetic type~~ calm eased entrances per section 2b, 2026-10-09) and keep a slight drift or scale while holding.
- **No sentences.** Each place or beat gets a **big rank, its name, and one huge number**. At most about 4 words of label.
- **Must not feel like scrolling through stats.** One idea per beat. ~~Badges and numbers **slam**, they do not drift in (see LEARNINGS 2026-10-08).~~ Superseded 2026-10-09 by section 2b: badges and words ease in; count-ups may land fast, then hold.
- **#1 lands on the drop** (the biggest moment in the song).
- Title is animated: e.g. "Bend's 3 hottest ___ right now." Use the right noun for the unit (NEIGHBORHOODS for City of Bend districts; "subdivisions" only when the unit really is subdivisions).
- Keep the **subdivision/district map** visual (Matt loves it): district draw-in, light sweep, lift-out, county lots filling.
- Length: story arc 15 to 30 s (section 2a, Matt 2026-10-08 via Insta Growth). ~~30 to 40 s~~ was the working target before that; the in-flight bend-busiest cut is 39.45 s (C11). A 1:51 cut was far too long. Hook in the first 1 to 2 s.
- ~~Every final number holds at least 1.5 s.~~ Every number and every beat holds **at least 2.5 s** (section 2b, 2026-10-09).
- Keep critical text out of the bottom 280 px and right 120 px (Reels UI).

## 2b. Pacing: calm, not beat-cut (Matt, 2026-10-09, 7:33 AM PT, via Creative Desk)
Matt on the rapid beat-cut pacing: "it just sucks." This replaces every faster rule above (struck through where it applied).
- **Every beat holds 2.5 s or more.** Every number holds at least 2.5 s.
- **At most one move per bar.** Big moments still land on downbeats; just fewer of them.
- **Camera moves are slow and eased** (long ease-in-out pushes, drifts, pull-outs; no snap zooms).
- **No rapid-cut montages, no strobing hit flashes**, no quick photo cuts. Photos hold at least 2.5 s with a slow Ken Burns move.
- Count-ups can still land fast, then hold.

## 2a. Reel structure standard, every clip (Matt, 2026-10-08, via Insta Growth)
1. **Hook in the first 1 to 2 s**: the story or the challenge, not a label. (A title card like "BEND: ASKING VS SOLD" alone is a label; open on the tension.)
2. **Length set for watch time.** Story arc **15 to 30 s**. (Data countdowns that need 3 places + end card may run to about 35 s; anything over 30 s needs a reason in the brief. See conflict C11.)
3. **Real footage or photos** in the piece (public meeting video, Matt's phone footage, real place stills, rights-clear photos). Code-rendered maps and numbers sit on top of or between real footage, not instead of it.
4. **1 or 2 real numbers** carry the clip. More numbers = scrolling stats.
5. **On-screen text readable with the sound off.** The story works muted.
6. **Loopable ending**: the last frame flows back into the first so a replay feels seamless.
7. Then the **locked end card** (section 1).

### Closings Reels (Matt, 2026-10-08, via Insta Growth)
- **Never** a 3-second "price + closed" clip.
- Only homes **Ryan Realty listed or sold**.
- Listing photos **only where Ryan Realty was the listing side, or the rights are clearly ours** (photographer license covers social reuse). Buyer-side deals: no listing-brokerage photos.
- Still no addresses, no buyer or seller names.

## 3. Copy (Matt, 2026-10-08)
- No AI slop, buzzwords, or formulaic ad-speak. Voice: a sharp, casual, confident Bend local, "this is easy stuff" energy.
- Banned words list: nestled, hidden gem, vibrant, thriving, bustling, "whether you're", look no further, dream home, unlock, elevate, discover, explore, journey, "it's not just X, it's Y", "more than just", "in today's market", game-changer, perfect blend, hottest market ever. No exclamation stacks, no taglines.
- **Never "top team"** wording.
- **No em dashes** (U+2014) or en-dash sentence breaks, anywhere: screen, caption, file names. Use a period, a comma, or "to".
- **No addresses, no buyer or seller names**, no identifiable clients. Describe homes and markets, never people (fair housing).
- **Every number comes from real data**, with its definition, window, geography, and property type written in the brief and in a one-line footer on screen. Typical = median. Never round counts; never interpolate; unknown is dropped, never 0.
- No cause claims the data can't carry (e.g. a price cut does not "cause" a slow sale).
- Kill vanity angles ("most homes sold in last 12 months", 2026-10-08).

## 4. Music (Matt, 2026-10-08)
- Songs people know, or what is **trending on Instagram now** (check the phone app's Trending tab; it is not on the web). No stock or Mixkit beds. No throwbacks like Funkytown.
- **Export silent.** Matt attaches the song in the Instagram picker on @ryanrealtybend himself (he accepts the in-app library risk). We give him the **exact picker start time** (m:ss).
- **Never rip, download, or re-host the audio.** Cue maps come from public synced-lyric, BPM, and timing data.
- **Beat-matched**: every ~~cut, slam,~~ move (at most one per bar, section 2b) and end-card word sits on a cue from the song's cue JSON (`templates/cue.schema.json`). Imagine keeps every cue as a config value so a new song only re-snaps.
- **Check the lyrics under every beat.** No clashes with what is on screen (e.g. the "Takin' It to the Streets" second verse about poverty sat under a neighborhood stat; we moved the start to 2:15).
- Keep the Reel under 3:00 (longer is not recommended to non-followers); story arc 15 to 30 s (section 2a).

## 5. QA (Matt, 2026-10-08)
- **Every render is watched start to finish with its audio** (song or click track) by Creative Desk before Matt sees it, with a written critique. Nothing goes to Matt unwatched.
- Imagine's render audit checks every number against the snapshot and greps for dashes. Creative Desk re-checks the numbers on the hold frames.
- Never send Matt a stale cut, a placeholder grid, or an unwatched draft.

## 6. Brand (palette lock 2026-05-13; Matt brand-art rule 2026-10-08)
- **Navy `#102742` and cream `#faf8f4` only.** White is a legibility layer. The old accents (navy-deep, sand, fir, sky, gold) are retired. Any accent color needs Matt's yes (open question below).
  - **Dated exception (Matt, 2026-10-08 10:33 PM PT): "Animate hottest you can use other colors sparingly."** A sparing accent is allowed when Matt asks for it: one hero word (e.g. HOTTEST: ember `#E4572E` into amber `#F2A541`, with a glow) plus at most one tiny echo (e.g. the '?' of '1 ?'). Everything else stays navy and cream. Classy, never cartoon fire. First used in bend-busiest v6.1.
- **Amboqia Boriango** is the display face (names, big words, titles). Geist for small labels/footers/numerals unless Imagine's look says otherwise. Use `amboqia-i-patch.woff2` (capital I renders like a 1).
- Highlight covers: Matt asked for his own branding artwork (2026-10-08), so cropping and recoloring the real engravings (not redrawing) is allowed for covers even though the design system says don't (C8).
- Brand assets are the **real logo and Matt's own artwork only** (engravings, Jax, Tower, yard sign). Nothing generated or redrawn for brand marks. No Lucide/stock icons standing in for brand art.
- Logo only on the end card, not as a watermark or in the first frames.
- MLS photos are never restyled. Imagine never draws numbers, words, maps, or logos (code renders them).
- Imagine produces through the Grok Imagine **web UI** on Matt's subscription. Never the paid xAI API (2026-09-24).

## 7. Formats
- **Loves (Matt, 2026-10-08):** city council / civic news clips built from public meeting video and housing or community-development data; **neighborhood spotlights** ("huge"). Keep civic clips neutral: report the decision, no cheering, no resident testimony clips.
- **Rejected:** **Guess the price** (Matt 2026-10-08: "guess the price is dumb"; confirmed again via Insta Growth 2026-10-08). Do not pitch it again; Funkytown (2026-10-08); generic national-market posts (2026-10-08, via Insta Growth audit, Matt approved); vanity "most homes sold in 12 months" (2026-10-08).
- Matt asked for more creativity (2026-10-08): bring specific stories with sources, ranked, not lists of formats.
- **Public meeting video is OK to clip** for civic pieces (Matt OKed it for Caldera, 2026-10-08). Neutral, no resident testimony.

## 8. Publishing (standing)
- **HOLD is the default. We never publish, schedule, or post.** Matt posts himself. No other bot's "go" counts. (social-publish-gate)
- Tell Insta Growth when Matt has posted (pinning, Stories).

## 9. Where renders run, box and memory (2026-10-08)
- **Imagine's video renders run on Matt's Mac mini (Matthews-Mini), not the shared box** (Matt, 2026-10-08 9:14 PM PT). Project folders on the box stay the source of truth for briefs, data and cues; Imagine syncs what it needs and brings the MP4s back for review.
- The box is shared and often under load. Anything heavy that still has to run on the box **Any heavy job (render, big ffmpeg, test suite, build) runs through `/home/box/agent-data/tools/heavy.sh`** (one at a time, waits for 3 GB free).
- No deep `find /` scans; use `ls` on known paths and scoped `rg`.
- Don't move or rename folders another agent may be rendering in. Link them.

## 10. Safety (standing)
- Never ask for passwords or codes in chat; use the secure sign-in form.
- No buyer or seller names in public copy (also restated in 3).

---

## Known conflicts (found 2026-10-08, RULEBOOK wins until resolved)
| # | Conflict | Where | Ruling here | Needs |
|---|---|---|---|---|
| C1 | Wordmark "bottom center on every stat card", white logo | motion-stats-craft §4 | Logo only on the end card, logo-blue at top | update motion-stats-craft |
| C2 | Headline and numerals in AzoSans-Medium | motion-stats-craft §4, growth-plan §2 | Amboqia display; Geist small type (design system) | update both |
| C3 | Length 7 to 15 s (reach_fast) / 15 to 30 s | motion-stats-craft §4, imagine-video-craft packs | Story arc 15 to 30 s (section 2a) now agrees with story_loop; reach_fast 7 to 15 s only for loops/teasers | align skills |
| C4 | "Socials publishes" / "Writing Bot captions" as the publish path | imagine-video-craft, social-publish-gate, growth-plan §2 | Matt posts himself; we never publish | compatible (HOLD), wording only |
| C5 | "Music added only if Matt approves a bed"; "silent picture default" | motion-stats-craft §4, imagine-video-craft | Silent export + Matt adds the song in the picker, beat-matched | update skills |
| C6 | Old shared end card: logo centered, "ryan-realty.com · 541.703.3095" | `/workspace/motion-clips/endcard.js` (used by clip2.html, clip4.html, neighborhoods/spotlight*.html) | Locked card (section 1). Do not reuse endcard.js | **Resolved 2026-10-08:** Imagine told to extract the v5 card into `motion-clips/endcard_v5.js` and retire endcard.js. Update END_CARD_SPEC when it lands. **Landed 2026-10-08 9:29 PM PT:** `templates/endcard_v5.js`; clip2, clip4, spotlight* switched; END_CARD_SPEC updated; endcard_v5.js re-cut 2026-10-08 10:10 PM PT to Creative Desk spec (centre pops/flashes, 82 px words inside x 120..950, navy/cream only, AmbI, loop hook) |
| C7 | Red `#D64541` + sage accents | asking-vs-sold `B_brief_v1.md` | **Resolved 2026-10-08 (Creative Desk lead decision under Matt's palette lock):** navy/cream only, no red or sage. B_brief v2 written that way | none |
| C8 | "Don't recolor or crop the heritage illustrations" | design system SKILL.md | **Matt's direct ask overrides for Highlight covers** (he asked for his own branding artwork). Set B v2 (brand art cropped and recolored, not redrawn) is the recommendation | Matt picks A or B |
| C9 | Brief v3 still has sentence lines ("Sold all over. No subdivision over 5."), "Call now pill", 12-mo footer copy | `creative-desk/bend-busiest/brief.md` | Superseded by Matt's 5:05 PM direction and v5 config | brief marked superseded in STATUS |
| C10 | Renderer named as "Remotion in the Next.js repo" | motion-stats-craft §0 | Real pipeline: HTML + `render.mjs` in `/workspace/motion-clips` | update skill |
| C11 | Structure standard says story arc 15 to 30 s, 1 or 2 numbers, real footage, loopable end, hook = story not label | Section 2a vs in-flight briefs: bend-busiest v5 (39.45 s, 3 places x number, code-only map, title-label open), asking-vs-sold B_brief (~33 s, 7 numbers, all graphic, "BEND: ASKING VS SOLD" label open), town-ladder (~34 s, 7 prices) | New pieces follow 2a. In-flight ones need a call | Matt/Creative Desk: ship bend-busiest as is or recut to ~30 s; rework asking-vs-sold and town-ladder to 1 to 2 hero numbers + real footage |
|  | Rulings 2026-10-08 | | **bend-busiest ships at 39.45 s** (inside the 30 to 40 s window, locked to the song); its hook and loop are accepted as is. **Asking vs sold** rewritten to §2a (B_brief v2, 24 s, 2 numbers, map base, loop seam). Town ladder and Caldera get §2a briefs | |
| C12 | Renders on the box via heavy.sh | motion-clips scripts (`finish_v5_heavy.sh`), this rulebook's old §9 | Renders on Matthews-Mini (Matt 9:14 PM). The v5 low-mem assemble on the box was still waiting for 3 GB free | Imagine: confirm where the v5 assemble finishes |
