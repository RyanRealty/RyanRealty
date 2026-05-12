---
name: viral-guardrails
description: Hard, measurable virality gate every piece of content must pass before publish. Pre-publish scorecard, kill criteria, and platform-specific minimums.
---

# Viral Guardrails — the Pre-Publish Gate

**This document is a ship/no-ship gate.** Every video, image, caption, post, and ad Ryan Realty publishes runs through this gate before going live. Pair-required with `ANTI_SLOP_MANIFESTO.md` (banned patterns) and `VIDEO_PRODUCTION_SKILL.md` (production rules). The manifesto governs what content is *banned*. The master skill governs *how* video is built. This file governs whether the finished piece is *good enough to publish at all*.

The bar is virality. Not "decent." Not "on-brand." Not "ready enough." Every piece is engineered for the algorithm to push it to a second, third, and tenth audience. If it cannot earn that push, it does not ship.

This is not aspirational language. The scorecard in §3 produces a 0-100 number. Pieces below the threshold are killed at the gate. There is no override, no "this one is special," no "let's see how it does."

---

## 1. Why this exists

The cost of mediocre content is not zero. It is negative.

- A piece that posts and underperforms drags the next post's reach. Platforms model account-level signal: weak watch-through-rate on one piece reduces the algorithmic score for the next.
- Audiences who tap and bounce learn to tap-and-bounce on the brand. The reflex is permanent.
- Ad budget on a weak piece compounds the loss — paid reach accelerates the negative signal.
- Time and creative cost is sunk into every render. Shipping it to die is the worst use of it.

The bar to ship is "this piece is engineered to win, and we can articulate why." Not "this piece does not actively embarrass us."

Every metric below ladders to one outcome: the algorithm shows the post to a second viewer, then a tenth, then a thousandth. If the piece is engineered for that and the data backs it, it ships. If the data is missing or the engineering is off, it does not.

---

## 2. The viral physics — what actually drives distribution

Distribution on every short-form platform in 2026 is governed by four signals, in this order of weight:

