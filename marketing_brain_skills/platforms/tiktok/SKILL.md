---
name: tiktok-platform-playbook
description: >
  TikTok platform strategy, algorithm primer, metrics deep-dive, and tactical
  playbook for Ryan Realty. Local real estate content targeting out-of-state
  buyers researching Bend, OR.
---

# TikTok Platform Playbook — Ryan Realty

**Pair-required:** `video_production_skills/VIRAL_GUARDRAILS.md` (hook spec + qualified-view threshold),
`video_production_skills/ANTI_SLOP_MANIFESTO.md` (banned patterns).

---

## 1. Platform overview

TikTok is the dominant interest-graph short-form video platform as of 2026. Unlike
Instagram (follower-graph-weighted) or YouTube (search-weighted), TikTok's For You Page
(FYP) distributes content primarily based on what a viewer has *engaged with*, not who
they follow. This matters enormously for real estate: a first-generation buyer in Texas
who has watched 15 videos about Bend housing costs will see Ryan Realty content before
a local follower who has never engaged with real estate topics.

**Format lock:** 1080×1920 portrait, h264+aac, 15–60 seconds (sweet spot 30–45s per
VIRAL_GUARDRAILS §format-specs). Longer content (up to 10 min) is permitted but short-form
dominates discovery for new-account growth.

**Why TikTok for Bend buyer acquisition:**
- Out-of-state buyers in high-cost metros (Bay Area, LA, Seattle, Portland) actively
  research relocation options on TikTok. Search terms like "moving to Bend," "Bend OR
  real estate," and "Oregon housing market" generate millions of monthly queries.
- TikTok's interest graph means a video about Bend wildfire risk or school districts
  can reach a California family in the research phase — before they contact any agent.
- The 18–34 and 35–54 demographic brackets both index strongly on TikTok, capturing
  the primary first-time buyer and move-up buyer cohorts.
- TikTok's algorithm has historically rewarded authentic, information-dense, local
  expertise content in real estate — the exact format Ryan Realty is built to produce.

