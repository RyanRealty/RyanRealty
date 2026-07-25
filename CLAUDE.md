# THE LOOP — the canonical development process (READ ZEROTH)

> **All development routes through THE LOOP v1.1.0 — see [`docs/DEVELOPMENT_PROCESS.md`](docs/DEVELOPMENT_PROCESS.md).** One self-improving cycle: ingest telemetry -> diagnose -> prioritize -> fix the class -> verify exhaustively -> ship -> measure -> learn -> lock behind a gate -> compete. It carries the preflight contract (no change starts blind), the live-environment rules, the escape-ledger protocol, and the approval model. Enforced by G44 (`ci:process-canon`). The sections below are the hard constraints THE LOOP operates under.

# Data Accuracy — ABSOLUTE, NON-NEGOTIABLE (READ FIRST)

> **Canonical database reference (read this BEFORE writing ANY SQL or market-report code):** [`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md). It covers every `public.*` table, the cache model (`market_pulse_live` 10–15 min freshness, `market_stats_cache` 6-hour freshness), the 14 resort communities + 14 Bend neighborhoods + cities, the `listings` mixed-case column quoting rule (the #1 cause of failed queries), slug formats per `geo_type`, and the SFR-only convention. **Don't aggregate raw `listings` for market reports — use the cache.** Registry source-of-truth: [`data/resort-communities.json`](data/resort-communities.json).

> **Methodology version — the definition and the stamp disagree. Cite the stamp.** `public.cache_methodology_definitions` holds 3 rows; the newest definition is `v4-2026-05-15` (effective_at 2026-05-15 17:08:03+00, `superseded_by` NULL). But **no live cache row is stamped v4.** Every row the site serves carries `methodology_version = 'v3-2026-05-07'`: `market_pulse_live` 17 of 17 rows (newest updated_at 2026-07-25 01:18:08+00), `market_stats_cache` 10,955 rows (newest computed_at 2026-07-25 01:15:00+00), plus 70 legacy `v1-pre-fix` rows and 5 NULL, zero v4. So when you state what a number was computed under, state **`v3-2026-05-07`** — that is the stamp on the row — and never claim v4 for a served figure. (Trace: `select methodology_version, count(*) from public.market_stats_cache group by 1` and the same over `market_pulse_live`, Supabase `dwvlophlbvvygjfxcrhm`, run 2026-07-24. The v4 definition was registered by migration `supabase/migrations/20260515170000_resort_communities_neighborhood_aliases.sql` but the cache writer never adopted the string — that gap is a tracked defect, not a doc error.)

**Every number that leaves this shop must be verified against the source of truth before it goes in front of a human, a social feed, an email, an MLS, a website, a video, a chart, a report, or a listing document.** No exceptions. Matt is a licensed principal broker. Publishing inaccurate data — price, inventory, DOM, YoY, sale-to-list, absorption, neighborhood stats, anything — is a compliance risk to Ryan Realty's license. This rule outranks speed, style, cost, and every other instruction in this file.

## What "verified" means (mandatory checklist before publish, send, or render)

1. **Name the source.** Every stat must trace to one of: live Supabase (`ryan-realty-platform`, table + filter documented), MLS direct pull, official agency data (ORMLS, NAR, Case-Shiller, OHCS, Census, BLS, FRED), or a linked primary-source URL. "I remember" is not a source. LLM-recall numbers are not a source.
2. **Pull the query fresh.** Re-run the SQL/API call in this session. Never reuse a hard-coded value from a prior script without re-confirming.
3. **Print the raw result.** Show the row counts, the date window, the filter (`PropertyType='A'` for SFR, geography, status, close-date range). The number in the deliverable must equal the number in the printout.
4. **Cross-check math.** Derived stats (months of supply, YoY %, absorption, median, price/sqft) get recomputed and the computation is shown. **Months of supply formula** = `active_listings / (closed_last_6_months / 6)`. **Thresholds: ≤ 4 seller's market, 4–6 balanced, ≥ 6 buyer's market.** Market classification (seller/balanced/buyer) verdict must match the actual MoS number against these thresholds.
5. **Reconcile narrative to data.** Every sentence, subhead, verdict, and pill has to be consistent with the number it sits next to. A "seller's market" verdict next to 4.3 months of supply is a fail.
6. **QA the rendered output.** For video or image deliverables, capture stills of every scene and visually confirm the displayed number matches the verified number. For text, grep the draft for every figure and map each to the source row.
7. **If a stat can't be verified, it doesn't ship.** Cut it. Don't estimate. Don't round-fill. Don't "approximate." The deliverable goes out with fewer numbers rather than one wrong one.

## What triggers this rule

Any deliverable containing market statistics, listing data, financial figures, neighborhood claims, competitive comparisons, or historical comparisons — including market reports, social video, email newsletters, blog posts, landing pages, listing descriptions, IG/TikTok/FB captions, printed flyers, video thumbnails, open-house signage, CMAs, seller net sheets, and anything else that goes to a consumer, client, lead, or public audience.

## What's forbidden

- Hard-coding numbers from a previous version of a deliverable into a new version without re-verifying.
- Trusting CountUp targets, chart values, or pill text that came from memory, prior chats, or another AI system.
- Using "about," "roughly," or "approximately" as a substitute for pulling the actual data.
- Shipping a deliverable when any stat has a question mark next to it in the source trace.
- Letting narrative voice override data — if the data contradicts the pre-written story, the story changes, not the data.

## Enforcement

Before any market-data deliverable is sent, rendered, posted, or committed: produce a one-line verification trace per figure ("$475K median — Supabase listings, PropertyType='A', City='Redmond', CloseDate 2026-01-01..2026-04-19, median(ClosePrice) = $475,000 over 188 rows"). Matt or a reviewer can audit the trace. No trace, no ship.

---

# Approval Model — confirmed by Matt 2026-07-21 (READ SECOND)

**Full autonomy with post-hoc review for everything reversible. Per-action approval for exactly four classes.** This supersedes the old "Draft-First, Commit-Last" blanket rule.

Reversible work — code, infrastructure, gates, DAL functions, migrations, site content, skills, dead-code deletion — is built, committed, and pushed without waiting for review. Matt reviews after the fact; a bad change gets reverted.

**Per-action approval (Matt must say yes to the specific action, every time — silence is never approval, a passing gate is never approval):**

1. **Outbound messages to real people** — email or SMS to a client, lead, or prospect that an agent initiates. Broker-initiated sends from the CRM are the broker acting for themselves.
2. **Publishing posts** — anything landing on a public social channel. Runtime mechanism: the publisher requires a human approval stamp ≤ 7 days old.
3. **Ad spend** — creating, changing, or scaling paid campaigns.
4. **OAuth grants** — connecting accounts or granting scopes.

**One commit-time class keeps the approval marker:** rendered content deliverables (video files in tracked `public/` paths) require `Approved-by: matt` or `Draft-shown: <url>` in the commit message — enforced mechanically by `scripts/check-draft-first.mjs` via the commit-msg hook. Everything else commits clean.

Content drafts (video, copy, creative) still get built to scratch (`out/`, gitignored) and shown to Matt before they enter a distribution path — that is what "publishing is per-action" means in practice.

---

# Brand Voice — ABSOLUTE, applies to EVERY piece of text (READ THIRD)

**Every piece of text generated for Ryan Realty — whether it ships to a channel, lands in a file, or is pasted into chat for Matt to copy into his own email client — must comply with the brand voice rules below.** No exceptions. This rule outranks convenience, speed, and any prior chat context. Matt should never have to remind the agent to strip em-dashes or banned words from a draft.

**Canonical source (single, READ IT):** `marketing_brain_skills/brand-voice/VOICE.md` — **The Five Laws** (1. Show it, don't say it. 2. A number beats an adjective. 3. Talk to a smart adult. 4. The category is not a claim. 5. Every number is live and true) + the two tests (competitor test, receipt test). LOCKED 2026-06-13; replaces the retired `voice_system_v2.md`. Every session that writes a word of Ryan Realty copy reads VOICE.md first and obeys it. `voice_guidelines.md` is now only the mechanical-floor reference; `SKILL.md` is workflow.

**This is not advisory — it is gated.** The Five Laws are hard-coded as `BANNED_PATTERNS` in `scripts/brand-voice-vocabulary.cjs` and enforced by `scripts/check-brand-voice.mjs` (`ci:brand-voice`, in `ci:gates` and the local pre-commit hook). A sentence that brags, panders, or names the category **fails the commit**, ratcheted toward 0. Scope: public-facing copy only (`app/`, `components/`, excluding api/actions/admin); the laws never touch reviews, external quotes, or broker-written listing remarks (they render from data, not literals). The inline rules below remain the floor for short chat snippets.

## What triggers this rule

ANY text the agent produces on behalf of Ryan Realty, in any of these forms:
- An email body drafted in chat for Matt to copy-paste
- A social post caption (IG, FB, TikTok, YouTube, LinkedIn, X)
- A blog post, listing description, or website copy
- A video VO script or on-screen text
- An ad headline or primary text
- A flyer, signage, or printed deliverable
- A market report narrative
- A client-facing email auto-sent from an API endpoint
- A CMA cover letter, signature line, or any prose inside a CMA HTML
- A GBP review response, an MLS public remarks block, an open-house sign

Internal-only text (agent commentary in chat, git commit messages, code comments, debugging logs, technical docs) is NOT governed by this rule. Anything a client or member of the public could read IS.

## Self-check (run before showing ANY draft to Matt)

Before pasting drafted prose into chat or writing it to a file, the agent grep-scans the draft for hard fails. A failing draft does not get shown. Fix it, then surface it.

### Banned punctuation (hard fail)

- **Em dashes** (`—` U+2014 and `–` U+2013 en-dash). Replace with a period or comma. Exception: as a literal data placeholder for "unavailable" in a stats table, the em-dash is allowed.
- **Semicolons** (`;`). Replace with a period.
- **Dramatic colons** — a colon used to introduce a punchline or expansion in body prose. Colons in headers, list intros, and tables are fine.
- **Exclamation marks in body copy.** One exclamation per piece maximum, and none in market-data content.

Compound hyphens are allowed where standard English requires them (single-family, out-of-state, 30-year fixed, first-time buyer, well-maintained). Hyphens in `ryan-realty.com` are required.

### Banned words (hard fail — full list in `voice_guidelines.md` §6.2)

**Real-estate clichés:** stunning, breathtaking, gorgeous, charming, pristine, nestled, boasts, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, luxurious, updated throughout, immaculate, captivating, exquisite

**AI filler:** delve, tapestry, robust, seamless, elevate, unlock, holistic, dynamic, vibrant, bustling, eclectic, curated, bespoke

**Vague qualifiers:** relaxed 2026-06-02 — no longer a blanket banned-word gate (the bare-word ban on about/around/approximately/roughly/fairly/somewhat blocked legitimate plain English and honest measurement hedges). The data-accuracy rule still stands: never substitute "about / roughly / approximately" for a STAT you can pull exactly (§0, reviewer-enforced via the verification trace). In ordinary prose these words are fine.

**Marketing slop:** top producing, top 1 percent, white glove, luxury concierge, premier brokerage, exclusive (as a brokerage descriptor), boutique brokerage, your real estate journey, we are passionate about, we pride ourselves on

**Fake urgency:** act fast, don't miss out, won't last long, won't last

**Hype openings:** "get ready to fall in love," "you won't believe," "introducing," "stunning new listing"

**Pandering / talking down:** "what a beautiful home," "you have great taste," "don't worry, we will handle everything," "let me explain in simple terms," "I know this seems complicated"

### Banned tropes

- Dramatic before-and-after ("most agents do X, we do Y")
- Fake humility brag ("we are just so honored to be voted...")
- Market-doom or market-hype ("the market is crashing" / "on fire")
- Agent-as-hero arc (broker is the protagonist instead of the client)
- **Headcount / smallness positioning** (Matt directive 2026-06-10): "three brokers", "small brokerage", "small team", "a small business like ours", "boutique" — banned on every site/marketing surface. Headcount is not a position and caps the growth story. Position on the standard (what every listing gets), the data, and direct-broker accountability. The phrase "a small business like ours" survives ONLY in Matt's personal 1:1 correspondence voice (review replies, personal letters). Enforced in `scripts/brand-voice-vocabulary.cjs` (category: smallness positioning).
- **Overtly stating a category, virtue, or obvious credential** — "independent brokerage by design", "we're honest / dedicated / local", "three brokers, all licensed and active", a "meet our mascot" moment. A licensed, active broker is the baseline for a real-estate site, not a selling point; naming a category or virtue out loud reads as cheese. Show it with a specific, concrete fact, or cut it. (Matt directive 2026-06-02; memory `feedback-voice-no-overt-statements`.)

### Voice + formatting rules

- **Sentence case** for body headlines. Title Case only for top-of-page hero H1.
- **"You/your"** is the subject (the reader). **"We/our team"** for brokerage identity. **"I"** only when the content is genuinely first-person from Matt (a video VO, a personal letter, a review response).
- **Phone:** `541.213.6706` (dotted). **Web:** `ryan-realty.com` (hyphenated, lowercase).
- **Place separator:** middle dot `·` — e.g. `BEND · OREGON`.
- **Currency rounded** to the nearest thousand: `$895,000` not `$894,750`.
- **Days = integer + "days":** `38 days`.
- **Percents** carry one decimal and a signed arrow when YoY: `↑ 2.1% YoY`.
- **Tabular numerals** on every numeric surface in the UI.
- **No emoji** in blog posts, email body, ad headlines, or video on-screen text. One emoji max in a social caption.

### Canonical phrases (Matt 1:1 correspondence ONLY — review replies, personal letters; NEVER site/marketing copy per voice_system_v2.md, approved 2026-06-11)

- "Thank you so much for taking the time to..."
- "It was genuinely a pleasure working with you."
- "That kind of trust makes all the difference."
- "A small business like ours."
- "Honored to..." / "Privilege to..."
- "I'm always here if you need anything down the road."
- "Wishing you all the best in your new chapter."

Words to favor in Matt's voice: genuinely, honored, privilege, small business like ours, trust, chapter, the finish line, the unpredictable market, without the high pressure.

## Self-check workflow (mandatory before every draft surfaces)

1. **Generate** the draft in working memory or a scratch buffer.
2. **Scan** for hard fails: grep for em-dash, en-dash, semicolon, every banned word, every banned phrase opener.
3. **Rewrite** every hit. Period or comma replaces em-dash. Period replaces semicolon. The real number replaces "approximately."
4. **Read aloud** in Matt's voice. If a sentence sounds like marketing copy (passionate, dedicated, premier, journey, dream), kill it.
5. **Then** show the draft to Matt.

If Matt has to ask "did you check the brand voice?" — the self-check failed. The cost of one extra scan is far cheaper than Matt's review cycles.

## When to load the full skill

Load `marketing_brain_skills/brand-voice/voice_guidelines.md` fully when:
- Writing long-form (blog post, listing description over 100 words, multi-paragraph email, video VO script over 30 seconds)
- Auditing existing content for voice drift
- Updating the rules based on Matt's feedback
- A producer skill runs — every producer's mandatory references already include `voice_guidelines.md`

For short chat-drafted snippets, the inline rules above are the floor. Either way, the hard-fail regex check runs every time.

## Inheritance and cross-references

- `marketing_brain_skills/producers/TEMPLATE.md` already requires every producer to load `voice_guidelines.md`. That covers producer-dispatched content.
- The **Video Build Hard Rules** section below carries the video-specific version of these rules. It is inline here because `video_production_skills/` was deleted 2026-06-15 (Matt directive, commit `abd59955`) — there is no separate video manifesto to load.
- `social_media_skills/platform-best-practices/SKILL.md` carries the platform-specific calibration. Same voice, different format conventions per channel.

## Maintenance

When Matt issues a new voice directive in chat, the agent's job is twofold:
1. Apply it to the immediate draft.
2. Update `voice_guidelines.md` (the source of truth) AND this section of CLAUDE.md if the rule is universal. A rule that lives only in chat history will be forgotten next session.

---

# Video Build Hard Rules (READ FOURTH — for any video task)

**These are the ship-blocker rules every video build must follow — and they are the ONLY ones.** `video_production_skills/` was deleted in full on 2026-06-15 (Matt directive, commit `abd59955`: 83 files, every format producer, the manifesto, the viral guardrails, the captions/safe-zone/quality-gate skills). Nothing survives it except three code modules still imported by the Remotion projects: `video_production_skills/captions/canonical/SingleWordCaption.tsx`, `.../canonical/safe-zones.ts`, `.../canonical/load-amboqia.ts` (mirrored at `video/market-report/src/captions/`). There is no longer a longer skill to "go read" — if a rule is not written below, it is not a rule.

## Format
- 1080×1920 portrait, 30 fps, h264 + aac, faststart, file < 100 MB.
- **Length: 30–45s for viral cuts. Never over 60s.** News clips, listings, market data → 30–45s. Long-form market reports may go to 60s.
- Captions burned in. ~80% of short-form viewers are muted; captions carry the video.

## Hook (first 2 seconds)
- Motion engaged by frame 12 (0.4s). Never static at frame 0.
- On-screen text by frame 30 (1.0s). Centered, 64–80 px headline.
- First spoken word is content (no "hey," "today," "welcome," "let's talk about").
- Hook contains specific element: number, place name, contradicting claim, or visual surprise.
- **Banned openings:** logo, brokerage name, title card on black, "REPRESENTED BY," slow boundary draw, agent intro, generic drone-with-no-overlay.

## First frame as thumbnail (t=0) — HARD RULE (ship-blocker, locked 2026-05-20)

**The first frame of every video must look great as a static thumbnail in a social feed.** Social platforms (IG Reels, TikTok, YT Shorts, FB Reels) auto-generate the preview thumbnail from the first frame unless you supply a custom cover. A black frame, a logo-only card, a blank background, or a low-contrast title slide kills click-through before the algorithm even has a chance.

The first frame must contain:
- Real photo content (hero photography, listing photo, live tile, drone shot — not a brand card)
- A title or headline overlay if needed (sized for thumbnail readability — 64–80 px headlines, NOT body copy)
- Strong contrast (no flat low-luma backgrounds; no flat high-luma backgrounds)

Banned at t=0 specifically:
- Pure black frame (luminance mean < 30/255)
- Pure white frame
- Solid cream / solid navy / solid any-brand-color background with no photo or content
- The Ryan Realty wordmark alone (logo-only intro)
- A "Coming Up" / "Brought to you by" / "Sponsored by" title card
- A blurred or focus-pulling-from-black ramp

Enforced by [`scripts/check_first_frame.py`](scripts/check_first_frame.py) — every video render runs this check before the file moves from `out/` to `public/v5_library/`. Failure surfaces as a ship-blocker. The script's own docstring is the check spec (thresholds: luma 30–240, variance ≥ 250, saturation ≥ 8 at mid-luma).

## Beats
- Standard 2–3s per beat. Luxury drone 3–4s MAX. **No beat over 4s.**
- Minimum 12 beats in a 45s video.
- Three motion types minimum (push_in, push_counter, slow_pan, multi_point_pan, gimbal_walk, cinemagraph, parallax).

## Pattern interrupts (anchored to real content beats, not gimmicks)
- 25% mark: new visual register or text shock.
- 50% mark: hard register shift (exterior → interior, drone → closeup, etc.).
- Final 15%: kinetic stat reveal. **No brokerage attribution, no logo, no contact info in the reveal frame.**

## Text overlays
- **Working safe zone (1080×1920 portrait): x 90–990, y 280–1480** — anchor every text overlay, caption, headline, stat panel, end-card element inside this rectangle. Canonical constants live at [`video_production_skills/captions/canonical/safe-zones.ts`](video_production_skills/captions/canonical/safe-zones.ts) (mirror: [`video/market-report/src/captions/safe-zones.ts`](video/market-report/src/captions/safe-zones.ts)) — import `PORTRAIT_SAFE` / `LANDSCAPE_SAFE` / `SQUARE_SAFE` instead of hardcoding per comp. The rule is this bullet; the old `safe-zones/SKILL.md` was deleted with the rest of the skill tree.
- **Avoid regions (1080×1920 portrait):** top 0–280 (IG / TikTok profile pill + follow), right 960–1080 (action column), bottom 1480–1920 (platform caption box + engagement chrome). No text, no critical content, no logo in any avoid region.
- **Landscape 1920×1080 (YouTube long-form):** working safe zone x 90–1830, y 80–1000. Avoid: top 0–80 (YT title overlay), bottom 1000–1080 (YT control bar).
- **Square 1080×1080 (IG feed / FB feed / LinkedIn carousel slide):** working safe zone x 90–990, y 90–1010. No major platform overlay.
- Body ≥ 48 px, headlines 64–80 px. (Single-word captions ride at 120 px — see captions SKILL.)
- Min 2s display per block. Max 5–7 words per block (except single-word captions, which time to forced-alignment).
- Numbers carry units always: "$3,025,000" not "3,025,000," "4 bedrooms" not "4 BR."
- White text + shadow OR dark pill under text. Never white-on-white, never gold-on-gold. Gold is retired per Design System v2 — replace with navy `#102742` or cream `#faf8f4`.

## VO (ElevenLabs only)
- **Voice: Victoria, ID `qSeXEcewz7tA0Q0qk9fH`** (locked 2026-04-27 — permanent). No other voice.
- Settings: **stability `0.40`, similarity `0.80`, style `0.50`, `use_speaker_boost: true`. Model `eleven_turbo_v2_5`.** (Updated 2026-05-07 — conversational tuning. Canonical source is this file plus the shared libs [`scripts/_voice_lib.py`](scripts/_voice_lib.py) / [`lib/voice/alignment.ts`](lib/voice/alignment.ts); the old `elevenlabs_voice/SKILL.md` is gone. The agent must NEVER fall back to the old 0.50/0.75/0.35 values.)
- **`previous_text` chained** across all lines for prosody continuity.
- Numbers spelled out for ingestion: "475,000" → "four hundred seventy five thousand."
- IPA phoneme tags work on `eleven_turbo_v2_5` (canonical) and `eleven_flash_v2` — they are silently SKIPPED on `eleven_v3`. Use `eleven_turbo_v2_5` for any line that needs forced pronunciation. Tricky place names: Deschutes (`dəˈʃuːts` — "duh-shoots"), Tumalo (`TUM-uh-low`, NOT "TOO-muh-low" — this is the local pronunciation, verified 2026-05-06), Tetherow, Awbrey, Terrebonne, Paulina (`pol-EYE-nuh`), Madras (`MAD-russ`).
- Sentences short. Two clauses max. No commas where Matt wouldn't pause.

## Brand (zero in frame for viral cuts — EXCEPT listing videos, see overlay system below)

> **This block was the v1 spec and it contradicted Design System v2 in this same file until 2026-07-24.** Gold (`#D4AF37`, `#C8A864`), AzoSans as the body/caption face, and cream `#F2EBDD` are RETIRED — do not reintroduce any of them. The v2 values below are the only ones. See "Design System v2" and its migration-conflicts table further down.

- **News, market reports, area guides, memes, evergreen:** no logo, no "Ryan Realty" text, no phone, no agent name, no URL anywhere in the video frame.
- **Listing videos:** the navy logo IS in frame, in the 200 px footer bar only — see "Listing video overlay system" below. No phone, no agent name, no URL anywhere else in frame.
- Brand colors: Navy `#102742`, Cream `#faf8f4`. Two-color palette. White `#FFFFFF` and black `#000000` are allowed only for text-on-photo legibility and scrim layers. No off-brand hex.
- Fonts: **Amboqia Boriango** (headlines, display, captions), **Geist** (body, UI, data). No AzoSans, no Helvetica, no system fallback.
- **End card uses [`listing_video_v4/public/brand/stacked_logo_white.png`](listing_video_v4/public/brand/stacked_logo_white.png)** — never text-only Ryan Realty. (The listing footer bar uses the navy wordmark, not the white stacked logo.)
- **News-clip caption pill is retired.** Captions are single-word Amboqia, white with a soft drop shadow, no pill, in the caption safe zone — the "Captions — HARD RULES" section below is the only caption spec. The old y 1480–1720 pill sat inside the platform action UI.

## Listing video overlay system — HARD RULE (approved 2026-04-28, colors migrated to v2 2026-05-12)
**FINAL spec for every listing video. Old single-panel approach (one dark panel at bottom ~43% of frame, 0.25–0.30 opacity scrim, 456 px logo) is DEAD. TWO layers, both required, both byte-identical across every video in a batch.**

- **Layer 1 — Text-zone scrim:** `rgba(0,0,0,0.40)` covering ONLY the headline/address/price block. Hard rectangle. **No feathering. No drop shadows. No `text-shadow`. No `filter: drop-shadow(...)`.** Photo shows through at 60%.
- **Layer 2 — Logo footer bar:** 200 px tall, flush bottom (`y=1720→1920`), cream-tinted over the photo. Navy `#102742` wordmark from [`design_system/ryan-realty/assets/brand/logo-blue.png`](design_system/ryan-realty/assets/brand/logo-blue.png), **580 px wide**, vertically centered. No gold. No drop shadow on the logo.
- **Strip between the two layers shows clean unobstructed photo** — no scrim, no gradient.
- **Identical across every video in a batch:** same opacity values, same heights, same logo size, same Y positions.
- This bullet list IS the spec. The former master/format skill files (`VIDEO_PRODUCTION_SKILL.md` §1, `listing_reveal/SKILL.md`) were deleted 2026-06-15 and nothing replaced them.

## Banned words (any caption, VO, on-screen text, blog, email, listing copy)
- stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home
- meticulously maintained, entertainer's dream, tucked away, hidden gem
- truly, luxurious, updated throughout
- "approximately," "roughly," "about" as a substitute for the real number (this is the §0 stat-discipline rule — these words are fine in ordinary prose, just never as a stand-in for a number you can pull)
- Em-dashes, semicolons, AI filler ("delve," "tapestry," "robust," "seamless," "elevate," "unlock")

## Render hygiene
- `cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92`
- **Concurrency=1 is required** (Chrome OOMs higher).
- Audio-codec patch is in place (native `aac` encoder, not `libfdk_aac`); ffmpeg/ffprobe symlinks point at static-ffmpeg. If audio-mix hangs, fall back to a video-only render plus a direct `ffmpeg -i video.mp4 -i vo.mp3 -c:v copy -c:a aac -shortest` post-mix. (The old `scripts/mix_news_audio.sh` helper no longer exists.)
- Pre-render asset audit: verify `listing_video_v4/public/v5_library/`, [`listing_video_v4/public/brand/stacked_logo_white.png`](listing_video_v4/public/brand/stacked_logo_white.png), `listing_video_v4/public/fonts/`, and all referenced VO mp3s exist.

## Quality gate (run BEFORE asking for approval)
```
[ ] ffprobe Duration in [30s, 60s]
[ ] ffmpeg blackdetect strict (pix_th=0.05) returns ZERO sequences
[ ] Frame at 0s passes `python3 scripts/check_first_frame.py <render.mp4>` (ship-blocker — luma 30–240, variance ≥ 250, saturation ≥ 8 mid-luma; no black, no logo card, no blank background)
[ ] Frame at 25% has visual register change
[ ] Frame at 50% has pattern interrupt
[ ] Final 15% is kinetic reveal
[ ] No frozen frames at beat boundaries
[ ] No black bars at transitions (parent div transparent + Sequence overlap)
[ ] Banned-words grep clean across captions, VO script, source pills
[ ] All on-screen numbers carry units and trace to citations.json
[ ] No logo / "Ryan Realty" / phone / agent name in any frame except end card
[ ] File size < 100 MB
```

## Viral scorecard (run AFTER quality gate, BEFORE asking for approval)
- Score 1–10 in each of these 10 categories (this list is the scorecard — `VIRAL_GUARDRAILS.md` was deleted 2026-06-15): hook, retention, text, audio, format, engagement, cover, cta, voice/brand, antislop.
- **Format minimums:** listing video 85, market data 80, neighborhood 80, meme 75, earth zoom 85, news clip 80. Default ship floor 80.
- Write `out/<deliverable>/scorecard.json` next to the render. Write `out/<deliverable>/citations.json` with every figure traced to a primary source.
- Auto-zero hits (banned word, unverified number, AI without disclosure, fair-housing hit) = ship-blocker regardless of headline score.

## Content approval applies (see "Approval Model" above)
- Render to `out/` (gitignored). Run quality gate + scorecard. Show Matt the path + scorecard summary. Wait for explicit approval. Then move to `public/v5_library/` and commit.

## There are no longer any long skill files
`video_production_skills/VIDEO_PRODUCTION_SKILL.md`, `VIRAL_GUARDRAILS.md`, `ANTI_SLOP_MANIFESTO.md`, and every per-format and per-capability sub-skill were deleted 2026-06-15. When a rule is missing for an edge case, the fix is to decide it, apply it, and **write it into this section** — not to go looking for a skill file that no longer exists. A rule that lives only in chat history is lost next session.

---

# Design System Rules — MANDATORY

## The Ryan Realty design system is the styling authority

The design system at `design_system/ryan-realty/` defines the look: navy `#102742` + cream `#faf8f4`, **Amboqia Boriango** display + **Geist** body, and the radii/shadows/spacing in `colors_and_type.css`. It is IMPLEMENTED as a themed component library at `@/components/ui/` — these are radix-nova primitives **re-skinned to the design system**. "shadcn" and "the design system" are the SAME thing here, not a choice to make. Build every UI element from `@/components/ui/` (the design-system components) so the whole site inherits the brand look. Do NOT hand-roll raw HTML controls on product/site surfaces, and do NOT treat "use the design system" and "use the components" as conflicting — they are one and the same.

**The per-surface visual target for every page is its mockup at `design_system/ryan-realty/ui_kits/<surface>/index.html`** (homepage, search, city, listing-detail, sell, about, market-report, zip, team, …). When building or reworking a surface, match its mockup. Display headings (page H1s + section H2s) use the Amboqia face — via the `H1`/`H2`/`DisplayHeading` primitives in `components/site/primitives` (which carry `font-display`) — the way the landing pages and the mockups do, never plain Geist. The landing pages look more polished than the rest of the site precisely because they apply this treatment; the rest of the site is being brought up to the same bar.

Every UI element MUST use the design-system components from `@/components/ui/`. No exceptions.

### Component Mapping (use these, not raw HTML):
| Need | Use This | NOT This |
|------|----------|----------|
| Button | `<Button>` from `@/components/ui/button` | `<button>`, `<a className="btn-...">` |
| Card container | `<Card>` from `@/components/ui/card` | `<div className="rounded-... border...">` |
| Form select | `<Select>` from `@/components/ui/select` | `<select>` |
| Text input | `<Input>` from `@/components/ui/input` | `<input>` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox` | `<input type="checkbox">` |
| Badge/tag | `<Badge>` from `@/components/ui/badge` | `<span className="rounded-full...">` |
| Dialog/modal | `<Dialog>` from `@/components/ui/dialog` | custom modal divs |
| Dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | custom dropdown divs |
| Tabs | `<Tabs>` from `@/components/ui/tabs` | custom tab implementations |
| Tooltip | `<Tooltip>` from `@/components/ui/tooltip` | `title` attribute |
| Separator | `<Separator>` from `@/components/ui/separator` | `<hr>`, `<div className="border-t...">` |
| Label | `<Label>` from `@/components/ui/label` | `<label>` |
| Textarea | `<Textarea>` from `@/components/ui/textarea` | `<textarea>` |
| Switch/toggle | `<Switch>` from `@/components/ui/switch` | `<input type="checkbox">` styled as toggle |
| Avatar | `<Avatar>` from `@/components/ui/avatar` | `<img className="rounded-full...">` |
| Table | `<Table>` from `@/components/ui/table` | `<table>` |
| Accordion | `<Accordion>` from `@/components/ui/accordion` | custom expand/collapse |
| Alert | `<Alert>` from `@/components/ui/alert` | `<div className="bg-yellow...">` |
| Progress | `<Progress>` from `@/components/ui/progress` | custom progress bars |
| Skeleton | `<Skeleton>` from `@/components/ui/skeleton` | custom loading placeholders |
| Sheet (mobile menu) | `<Sheet>` from `@/components/ui/sheet` | custom slide-out panels |

### Color Tokens (use these, not hex/named colors):
| Need | Use | NOT |
|------|-----|-----|
| Primary action | `bg-primary text-primary-foreground` | `bg-blue-600`, `bg-[#102742]` |
| Secondary | `bg-secondary text-secondary-foreground` | `bg-gray-100` |
| Accent/CTA | `bg-accent text-accent-foreground` | `bg-gold`, `bg-amber-500` |
| Destructive | `bg-destructive text-destructive-foreground` | `bg-red-500 text-white` |
| Success | `bg-success text-success-foreground` | `bg-green-500 text-white` |
| Warning | `bg-warning text-warning-foreground` | `bg-yellow-500` |
| Muted text | `text-muted-foreground` | `text-gray-500` |
| Borders | `border-border` | `border-gray-200` |
| Card background | `bg-card` | `bg-white` |
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |

### Utility Function:
Always use `cn()` from `@/lib/utils` for conditional/merged classes. Never string concatenate class names.

### Custom CSS Classes:
DO NOT use `card-base`, `btn-cta`, or any custom CSS class from globals.css. Use shadcn components directly.

### Legacy backup (removed — no-op rule):
The `_style_backup/` directory was removed from the repo. Never recreate it. Use only `@/components/ui/` and `app/globals.css`. (The entry remains in `tsconfig.json`'s `exclude` array for historical reasons — harmless.)

---

# Design System v2 — Heritage + Web Registers (locked 2026-05-12)

**The canonical source for every brand-touching decision lives at [design_system/ryan-realty/](design_system/ryan-realty/).** Read order: `MANIFEST.md` → `SKILL.md` → `README.md` → `colors_and_type.css`. Never invent colors, fonts, or asset paths from memory — open the source.

## Two registers — pick one per surface

| Register | Use for | Color | Type |
|---|---|---|---|
| **Heritage** | Yard signs, postcards, door hangers, email banners, IG posts + carousels, print flyers, broker brag sheets, section heroes, listing-tour-video, news clips, all "stamped" moments | Navy `#102742` **monochrome** on cream `#faf8f4` (warm stone neutrals) | **Amboqia Boriango** display; the pre-rendered wordmark as image — never re-typeset |
| **Web / product** | Homepage, search, market hub, dashboards, forms, every UI surface | Navy `#102742` primary on warm stone (shadcn/ui radix-nova) | **Geist** sans for UI/body/captions, **Amboqia Boriango** for display/hero H1s |

Never mix the two on the same surface (except a single cross-register hero or footer block).

## Brand colors — locked hex (palette simplified 2026-05-13)

| Token | Hex | Use |
|---|---|---|
| `--rr-navy` | `#102742` | Primary navy. Logo, CTAs, headlines, focus intent, end-card backgrounds. |
| `--rr-cream` | `#faf8f4` | Warm off-white — primary background. |

**Two-color palette only.** Matt's directive 2026-05-13: "I want to get rid of navy-deep, sand, fir, sky — we won't be using that in anything else, so remove those entirely."

Retired tokens (do not reintroduce):

- retired: `--rr-navy-deep` `#0a1a2e` → use `rgba(16,39,66,0.85)` for hover/pressed states
- retired: `--rr-sand` `#e8e2d4` → use `rgba(16,39,66,0.08)` for borders/dividers
- retired: `--rr-fir` `#2e4a3a` (was forest accent, gone)
- retired: `--rr-sky` `#8fb8d4` (was Deschutes accent, gone)

Utility: white `#FFFFFF` and pure black `#000000` allowed for text-on-photo legibility and scrim layers only. Off-brand hex codes still banned.

**Gold is also OUT of the v2 system.** Both `#D4AF37` (news) and `#C8A864` (listing reels) remain retired. Existing rendered videos in `public/v5_library/` stay as-is until re-rendered; new renders use navy-on-cream. See "Migration conflicts" below.

## Type families — three, with a decision tree

CSS vars are in `design_system/ryan-realty/colors_and_type.css`.

1. Writing a **wordmark or section hero stamp** → use the pre-rendered image from `design_system/ryan-realty/assets/brand/` (e.g. `logo-blue.png`, `illustration-05.png`). Do **not** re-typeset.
2. Writing a **display moment** (hero H1, pull quote, testimonial, yard-sign text, postcard headline, IG cover title, slide title) → **Amboqia Boriango**, navy on cream, tracking `-0.01em` (hero H1) to `0.08em` (all-caps signage).
3. Writing an **arched ribbon sub-label** under a wordmark → **Azo Sans Medium**, UPPERCASE, tracked `0.12em`.
4. Writing **body, UI, market data, forms, nav, video captions** → **Geist** (400/500/600/700). Geist Mono for code.

Font files: `design_system/ryan-realty/fonts/Amboqia_Boriango.otf`, and `AzoSans-Medium.ttf` — retired as the body face, still the arched-ribbon sub-label face only. Geist loads via `next/font/geist` in production; via Google Fonts in design previews.

## Radii — base 10px, ladder to 22px

`sm 6` · `md 8` · `lg 10` (button/input) · `xl 14` (card) · `2xl 18` · `3xl 22`. Badge = pill.

## Shadows — navy-tinted only

All shadows use `rgb(16 39 66 / opacity)`. `--shadow-sm` on resting cards, `--shadow-md` on hover, `--shadow-lg` on hero search. Full ladder in `colors_and_type.css`.

## Focus ring

**3px warm stone.** Never navy. Visible always. 

## Motion ladder

200ms fades · 300ms entrances · 400ms fade-up · 2s loops · 20s Ken Burns. Ease-out entrances, ≤16px travel. Always respect `prefers-reduced-motion`.

## Voice + content — binding everywhere (web, print, video VO, social, email)

The full spec is in `design_system/ryan-realty/SKILL.md`. Highlights:

- **Honest. Transparent. Trustworthy. Direct and kind.** Show, don't tell — let the fact do the work.
- **Four rules:** Direct. Specific. Kind. Honest, even when inconvenient.
- **Phone:** `541.213.6706` (dotted, brand voice — Matt's direct). **Bio phone (attribution-tracked):** `541.703.3095` — use this on social profiles, ads, and any inbound lead-capture surface so calls carry attribution. It is Matt's ported primary Twilio line and lands in the in-house CRM; the old "FUB-tracked" label is stale (Follow Up Boss was decommissioned 2026-06-24). **Web:** `ryan-realty.com` (hyphenated, lowercase). **Place separator:** middle dot · — `BEND · OREGON`.
- **Social handles (LOCKED 2026-05-13) — `@ryanrealtybend` on every platform** (IG, TikTok, Threads, YouTube, X, Pinterest), `/ryanrealtybend` on Facebook + LinkedIn vanity. The older `@ryanrealtybend1` TikTok account was an accidental sandbox-FB-OAuth byproduct — Matt has deleted it. Any new tooling, OAuth flow, publisher integration, or docs that reference a TikTok account use `@ryanrealtybend` only. Cross-platform consistency lets a viewer who sees `@ryanrealtybend` on one feed find Ryan Realty instantly on every other.
- **"You/your"** is the subject. **"We/our team"** for broker identity. **Never "I".**
- **Sentence case** for web headings; Title Case only for the hero H1.
- **Tabular numerals** (`font-variant-numeric: tabular-nums`) for every numeric surface.
- **Currency rounded** to the nearest thousand: `$895,000` not `$894,750`.
- **Days = integer + "days":** `38 days`.
- **Unavailable** → em-dash `—` (em-dashes are banned as punctuation but allowed as a data placeholder).
- **Percents:** one decimal, signed arrow: `↑ 2.1% YoY`.

### Banned vocabulary (extends the video manifesto — applies to every surface)

- Meta-tone: *passionate, dedicated, premier, luxury, boutique, concierge, white-glove*
- Real-estate clichés: *dream home, nestled, breathtaking, turnkey, must-see, stunning, gorgeous, charming, pristine, meticulously maintained, entertainer's dream, tucked away, hidden gem*
- Hedging: *may, could, potentially*
- Marketing exhortations: *Don't miss out! Act now!*
- **Exclamation marks** in body. **Emoji.** Anywhere. Ever. Pressure / scarcity framing.

## Heritage asset cheat sheet

Full inventory: `design_system/ryan-realty/MANIFEST.md`. Most-used:

- **Heritage wordmark:** `design_system/ryan-realty/assets/brand/logo-blue.png` (navy on cream — print, signage, IG, flyers)
- **Signature lockup:** `design_system/ryan-realty/assets/brand/illustration-05.png` (wordmark + beer-glass + dog + tagline ribbon)
- **Mascot Jax:** `design_system/ryan-realty/assets/brand/blue-dog.png` · `white-dog.png` for dark backgrounds
- **Scene illustrations:** `scene-tower.png` (Tower Theater), `scene-water-pageant.png` (historic downtown)
- **CANONICAL BRAND HERO PHOTO (LOCKED 2026-05-13):** `design_system/ryan-realty/assets/hero/hero-old-mill-master-4k.jpg` (1920×1080 F1 frame of `iStock-1330945786` — Old Mill District drone: three smokestacks, American flag at top, Deschutes River with floaters + kayakers, Cascade mountain horizon). **Use this for ANY design surface that needs a banner / cover photo / header / hero / cinematic anchor (social profile banners, email headers, website hero, listing-video intros, flyer + carousel hero slots, marketing collateral, etc.).** Pre-cropped at every social-platform aspect lives in the same `hero/` folder (`banner-2048x1152-youtube.jpg`, `banner-1500x500-x.jpg`, `banner-820x312-facebook.jpg`, `banner-1024x576-gbp.jpg`, `banner-800x450-pinterest.jpg`, `banner-1128x191-linkedin.jpg`). Top-anchored crops so the American flag stays visible at every aspect. **Crop discipline mandatory** — see `design_system/ryan-realty/assets/hero/README.md` for full rules. Stock subscription license (iStock) — active sub required at publish time.
- **Legacy site hero:** `design_system/ryan-realty/assets/hero-poster.webp` (Deschutes aerial) — being phased out in favor of the canonical hero above.
- **14 numbered heritage wordmark variations:** `illustration-01.png` through `illustration-14.png`
- **Element cutouts** (for custom compositing): `design_system/ryan-realty/assets/brand/navy-cream/element-*.png`

## Broker headshots (locked 2026-05-12, transparent PNGs added 2026-05-13)

The three Ryan Realty brokers each have a normalized 800×1200 headshot at `design_system/ryan-realty/assets/team/`. **Both `.jpg` (white bg, kept for legacy) and `.png` (transparent bg, canonical going forward) versions exist:**

- `matt-ryan.png` (transparent) / `.jpg` — Matt Ryan (owner / principal broker)
- `paul-stevenson.png` / `.jpg` — Paul Stevenson
- `rebecca-peterson.png` / `.jpg` — Rebecca Peterson

**Use the `.png` (transparent) version by default.** The subject is cut out cleanly (alpha-matted via rembg u2net_human_seg), so the portrait drops onto any background — cream, navy, a photo, a banner, a gradient — without showing a rectangular white box. Only fall back to `.jpg` if a transparent-aware renderer isn't available.

All three share identical head height (552px top-of-head to chin), top whitespace (20px in the JPG version; the PNG retains the same anchoring), and horizontal centering. Natural color, no filter. Byte-identical mirrors at `public/images/brokers/` under web-convention names (`ryan-matt.png`, `stevenson-paul.png`, `peterson-rebecca.png`). Full spec in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Listing-agent rule:** Every per-listing deliverable (flyer / IG carousel / listing-tour-video end card / blog byline / lead-gen ad / email) includes the **listing agent's headshot** — resolve from the Supabase `listings` row (`ListAgentEmail`, `ListAgentFullName`) to one of the three brokers above. For brand-led content (market reports, news clips, memes, neighborhood guides), the brokerage speaks — omit the headshot and use the Jax mascot instead.

**Composite rule:** Never re-create a rectangular box behind the broker portrait by adding background fills, drop-shadows that fake a frame, or borders. The transparent edge IS the composition — let the portrait float over the underlying surface.

## Migration conflicts vs the prior locked spec (RESOLVED 2026-05-12)

The v1 spec held in this file before today carried gold accents and AzoSans body. v2 supersedes:

| Surface | v1 (pre-2026-05-12) | v2 (locked now) |
|---|---|---|
| Listing video footer logo bar | retired: gold `#C8A864` logo on `rgba(0,0,0,0.70)` bar | Navy `#102742` logo on cream-tinted bar; uses `logo-blue.png` |
| News clip caption pill | retired: 70% navy pill, 2px gold top border, AzoSans 56px | No pill at all. Single-word Amboqia caption, white with drop shadow (see "Captions — HARD RULES") |
| Body / UI / captions font | retired: AzoSans | **Geist** for body/UI/data, **Amboqia Boriango** for display + video captions |
| Cream background | retired: `#F2EBDD` | `#faf8f4` |
| Brand color count | retired: navy, gold, cream, charcoal | Navy `#102742` + cream `#faf8f4` only (navy-deep / sand / fir / sky were themselves retired 2026-05-13) |
| Mascot | Not specified | **Jax** the blue lab — explicitly part of brand |

**Already-rendered videos in `public/v5_library/` stay as-is** (no retroactive re-render). **New renders use v2.** When a video is re-rendered for any reason, it migrates to v2.

## Web product specifics (extends "Design System Rules — MANDATORY" above)

The shadcn/ui-only rule above still holds. v2 additions:

- The `--font-sans` token in `app/globals.css` is `Geist` (already loaded via `next/font/geist` in `app/layout.tsx`). Do not swap to system fonts.
- The radix-nova stone neutral base is correct. Do not migrate to slate or cool greys.
- The `--primary` oklch in `app/globals.css` evaluates to `#102742`. Do not edit.

## Source of truth (flipped 2026-05-14)

**The codebase at `design_system/ryan-realty/` is the source of truth for the brand system, not the Claude Design project.**

Producers in `marketing_brain_skills/producers/` mandate-load this folder on every run. Whatever lives here IS what ships across every flyer, listing reel, IG carousel, GBP reply, and market report. Hand-edits to `colors_and_type.css`, `README.md`, `SKILL.md`, `MANIFEST.md`, `preview/*.html`, and `assets/team/*` happen directly in Claude Code or Cursor — commit and push and the next producer run sees them.

The Claude Design project at `b87a4e11-1017-4fb5-bc82-ed8fec1ec568` is a **visual previewer + prototyping surface**. It mirrors this folder for the Design System tab and is the place to design new tokens, preview cards, or visual variants before they ship.

### How sync works in each direction

- **Codebase → design project.** When Matt opens the design project and asks *"sync from codebase"*, the design agent mirrors `design_system/ryan-realty/` into the project so the Design System tab reflects current truth. Pull, don't push.
- **Design project → codebase.** When Matt prototypes a new card / token / variation in the design project, the design agent writes the file under `codebase-patches/design_system/ryan-realty/<exact-codebase-path>` in its workspace. When Matt opens Claude Code in this repo and asks *"apply design patches"*, the codebase agent rsyncs `codebase-patches/design_system/ryan-realty/` into `design_system/ryan-realty/`, commits, and pushes.

The codebase never depends on the design project being available. The design project never holds canonical state alone.

## Skill self-binding (the rule that keeps this real)

Every content skill (`marketing_brain_skills/producers/*`, `social_media_skills/*`, `automation_skills/*`) MUST reference BOTH of these in its "Required references" section:

1. `design_system/ryan-realty/SKILL.md` — the visual brand spec
2. `social_media_skills/platform-best-practices/SKILL.md` — the platform rule layer (2026 best practices for IG, TikTok, YouTube, FB, LinkedIn)

A skill that produces content without loading both is non-compliant. Update the skill, not the workaround.

## Platform best practices (locked 2026-05-13)

Canonical platform rule layer lives at [`social_media_skills/platform-best-practices/SKILL.md`](social_media_skills/platform-best-practices/SKILL.md). Synthesized from research on 30+ top real estate creators across IG, TikTok, YouTube, Facebook, LinkedIn. The skill resolves these recurring questions:

- **Logo in frame?** Almost always no on short-form (TikTok, IG Reels, YouTube Shorts, FB Reels). Allowed on long-form YouTube after 0:30, FB Reels (tolerated), end cards, thumbnails, print. **"The logo is a closer, not an opener."**
- **Matt's face on camera?** Use the per-surface matrix in the skill (broker brag yes, listing tour optional, neighborhood guide YT long-form yes).
- **Captions?** Geist 500 white with subtle drop-shadow per CLAUDE.md §0.5. Never on navy/colored pills.
- **Length / aspect / hook timing / posting cadence / SEO?** All answered by the cross-platform decision matrix.

**Default to the matrix.** When asking the user a content question, frame it as: "Best practice says X (per platform-best-practices.md). Want to follow it, or override?"

Research sources at `docs/research/best-practices-*.md` (Instagram, TikTok, YouTube, Facebook+LinkedIn, cross-platform branding).

---

## Marketing Brain Architecture (MANDATORY READ for any agent producing marketing artifacts)

Any agent producing content, writing site copy, mutating ad campaigns, or sending communications on behalf of Ryan Realty reads this section first. The architecture governs how every marketing action is generated, dispatched, executed, and approved.

### Producer layer — freeze LIFTED 2026-07-21

Matt lifted the 2026-06-09 growth freeze on 2026-07-21 ("LIFT G45", session transcript). Gate G45 and its baseline are deleted. New producers may be added again. Every producer still routes through the action-row protocol, the approval queue, and the voice/QA gates — the freeze governed growth, never those controls.

### Three invocation modes

| Mode | When Matt says | Skill | What happens |
|---|---|---|---|
| **Run brain** | "run the brain", "weekly brain", "what should we make" | `marketing_brain_skills/run/SKILL.md` | Full cycle: audits → generate action rows → dispatch all to producers in parallel → surface all drafts |
| **Direct produce** | "make a listing video for...", "create a flyer for...", "draft a GBP post" | `marketing_brain_skills/produce/SKILL.md` | Bypasses cycle: parses request → writes one action row → dispatches matching producer → surfaces draft |
| **Read plan** | "show me the brain report", "what's pending" | Read-only query against `marketing_brain_actions` | No dispatch; surface pending rows and their statuses |

**Rule:** Never invoke a producer directly without going through one of these two entry-point skills. The entry-point skills enforce the approval gate and the action-row audit trail.

### Execution path (canonical vs legacy)

There are THREE ways a producer can actually run. The first is canonical and replaces the others.

| Path | Trigger | When it fires | Audit trail |
|---|---|---|---|
| **Producer-runtime cron** (canonical) | `/api/cron/producer-runtime` | Hourly (`0 * * * *` in `vercel.json`) when `PRODUCER_RUNTIME_ENABLED=true` on Vercel. Polls `status='in_production'` rows, loads the producer's SKILL.md, calls Claude Sonnet 4.5 via the Messages API, transitions to `ready` with full `executor_response`. | Full. Every row touches `marketing_brain_actions` + writes to `marketing_cost_ledger`. Cost capped at $5/row, $15/run, max 3 rows/run. |
| **One-shot admin trigger** | POST `/api/admin/run-producer/[id]` | Matt clicks "Run producer now" in `/admin/approval-queue`, OR an admin curls the route with a session cookie. Same logic as the cron, runs exactly one row. | Full. Same `marketing_brain_actions` flow, `triggered_by='admin_manual'` in executor_response. |
| **Direct CLI** (legacy, discouraged) | `python3 scripts/build_X.py <payload.json>` | Manual dev / one-off test. **Guarded by `require_action_row(payload)` in `scripts/_producer_lib.py`** — opt-in per producer. Once a producer calls the guard, rogue invocations refuse unless `PRODUCER_ALLOW_ROGUE=1`. | None unless the payload carries `action_id`. The guard's job is to refuse silent rogue runs. |

**The canonical path is the cron.** The brain creates a `pending` row → `producer-dispatcher` cron transitions to `in_production` → `producer-runtime` cron executes → row hits `ready` → Matt reviews in `/admin/approval-queue` → approve → `publisher-sweep` cron hits `/api/social/publish` → row hits `executed` → `marketing-measurement-loop` cron populates `content_performance` → row hits `measured`.

**Cadences come from `vercel.json`, not from prose** (the three written here drifted and were wrong until 2026-07-24): `producer-dispatcher` `0 * * * *` hourly, `producer-runtime` `0 * * * *` hourly, `publisher-sweep` `*/30 * * * *` every 30 min, `marketing-measurement-loop` `0 15 * * *` daily. `scripts/check-cron-registered.mjs` (`ci:cron-registered`) enforces that every cron route is registered; the schedule itself is whatever `vercel.json` says, so read it there.

**Skill-only producers** (REGISTRY rows annotated `⚠️ NO_SCRIPT`) cannot run via the legacy Python CLI because no `scripts/build_X.py` exists. They run ONLY via the producer-runtime cron, which reads the SKILL.md directly. Cron-callable does not require a build script — the SKILL.md IS the recipe.

**Migration status (2026-05-21):**
- `PRODUCER_RUNTIME_ENABLED=true` set in Vercel production env.
- `require_action_row()` shipped in `_producer_lib.py` (commit 749377f). No producer scripts call it yet — opt-in as scripts are touched.
- REGISTRY reconciled: 80 brain-callable producers in REGISTRY, 8 skill-only (NO_SCRIPT).

### The protocol: `marketing_brain_actions` table

Every marketing action — brain-generated or manually triggered — gets one row in `public.marketing_brain_actions` (Supabase project `dwvlophlbvvygjfxcrhm`).

**Key columns:**

| Column | Purpose |
|---|---|
| `action_type` | `content:listing_reel`, `site:copy_update`, `ops:meta_ads_pause`, etc. |
| `target` | Subject: `mls:220189422`, `/listings`, `city:Bend`, `topic:wildfire-risk` |
| `assigned_producer` | Path to the producer's SKILL.md (e.g. `marketing_brain_skills/producers/cma`, `social_media_skills/list-kit`) |
| `payload` | Action-type-specific data the producer needs (jsonb) |
| `data_evidence` | Raw signal evidence from audits that triggered this action (jsonb) |
| `generation_reason` | Human-readable explanation of why this action was created |
| `executor_response` | What the producer returned after execution (nullable jsonb) |
| `executed_at` | When the producer transitioned to `in_production` |

**Status flow:**

```
pending → in_production → ready → [Matt approves] → approved → executed → measured
                                                                 │
                                          killed ◄───────────────┘ (Matt cancels or QA fails)
```

**Backward-compat view:** `public.content_briefs` is a view over `marketing_brain_actions`. Existing code using `.from('content_briefs')` keeps working.

**Four action-type categories:**

| prefix | examples | approval |
|---|---|---|
| `content:` | `content:cma`, `content:blog_post`, `content:list_kit`, `content:fb_lead_gen_ad` | matt-review-draft |
| `site:` | `site:cta_update`, `site:copy_update`, `site:page_create` | matt-review-PR |
| `ops:` | `ops:meta_pause`, `ops:meta_budget`, `ops:gbp_post` | matt-explicit |
| `comms:` / `analyze:` | `comms:alert`, `analyze:anomaly` | none (internal) |

### Producer registry

**Path:** `marketing_brain_skills/producers/REGISTRY.md`

The brain reads this file at decision-time. Sections A–F are brain-callable producers. Sections G–I are capabilities and infrastructure (not action-type targets).

To look up a producer for a given `action_type`: find the row in Sections A–F where `action_types` contains that string. The `path` column is `assigned_producer`.

**Never hard-code a producer path.** Always resolve through the registry.

### Content actions route through `automation_skills/content_engine/`

Every `content:*` action — regardless of source (brain cycle or direct produce) — dispatches through `automation_skills/content_engine/SKILL.md`. No content producer is invoked directly. The content engine owns: storyboard pass → build → QA pass → Matt review → publish → post-mortem. Skipping it means skipping the QA gate and viral scorecard. That is not allowed.

**Non-content actions** (`site:*`, `ops:*`, `comms:*`, `analyze:*`) dispatch directly to the producer at `assigned_producer/SKILL.md`.

### Producer SKILL.md template

**Path:** `marketing_brain_skills/producers/TEMPLATE.md`

Every producer skill has 10 required sections:

1. Scope (what it does + what it does not)
2. Action types handled (list + payload schemas)
3. Brief payload schema (TypeScript interface)
4. The recipe (step-by-step expertise)
5. Tools used (APIs, MCPs, env vars)
6. Output format (where draft lands, how to surface it)
7. Approval gate (what kind of human approval)
8. Status flow (how producer transitions the action row)
9. Failure modes (common errors + recovery)
10. Related skills + playbooks + references

The frontmatter must include `action_types: [...]` listing every action_type string the producer handles.

### Approval gates by action_type category

| action_type prefix | approval type | what counts as approval |
|---|---|---|
| `content:*` | matt-review-draft | Matt says "ship it" / "approved" / "go" after seeing the draft |
| `site:*` | matt-review-PR | Matt merges the GitHub PR |
| `ops:*` | matt-explicit | Matt explicitly names the action in the conversation (not inferred) |
| `comms:alert` | none | Brain sends directly; Matt sees it in iMessage/Slack |
| `analyze:*` | none | Findings written to marketing_decisions; surfaced in next digest |

**Silence is never approval.** A passing QA gate is never approval. A successful build is never approval.

### Status flow (ASCII)

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ draft complete, QA passed
        ▼
      ready        ← executor_response populated with draft_path + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ publish step completes
        ▼
    executed       ← git commit+push OR API call OR PR merge done
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes metrics to content_performance

    killed         ← terminal; Matt cancels OR QA fails after 2 auto-iterations
```

### Producer expertise model

Every producer reads its own references before executing. **These rules apply GLOBALLY — every piece of content created for any Ryan Realty surface (social, web, email, print, video) inherits them whether the producer "knows about" the rule or not.** Hidden-in-an-optional-skill is not acceptable. Every content producer loads ALL of:

**Tier 1 — mandatory for every producer (every action_type):**
1. `CLAUDE.md` §0 — Data Accuracy mandate (non-negotiable; outranks all other instructions)
2. `CLAUDE.md` "Approval Model" — content publishing is per-action approved (non-negotiable)
3. `design_system/ryan-realty/SKILL.md` — brand visual system
4. `marketing_brain_skills/brand-voice/SKILL.md` + `voice_guidelines.md` — voice enforcement (`grep_banned()` / `has_hard_fail()` from `scripts/_producer_lib.py`)

**Tier 2 — every content producer additionally loads:**
5. `automation_skills/content_engine/SKILL.md` — the routing bus they are called from
6. `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer
7. `CLAUDE.md` "Video Build Hard Rules" — banned content + banned openings + scorecard minimums. This section replaced `ANTI_SLOP_MANIFESTO.md` and `VIRAL_GUARDRAILS.md`, both deleted 2026-06-15.

**Tier 3 — every video / animated content producer additionally loads (locked 2026-05-20):**
8. `CLAUDE.md` "Captions — HARD RULES" — single-word Amboqia caption rule. Canonical component: [`video_production_skills/captions/canonical/SingleWordCaption.tsx`](video_production_skills/captions/canonical/SingleWordCaption.tsx). **Every video with VO uses it — no exceptions, no alternate caption components.**
9. `CLAUDE.md` "Text overlays" — platform-aware safe zones for portrait / landscape / square. **Import from [`video_production_skills/captions/canonical/safe-zones.ts`](video_production_skills/captions/canonical/safe-zones.ts); never hardcode coords.**
10. `CLAUDE.md` "ElevenLabs Voice" — Victoria voice + canonical settings. **Every VO call goes through [`scripts/_voice_lib.py`](scripts/_voice_lib.py) (Python) or [`lib/voice/alignment.ts`](lib/voice/alignment.ts) (Node) — no inline ElevenLabs API calls.**
11. [`scripts/check_first_frame.py`](scripts/check_first_frame.py) — first-frame thumbnail gate. **Every video render runs it before publish.**

**Tier 4 — flat-design / static-image producers (FB lead-gen ad, flyer, IG carousel, LinkedIn doc carousel, map static card, Google Ads SERP card) additionally load:**
12. [`marketing_brain_skills/competitor-design-recon/SKILL.md`](marketing_brain_skills/competitor-design-recon/SKILL.md) — Apify-driven layout pattern library. **Read `out/design-recon/<format>/recon.md` at build time; adapt a documented pattern instead of inventing layouts.**

**Tier 5 — content type-specific (load only the one matching your action_type):**
13. The matching producer SKILL.md resolved through `marketing_brain_skills/producers/REGISTRY.md`. **Video producers were decommissioned from the registry 2026-06-14** — there is no `video_production_skills/<format>/SKILL.md` to load, and a brain row that names one cannot execute.

A producer that executes without loading the applicable tier references is non-compliant. The TEMPLATE.md producer scaffold enumerates these tiers — fix the producer, not the content. **If a rule is hidden in a skill that the producer doesn't load, the rule itself is broken — move it into a tier above.**

### Global enforcement check (recommended pre-render)

Every video producer's build pipeline should run, in order:

```bash
# 1. Verify the producer's source actually imports the canonical libs
grep -q 'from scripts._voice_lib' scripts/build_<producer>.py || echo "FAIL: not using shared voice lib"
grep -q 'SingleWordCaption\|safe-zones' video/<comp>/src/*.tsx || echo "FAIL: not using canonical captions/safe-zones"

# 2. Run the brand-voice check on all on-screen text + VO scripts
python3 -c "from scripts._producer_lib import has_hard_fail; ..."

# 3. Render, then verify the first frame
python3 scripts/check_first_frame.py out/<format>/<slug>/<file>.mp4

# 4. Run blackdetect + duration check (existing quality gate)
```

A producer that ships without these checks is non-compliant. Every per-producer rebuild is responsible for wiring its build pipeline to all four steps.

### Existing exemplar: list-kit

`social_media_skills/list-kit/SKILL.md` is the canonical compound-producer pattern. It demonstrates: single data pull fans out to 5 parallel deliverables, verification trace per figure, draft surface format, kit-manifest.json, approval gate, publish step, asset library registration. Read it before building any new orchestrator-class producer.

---

## Opus Orchestrator Policy (MANDATORY)

This agent runs on Opus. Opus is ~15× the per-token cost of Haiku. **Do not burn Opus context on mechanical/bulk work.** Delegate to subagents via the `Agent` tool (`model: "sonnet"` or `"haiku"`).

**Always delegate:**
- Codebase enumeration and grep sweeps across many files (`Explore` subagent)
- Bulk refactors / rename-across-repo tasks
- Reading/parsing >10 files to understand a module
- Running long test suites, builds, or deployments
- Data extraction from Supabase / large CSVs / logs

**Opus keeps:**
- Architecture decisions (ADRs), system design
- The final code review before ship
- User-facing product decisions and trade-offs
- Complex debugging where context across multiple systems matters

Launch parallel subagents in a single message when work is independent. **Never use `git worktree` or a non-`main` branch for this repo** — all code changes land in the single checked-out `main` working tree. See memory: `feedback_orchestrator_pattern.md`.

---

## Mechanical guardrails (READ FIRST)

Prose rules in this file are advisory. The **only** rules I am required to follow are the ones encoded as mechanical gates — they fail my commit. Full catalog: [`docs/MECHANICAL_GATES.md`](docs/MECHANICAL_GATES.md).

Before every commit on a user-facing surface:

```bash
npm run ci:gates
```

That runs the gate chain defined in `package.json` → `ci:gates` (that script is the authoritative list — don't re-enumerate it in prose, it drifts): design-tokens + seo-routes + DAL boundary + brand-voice + **mockup parity** + **page DAL** + **static params** + **cron-registered** + the meta-gate `ci:gates-wired`, among many others. If any fails, the commit doesn't ship. The meta-gate (`ci:gates-wired`) now also fails on any `scripts/check-*.mjs` that runs nowhere — closing a blind spot the 2026-06-20 audit found (28 gate files ran nowhere while docs called some "enforced"); 7 remain a tracked orphan backlog in `scripts/gates-wired-baseline.json` (21 of the 28 since wired or fixed-then-wired; triage the rest: wire or delete; the count may only shrink). DB-dependent gates (G16 `ci:data-access`) run locally/nightly — they hit live Supabase, so they are NOT in the secret-less static chain.

The most important one added 2026-05-28 is **mockup parity** (`scripts/check-mockup-parity.mjs`). Every Wave 3 page rebuild must satisfy the corresponding `design_system/ryan-realty/ui_kits/<route>/parity.json` contract — which enumerates every component the mockup says the page must import. If I edit `app/<route>/page.tsx` without the matching components, CI fails. Adding a new gated route: place the mockup + create the `parity.json` + the gate auto-picks it up.

**If a guardrail keeps being violated, the answer is a new mechanical gate, not more prose.** Add it via the pattern in `docs/MECHANICAL_GATES.md` "How to add a new gate."

### Which rule in this file is a gate, and which is only prose

Read this before you decide a rule is optional. A gated rule fails the commit whether or not you read the section. An ungated rule is enforced by a reviewer or by nothing — those are the ones that rot, so treat them as the ones to convert next.

| Rule in this file | Mechanism | Gate script |
|---|---|---|
| Brand voice — banned words, Five Laws | gated | `scripts/check-brand-voice.mjs` (vocabulary in `scripts/brand-voice-vocabulary.cjs`) |
| Design tokens — no off-brand hex, no raw controls | gated | `scripts/lint-design-tokens.js` |
| Mockup parity per surface | gated | `scripts/check-mockup-parity.mjs` |
| DAL boundary — no raw `.from()` outside `lib/data/` | gated | `scripts/check-dal-boundary.mjs` |
| Every `app/<route>/page.tsx` imports the DAL | gated | `scripts/check-page-dal.mjs` |
| `listings` mixed-case columns are quoted | gated | `scripts/check-dal-column-quoting.mjs` |
| Schema snapshot + DAL index stay current | gated, local/nightly only (needs DB creds) | `scripts/check-data-access.mjs` |
| Every cron route is registered in `vercel.json` | gated | `scripts/check-cron-registered.mjs` |
| THE LOOP process canon, no rogue plan files | gated | `scripts/check-process-canon.mjs` |
| Loop skills stay on the 2026-07-21 approval model | gated | `scripts/check-loop-skills-canon.mjs` |
| Every `scripts/check-*.mjs` actually runs somewhere | gated (meta) | `scripts/check-gates-wired.mjs` |
| A ledger row cannot claim "done" without a real mechanism | gated (meta) | `scripts/check-program-complete.mjs` |
| This file cites no dead path, no decommissioned FUB doc, no retired v1 design token | gated | `scripts/check-claude-canon.mjs` |
| Rendered video deliverables carry an approval marker | gated via the commit-msg hook | `scripts/check-draft-first.mjs` |
| First frame of a render is a usable thumbnail | gated in the render pipeline, not in CI | `scripts/check_first_frame.py` |
| §0 data accuracy — every number traces to a named source | prose plus reviewer. No gate can read a deliverable's intent; the per-figure verification trace is the mechanism | — |
| Video hard rules — length, hook, beats, safe zones, VO settings | prose plus the quality gate you run by hand before asking for approval | — |
| Approval model — the four per-action classes | prose, except the commit-msg marker above | — |

`package.json` → `ci:gates` is the authoritative chain. This table maps rule to mechanism; it does not replace that chain.

---

## Work Standards

- **No shortcuts, no assumptions.** When coding, implement the full solution from start to finish. Never stop halfway and present partial work as complete. When answering questions about the codebase, trace the logic all the way through to a confirmed answer — no surface-level glances, no guesses.
- **Always verify your own work.** Before saying something is done or something is true, confirm it. Run the code, check the output, read the actual files. Never assume. Every claim about code behavior must be verified by actually reading the relevant code. Every fix must be tested to confirm it works before reporting it's done.
- **Truthful and accurate, always.** If you're not sure, say so. Never state something as fact unless you've confirmed it. If you got something wrong, own it immediately.
- **No partial answers.** When asked about status, where things stand, or how something works, go all the way through to the end to figure out the exact answer. There are never any assumptions being made — always confirm.
- **Always push directly to main.** No **`git worktree`**, no extra local or remote branches, no feature branches unless explicitly asked — one checkout, **`main` only**.
- **Same pipeline as Cursor.** Matt switches between Claude Code and Cursor on one repo. Before work: `git pull --rebase origin main`. After every commit on `main`: **push to `origin` immediately** — no “saved locally” commits. **Migrations:** apply to hosted Supabase in the same delivery as code that depends on them (see `AGENTS.md` *Claude Code ↔ Cursor*, `.cursor/rules/production-parity.mdc`, `.cursor/rules/supabase-migrations-auto.mdc`). Optional continuity: `~/.claude/plans/HANDOFF-*.md` + `docs/plans/task-registry.json`.
- **Never ask Matt to run anything manually.** You handle ALL git operations, ALL terminal commands, ALL deployments, everything. Matt never touches the terminal. If something needs to be done, you do it.
- **Proactively clear git locks.** Before ANY git operation (commit, merge, rebase, pull, push), check for .git/index.lock and remove it if it's stale. Never let a lock file block progress. Never report a lock file to Matt as a blocker — just fix it.
- **No blocked builds or commits.** Builds must never back up. Commits must never be blocked. If something is in the way, fix it yourself. Exhaust every option before reporting an issue.
- **No half measures. Research how pros do it first, nail it the first time.** Before scaffolding anything non-trivial, look at how the best agents/teams in the field do it (the actual viral creator, the actual top-tier broker workflow, the actual reference implementation). Build to that standard from the start. Don't ship a minimum-viable thing and iterate ten times — that wastes Matt's review cycles and produces drift. Get it right.
- **Vault is the sole source of truth for transaction coordination.** When auditing, reconciling, or reporting on transactions, query Vault. **Never reconcile transactions against SkySlope** — SkySlope is a workflow tool, not a system of record. Treating SkySlope as authoritative is a known failure mode that produces wrong audit numbers.
- **Full company scope on all audits.** Every audit (transactions, mailboxes, broker activity, listing counts, anything) runs across **all brokers**, **all mailboxes**, and the **max available date range** by default. Never narrow to a single broker, single inbox, or last-30-days window unless Matt explicitly asks for that scope. Partial-scope audits miss outliers and produce false-clean reports.

---

## Persistent memory (repo)

Durable cross-session notes live in **`.auto-memory/`** (same pattern as Cowork `feedback_*.md` references in video skills). **Cascade Peaks video (in flight):** append status to `.auto-memory/memory_cascade_peaks_video_handoff.md` — do not let handoff notes live only in chat. **Local Remotion env (Mac / Cursor, parity with Cowork `work/cascade_peaks`):** `npm run video:cascade-peaks:setup` then `video/cascade-peaks/README.md`.

**Hand off to Cursor / the other Claude agent:** Before Matt switches tools, update **`docs/plans/CROSS_AGENT_HANDOFF.md`** (Current block: what shipped, what is next, commit SHA, skills you read). The other side pulls `main` and reads that file first. See **`AGENTS.md`** (*Cross-agent handoff* + *Skills*).

---

## Data Access Discipline — MANDATORY (enforced by gate G16)

**Before running ANY `mcp__supabase__execute_sql`, `SELECT FROM information_schema`, or raw query — even "just to check the columns" — read these two files:**

1. **[docs/DATABASE_SCHEMA_SNAPSHOT.md](docs/DATABASE_SCHEMA_SNAPSHOT.md)** — auto-generated. Every public table, view, and materialized view. Every column, type, nullable, default. Row counts on the hot tables. **The agent must not run `SELECT column_name FROM information_schema.columns` ever again — the answer is in this file.**
2. **[docs/DAL_INDEX.md](docs/DAL_INDEX.md)** — auto-generated from `lib/data/**/*.ts`. Every DAL function, the tables it touches, the columns it selects, its cache key + TTL + tags. **Before writing a query, find the existing DAL function that already covers the access pattern. If `getMarketPulse({geoType, geoSlug})` exists, call it instead of `SELECT FROM market_pulse_live ...`.**

**Why this matters:**

- Ad-hoc queries bypass `unstable_cache`, hit the production database directly, and put load on a system whose response times affect every user.
- Schema-discovery queries (`SELECT column_name FROM information_schema...`) waste agent context and produce data the snapshot already carries.
- When the agent designs a query path that doesn't match what production uses, the site can get slow because the "verified" pattern isn't the cached one.

**Rules (all mechanically enforceable):**

1. **Schema discovery is forbidden.** If you need to know what columns a table has, read `docs/DATABASE_SCHEMA_SNAPSHOT.md`. Never query `information_schema`.
2. **DAL-first reads.** If the data is reachable via a function in `docs/DAL_INDEX.md`, use that function. Do not write a raw query when a DAL function already covers it.
3. **No raw `.from()` outside `lib/data/`.** Enforced by G1 (ESLint `no-restricted-syntax` + `scripts/check-dal-boundary.mjs`).
4. **Every `app/<route>/page.tsx` imports `@/lib/data`.** Enforced by G8 (`scripts/check-page-dal.mjs`).
5. **Snapshot + index stay current.** Enforced by G16 (`scripts/check-data-access.mjs`, `ci:data-access`). Drift = a migration landed without refreshing the snapshot, or a DAL change landed without refreshing the index. Fix: `npm run ci:data-access -- --refresh` then commit. (`ci:data-access` runs locally + nightly, NOT the static `ci:gates` chain — it regenerates the schema snapshot from live Supabase via `_agent_schema_dump()` and needs DB creds the static chain doesn't have.)
6. **The one legit use of `execute_sql`:** investigating actual data quality (not schema). Even then: read the snapshot first, then run ONE targeted query — not a sequence of "let me see what this returns."

**The auto-refresh path:** the snapshot is regenerated by calling `public._agent_schema_dump()` (a `SECURITY DEFINER` SQL function installed by migration `20260528020000_agent_schema_dump_function.sql`). The DAL index is regenerated by AST-walking `lib/data/**/*.ts`. Both flow through `npm run ci:data-access`. Adding a column? Apply the migration, then `npm run ci:data-access -- --refresh`, then commit. Adding a DAL function? Just `npm run ci:data-access -- --refresh` and commit.

Companion memory: [`feedback_no_adhoc_sql.md`](~/.claude/projects/-Users-matthewryan-RyanRealty/memory/feedback_no_adhoc_sql.md).

---

## Supabase Database — MANDATORY READ before any SQL

**Canonical reference: [docs/DATABASE_FOR_AI_AGENTS.md](docs/DATABASE_FOR_AI_AGENTS.md).** Read this BEFORE writing any SQL or building any market report. It covers every table grouped by purpose, the cache model (`market_pulse_live` 10-min freshness, `market_stats_cache` 6-hour freshness), the 14 resort communities + 14 Bend neighborhoods + city/region levels, the `listings` 800-field reality with mixed-case quoting rules, methodology versioning, slug formats per geo_type, and gotchas. The `data/resort-communities.json` registry is the source of truth for resort/area communities. Don't aggregate raw `listings` for market reports — use the cache.

**Companion auto-generated references** (do not hand-edit, regenerated by G16):
- [docs/DATABASE_SCHEMA_SNAPSHOT.md](docs/DATABASE_SCHEMA_SNAPSHOT.md) — every column in every public table.
- [docs/DAL_INDEX.md](docs/DAL_INDEX.md) — every DAL function in `lib/data/` + the tables it touches.

**Project ID:** `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform` — `dwvlophlbvvygjfxcrhm.supabase.co`).

**Row count:** 589K+ rows in `listings` as of 2026-04-29. Always paginate or aggregate; never `SELECT *` without a tight filter.

**Column-name quirk (RETS standard).** The `listings` table uses **mixed-case column names** that Postgres preserves only when quoted. **Every reference to a mixed-case column must be wrapped in double quotes** or the query returns "column does not exist." This is the #1 cause of failed listings queries.

**Quoted column names (must use double quotes in SQL):**
`"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`, `"Longitude"`, `"TotalLivingAreaSqFt"`, `"PhotoURL"`, `"SubdivisionName"`, `"ClosePrice"`, `"CloseDate"`, `"CumulativeDaysOnMarket"`, `"BedroomsTotal"`, `"BathroomsTotal"`.

**Lower-case columns (no quoting required):**
`year_built`, `pending_timestamp`, `price_per_sqft`.

**Example — correct:**
```sql
SELECT "StreetNumber", "StreetName", "ListPrice", "StandardStatus", year_built
FROM listings
WHERE "StandardStatus" = 'Active'
  AND "ListPrice" BETWEEN 500000 AND 1000000
LIMIT 50;
```

**Example — silently wrong (returns "column does not exist"):**
```sql
SELECT StreetNumber, ListPrice FROM listings WHERE StandardStatus = 'Active';
```

**When in doubt, query `information_schema.columns` FIRST.** Do not guess column names. Do not infer from prior queries — schemas drift.

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'listings'
ORDER BY ordinal_position;
```

For market-data work, also see the master rule above (Data Accuracy §4): MoS formula, thresholds, and Spark × Supabase reconciliation gate. Per-table conventions like `PropertyType='A'` for SFR and YTD windows live in [`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md) and in "Data Accuracy in Video" below.

---

## Skill Routing

**Global index:** Before loading skills ad hoc, open **`~/.claude/GLOBAL_SKILLS_REGISTRY.md`** (or the git mirror **`docs/plans/GLOBAL_SKILLS_REGISTRY.md`**) for the full inventory: repo skills, Cursor plugins (Vercel, Supabase, Figma, Superpowers, etc.), `skills-cursor`, TRANSACTION COORDINATOR skills, and Cowork-mounted skills (section E). **`~/.cursor/GLOBAL_SKILLS_REGISTRY.md`** is a stub that points at the canonical file.

**Load skills first:** If a task might match any **`SKILL.md`** in this repo (`.claude/skills/`, `.cursor/skills/`, `marketing_brain_skills/`, `social_media_skills/`, `automation_skills/`) or in Cursor’s bundled skill paths, **read that skill file before doing the work**—same bar as Cursor agents (`AGENTS.md` *Skills*). `video_production_skills/` is NOT in that list: it holds three code modules and no skills.

**Mandatory:** `engineering:code-review` on every meaningful change before ship. `engineering:deploy-checklist` before any production deploy. `design:design-system` audits whenever shadcn/ui compliance is in question.

**Data work:** `data:*` skills fire automatically on any Supabase / SQL / analytics task.

Everything else (debugging, architecture, testing-strategy, documentation, incident-response, tech-debt, accessibility-review, ux-copy, web-artifacts-builder) fires on trigger match — no table needed.

---

## Content routing — which file to load per deliverable

> **Read this before the table.** `video_production_skills/` was deleted 2026-06-15 (commit `abd59955`) and video producers were removed from `marketing_brain_skills/producers/REGISTRY.md` on 2026-06-14. Every row that used to point at a `video_production_skills/*/SKILL.md` is gone from the table below because the file is gone. For video work, the **"Video Build Hard Rules"** section near the top of this file is the complete ruleset. What remains here is the routing that still resolves.

| Trigger | Load this |
|---|---|
| Any video build (market report, listing reel, news clip, neighborhood guide, meme) | **"Video Build Hard Rules"** in this file — format, hook, first-frame gate, beats, safe zones, VO, brand, quality gate, scorecard. Plus "Captions — HARD RULES", "ElevenLabs Voice", "Video Review Gate", "Pacing Rule" below. Remotion projects live in `video/` and `listing_video_v4/`. |
| **SEO blog post** on ryan-realty.com | `social_media_skills/blog-post/SKILL.md`. **Publishing path is Supabase `blog_posts` rendered by the live Next site, NOT AgentFire WordPress** (memory `reference_blog_publish_path`). |
| **Paid Meta pipeline, marketing automation, weekly optimization crons, seller funnel wiring** | **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** (read first), **`docs/MARKETING_LEAD_FLOW.md`** for path-by-path lead creation, **`.cursor/skills/facebook-seller-growth/SKILL.md`**, **`docs/FB_SELLER_CAMPAIGN_PLAYBOOK.md`** when launching |
| **Facebook lead-gen ad** (FB lead form, creative and form spec) | **`docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`** for live wiring (CAPI, webhooks, dashboard), **`docs/MARKETING_LEAD_FLOW.md`** for webhook plus dedup detail, then `social_media_skills/facebook-lead-gen-ad/SKILL.md`. **Both docs were written pre-cutover and say leads land in Follow Up Boss — they do not.** Since 2026-06-24 every path writes to `public.crm_people` (`lib/followupboss.ts` `sendEvent()` → `ensureNativeLead`); read the FUB parts as "the in-house CRM". |
| **Seller LP follow-up workflow** (auto touches after a seller LP submission — emails, SMS, CMA delivery, broker assignment, pause-on-reply) | **The in-house CRM sequence engine, not Follow Up Boss.** `app/lp/seller-home-value/actions.ts` calls `autoEnrollByFubId()` in [`lib/crm/enroll.ts`](lib/crm/enroll.ts) on submit; `/api/cron/crm-auto-enroll` sweeps anything missed; `/api/cron/crm-sequence-engine` fires the touches; `/api/cron/crm-scheduled-sends` delivers them. Pause-on-reply lives inside the sequence engine (the old `seller-workflow-pause` cron does not exist). Sequences are edited at `/admin/crm/sequences`. The 2026-05-17 FUB workflow docs describe an engine that no longer runs — do not build against them. |
| **Expired/Canceled/Withdrawn listing workflow** — detection + landing page + audit producer | **`marketing_brain_skills/producers/expired-listing-lp/SKILL.md`** — the canonical producer with voice rules + 5-cause audit framework. **`/lp/expired-listing`** — the empathy-driven LP. **`public.expired_listings`** — dedupe + audit trail. Detection runs inside the delta sync, **not** on an hourly `detect-expired-listings` cron: the route exists at `app/api/cron/detect-expired-listings/route.ts` but is NOT registered in `vercel.json`, so nothing invokes it on a schedule. The detected owner becomes a native `crm_people` lead, not a FUB person. Voice: authentic, not salesy — never pander, never editorialize, no "most agents do X" comparison framing. |
| **Per-broker agent attribution** (when Rebecca or Paul's ad points to ryan-realty.com, lead auto-routes to them) | URL param `?agent=<slug>` (slugs: `matt`, `matt-ryan`, `rebecca`, `rebecca-peterson`, `paul`, `paul-stevenson`) → `components/AgentAttributionBridge.tsx` (already in layout) writes `rr_agent_attribution` cookie (90-day TTL). Server-side: `app/actions/agent-attribution-read.ts` `readAttributedAgentServer()` reads the cookie and returns `{ broker, userId }`. Both LP forms (seller + buyer + expired) call this and override the default Matt-routing if cookie is set. Default routing: all leads to Matt per 2026-05-17 directive. |
| **Supabase market-data tables** (any market-report data pull) | [`docs/DATABASE_FOR_AI_AGENTS.md`](docs/DATABASE_FOR_AI_AGENTS.md) + [`docs/DATABASE_SCHEMA_SNAPSHOT.md`](docs/DATABASE_SCHEMA_SNAPSHOT.md) — the full column list for `market_stats_cache`, `market_pulse_live`, `listings`, `listing_history`, `boundaries`, `neighborhood_subdivisions`, `app_config`. |
| **Asset library — register, query, or reuse media assets** | Manifest at `data/asset-library/manifest.json`, CLI at [`lib/asset-library.mjs`](lib/asset-library.mjs). Photos carry vision grades — search the `vision_*` fields. |
| **CMA / Comparative Market Analysis** — "create a CMA for...", "do a market analysis on...", "what's this property worth", "pricing opinion on..." — any per-property valuation deliverable | **`marketing_brain_skills/producers/cma/SKILL.md`** — branded HTML CMA (subject + comp flyers + branded map + 2-method pricing). Signed by the broker handling the listing (resolved from `public.brokers` by email or slug; falls back to Matt if no match). Every finalized CMA is recorded in `public.cmas` with `cma_comps` linking the comps used. Rendered exemplars live under `public/cmas/`. |

**Rule updates are bidirectional.** When Matt issues a directive in chat that produces a permanent rule (e.g. "narrative-only VO", "multi-color line chart", "no photo dupes per render"), the agent's job is twofold:
1. Update the actual code to enforce the rule.
2. **Write the rule into this file** (or the producer SKILL.md, when one owns the surface) so future runs hit it whether or not the agent remembers the chat. A rule that lives only in chat history will be forgotten next session.

Video rules locked 2026-05-07 that survived the skill deletion and still apply to every market-data video: narrative-only VO (the VO does not recite the numbers the screen already shows), caption sync locked to VO timestamps with no padding, multi-color line chart on the price beat, and photo diversity (no repeated photo inside one render).

> **Platform token status (verified 2026-05-06 against live Graph API + Supabase):** Meta Page token is a long-lived never-expires token with full publishing scopes (`pages_manage_posts`, `instagram_content_publish`, `pages_manage_engagement`, etc.) — IG/FB publishing is LIVE. LinkedIn, YouTube, X, GBP all have tokens (some auto-refresh on first call, normal OAuth pattern). TikTok / Pinterest / Threads OAuth tables are empty — these need first-time OAuth connect at the respective platform authorize route.

### Data Accuracy in Video — OUTRANKS EVERYTHING

**Every number shown or spoken in a video MUST trace to a verified primary source. §0 of this file is the rule. A pretty render with a wrong number does not ship — even at 100/100 on the viral scorecard.**

- All figures trace to Supabase (`market_pulse_live`, `market_stats_cache`, `listings`), Spark API (`SPARK_API_BASE_URL` + `SPARK_API_KEY` in `.env.local`), or a named primary source (NAR, Case-Shiller, NAHB, AEI, etc.).
- Query the primary source live BEFORE scaffolding the BEATS array — never inherit numbers from a brief, prior chat turn, web article, or previous render.
- `citations.json` ships alongside every render. One entry per figure: source, table, column, filter, row count, `fetched_at_iso`, query text. No citations, no ship.
- Research briefs, web articles, and conversation context are untrusted. Cross-verify against the primary database.
- Unverifiable stat = cut. No estimating. No rounding to fill a gap. No "approximately."
- **Market reports**: always `property_type='A'` (SFR), YTD windows, apples-to-apples periods. YoY = same window across two years, not Q1 vs full-year.
- **Spark × Supabase reconciliation is a HARD PRE-RENDER GATE for market reports.** Before `npx remotion render` runs, the agent queries Spark for every figure that also exists in Supabase, prints both values + delta %, and **STOPS the render if any `|delta| > 1%`**. Surface the conflict to Matt (figure, Supabase value + query, Spark value + query, delta, suspected cause) and wait for resolution. Re-render only after Matt confirms. Spark wins for active inventory + DOM; Supabase wins for reconciled historical close data once it's refreshed past the Spark cutover date. Document the cross-check in `citations.json`.
- **Months of supply** = `active_listings / (closed_last_6_months / 6)`. Thresholds: ≤ 4 seller's, 4–6 balanced, ≥ 6 buyer's. Verdict pill must match the number.
- **Never round in a way that changes the narrative.** $474,500 → `$475K` is fine; $474,500 → `$500K` is not.

`.env.local` cred status (verified 2026-04-27): `SPARK_API_KEY` ✅, `SPARK_API_BASE_URL` ✅ (`https://replication.sparkapi.com/v1`). `SPARK_TOKEN`, `BRIDGE_API_KEY`, `RESO_API_KEY` ❌ not provisioned — surface to Matt before any build that needs them.

### Captions — HARD RULES (Ship Blockers)

**Captions are the single most-watched element on muted feeds. Choppy or overlapping captions kill retention. These six rules ARE the canonical spec — the former `captions/SKILL.md` and `CAPTION_AUDIT.md` were deleted 2026-06-15 and only the code modules under `video_production_skills/captions/canonical/` survive.**

1. **Captions NEVER render over other visual components.** No overlap with stats, numbers, charts, logos, end-card elements, animated text overlays (titles, price reveals, SlamLine, WordReveal, BreakingBadge), photos with focal content, or any other rendered overlay. If a competing element needs the caption zone for a beat, the caption is suppressed for that beat.
2. **Captions occupy a dedicated reserved safe zone that no other component can enter.** Portrait 1080×1920: y 1280–1460 (center y 1370), x 90–990. Landscape 1920×1080: y 880–1000 (center y 940), x 90–1830. Square 1080×1080: y 850–1010 (center y 930), x 90–990. **Canonical constants:** import from [`video_production_skills/captions/canonical/safe-zones.ts`](video_production_skills/captions/canonical/safe-zones.ts) — `CAPTION_PORTRAIT`, `CAPTION_LANDSCAPE`, `CAPTION_SQUARE`. The older y 1480–1720 portrait coords sat INSIDE the platform action UI and are retired.
3. **CAPTION FORMAT IS SINGLE-WORD AMBOQIA (Matt directive 2026-05-20 — supersedes the 2026-05-07 sentence-with-highlight rule).** Render ONE word at a time, large, centered in the caption safe zone, in Amboqia Boriango (the brand display font — NEVER AzoSans, NEVER Geist, NEVER Anton, NEVER Inter). The word appears at speech start and fades out at speech end, synced to ElevenLabs `/v1/forced-alignment` word timestamps. No phrase windows. No 3-word chunks. No full sentences staying on screen. No karaoke-style highlight inside a sentence. No colored pill background. No gold accent (gold is retired per Design System v2). White text + soft drop shadow on the photo / video directly. Same look across every video the brand ships. **Canonical component:** [`video_production_skills/captions/canonical/SingleWordCaption.tsx`](video_production_skills/captions/canonical/SingleWordCaption.tsx) (mirror used by the market-report project: [`video/market-report/src/captions/SingleWordCaption.tsx`](video/market-report/src/captions/SingleWordCaption.tsx)). **Canonical rule:** this list.
4. **Word transitions: smooth crossfade ≤ 100 ms between adjacent words.** Hard cuts produce flicker — banned. Gaps shorter than 100 ms crossfade the outgoing word into the incoming word. Gaps longer than 500 ms render true silence (no caption visible during a real breath / pause). The canonical component uses `CROSSFADE_SEC = 0.08`.
5. **Caption timing syncs to natural speech cadence via ElevenLabs `/v1/forced-alignment` word-level timestamps — never to clock-time slots or `<Sequence>` boundaries.** Generate the alignment JSON next to every VO MP3 before rendering; the canonical component reads `{ text, startSec, endSec }` per word.
6. **No choppy or jittery caption changes.** No flicker. No 1-frame blips. No mid-word fade-outs. No font-size oscillation. No re-layout jumps. Amboqia loaded via `loadAmboqia()` from [`video_production_skills/captions/canonical/load-amboqia.ts`](video_production_skills/captions/canonical/load-amboqia.ts) before the first render — caption renders without the brand font are a ship-blocker.

A render that fails any of these is a non-ship until repaired. Captions + data accuracy together gate every render: wrong number OR broken captions = no ship.

**Migration status (2026-05-20, re-verified 2026-07-24):** Legacy caption components still exist (`video/market-report/CaptionBand`, `video/market-report/KineticCaptions`, `video/market-report-yt-long/KineticCaptions`, `video/earnest/brand/CaptionBand`, `video/evergreen-education/components/CaptionBand`, `listing_video_v4/src/news/SentenceCaption`). Migration replaces the legacy component body with a re-export of `SingleWordCaption` from the canonical path. New content uses the canonical component directly from day one. **Known breakage:** several gate-excluded comps under `video/` still import `video_production_skills/safe-zones/canonical/safe-zones` — a directory that no longer exists. Those comps do not compile; repoint them to `video_production_skills/captions/canonical/safe-zones` when you next touch one.

### ElevenLabs Voice — MANDATORY

- **Voice: Victoria — Voice ID: `qSeXEcewz7tA0Q0qk9fH`**
- Voice profile: middle-aged American, conversational, warm, trustworthy, relatable. Designed for explainer videos, viral social, and modern brand VO. Saved on account as "Victoria — Ryan Realty Anchor."
- Env vars in `.env.local`: `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH`, `ELEVENLABS_VOICE_ID_VICTORIA=qSeXEcewz7tA0Q0qk9fH`
- API key: `ELEVENLABS_API_KEY` in `.env.local`
- **ALWAYS use Victoria for ALL voiceover.** No other voice. No substituting. No asking.
- **Canonical model + settings (Matt directive 2026-05-07 — tuned for conversational delivery)**: `eleven_turbo_v2_5`, **stability `0.40`** (was 0.50 — lower = more expression), **similarity_boost `0.80`** (was 0.75 — stronger Victoria identity), **style `0.50`** (was 0.35 — more dynamic delivery), `use_speaker_boost: true`. Different model or different settings = different-sounding voice = a rejected render. Override per-script via `voice_settings` field in `script.json`.
- **Conversational delivery rules.** Avoid robotic monotone. Split long sentences into shorter clauses. Add commas where a natural speaker would pause. Use IPA phoneme tags for tricky place names (Bend, Tumalo, Deschutes — see CLAUDE.md IPA library). For very long lines, break into multiple `segments` rather than one continuous run-on.
- Use `previous_text` chaining for prosody continuity across sentences within a clip.
- Use IPA phoneme tags for tricky pronunciations (e.g., Deschutes → `<phoneme alphabet="ipa" ph="dəˈʃuːts">Deschutes</phoneme>`).
- Matt approved this voice 2026-04-27 — Victoria is the permanent voice. Do not switch without explicit Matt direction.

### Video Review Gate — MANDATORY

- **No rendered video MP4 gets committed or pushed without Matt's explicit approval.**
- This applies to anything that lands in `listing_video_v4/public/v5_library/` or any other user-facing/public-facing path. Source code changes (`.tsx`, `.py`, skill docs, scorecards, citations.json) push as normal — those are infrastructure, not the deliverable.
- Workflow:
  1. Render to `listing_video_v4/out/<name>.mp4` (local, untracked).
  2. Run the QA gate (blackdetect, audio non-silent check, duration/codec verify).
  3. **Present the local file path to Matt** for review (`open /Users/matthewryan/RyanRealty/listing_video_v4/out/<name>.mp4`). If multiple clips, list each path.
  4. Wait for explicit ship approval (e.g., "ship it", "approved", "push").
  5. Only after approval: copy to `public/v5_library/`, `git add` the MP4, commit, push.
- This rule overrides the default "always push immediately" rule from `feedback_always_push.md` for video deliverables. Code changes that describe the video still push immediately.
- Reason: bad audio, wrong voice, wrong end card, wrong duration — all caught by Matt before the MP4 lands on `main` and gets distributed. Cheaper to fix in `out/` than to revert a public commit.
- Locked 2026-04-27. Applies to every format: news clips, listing reels, market reports, neighborhood guides, memes with rendered video.

### Pacing Rule — First Scenes

- The first scene / hook text MUST stay on screen long enough for the viewer to read it completely. **Minimum 3 seconds** for any text-heavy opening scene.
- **No scene with readable text shorter than 2.5 seconds.**
- The hook should grab attention but NOT flash by so fast nobody can read it.
- This rule applies to every video format: news clips, listing reels, market reports, neighborhood guides, memes with text overlay.

### Banned-content gate (the surviving ANTI_SLOP rules — every one a ship-blocker)

The manifesto file is gone; its rules are not. Each of these fails a render on its own:

1. **No generic real-estate language.** The banned-words list above applies to captions, VO, on-screen text, and the caption of the post that carries the video.
2. **No AI-generated image or clip passed off as a real photo of a real place.** If a frame is AI-generated, it is either obviously stylized or it is disclosed on-screen. Never AI-generate a house, a room, or a view that a buyer could mistake for the actual property.
3. **VO is ElevenLabs Victoria only**, with the pronunciation overrides in "ElevenLabs Voice" below. No other voice, no other vendor, no synthetic accent.
4. **Music is beat-synced or absent.** Cuts land on the beat or the track comes out. A bed that fights the edit is worse than silence.
5. **Every number is source-verified** per §0. No number in a render that is not in `citations.json`.
6. **A brand-new format gets human review for its first 30 days** before it runs unattended.
7. **No AI-written humor and no engagement bait** ("comment YES for the link", "wait for it", fake questions).
8. **Brand visual standards hold in every frame** — navy/cream, Amboqia + Geist, safe zones, no off-brand hex.

### Hook + retention spec (the surviving VIRAL_GUARDRAILS numbers)

- **Hook frames:** motion by 0.4s, on-screen content by 1.0s, payoff by 2.0s, confirmation by 3.0s. TikTok's qualified-view threshold is 5.0s — the first five seconds decide distribution.
- **Retention beats:** register change at 25%, hard pattern interrupt at 50%, escalation at 75%, kinetic reveal in the final 15%.
- **Ship floors** (from the scorecard above): listing video 85, market data 80, neighborhood 80, meme 75, earth zoom 85, news clip 80. Default 80.
- Engineer the BEATS array against the scorecard from beat 0 — never "score later." Run the quality gate (blackdetect strict + frame extraction + visual scrub) before push and write `scorecard.json` next to every render.

### Sister skill libraries

- **`video_production_skills/`** — **NOT a skill library.** Three code modules only (`captions/canonical/SingleWordCaption.tsx`, `safe-zones.ts`, `load-amboqia.ts`). Every skill file under it was deleted 2026-06-15.
- **`social_media_skills/`** — the per-deliverable producer skills (blog-post, facebook-lead-gen-ad, flyer-design, instagram-carousel, list-kit, and the rest). Index at `social_media_skills/README.md`. Resolve through `marketing_brain_skills/producers/REGISTRY.md`, never by guessing a path.
- **`automation_skills/`** — three triggers (`listing_trigger`, `market_trigger`, `trend_trigger`) plus the pipelines that survive under `automation_skills/automation/` (`post_scheduler`, `performance_loop`, `engagement_bot`, `ab_testing`, `publish`, `qa_pass`, `feedback_loop`, `buffer_poster`, `api_knowledge`) and `automation_skills/content_engine/`. `repurpose_engine` and `thumbnail_generator` were deleted 2026-06-15. Inbound DM/comment lead capture writes to the in-house CRM (`public.crm_people`), not to Follow Up Boss.