### 2a. Watch-through rate (WTR)
- The percent of viewers who do not swipe in the first 1-3 seconds, then the percent who reach 50%, then the percent who reach 100%.
- **TikTok 2026 retention-to-distribution multipliers** (per [TTS Vibes](https://insights.ttsvibes.com/tiktok-first-3-seconds-hook-retention-rate/)):
  - Below 60% retention at 3s = 1.0x baseline (no push)
  - 60-70% = 1.6x
  - 70-85% = 2.2x
  - 85%+ = 2.8x (viral window unlocked)
- TikTok 2026 raised "Qualified Views" from 3-second to **5-second hold** ([Virvid 2026](https://virvid.ai/blog/tiktok-algorithm-2026-explained)). Hook engineering now optimizes for the 5-second decision window, not the old 3-second one.
- TikTok 70%+ completion = 3x more reach. 80%+ = typical viral content. 78% retention is the platform-wide average ([Virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time)).
- Instagram Reels: 3-second hook retention above 60% outperforms below 40% by **5-10x** ([TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide)). Maintaining retention above 50% throughout yields ~38% reach boost.
- YouTube Shorts: 75%+ retention triggers 3x distribution to new audiences. Viral Shorts (1M+ views) average 76% retention ([Virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time)).
- Decision moment: seconds 0-3. **70% of viewers decide whether to scroll past within the first 3 seconds** ([TTS Vibes](https://insights.ttsvibes.com/tiktok-first-3-seconds-hook-retention-rate/)). Hook fails = the rest of the video is irrelevant. **84.3% of viral TikTok videos in 2025 used psychological hook triggers in the first 3 seconds.**

### 2b. Share rate + Save rate
- Shares are the most valuable engagement signal across IG, TikTok, and FB. One share is worth roughly 3x the algorithmic weight of 10 likes (per platform brief).
- Shares compound across networks (sender's followers + recipient's followers).
- **Q4 2025 Meta algorithm shift: saves are now weighted 40% MORE than likes** for Reels ranking ([InfluenceFlow 2026](https://influenceflow.io/resources/short-form-content-performance-and-virality-metrics-the-complete-2026-guide/)).
- Save rate above 3% of total reach = 4x more likely to surface on non-followers' Explore pages vs. posts relying on likes alone ([Napolify](https://napolify.com/blogs/news/likes-vs-saves-instagram)).
- **A Reel with 400 saves outranks one with 10,000 likes** in the IG recommendation engine ([Mirra](https://www.mirra.my/en/blog/instagram-algorithm-2026-complete-analysis)).

**TikTok engagement signal weights** ([Virvid 2026](https://virvid.ai/blog/tiktok-algorithm-2026-explained)):
- Watch time: 10 pts
- View-through rate: 8 pts
- Shares: 6 pts
- Comments: 5 pts
- Likes: 4 pts

**X/Twitter signal weights** ([PostEverywhere](https://posteverywhere.ai/blog/how-the-x-twitter-algorithm-works)):
- Reply with author response: +75 (150x a like)
- Reply: +13.5 (27x a like)
- Bookmark: +10
- Retweet: +1
- Like: +0.5

### 2c. Re-watch rate
- TikTok and YouTube Shorts both reward re-watches: viewers watching the video 2+ times push distribution exponentially.
- Re-watchable content (humor, useful data, emotional) performs 2x ([Virvid](https://virvid.ai/blog/tiktok-algorithm-2026-explained)).
- Re-watchable structures: a payoff that resolves in the last 2 seconds and re-frames the opening, a hook that requires a second viewing to fully read, a visual gag that lands harder on rewatch.

### 2d. Comment + DM volume + speed
- DMs are the second-heaviest signal on IG (per brief). Comment depth (length of replies, length of threads) is weighted heavier than comment count.
- Comment speed in the first 30 minutes is a "boost trigger" — the algorithm pushes posts that earn comments fast.
- **First-hour engagement: 15% early engagement combined with strong watch time triggers tier escalation on TikTok** ([Virvid](https://virvid.ai/blog/tiktok-algorithm-2026-explained)). TikTok 2026 first shows content primarily to existing followers — strong initial engagement unlocks external distribution.

### 2e. Empirical thresholds — print these on the wall

| Metric | "Push to next tier" threshold | Source |
|--------|-------------------------------|--------|
| TikTok 3s retention | 70% (2.2x multiplier), 85% (2.8x viral window) | [TTS Vibes](https://insights.ttsvibes.com/tiktok-first-3-seconds-hook-retention-rate/) |
| TikTok 5s qualified view | held viewer past 5s = qualifies | [Virvid](https://virvid.ai/blog/tiktok-algorithm-2026-explained) |
| TikTok completion rate | 70%+ for 3x reach, 80%+ for viral | [Virvid](https://virvid.ai/blog/tiktok-algorithm-2026-explained) |
| Reels 3s hook retention | 60%+ outperforms <40% by 5-10x | [TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide) |
| Shorts retention | 75%+ for 3x reach to new audiences | [Virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time) |
| IG save rate | 3%+ of reach for 4x Explore lift | [Napolify](https://napolify.com/blogs/news/likes-vs-saves-instagram) |
| Engagement rate | 5%+ strong, 10%+ viral potential | [InfluenceFlow](https://influenceflow.io/resources/short-form-content-performance-and-virality-metrics-the-complete-2026-guide/) |
| Silent-watch rate | ~80% across short-form | [Zebracat 2025](https://www.zebracat.ai/post/instagram-reels-statistics) / [Virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time) |

**Implication for production.** Every piece is engineered against these four signals. Hook engineering protects WTR. Structure engineering protects share rate (worth showing) and re-watch (worth seeing again). Topic engineering protects comment volume (worth talking about).

---

## 3. The pre-publish virality scorecard (0-100)

Every video, every image-post, every carousel, every story sequence runs through this scorecard before publish. The scorer (orchestrator agent or the human in the 30-day review window) assigns a 0-10 in each of ten categories. Total = 0-100.

### Scoring categories

| # | Category | What it measures | Max |
|---|----------|------------------|-----|
| 1 | Hook (0-3s) | Does the open stop a scroll? | 10 |
| 2 | Retention structure | Are the 25%, 50%, 75% beats engineered? | 10 |
| 3 | Text execution | Captions/overlays sized, timed, on-brand | 10 |
| 4 | Audio strategy | Music/VO matches register, beat-synced if music | 10 |
| 5 | Format compliance | Right aspect, length, resolution, codec | 10 |
| 6 | Engagement triggers | Built-in reasons to share, save, comment | 10 |
| 7 | Cover/first frame | First frame on the grid earns a tap | 10 |
| 8 | CTA/payoff | Reveal lands, CTA matches register | 10 |
| 9 | Voice/brand | Sounds like Matt, looks like Ryan Realty | 10 |
| 10 | Anti-slop | Manifesto pass + voice rules + data trace | 10 |

### How to score each category

#### Category 1 — Hook (0-3s) — 10 points

| Sub-criterion | Points |
|---------------|--------|
| Frame 0-12 (0-0.4s) has motion engaged | 2 |
| First on-screen text or visual element communicates the payoff or the question by frame 30 (1.0s) | 2 |
| First spoken word (if VO) is content, not a greeting; first audio beat (if music-only) is on the scroll-stop | 2 |
| Hook contains a specific, concrete element: a number, a place name, a contradicting claim, or a visual surprise | 2 |
| Pattern interrupt is something the viewer has not seen in 10 prior videos in their feed (no generic kitchen pan, no agent-on-camera mid-sentence, no logo card) | 2 |

**Auto-zero:** opens with logo, "REPRESENTED BY" line, agent intro, brokerage chyron, slow boundary draw, title card on black, or any banned-opening pattern from `ANTI_SLOP_MANIFESTO.md` Rule 4.

#### Category 2 — Retention structure — 10 points

| Sub-criterion | Points |
|---------------|--------|
| 25% mark: pattern interrupt (new register, text shock, shot type change) | 2 |
| 50% mark: register shift (exterior to interior, drone wide to closeup, color to mono, etc.) | 2 |
| 75% mark: payoff or a new piece of information that re-engages | 2 |
| Final 15%: kinetic stat reveal or hard CTA, anchored on the platform's preferred end frame | 2 |
| Average beat length within the §1 cap of the master skill (2-3s standard, 3-4s luxury max) | 2 |

**Auto-zero:** any single beat exceeds 4s, the video flatlines after second 10 with no register change, or the reveal contains contact info / brokerage attribution (banned per master skill §5).

#### Category 3 — Text execution — 10 points

| Sub-criterion | Points |
|---------------|--------|
| All on-screen text inside the 900x1400 safe zone (per master skill §1) | 2 |
| Body text >= 48px, headlines 64-80px | 2 |
| Each text block displays for at least 2 seconds and at a reading speed under ~3 words per second | 2 |
| Contrast pass: white-on-shadow OR dark-pill-under-text. No white-on-white, no navy-on-navy | 2 |
| All numbers carry units ($, beds, sqft, %); no "approximately/roughly/about" | 2 |

**Auto-zero:** any text overlaps platform UI chrome (bottom nav, top status, comment ribbon), any number on screen has no citation in `citations.json`, any text block flashes for under 1 second.

#### Category 4 — Audio strategy — 10 points

Pick the path that applies to this piece:

**Path A — Music + VO (most listing/market video):**
| Sub-criterion | Points |
|---------------|--------|
| Music selected by register: under $500K upbeat (120-140 BPM), $500K-$1M balanced cinematic (90-120 BPM), over $1M sparse atmospheric (60-80 BPM) per [HookSounds BPM ranges](https://www.hooksounds.com/blog/finding-creative-rhythm-optimal-bpm-content-creators/) | 2 |
| Cuts beat-synced via `audio_sync` skill, primary cuts on downbeats; trace JSON next to render | 2 |
| Music ducks under VO to ~-18 dB; VO clear with no overlap between adjacent lines | 2 |
| Music swells into final 15% reveal | 2 |
| ElevenLabs VO with `previous_text` chained, pronunciation overrides applied (Deschutes, Tumalo, etc.) | 2 |

**Path B — Trending audio (meme, trend-jack, low-register):**
| Sub-criterion | Points |
|---------------|--------|
| Sound is on the trending tab on the target platform within the last 7 days, **with under 5,000 uses** (catch the trend before saturation; 500K+ uses = diminishing returns per [Deskgram](https://deskgram.co/trending-audios-vs-original-audios-which-performs-better-today/)) | 3 |
| Use of the sound is contextually correct (not slapped on for trend-juice with mismatched content; off-context = downrank per platform brief) | 3 |
| First beat of the sound aligns to the first cut (so the trend-recognition fires) | 2 |
| No watermark on the audio source clip | 2 |

**Path C — VO-only (no music):**
| Sub-criterion | Points |
|---------------|--------|
| ElevenLabs voice with stability 0.45-0.55, similarity 0.75, style 0.30-0.45 (per manifesto Rule 3) | 3 |
| `previous_text` chained across all lines for prosody continuity | 3 |
| Pronunciation overrides applied for all Bend place names | 2 |
| Cadence: short sentences, no commas where Matt would not pause, numbers spelled out | 2 |

**Auto-zero on every path:** stock library elevator loop, default Epidemic top-of-page, off-beat cuts (>4 frames at 30fps), robotic TTS that is not ElevenLabs.

#### Category 5 — Format compliance — 10 points

| Sub-criterion | Points |
|---------------|--------|
| Aspect ratio 9:16 (1080x1920) for IG Reels, TikTok, YouTube Shorts, FB Reels | 2 |
| Length within platform-specific window (see §6) | 2 |
| Frame rate 30fps minimum, codec h264, CRF 24, faststart, file size under 100 MB | 2 |
| Captions/subtitles burned in (40% IG mute rate, 85% FB mute rate per master skill §1) | 2 |
| Cover frame designated and rendered separately for IG grid + Shorts + TikTok preview | 2 |

**Auto-zero:** wrong aspect ratio shipped to a portrait-only surface, exceeds platform max length, no burned captions on a piece intended for muted feeds.

#### Category 6 — Engagement triggers — 10 points

The piece must be engineered to earn at least one of: a share, a save, a comment, a DM. Score the *strongest* trigger present:

| Trigger present | Points |
|-----------------|--------|
| Share trigger — content people send to a specific person ("send to your spouse who said no to Bend") | 2 |
| Save trigger — content people return to ("the 5 questions to ask before listing", saved as a checklist) | 2 |
| Comment trigger — a specific question or take that invites disagreement or an opinion ("the most overpriced neighborhood in Bend"; reply with yours) | 2 |
| DM trigger — a hook that maps to a specific DM call-to-action (per `viral-hook-library.md` — "DM me 'tour' for the address", "DM me 'market' for the report") | 2 |
| Re-watch trigger — a payoff in the final frame that re-frames the open and rewards a second viewing | 2 |

**Auto-zero:** content has no built-in reason to engage. "Just enjoy the listing" is not a trigger. A pretty drone shot on its own is not a trigger.

#### Category 7 — Cover / first frame — 10 points

| Sub-criterion | Points |
|---------------|--------|
| First frame is high-contrast, photo-forward, with the most intriguing visual in the entire piece | 2 |
| Cover-frame text (if used) is under 6 words, sized for 250x444 grid preview readability, in brand fonts | 2 |
| For listings: address or price visible on cover; for market: the headline number; for neighborhood: place name | 2 |
| Face shown when relevant (real estate creators with face on cover have ~30% higher tap rate per published creator data — see §10 references). For Ryan Realty, Matt's face when register fits; never an AI avatar on cover | 2 |
| Cover passes the "thumb-stop test": shown at 1/3 size on a busy grid, does it still earn a tap? | 2 |

**Auto-zero:** cover frame is black, blurred, mid-transition, or contains a logo as the dominant element.

#### Category 8 — CTA / payoff — 10 points

| Sub-criterion | Points |
|-----------------|--------|
| Payoff at the 75-100% mark delivers what the hook promised, verbatim or near-verbatim | 2 |
| CTA matches platform register: DM-CTA on IG, comment-prompt on TikTok, link in bio reference (never in-frame URL on viral cuts) | 2 |
| Caption-CTA matches the in-video CTA (no in-video "DM me" with a caption that says "comment below") | 2 |
| Soft CTA used for top-of-funnel content; hard CTA reserved for explicit listing/market drops | 2 |
| No CTA in the final frame of a viral cut: kinetic stat only (per master skill §5) | 2 |

**Auto-zero:** thumbnail/hook promise does not appear in the body of the piece (banned per manifesto Rule 10), CTA contradicts the platform (DM CTA on YouTube Shorts is meaningless).

#### Category 9 — Voice / brand — 10 points

| Sub-criterion | Points |
|---------------|--------|
| Sounds like Matt: 40-something Bend broker, direct, factual, confident. Not ChatGPT, not corporate, not influencer-bro | 2 |
| Brand colors used (Navy `#102742`, Navy-deep `#0a1a2e`, Cream `#faf8f4`, Sand `#e8e2d4`, Fir `#2e4a3a` (sparing), Sky `#8fb8d4` (sparing)). No off-brand hex | 2 |
| Brand fonts used (Amboqia headline, AzoSans body). No Helvetica, no system fallback | 2 |
| No logo, brokerage name, phone, or agent-name chyron inside viral video frames (per master skill §5) | 2 |
| Voice rules pass (manifesto Rule 11): no semicolons, no em-dashes, no AI filler, no "I'm thrilled to..." | 2 |

**Auto-zero:** any banned word from manifesto Rule 1, any AI filler word from manifesto Rule 11, any brand-color violation.

#### Category 10 — Anti-slop / data trace — 10 points

| Sub-criterion | Points |
|---------------|--------|
| `citations.json` exists next to the render and every numeric figure on screen / in VO / in caption is traced to a verified source (per CLAUDE.md §0 + manifesto Rule 7) | 3 |
| Every photographic asset has a source line (photographer, MLS ID, drone op, or Matt's iPhone) | 2 |
| AI disclosure pill present if any AI imagery, AI avatar, or AI-extended footage is used (manifesto Rule 5) | 2 |
| Fair-housing scan clean: no "great for families", no "safe neighborhood", no steering language (manifesto Rule 13) | 2 |
| Misrepresentation scan clean: no other-agent listings posted as Ryan Realty's, no MLS price without ORMLS attribution (manifesto Rule 13) | 1 |

**Auto-zero:** any unverified number, any AI image of a real place / real property / real person without disclosure, any fair-housing-language hit.

### Scoring thresholds

| Score | Verdict |
|-------|---------|
| **90-100** | Engineered to win. Ship immediately. Track performance and feed back into the format library |
| **80-89** | Strong piece. Ship. Note the 1-2 categories that lost points and remember them for the next build |
| **70-79** | Borderline. Do not ship. Identify the lowest-scoring category and re-cut. A 70-79 ships only if Matt explicitly green-lights with eyes on the score sheet |
| **60-69** | Weak. Kill or rebuild. The piece will drag account-level signal — better to kill than ship |
| **Under 60** | Dead. Kill it. Do not "salvage." The bones are wrong; rebuild from the BEATS array up |

**Hard floor: 80.** Default ship gate is 80. Anything 70-79 needs a specific Matt approval. Anything under 70 does not ship.

**Auto-zero in any category drops the whole piece below 80 mathematically (max 90 with one zero), but the *real* effect is: if any auto-zero criterion fires, the piece does not ship regardless of the headline score.** Auto-zero is a kill switch. Re-cut, re-score, re-evaluate.

---

## 4. Hook gate — first 3 seconds in detail

Every gate in §3 ladders to this one. Hook engineering is non-negotiable.

### Frame-by-frame hook spec (1080x1920, 30fps)

| Frame | Time | Required content |
|-------|------|------------------|
| 0 | 0.00s | Photo or video content present. Never a logo. Never black. Never a title card |
| 12 | 0.40s | Motion engaged. Push-in, parallax, gimbal walk, or trending-sound visual sync — something is moving |
| 30 | 1.00s | First text element on-screen if text-anchored hook, OR first VO syllable if VO-anchored. Visual specificity present (a real address, a real number, a real face, a real place) |
| 60 | 2.00s | Hook payoff line complete or visible curiosity gap planted. Viewer has decided to watch, or they are gone |
| 90 | 3.00s | Confirmation beat — a second visual or piece of information that confirms the hook was real, not bait |
| 150 | 5.00s | **TikTok 2026 "Qualified View" threshold.** Viewer who held this long counts toward the algorithm's primary engagement metric. Re-engage here with a fresh visual or info beat |

### Hook archetypes that work (use these)

Per `social_media_skills/platforms/viral-hook-library.md`:

- **Bend market stat shock:** "Bend home prices jumped 8% this month." Lead with the number on-screen, big.
- **Buyer/seller myth break:** "No, you don't need 20% down." Contrarian claim, immediate proof.
- **Neighborhood spotlight reveal:** "This neighborhood has trails, breweries, and homes under $500K. Where is it?" Hook with the question, answer in the body.
- **Historic Bend story:** "Bend started as a logging town." True, grounded, narrative-anchored.
- **Listing tease:** kinetic-stat-style address overlay on the strongest exterior shot, hook line that names architect + location in one short sentence.

### Hook archetypes that die (banned)

Per manifesto Rule 4 + master skill §2:

- "In today's real estate market..."
- "Have you ever wondered..."
- "Did you know..."
- "Hey guys / what's up..."
- "Welcome to..."
- Title card on black
- Logo open
- Agent introducing themselves before any content
- Generic drone shot with no on-screen specificity in first 1s

### The 1-second test

Cover the entire piece except the first 1 second of video and the first 6 words of caption. Does that alone make a viewer stop scrolling? If no, the hook fails. Re-cut.

---

## 5. Retention structure — pattern interrupt timing

Per master skill §1 + the four-signal physics in §2:

### Required pattern interrupts

| Mark | Position | Required action |
|------|----------|-----------------|
| 25% | second 7-12 (45s video) | New visual register or text overlay shock. Anchored to a real content beat, never a gimmick |
| 50% | second 20-25 (45s video) | Hard register shift. Examples: exterior wide cut into interior closeup, drone aerial cut into kitchen detail, day shot cut into golden hour, photo cut into kinetic text card |
| 75% | second 33-37 (45s video) | New information or payoff seed. The viewer needs a reason to make it the last 10 seconds |
| Final 15% | second 38-45 | Kinetic stat reveal. Price, address, status (PENDING / SOLD / NEW), absorption number. No brokerage attribution, no logo, no contact info |

### Pacing curve

- **Fast start:** hook + 2-3 hero shots in first 9 seconds. Beat length 2-2.5s.
- **Breathe in middle:** beats 2.5-3s, slightly longer dwell on craft details. The viewer settles.
- **Fast at end:** beats 1.5-2s into the reveal, then hold the final stat for ~5s.

### Auto-fail retention patterns

- A photo or beat held over 4 seconds.
- Two consecutive beats with the same motion type (e.g., push-in twice in a row).
- A repeated photo or clip within a single video.
- A "settle" period over 6 seconds where nothing new is introduced.
- A reveal that does not pay off the hook.

---

## 6. Platform-specific specs

Pull from `social_media_skills/platforms/social-channel-specs.md` (full source) — the table below is the canonical pre-publish summary.

### Length windows (research-backed, [Shortimize](https://www.shortimize.com/blog/video-length-sweet-spots-tiktok-reels-shorts) + [Kathy Jacobs](https://kathyjacobs.com/2026-short-form-video-guidelines-reels-youtube-shorts-tiktok-videos-length/) 2026)

| Platform | Viral sweet spot | Engagement max | Hard cap | Notes |
|----------|------------------|----------------|----------|-------|
| Instagram Reels | 15-30s (viral potential) | 60-90s (highest comments ~26s) | 90s | 15s or under = 72% completion vs 46% for longer Reels |
| TikTok | 11-18s (virality) OR 30-45s | 21-34s (engagement) | 3 min | 3-10 min gets 2x views but lower completion |
| YouTube Shorts | **Bimodal: ~13s OR ~55-58s** | Bimodal | 60s | Middle range (30-45s) underperforms — 35B-view study confirms bimodal peak |
| Facebook Reels | 30-60s | 90s | 90s | Same retention math as IG |
| LinkedIn (native video) | 30-90s | 10 min | 10 min | Dwell time is the signal — longer videos with strong retention win |
| X (formerly Twitter) | Under 45s | 10s+ watch triggers positive signal | 2:20 | Auto-play in feed, sound usually off — captions mandatory |

**Format completion rates by length** ([TTS Vibes](https://insights.ttsvibes.com/tiktok-first-3-seconds-hook-retention-rate/)):

| Length | Completion |
|--------|------------|
| 0-15s | 92% |
| 16-30s | 84% |
| 31-60s | 68% |
| 1-3 min | 42% |
| 3+ min | 28% |

### Aspect ratio

- **9:16 (1080x1920)** — IG Reels, TikTok, YouTube Shorts, FB Reels, IG Stories. **Default for every viral cut.**
- **4:5 (1080x1350)** — IG feed posts only when content is photo-led. Never used for video except where deliberately repurposed.
- **1:1 (1080x1080)** — legacy IG, never primary.
- **16:9** — long-form YouTube and LinkedIn native video. Different format, different rules; use the long-form skill, not this one.

### Captions

- **Burned-in captions are mandatory. Roughly 80% of short-form viewers watch without audio** ([Zebracat 2025](https://www.zebracat.ai/post/instagram-reels-statistics) / [Virvid](https://virvid.ai/blog/ai-shorts-increase-retention-watch-time)). All critical information must be visible without sound.
- **63% of top-performing TikTok videos place the key message in on-screen text in the first 3 seconds** ([Virvid](https://virvid.ai/blog/tiktok-algorithm-2026-explained)).
- Caption font: AzoSans Medium 48px minimum (master skill §1). Body text 40-60px range for 1080p ([legibility.info](https://legibility.info/rules-for-text-in-videos)). White on dark pill or shadow with outline.
- **Reading speed:** 1 second per 13 characters minimum dwell time. A 30-character line needs 2.3s minimum on screen ([legibility.info](https://legibility.info/rules-for-text-in-videos)). Design for 150-180 WPM comprehension on mixed audiences.
- Caption position: bottom third, inside the 900x1400 safe zone. **Avoid top 20% of frame** (covered by platform UI on some devices).
- Max 30 characters per line, max 3 lines per text block.
- Dynamic word-by-word captions synced to speech outperform static text blocks for retention.

### Cover frame

- IG Reels: cover is the grid preview. Designate a specific frame, not the auto-pick.
- TikTok: cover is the for-you-feed preview. Designate.
- Shorts: cover is shown in subscription feed and search; choose the frame that earns the search-tap.

### Posting cadence (research-backed)

**TikTok frequency** ([Buffer 11M-post study](https://buffer.com/resources/tiktok-algorithm/)):
- 2-5x/week: +17% views per post
- 6-10x/week: +29% views per post
- 11+/week: +34% views per post
- Quality-constrained sweet spot: **3-5 posts/week**

**Instagram Reels** ([TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide)): 3-5 Reels/week. Daily posting can work with a repurposing system but quality must not drop. Tuesday-Thursday 8am-4pm Bend time per platform brief; IG peak windows: Mon 2-4 PM, Tue 1-7 PM, Wed 12-9 PM, Thu 12-2 PM ([Buffer 9.6M-post study](https://buffer.com/resources/when-is-the-best-time-to-post-on-instagram/)).

**X/Twitter** ([PostEverywhere](https://posteverywhere.ai/blog/how-the-x-twitter-algorithm-works)): 2-3 quality posts/day, minimum 30-60 min between posts. 10x more impressions for Premium accounts. Best windows: Tue/Wed/Thu 9 AM-3 PM.

**YouTube Shorts:** 3-5/week. **Peak reach timeline: 96 hours** (vs TikTok/IG's 48-72 hours) ([InfluenceFlow](https://influenceflow.io/resources/short-form-content-performance-and-virality-metrics-the-complete-2026-guide/)).

**Facebook:** Cross-publish native. No IG cross-post penalty as of 2025-2026, but native FB outperforms shared by ~15% (per platform brief).

**LinkedIn:** 2-3 posts/week, mix of native text + native video. Personal profile reach 8-10x company page reach.

### Hashtag strategy

**TikTok 2026** ([Akselera](https://akselera.tech/en/insights/guides/tiktok-hashtag-strategy-guide)):
- **Platform max: 5 hashtags per post** (TikTok-enforced, per [TikTok platform announcement](https://www.tiktok.com/en/trending/detail/new-tiktok-update-maximum-5-hashtags))
- 5,000-video study: posts with strategic hashtags averaged 38,000 views vs 9,000 without (4.2x lift)
- Niche hashtags: 60-70% higher engagement than broad
- **Dead in 2026:** #fyp, #foryou, #viral — they burn a tag slot with no reach
- TikTok Creator Team: "diminishing returns after 5 hashtags"
- Pattern: 3 niche + 1-2 trending hashtags

**Instagram 2026** ([TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide)):
- Posts with **fewer but relevant hashtags achieved 23% higher reach** than hashtag-heavy posts
- 5-10 niche hashtags. Never 30. Hashtag dump = downrank.

**YouTube Shorts:** keywords matter more than hashtags. Optimize title + description for search intent.

**LinkedIn / X:** hashtags used sparingly (1-3); over-hashtagging suppresses reach.

---

## 7. Engagement trigger requirements

Per §3 Category 6: every published piece must have at least one engineered trigger. Score the strongest one present.

### Built-in share triggers (the strongest signal)

Content people send to a specific person:

- "Send this to your partner who said no to Bend."
- "If you're a buyer waiting for prices to drop, here's the math."
- "The one neighborhood every transplant gets wrong."
- A controversial-but-defensible take ("the most overpriced neighborhood in Bend right now is...")

### Built-in save triggers

Content people return to:

- A checklist or numbered list (most-saved format on IG)
- A reference table (median prices by neighborhood, schools by zone, drive times)
- A how-to ("the 5 questions to ask before listing")
- A market data card with a specific date range

### Built-in comment triggers

Content that earns disagreement, opinion, or shared experience:

- A take that invites a counter ("this is the worst-performing tier in Bend right now — change my mind")
- A specific question that maps to lived experience ("what's the deal-breaker in your last home search?")
- A "hot take" framing where viewers are expected to vote in comments

### Built-in DM triggers

Content with a clear DM call-to-action mapped to a specific resource:

- "DM me 'tour' for the address."
- "DM me 'market' for the full report."
- "DM me 'guide' for the buyer checklist."

### Banned engagement bait (manifesto Rule 10 + repeated here)

- "Wait until you see the end..."
- "You won't believe what happened..."
- Cliffhangers that resolve in a different post.
- Thumbnail text that does not appear in the video.
- "Tag someone who," "double-tap if," "comment if you agree" — no algorithmic value, manifesto-banned.

The line: an engagement trigger is built in when the piece naturally produces a share/save/comment/DM. Engagement bait is when the piece manufactures the prompt without delivering the substance. Substance always.

---

## 8. Thumbnail / cover frame requirements

Per §3 Category 7. The cover is the first conversion event — from grid view to tap. Below the conversion threshold, the rest does not matter.

### Cover-frame anatomy

- **Photo content fills the frame.** No black, no logo-as-dominant-element, no mid-transition smear.
- **Highest-contrast, most-intriguing frame from the entire piece.** If the cover is not the strongest frame, the piece is fighting itself.
- **One element of specificity** — a recognizable place, a number, a face, an architectural detail. "Pretty exterior" is not specificity.
- **Text overlay (if used) under 6 words.** Sized for grid-preview legibility (250x444 in IG grid). AzoSans Bold 64px minimum on a 1080x1920 source.
- **Brand-color treatment if text-led.** Navy pill or cream pill, never navy-on-navy or white-on-bright-sky.

### Cover-frame data (April 2026)

- **Custom thumbnails on YouTube Shorts increase CTR by 85%** vs auto-generated frames ([Miraflow](https://miraflow.ai/blog/youtube-shorts-thumbnail-strategy-2026)). The auto-pick is a default, not a strategy.
- **Strong-emotion thumbnails increase CTR by 20-30%** vs neutral expression ([VidIQ via BTW](https://www.businesstechweekly.com/technology-news/do-faces-help-youtube-thumbnails-exploring-data-driven-insights-for-creators/)).
- **Face-forward content on Reels increases retention by 35%** ([TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide)).
- Niche dependency on faces: a 300K+ video study found no universal "face wins" rule — finance/business/local-real-estate content benefits from face on cover; product showcase content does not ([Search Engine Journal](https://www.searchenginejournal.com/do-faces-help-youtube-thumbnails-heres-what-the-data-says/563944/)).
- **3-element formula:** one strong focal point (face with emotion OR single jaw-dropping property feature) + 3 words max in large text + high contrast. Never more than one focal point.
- **Override the auto-pick on TikTok and Reels.** TikTok's default cover is ~1 second in — almost always not the strongest frame.

### Format-specific cover requirements

- **Listing video:** address text or hero exterior with a specific architectural feature visible. Never a logo.
- **Market data video:** the headline number ("median up 8%"), bigger than anything else.
- **Neighborhood spotlight:** place name + signature visual (Drake Park, the Old Mill smokestacks, the river bend at Sawyer Park).
- **Avatar market update:** Matt's face or avatar centered, headline number in pill bottom-third.
- **Meme / trend-jack:** the specific frame from the trend-clip that triggers recognition in the for-you tab.

### The thumb-stop test

Render the cover at 250x444 and put it on a mock IG grid alongside 5 other listings. Ten random Bend phones see the grid. Does our cover earn the tap? If no, the cover fails. Re-cut.

---

## 9. CTA placement and style

Per §3 Category 8.

### CTA hierarchy by register

- **Top-of-funnel content (market data, neighborhood spotlight, education):** soft DM-CTA in caption, no in-frame CTA. The caption is the action layer.
- **Mid-funnel (listing tease, format showcasing the brand):** soft CTA. Maybe a closing line in VO that names the resource ("DM me 'tour' for the address"), but the video frame stays kinetic-stat-only on the reveal.
- **Bottom-of-funnel (specific listing, open house, deal close):** hard CTA in caption + spoken in VO at the 75% mark. Address visible on the kinetic reveal frame, contact info still in caption (never in viral video frame).

### CTA data (April 2026)

- **Videos with explicit CTAs have 380% higher CTR and up to 80% higher conversion rates** vs videos with none ([Wistia / PlayPlay aggregate](https://playplay.com/blog/video-cta-examples/)).
- **Optimal placement:** mid-video (~70-80% mark) AND end-of-video. Place end-CTA *immediately after* the emotional peak/payoff, never after a wind-down.
- **Soft CTA outperforms hard CTA on cold audiences.** "Save this for later" beats "DM me for a free home valuation" when the viewer doesn't know you yet. Saves also weight 40% more than likes (per Q4 2025 Meta shift, §2b).
- **Comment-keyword funnels** ("Comment 'GUIDE' for the full breakdown") drive comment volume + algorithm signal simultaneously — the strongest dual-purpose CTA pattern in 2026.
- **CTA hurts when** the conversion ask comes before the value lands. Salesy language in the first 50% of video increases skip rate.

### CTA copy by platform

- **IG:** DM-CTA primary ("DM me 'tour' for the address"). Link in bio is the secondary path.
- **TikTok:** comment-prompt or follow-CTA. TikTok DM volume is lower than IG; do not rely on it as primary.
- **YouTube Shorts:** subscribe-CTA primary, link in description secondary. No DM mechanic.
- **Facebook:** comment-prompt primary, share-prompt secondary.
- **LinkedIn:** comment-prompt primary. Posts with strong dwell time and comment threads outperform every other CTA structure.
- **X:** reply-CTA, quote-tweet-CTA. Soft.

### CTA banlist

- "Click the link in bio" — burns reach on every platform; redundant on IG.
- "Subscribe for more" — lazy, no algorithmic boost, no audience reason to comply.
- "Follow for more market updates" — banned; gives no specific value.
- "DM me 'info'" — too vague. Use a specific resource name.
- Any CTA that contradicts the in-video promise.

---

## 10. Format-specific minimum bars

Each viral format in `video_production_skills/` has its own minimum scorecard threshold. The defaults below codify the floor; individual format SKILL.md files can raise the bar but never lower it.

### Listing video (`listing_reveal/`, `listing_launch/`)

- Minimum scorecard: **85**.
- Minimum beats: 12 (45s) or 14-16 (60s).
- Mandatory pattern interrupt at 50% (drone-to-interior or interior-to-drone).
- Mandatory kinetic reveal at final 15% (price + address + status).
- Audio path: A (music + VO) or C (VO-only). No trending-sound listing reveals.
- Cover frame: hero exterior with architectural specificity. Address overlay optional but encouraged.

### Market data video (`data_viz_video/`, `market_report_video/`, `avatar_market_update/`)

- Minimum scorecard: **80**.
- Mandatory headline number on screen by 1.0s.
- Every number on screen has a citation in `citations.json` (auto-zero on Category 10 if not).
- Audio path: A (music + VO) or B (trending audio for the meme/trend-jack tier only — never on a serious data piece).
- Cover frame: the headline number, largest visual element.
- AI disclosure pill present for full duration of any avatar segment (manifesto Rule 5).

### Neighborhood spotlight (`neighborhood_tour/`, `area_guides/`)

- Minimum scorecard: **80**.
- Mandatory place name on screen by 1.5s.
- Fair-housing scan tightened: any "great for families", "safe", "diverse" language = auto-zero on Category 10 (manifesto Rule 13).
- Drone or Earth Studio establishing shot in first 5 seconds.
- Audio path: A (music + VO) is default; B (trending audio) only on the meme variant.

### Meme / trend-jack (`meme_content/`)

- Minimum scorecard: **75** (lower bar; meme content is volume-and-velocity).
- Audio path: B (trending sound). Sound must be on-trend within 7 days.
- Voice grader pass (manifesto Rule 9): does this sound like a 40-something Bend broker, or like ChatGPT trying to be funny? If the latter, kill.
- Beat length: meme cuts can run faster than 2s; no upper-cap exception.
- No data claims (memes do not need citations because they do not make claims).

### Earth zoom / cinematic intro (`earth_zoom/`, `google_maps_flyover/`)

- Minimum scorecard: **85** (high production cost, must clear a high bar).
- Mandatory: terminal frame matches the actual address (overlay-on-MLS-photo QA, no fake satellite imagery).
- AI disclosure pill if Earth Studio composite includes AI atmospherics.

---

## 11. Pre-publish ship check (the 30-second card)

The full scorecard is in §3. This is the ship-day pre-flight, run after the score is computed and before the post button is pressed.

```
[ ] Scorecard total >= format-specific minimum (§10)
[ ] No auto-zero in any category
[ ] Manifesto Enforcement gate (§Enforcement of ANTI_SLOP_MANIFESTO.md) green
[ ] Master skill §6 quality gate green (blackdetect, no frozen frames, etc.)
[ ] citations.json present, every number traced
[ ] Source trace present for every photo asset
[ ] AI disclosure pill present if AI assets used
[ ] Beat-sync trace present if music used
[ ] Cover frame designated (not auto-picked)
[ ] Caption written, banned-words pass clean
[ ] Hashtag set per platform (IG 5-10 niche, TikTok 5-8 + 1-2 trending)
[ ] Format-review-window check — if format is in 30-day human review window, pending_review is cleared
```

If any line is unchecked, the piece does not ship. Fix the line. Re-score if a fix changes a category. Re-run the pre-flight.

---

## 12. Enforcement

### Where this gate runs

- **Manual builds:** before any commit to `out/` or push to social, the orchestrator agent runs the §3 scorecard and the §11 pre-flight. The score is recorded in `out/<deliverable>/scorecard.json` next to the render.
- **Automated pipelines (`automation_skills/automation/post_scheduler/`):** the post scheduler refuses to publish a piece without a `scorecard.json` showing total >= format minimum and no auto-zero. The refusal logs an entry in `pending_review/` for human action.
- **30-day review window (manifesto Rule 8):** during the first 30 days of any new format, Matt sees the scorecard alongside the render and approves or rejects manually. After 30 days of clean output, the format graduates to auto-publish.

### `scorecard.json` schema

Every render ships with a `scorecard.json`:

```
{
  "deliverable": "tumalo_v3",
  "scored_at": "2026-04-26T10:30:00-07:00",
  "scored_by": "orchestrator|matt",
  "format": "listing_reveal",
  "minimum_required": 85,
  "categories": {
    "hook": { "score": 9, "notes": "address visible by 0.8s, push-in engaged frame 8" },
    "retention": { "score": 8, "notes": "50% interrupt clean, 75% payoff weak" },
    "text": { "score": 10 },
    "audio": { "score": 9, "path": "A" },
    "format": { "score": 10 },
    "engagement": { "score": 8, "primary_trigger": "DM" },
    "cover": { "score": 9 },
    "cta": { "score": 9 },
    "voice_brand": { "score": 10 },
    "antislop": { "score": 10 }
  },
  "auto_zero_hits": [],
  "total": 92,
  "verdict": "ship"
}
```

Auto-zero hits, even when the headline total is high, block ship.

### When the gate fails

If a piece scores under the format minimum:

1. Identify the lowest-scoring category.
2. Re-cut against that category specifically. Do not "polish" — the bones are the problem.
3. Re-score from scratch.
4. If still under, the format itself may be wrong — escalate to Matt for a register pivot.

If a piece auto-zeroes:

1. The auto-zero is a hard failure mode (banned word, unverified data, AI without disclosure, fair-housing hit).
2. Fix the specific failure. Do not "explain it away."
3. Re-run the relevant scan (banned-words grep, citations diff, fair-housing scan).
4. Re-score the affected category. Resume.

---

## 13. Real estate viral patterns (April 2026)

### Creators with documented viral metrics

- **Glennda Baker** (@glenndabaker) — 874.9K TikTok followers; Atlanta agent; story-driven client narratives + educational. One of the most-followed real estate accounts in the US ([Feedspot 2026](https://creators.feedspot.com/real_estate_tiktok_influencers/)).
- **Josh Altman** — Luxury LA broker; pool-reveal video generated **4M views in a few days**; Rochelle Maize luxury-kitchen video: **9M views** ([AgentFire](https://agentfire.com/blog/real-estate-tiktok-ideas-that-will-get-you-deals-live-examples/)).
- **Victor Chan** (@victortkchan) — grew to 98K+ followers within a few months with 15-20 second finance explainer videos ([AgentFire](https://agentfire.com/blog/real-estate-tiktok-ideas-that-will-get-you-deals-live-examples/)).
- **Tat Londono** (@tatlondono) — high-energy buyer/investor tips. Both agent + coach positioning.

**Listings with video receive 403% more inquiries** than those without ([ResImpli stat](https://resimpli.com/blog/real-estate-video-statistics/), cited across multiple 2025 sources).

### Real estate hook patterns that work

- **"Wait, THAT's in the house?!" reveal moments** — unexpected feature, hidden room, unusual amenity ([Property Providers](https://propertyproviders.com/tiktok-made-me-do-it-real-estate-trends-going-viral-in-2025/))
- **Luxury feature close-up** in the first 2 seconds — infinity pool, chef's kitchen, mountain views through floor-to-ceiling glass
- **"What $X buys in [City]"** price-tier comparison
- **Before/after transformation** with quick cuts
- **Hyper-local hidden gem** — "Most people driving through Bend don't know this neighborhood exists"
- **Myth-buster** — "Everyone says wait for rates to drop. Here's why that's wrong."
- **Story / deal narrative** — "We almost lost this house because of one inspection clause"
- **Market data drop with counterintuitive finding**
- **Trending audio layered over property tour** (the Altman / Hard Knock Life formula)

### Real estate content that dies (do not produce)

- Generic slideshow photo tours with no voice or hook
- Agent on camera at a desk with no defined problem or curiosity gap in first 3 seconds
- Unstaged small spaces / minimalist-but-empty rooms
- Cookie-cutter homes with no differentiating feature
- Generic captions: "Dream home alert!", "Just listed!"
- Listing-style content (address, price, bed/bath) without narrative

### "Local virality" — why this matters more than national reach

**Views from within your market's geographic area carry more conversion value than national viral numbers** ([DMR Media](https://www.dmrmedia.org/blog/viral-content-patterns-in-real-estate-2025)). Targeting local audience signals over aggregate impressions is the right move for Ryan Realty.

A piece that hits 50K Bend-area views beats a piece that hits 1M scattered-national views in real revenue terms. Hashtag, geo-tag, and copy-anchor every piece to Bend / Central Oregon. The platform's geo-targeting picks up the signal and shows the post to more local viewers — which is the audience that converts.

### Audio mix recommendations (Reels)

Per [TrueFuture Media](https://www.truefuturemedia.com/articles/instagram-reels-reach-2026-business-growth-guide):
- **40-50% original audio / voiceover**
- **30-40% trending sounds**
- **15-20% evergreen music**

Across the Ryan Realty content engine, this mix translates to: most listing reveals and market data go original (Path A or C); meme / trend-jacks use trending audio (Path B); a smaller share of evergreen brand pieces use a curated music bed.

---

## 14. Quick reference

For the under-30-second pre-flight scan, see [`VIRAL_SCORECARD_QUICKREF.md`](VIRAL_SCORECARD_QUICKREF.md). That file is the index card version of this gate; pin it next to the editor on every build.

The full reasoning, the platform-by-platform algorithm data, and the source citations behind every number above live in:

- `social_media_skills/platforms/platform-algorithm-brief.md` — algorithm signals per platform, refreshed monthly
- `social_media_skills/platforms/viral-hook-library.md` — hook archetypes and copy patterns
- `social_media_skills/platforms/social-channel-specs.md` — technical specs per platform
- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master video production skill (the *how* of building)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned patterns (the *what's banned* gate)

If a number in this file disagrees with a number in those source files, the source file wins. Refresh this file when the source files refresh.

---

## 15. The bottom line

The point of this gate is not to slow content down. The point is to stop publishing content that drags the account.

Every piece that ships under this gate is engineered for distribution. The hook is a hook. The structure is engineered against the four signals. The text is sized to be read. The audio is matched to register. The CTA matches the platform. The cover earns the tap. The brand is intact. The data is verified. The slop is gone.

If the piece cannot clear the gate, the piece is not ready. If the format cannot consistently clear the gate, the format is wrong. If a format consistently scores 95+, study why and codify the pattern back into the master skill.

Virality is not luck. It is the output of a machine that is built to produce it. This gate is part of the machine.

---

*Last reviewed: 2026-04-26. Refresh when platform algorithm brief refreshes (monthly) or when a new format launches.*