**Source:** TikTok Newsroom (https://newsroom.tiktok.com), TikTok Creator Portal
(https://www.tiktok.com/creators/creator-portal/).

---

## 2. Algorithm primer — 2026

TikTok's recommendation system is an interest-graph model, not a social graph model.
New content is tested against small pools of viewers whose interest profiles match the
content's topic signals. If the test pool engagement clears the threshold, TikTok
widens distribution to larger pools — each wave bigger than the last.

### 2a. The cascade model

1. **Initial pool** (~300–500 accounts): content is shown to accounts whose past behavior
   matches predicted interest signals (topics in caption, hashtags, audio, on-screen text
   analyzed by OCR).
2. **Engagement gate:** if the pool clears the threshold, TikTok serves a 3–5x larger pool.
3. **Cascade continues** until either the pool fails the gate or the content saturates
   its addressable audience.

A video with 0 followers can reach 1M+ views if it clears each gate. A video from an
account with 100K followers will reach nothing if it fails the first gate.

### 2b. Qualified Views threshold (2026)

TikTok raised the "Qualified View" threshold from 3 seconds to **5 seconds** in 2025-2026.
A view counts toward the distribution signal only if the viewer watched at least 5 seconds.
All hook engineering targets this 5-second hold.
**Source:** Virvid (https://virvid.ai/blog/tiktok-algorithm-2026-explained).

Cross-reference: `video_production_skills/VIRAL_GUARDRAILS.md` §2a — the frame-by-frame
hook spec is calibrated against this threshold (motion by frame 12 / 0.4s, content by
frame 30 / 1.0s, payoff by 2.0s, viewer confirmation by 3.0s, qualified-view hold at 5.0s).

### 2c. Signal weights (2026)

| Signal               | Weight |
|----------------------|--------|
| Watch time           | 10 pts |
| View-through rate    | 8 pts  |
| Shares               | 6 pts  |
| Comments             | 5 pts  |
| Likes                | 4 pts  |

**Source:** Virvid (https://virvid.ai/blog/tiktok-algorithm-2026-explained).

Completion rate is the practical proxy for watch-time + view-through-rate combined.
It is the dominant signal by a wide margin.

### 2d. Completion rate benchmarks

- 70%+ completion → 3x more reach.
- 80%+ → typical viral content.
- 78% → platform-wide average.
- **Source:** Virvid (https://virvid.ai/blog/ai-shorts-increase-retention-watch-time).

### 2e. Re-watches

A viewer watching 2+ times pushes the cascade exponentially. Re-watchable content
(useful data, surprising stat, end-frame that re-frames the opener) performs 2x versus
watch-once content. Design every video to reward a second view.

### 2f. First-hour engagement

TikTok shows new content first to existing followers. Strong first-hour engagement from
that base unlocks external (non-follower) distribution. This is why posting cadence
matters: consistent posts train followers to engage, which primes the pump for FYP reach.
**Source:** Virvid (https://virvid.ai/blog/tiktok-algorithm-2026-explained).

### 2g. Interest graph vs. follower graph

TikTok is ~80% interest-graph, ~20% follower-graph for distribution decisions. A new
account with 50 followers can outscore an account with 50,000 followers on a given topic
if the content is better-engineered. Follower count is a lagging indicator of account
authority, not a distribution lever.

---

## 3. Metrics deep-dive

### 3a. Completion rate (CR)

**What it is:** Percentage of viewers who watch the video to the last frame.

**Good for small/new account (<10K followers):** 40–55% is baseline. 60%+ is strong.

**Good for real estate niche:** 55–70% is average for real estate content on TikTok;
the category historically underperforms entertainment but outperforms B2B due to
strong viewer intent.

**Causes of underperformance:**
- Hook fails to deliver payoff promised in the first 3 seconds.
- Caption/VO mismatch (viewer expects one thing, video delivers another).
- Video too long for the content density — each second must earn its watch.
- Beat transitions that freeze or go black create "swipe windows."

**Levers:**
- Shorten the video. The shorter a video is, the higher completion can go.
- Front-load the value: answer the implied question by the 50% mark.
- Pattern interrupt at 25% and 50% to re-anchor viewers who were about to swipe.
- End with a frame that compels re-watch (data reveal, contradiction, callback).

**Source:** Hootsuite Social Media Trends 2026 (https://blog.hootsuite.com/social-media-trends/),
Later TikTok Benchmarks (https://later.com/tiktok/).

---

### 3b. Views

**What it is:** Total play count (includes repeats; not unique).

**Good for small account:** 200–500 views/video baseline. 1,000–5,000 is a healthy
early signal. 10,000+ indicates the cascade fired.

**Real estate niche:** Local-market videos for smaller markets (Bend population ~100K)
typically peak at 5K–50K views organically. Viral outliers (wildfire risk, rate shock,
cost comparison) can reach 500K+.

**Causes of underperformance:** Hook failure (swipe before 5s), mis-tagged niche
(hashtags pointing at wrong interest graph), low-engagement posting time.

**Levers:** Hook engineering, audio selection (trending sound lifts initial distribution),
hashtag precision.

---

### 3c. Watch time (total seconds)

**What it is:** Cumulative seconds of play across all viewers. Not per-viewer.

**Good numbers:** For a 45s video at 1,000 views with 60% CR → ~27,000 seconds. The
marketing brain computes per-viewer average by dividing total watch time by views.

**Note:** Total watch time as a raw metric is not exposed via the current API tier.
Average watch time per viewer and completion rate require Research API access (see
ingestor header for tier-gated list).

---

### 3d. Shares

**What it is:** Times viewers tapped "Send to" (DM or external share).

**Good for small account:** 1–3% share rate (shares / views).

**Why it matters:** Shares carry 6/10 weight in the TikTok signal stack — second only
to watch time and view-through rate. One share on TikTok exposes the video to the
recipient's contact graph AND often triggers a second distribution wave from TikTok.

**Real estate niche lever:** Content that makes viewers want to send it to someone
specific ("send this to your friend who wants to move to Bend") outperforms generically
viral content for lead quality.

**Benchmark source:** Social Media Examiner 2026 Industry Report (https://www.socialmediaexaminer.com/report/).

---

### 3e. Likes

**What it is:** Heart taps.

**Algorithm weight:** 4/10 — the weakest engagement signal in the TikTok stack.
Likes are a social proof signal for viewers scanning the like count, not a primary
distribution lever. Do not optimize for likes over completion or shares.

**Good benchmark:** 3–8% like rate for real estate content. Below 1% indicates
audience mismatch.

---

### 3f. Comments

**What it is:** Comment count.

**Algorithm weight:** 5/10. Comment *depth* (replies, thread length) is weighted more
than raw comment count.

**Good benchmark:** 0.5–2% comment rate. Real estate content that asks a polarizing or
locally specific question outperforms ("Is Bend overpriced? Comment your number.").

**Lever:** End every video with a comment-baiting question. One specific question
outperforms generic "let me know below."

---

### 3g. Followers

**What it is:** Cumulative follower count. A lagging indicator.

**Growth benchmarks for new accounts:**
- Months 1–3 (daily posting): 100–500 new followers/month is healthy.
- Month 6+: 1,000–5,000/month if content consistently clears the cascade.

**Real estate niche:** Follower counts in real estate on TikTok tend to be smaller than
entertainment niches but have higher purchase intent per follower.

**Source estimate** (internal — no published per-niche benchmark available).

---

### 3h. Profile views

**What it is:** Unique accounts that visited the profile (not exposed in current API tier).
Available in TikTok Analytics Dashboard (manual) or Research API (programmatic).

**Why it matters:** Profile views → bio link clicks → website traffic. The ratio of
profile views to bio clicks is a proxy for how well the CTA and bio are converting.

---

### 3i. Follower engagement rate

**Formula:** `(likes + comments + shares) / followers`. Compute in the marketing brain
from the per-video metrics stored in `marketing_channel_daily`.

**Good:** 5–10% for accounts <10K followers. Declines naturally as accounts scale.
Above 10% is exceptional for real estate.

---

## 4. Format playbook

All Ryan Realty TikTok content is **1080×1920 portrait, 30fps, h264+aac**. No exceptions.
See `video_production_skills/VIDEO_PRODUCTION_SKILL.md` for full production spec.

### 4a. Hook spec (first 5 seconds — the 2026 qualified-view gate)

| Frame | Time | Required |
|-------|------|----------|
| Frame 12 | 0.4s | Motion engaged (Ken Burns, push_in, pan) — no static opener |
| Frame 30 | 1.0s | On-screen text: centered, 64–80px headline, 5–7 words max |
| Frame 60 | 2.0s | Payoff delivered or clearly implied |
| Frame 90 | 3.0s | Viewer confirmation: "this video is worth finishing" |
| Frame 150 | 5.0s | **Qualified-view threshold** — viewer is now counted by TikTok |

Hooks that contain a **number, a place name, a contradicting claim, or a visual surprise**
outperform generic hooks by 2.2x on 3-second retention.
**Source:** VIRAL_GUARDRAILS.md §2a, TTS Vibes (https://insights.ttsvibes.com/tiktok-first-3-seconds-hook-retention-rate/).

**Banned openings:** logo, brokerage name, "Hey everyone," "Today I want to talk about,"
slow boundary draw, agent intro, black title card. See ANTI_SLOP_MANIFESTO.md.

### 4b. Pattern interrupts

- **25% mark:** new visual register or text shock.
- **50% mark:** hard register shift (exterior → interior, drone → closeup, chart → VO).
- **Final 15%:** kinetic stat reveal. No logo, no contact info, no brokerage attribution.

### 4c. Trending audio

Trending audio is a significant distribution lever on TikTok — the algorithm surfaces
content using sounds that are gaining velocity to users who engage with that sound family.

**Rules for Ryan Realty:**
- Use trending instrumentals only (no vocal tracks — VO is the human presence in the video).
- Trending sound must fit the emotional register of the content: uptempo electronic for
  market data, cinematic/ambient for listing tours, lo-fi for evergreen education.
- Sounds that are "trending" (>10K videos in the last 7 days) but not yet oversaturated
  (<500K videos total) perform best. This is the "low saturation + high velocity" window.
- Songs with lyrics that contradict the brand voice or content are disqualifying even if
  trending.

**How to find:** TikTok Creative Center (https://ads.tiktok.com/business/creativecenter/),
TrendTok Analytics (https://www.trendtok.app/), Exolyt (https://exolyt.com/).

### 4d. Captions

Captions are required on every video — ~80% of TikTok viewers watch muted on-feed
but switch to audio if captions earn their attention.

Full caption spec: `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §0.5.
Key rules:
- Full-sentence display with active-word gold highlight (not word-by-word).
- Sync to ElevenLabs forced-alignment timestamps.
- AzoSans 56px, 70% navy pill (`rgba(16,39,66,0.70)`), 24px corner radius.
- Caption zone: y 1480–1720, x 90–990. Never overlapping stats, charts, or photo focal content.

---

## 5. Posting cadence + timing

### 5a. New account (0–3 months): daily minimum

TikTok's algorithm requires a signal baseline before it can model an account's topic
affinity and distribute confidently. Daily posting for the first 60–90 days:

- Feeds the FYP with enough content to test which formats, hooks, and topics clear
  the cascade.
- Trains TikTok's topic classifier to associate the account with local real estate,
  Bend OR, and relocation content.
- Produces the performance data the marketing brain needs to optimize.

**Recommended:** 1 post/day, varied format (market data Monday, listing tour Tuesday,
neighborhood guide Wednesday, educational/myth-bust Thursday, local lifestyle Friday).

### 5b. Established account (3 months+): 3–5x/week

After establishing topic affinity and having at least 5–10 videos that cleared the
cascade (1,000+ views), reduce to sustainable 3–5 posts/week without reach penalty.
Quality gates matter more than cadence at this stage.

### 5c. Optimal posting times for real estate audiences

TikTok's algorithm does not strictly enforce time-of-day weighting the way older
platforms did — content can go viral 48–72 hours after posting. However, first-hour
engagement from existing followers matters, so posting when followers are active
improves the initial seed.

For Bend, OR real estate audiences (Pacific time, working professionals):
- **Best windows (Pacific):** 7–9am (morning scroll), 12–1pm (lunch break), 8–10pm (evening).
- **Avoid:** 2–5am, Saturday/Sunday before 9am (low-quality engagement window for real estate).

**Note:** These are empirical estimates. Once the account has 30+ days of data, query
`marketing_channel_daily` for time-of-day correlation with views and adjust.

---

## 6. Trending audio + hashtags

### 6a. Audio strategy

Trending audio is the single biggest distribution lever unique to TikTok vs. other
platforms. The algorithm actively boosts content using sounds in their growth phase.

**Discovery workflow:**
1. Open TikTok Creative Center → Sounds → filter by "rising" + last 7 days.
2. Cross-check on TrendTok: look for sounds with <500K uses but >50K uses — the sweet spot.
3. Verify the audio fits the content register (no lyrics clashing with VO).
4. Save sound for use within 24–48 hours — viral audio windows are short.

**Tools:**
- TikTok Creative Center (free): https://ads.tiktok.com/business/creativecenter/
- TrendTok (paid, ~$9/mo): https://www.trendtok.app/
- Exolyt (free tier available): https://exolyt.com/
- Apify actor `clockworks/free-tiktok-scraper` — scrape competitor video sound usage
  to detect rising sounds before they hit Creative Center.

### 6b. Hashtag strategy

**Primary hashtags (high-intent, lower volume — real estate niche):**
`#bendoregon`, `#bendor`, `#bendrealestate`, `#oregonrealestate`, `#relocatingtooregon`,
`#pnwrealestate`, `#movingtoOregon`, `#centralOregon`

**Secondary hashtags (broader reach pool):**
`#realestate`, `#housingmarket`, `#firsttimehomebuyer`, `#homebuying2026`, `#realtorlife`

**Format tags (for FYP categorization):**
`#realestatetiktok`, `#realestateagent`, `#homeforsale`

**Optimal hashtag count:** 4–7 per post. More than 10 dilutes topic signal. One
primary niche hashtag + 2–3 topic hashtags + 1–2 format tags is the standard formula.

**Trending hashtag check:** Weekly sweep of `#bendoregon` and `#oregonrealestate` to
identify which sound/hashtag combinations are gaining volume.

---

## 7. Real estate competitor benchmarks

### 7a. Glennda Baker (@glendabaker)

- Cadence: 1–2/day.
- Format: talking-head VC with on-screen text overlay. Low production. High authenticity.
- Hook style: controversial claim or polarizing opinion in first 2 seconds. No voiceover
  — direct-to-camera.
- Hashtag strategy: 5–7 tags, always includes `#realestate` and one market-specific tag.
- What works: strong opinion + CTA for comments. High comment velocity drives reach.
- What doesn't: any content with high production value — her audience has trained to
  distrust "polished."
- **Ryan Realty takeaway:** production quality is not a substitute for hook quality.
  Glennda outperforms with a phone and a strong take. Engineer the hook before
  engineering the B-roll.

### 7b. Caton Del Rosario (@catond)

- Cadence: 5–7/week.
- Format: luxury property tours + narrated market analysis. Mix of production levels.
- Hook style: price reveal in the first 3 words. "This house just sold for $4.2M."
- Audience: aspirational viewers, not necessarily buyers. Watch time is high but
  lead intent is lower per view than local-market content.
- **Ryan Realty takeaway:** price hooks work universally. The Bend audience is
  value-motivated, not aspirational — lead with market insight ("Bend inventory just
  hit 2.1 months of supply") over price shock.

### 7c. What consistently works in real estate TikTok

- Specific local numbers in the hook: "$485K median in Bend" outperforms "Is Bend expensive?"
- Myth-busting structure: "Everyone thinks [wrong thing]. Here's what the data actually shows."
- Visual proof: charts, map overlays, MLS screenshots add credibility that boosts
  watch time vs. talking-head only.
- Short (30–35s) outperforms long (55–60s) for new-account growth. Completion rate
  on shorter videos pushes the cascade faster.
- Trend hijacks (real estate angle on a viral national story) — e.g., wildfire insurance
  crisis, interest rate decision, national housing shortage — drive volume spikes.

---

## 8. Improvement tactics

### 8.1 Tighten the first 5 seconds
**Metric:** Completion rate. **Expected lift:** +8–15% CR. **Lead time:** Immediate.
Review every video that clears 10K views for frame-0 composition. Motion by 0.4s,
text by 1.0s. Any video without both fails the hook spec.
**Source:** VIRAL_GUARDRAILS.md §2a.

### 8.2 Switch from generic to specific numbers in caption
**Metric:** Views (FYP distribution). **Expected lift:** +20–40% initial pool engagement.
**Lead time:** Immediate.
"Bend housing market update" → "Bend homes are sitting 42 days on market — up 18% YoY."
Specific numbers engage the interest graph's topic classifier more precisely.

### 8.3 Use trending audio in the rising phase
**Metric:** Views. **Expected lift:** +30–100% on initial distribution pool.
**Lead time:** 24–48 hours (sound identification + render time).
Execute the sound-discovery workflow weekly. One video on a rising sound before
saturation outperforms 10 videos on an oversaturated sound.
**Source:** TrendTok benchmarks (https://www.trendtok.app/).

### 8.4 Add a pointed comment question
**Metric:** Comments, first-hour engagement. **Expected lift:** +40–80% comment rate.
**Lead time:** Immediate (caption edit).
End every video caption with one specific question. "What's stopping you from making
the move?" outperforms "Let me know your thoughts."

### 8.5 Post at 7–9am Pacific, not noon
**Metric:** First-hour engagement (follower-base seed). **Expected lift:** +10–20% follower engagement.
**Lead time:** Immediate (scheduling change).
Most Pacific-time working professionals scroll TikTok in the morning commute window,
not at lunch. Test both and let the data confirm.

### 8.6 Shorten videos to 30–35s
**Metric:** Completion rate. **Expected lift:** +10–20% CR (fewer swipe opportunities).
**Lead time:** Next production cycle.
A 45s video requires holding a viewer 10+ seconds longer than a 35s video for the same
completion percentage. Cut ruthlessly.

### 8.7 Add pattern interrupt at the 25% and 50% mark
**Metric:** 50% retention rate. **Expected lift:** +5–10% mid-video retention.
**Lead time:** Next production cycle.
VIRAL_GUARDRAILS §retention-structure: a new visual register at 25% and a hard format
shift at 50% both re-anchor viewers who were about to swipe.

### 8.8 Competitor sound monitoring via Apify
**Metric:** Views. **Expected lift:** 1–2 high-performing videos/month via sound arbitrage.
**Lead time:** 1–2 days to configure Apify actor.
Use `clockworks/free-tiktok-scraper` to pull the last 10 videos from 5 real estate
TikTok competitors. Extract audio IDs, cross-check against Creative Center rising
sounds, identify sounds competitors are riding before saturation.

### 8.9 Publish daily for 90 days
**Metric:** Followers (lagging). **Expected lift:** Baseline reach 3–5x by day 90 vs. day 1.
**Lead time:** 90 days.
TikTok's account authority model rewards consistent publication. Accounts that post
daily for 90 days and maintain 50%+ average CR earn a sustained reach floor that
lower-cadence accounts don't achieve.
**Source estimate** (no published TikTok confirmation — industry-observed pattern).

### 8.10 Repurpose top-performing formats immediately
**Metric:** Completion rate, shares. **Expected lift:** +15–25% vs. novel format.
**Lead time:** Same production cycle.
A format that cleared 70%+ CR once will likely clear it again on the same topic.
When a video outperforms, the marketing brain flags it. Rebuild the same structure
with a different specific number or neighborhood within the next 7 days.

---

## 9. Anti-patterns

### 9.1 Letterboxed video
Never output a 16:9 or 4:3 video with black bars on a TikTok post. The platform crops
to 9:16; letterboxed content reads as low-effort and kills watch time in the first swipe.
Always render 1080×1920. **Source:** TikTok Creator Portal best practices.

### 9.2 Slow hooks
Static frame at frame 0 is a ship-blocker. Any video that doesn't have motion by 0.4s
is rejected at the quality gate regardless of content quality. The platform's own
algorithm data shows 70% of viewers swipe within the first 3 seconds if there's no
motion signal.

### 9.3 VO music that overpowers speech
If the background music level competes with the narration, viewers on-audio perceive
the video as chaotic and swipe. ElevenLabs VO is at 0dB; music is mixed at -14 to
-18dB under VO. Never level-match music to voice.

### 9.4 Trending sound that contradicts brand register
Using a meme audio track on a serious market data video (or vice versa) creates
cognitive dissonance. Viewer intent and sound register must match. The sound is a
promise about the video's tone — breaking it at frame 30 causes swipes.

### 9.5 Banned words in caption and VO
All words banned in CLAUDE.md apply to TikTok captions: stunning, nestled, boasts,
charming, pristine, gorgeous, breathtaking, must-see, dream home, spacious, cozy,
luxurious. TikTok's audience skews younger and has a stronger rejection reflex for
marketing-speak than older platform audiences.

### 9.6 Ryan Realty branding in the first 5 seconds
Brand reveal before the viewer has cleared the 5-second qualified-view threshold is
a hook killer. The viewer came for information, not a brokerage announcement. Logo
and brand attribution go at the end card only (for viral/news cuts) or in the footer
bar only (for listing videos). Never in the first 5 seconds. Never as an opener.

### 9.7 Posting at random times
Without a consistent posting schedule, TikTok cannot build a reliable follower
engagement model. Random cadence suppresses the first-hour follower seed that
unlocks external distribution. Post on a schedule, even if the cadence is modest.

### 9.8 Ignoring comment reply speed
First-hour comment replies from the creator signal to TikTok that the post is
generating author engagement — a distribution boost trigger. Leaving the first 10
comments unanswered for 24 hours wastes the boost window. Respond within 1 hour
of posting.

---

## 10. Brain-readable summary

### If X drops, do Y

| Signal | Drop threshold | Action |
|--------|---------------|--------|
| Completion rate | < 50% on last 5 videos | Shorten to 30–35s; review hook spec; add pattern interrupt at 25% |
| Views per video | < 300 (account >30 days old) | Check trending audio; review hashtag precision; confirm posting time |
| Shares | < 0.5% of views | Add explicit share-bait ("Send this to someone considering moving to Bend") |
| Comments | < 0.3% of views | End every video with one specific question; reply to all comments in hour 1 |
| Follower growth | < 50/week after 30 days | Increase cadence to daily; repurpose top-performing format |
| First-hour likes | < 10% of average per-video likes | Shift posting time to 7–9am Pacific |

### Top 3 levers for completion rate

1. **Hook tightness** — motion by 0.4s, specific number or claim by 1.0s.
   A viewer who doesn't get a clear value promise by 3s will not reach 5s.

2. **Video length** — 30–35s videos have structurally higher CR than 45–55s videos
   holding all else equal. Cut every video to its minimum viable length.

3. **Pattern interrupt at 50%** — a hard visual register change at the midpoint
   re-anchors viewers who were about to swipe. This is the single highest-leverage
   in-video edit that can be made without changing the content.

### Single most important metric

**Completion rate.**

It is the practical proxy for watch-time + view-through-rate combined — the two
highest-weight signals in TikTok's algorithm. Every other metric (likes, comments,
shares) is a downstream effect of whether the video earned the viewer's full attention
first. A video with 90% CR and 200 views will be pushed to a second pool. A video with
20% CR and 10,000 views will not. Engineer for completion first; everything else follows.

---

*Last updated: 2026-05-13. Sources: TikTok Newsroom, TikTok Creator Portal, Virvid,
TTS Vibes, Hootsuite Social Trends 2026, Later TikTok Benchmarks, Social Media Examiner
2026 Industry Report, TrendTok documentation.*
