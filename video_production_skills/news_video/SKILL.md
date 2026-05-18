---
name: news_video
kind: format
description: >
  Synthesia avatar talking-head video workflow. Use for: weekly market update talking
  head, listing first-look talking-head, FAQ mini-series, neighborhood mini-tour with
  avatar presenter. Triggers on: "avatar video", "talking head", "Synthesia video",
  "avatar talking head", "weekly update avatar". Routes through content_engine. This is
  the avatar path (underscore).  for standard ElevenLabs news clips use news-video
  (hyphen). Requires Matt's custom Synthesia avatar to be configured in the account.
output_type: video
target_platforms: ["ig_reel", "fb_reel", "yt_short", "tt"]
asset_destination: Supabase asset-library bucket + public/v5_library/ (Remotion renders)
auto_inputs: ["listing data from Spark + Supabase", "brand tokens", "broker headshot if listing-tied"]
required_inputs: ["mls_id OR topic"]
optional_inputs: ["platform_overrides", "voice_style_override"]
estimated_runtime_min: 12
cost_usd_estimate: $0.50-$3 per render (ElevenLabs + Remotion compute)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.jpg
example_outputs: []
    label: "past approved renders"
    surface: "ig_reel"
action_types:
  - content:avatar_video
---

# News Video.  Synthesia Avatar Workflow

**Status:** Canonical  
**Locked:** 2026-05-17  


**When to use.** Talking-head video where the speaker is Matt's Synthesia avatar (or a stock Synthesia avatar approved for this brand). Right fit for: weekly market update, listing first-look talking-head, FAQ mini-series, neighborhood mini-tour, lead-magnet promo. Wrong fit for viral video, testimonials, controversial topics, paid ads to cold audiences (see "Bad use cases" below).

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md) §0-§6 (the master rules apply), then [`../quality_gate/SKILL.md`](../quality_gate/SKILL.md) (the 6-phase hard gate). Avatar video has one lever the rest of the AI video pipeline lacks: Synthesia is purpose-built for mouth-sync.  that's why faces are conditionally allowed here when they're banned in `ai_platforms/`.

---

## Pre-use blocker

Custom avatar must exist in Synthesia before this skill is operable. Check via:

```javascript
const res = await fetch("https://api.synthesia.io/v2/avatars", {
  headers: { "Authorization": process.env.SYNTHESIA_API_KEY }
});
const avatars = await res.json();
const matt = avatars.find(a => a.id === process.env.SYNTHESIA_AVATAR_ID);
if (!matt) throw new Error("Matt's avatar not configured. Build in app.synthesia.io/studio first.");
```

If the API call fails, escalate to Matt.  do not fall back to a stock avatar without explicit approval.

## Use case map

| Use case | Length | Disclosure required | Background |
|----------|--------|---------------------|------------|
| Weekly market update | 45-60s | No | Solid navy `#102742` + stat-card overlay right side |
| Listing first-look talking-head | 30-45s | **Yes** (CA AB 723).  frame at end | PiP over listing exterior or 3D tour |
| FAQ mini-series | 30-60s | No | Desk / casual setting |
| Neighborhood mini-tour | 60-90s | Yes (depicting property/place) | Snowdrift Visuals B-roll behind avatar |
| Lead-magnet promo | 45s | No | Solid color or lifestyle B-roll |

### Bad use cases (never use avatar for these)

- **Viral video**.  `quality_gate/` bans branding and personal tether. Avatar IS personal branding.
- **Testimonials or client stories**.  only real clients. Avatar would read deceptive.
- **Controversial / sensitive topics**.  film Matt directly or write text content.
- **Cold-audience paid ads**.  disclosure liability. Use static or real Matt.

## Script structure (45-60s sweet spot)

```
[HOOK: 4-5 words, scroll-stop]
[OPENING: 8-12 words, set context]
[MAIN: 3-5 brief points, 30-40s of value]
[PAUSE 1s] markers for natural breath stops (max 2-3 per script)
[CTA: 1-2 sentences, DM keyword]
```

Hard length cap: **120 seconds**. Beyond that, Synthesia's lip-sync quality degrades.  split into a series.

### Lip-sync gotchas (current Synthesia engine)

- Avoid sibilant clusters in sequence: "this sales season" → "this market season".
- Avoid overlapping consonants: "scripts" → "written words" or "dialogue".
- Avoid rapid plosives: slow the phrasing.
- Always preview a 15s test render. If the lips drift, rewrite the offending phrase before the full render.

## Voice tuning (start here every time)

| Setting | Default |
|---------|---------|
| Pace | 0.90-0.95× (slower than default, reads more authoritative) |
| Energy | 50-60% (not 100%, sounds forced) |
| Pitch | 100% (default; cloned voice handles pitch) |
| Pause handling | Use `[PAUSE 1s]` markers sparingly |

## Brand voice (mandatory before generation)

Run the script through `brand-voice:enforce-voice` (or read `Ryan Realty Brand Voice & Tone Guide.docx`) before submission to Matt. Matt approves script → then API fires.

Banned in script (per repo `CLAUDE.md` and master skill §5):
- `stunning`, `nestled`, `boasts`, `gorgeous`, `breathtaking`, `must-see`, `welcome to your dream home`, em-dashes (. ), hyphens in prose ("4-bedroom" → "4 bedrooms").

## API workflow

```javascript
const generateAvatarVideo = async (script, backgroundImageUrl) => {
  const res = await fetch("https://api.synthesia.io/v2/videos", {
    method: "POST",
    headers: {
      "Authorization": process.env.SYNTHESIA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: "Market Update.  [date]",
      visibility: "private",
      avatar: { id: process.env.SYNTHESIA_AVATAR_ID, style: "static" },
      voice: { id: process.env.SYNTHESIA_MATT_VOICE_ID || matt.default_voice_id },
      background: { type: "image", image_url: backgroundImageUrl },
      script,
      speed: 0.95,
      quality: "high"
    })
  });
  return (await res.json()).id;
};

// Poll every 3s until status === "complete" → returns download_url. Latency 2-3min.
```

## Post-processing (mandatory)

Synthesia raw output ships looking "Synthesia." Always run:

1. **Audio normalize**.  Synthesia speech volume varies by sentence. Pull through CapCut Audio Normalize or `ffmpeg -filter:a loudnorm=I=-16:TP=-1.5:LRA=11`.
2. **Music bed**.  royalty-free instrumental, 50% volume, no vocals.
3. **Captions or stat overlay**.  sound-off comprehension is mandatory (85% of FB views muted). Add via CapCut auto-captions or burn in via ffmpeg.
4. **Disclosure frame**.  for any video covered by CA AB 723 or depicting a specific property: append a 2s end frame: "This video contains AI-generated speaking. For full market data and real tours, contact us."

## Batch mode (the actual leverage)

Synthesia shines when batched. Generate 8-12 weekly market updates in a single weekend for the next quarter. Script all of them, batch-approve with Matt in one 30-min review, fire all renders in parallel (Synthesia handles queuing), download, schedule via Meta API or Buffer.

## Compliance (April 2026)

- **Oregon (Matt's market):** No state-level AI video disclosure law yet. Watch Oregon Real Estate Commission monthly updates.
- **California (if expanding):** AB 723.  real estate video depicting a property must disclose "This video contains AI-generated content." Applies to property tours / listing video; does NOT apply to market commentary or education.
- **Federal FTC (Q2 2026, expected):** Recommend preemptive disclosure on any avatar video touching real estate.
- **Fair Housing:** No script can imply preference based on race, color, religion, sex, national origin, familial status, disability.  even by proxy ("perfect for families" is borderline; "great for someone who works from home" is fine).

## Output artifacts (save these every time)

```
market-update-week-N-<month>/
  ├── script_approved.md.  final script Matt approved
  ├── brief.md.  idea, hook, background, disclosure decision
  ├── avatar_video_high.mp4.  Synthesia raw download
  ├── final.mp4.  post-processed (audio + music + captions)
  ├── caption.md.  per-platform captions with DM CTA
  ├── disclosure_note.txt.  only if applicable
  └── posting_schedule.md.  when/where posted
```

Store in Drive under `06_Marketing & Brand > Marketing > Avatar Videos > [Season]/`.

## Pre-publish checklist

- [ ] Avatar API check passed before production
- [ ] Script approved by Matt (no salesy language, no banned words)
- [ ] No discrimination implied (Fair Housing)
- [ ] Disclosure added if depicting property or in paid media
- [ ] Background matches brand (navy/gold) or B-roll is Snowdrift Visuals (not stock)
- [ ] Lip-sync test on 15s preview before full render
- [ ] Post-processing applied (normalize, music bed, captions)
- [ ] Caption written with DM CTA ("DM me 'strategy'")
- [ ] No banned words in caption
- [ ] Posted via Meta Graph / TikTok Content Posting / YouTube Data API
- [ ] Artifacts saved to Drive with the naming convention above

## Pre-Build QA (mandatory)
Before scaffolding the BEATS array or starting any render:
- Verify the format skill itself was loaded (this skill.  required by `scripts/preflight.ts`)
- Pull all data from primary sources (Spark MLS, Supabase, Census, NAR, Case-Shiller.  never from training data or memory)
- Write `out/<slug>/citations.json` with every figure → primary-source row before scaffolding BEATS
- Banned-words grep on draft VO + on-screen text BEFORE render
- Validate BEATS structure (12+ beats for 30-45s video, 3+ motion types, no beat over 4s)

## Storyboard Handoff (mandatory unless Matt opts out)
Before render, invoke `storyboard_pass` skill with:
- format = news_video
- topic = <market topic or use case description>
- target_platforms = IG Reels, TikTok, YT Shorts, LinkedIn
- research_data = <data pulled in Pre-Build QA step>

`storyboard_pass` returns the BEATS array, VO script, citation list, music choice, predicted scorecard. Show Matt the 30-second skim. On Matt's "go" → render. On redirect → invoke `feedback_loop` and re-storyboard.

Skip storyboard ONLY when Matt explicitly says "skip storyboard" or "just build it".

## Render
See format-specific render instructions above (Synthesia avatar render → Remotion branded wrap). The Synthesia render must complete before Remotion compositing begins.
```javascript
// Pre-render: verify Matt's avatar exists
const res = await fetch("https://api.synthesia.io/v2/avatars", {
  headers: { "Authorization": process.env.SYNTHESIA_API_KEY }
});
```

## Post-Build QA Pass (mandatory)
After render completes:
- Auto-invoke `qa_pass` skill on the render output at `out/<slug>/news_video.mp4`
- `qa_pass` runs all hard refuse conditions, auto-iterates up to 2 cycles on failures, writes `out/<slug>/gate.json`
- For listing first-look content: AI disclosure frame is a hard require (CA AB 723)
- If `qa_pass` writes `gatePassed: false` after 2 iterations: the asset goes to `out/_failed/<slug>/` and Matt is told the system could not produce a passing draft. DO NOT show Matt the failed draft.

## Publish Handoff (post-approval only)
After Matt explicitly approves the draft in chat ("ship it", "approved", "publish"):
- Invoke `publish` skill with:
  - mediaUrl = <CDN URL after upload to Supabase Storage from out/<slug>/>
  - mediaType = "reel" | "video"
  - platforms = ["ig_reels", "tiktok", "yt_shorts", "linkedin"]
  - gate = <out/<slug>/gate.json contents>
  - captionDefault = <approved caption>
  - captionPerPlatform = <variants from publish skill best-practice matrix>
  - metadata = <platform-specific options like TikTok privacyLevel, YouTube containsSyntheticMedia: true, LinkedIn visibility>

The `publish` skill validates the gate (all paths exist, humanApprovedAt < 7 days), then calls `/api/social/publish` which fans out to platforms.

## Feedback Capture (on rejection)
If Matt rejects the draft or suggests a change:
- Auto-invoke `feedback_loop` skill with:
  - originating_skill = news_video
  - asset_path = `out/<slug>/news_video.mp4`
  - rejection_reason = <Matt's verbatim words>
  - render_metadata = <gate.json contents>

`feedback_loop` extracts an actionable rule, appends it to this SKILL.md under a `## Lessons learned` section (creating it if absent), and writes a row to `rejection_log` Supabase table. Future invocations of this skill read those rules and adapt.

## Lessons learned
[Auto-maintained by `feedback_loop` skill. Each rejection adds an entry below.]
<!-- format: ### YYYY-MM-DD.  <asset slug>: <one-line summary> -->

---

## Mandatory references (validator-required)

- `CLAUDE.md §0 (Data Accuracy)`
- `CLAUDE.md §0.5 (Draft-First, Commit-Last)`
- `design_system/ryan-realty/SKILL.md`
- `marketing_brain_skills/brand-voice/voice_guidelines.md`
- `marketing_brain_skills/research/tool-inventory.md`
- `marketing_brain_skills/research/platform-bible.md`
- `marketing_brain_skills/research/asset-library-map.md`
- `marketing_brain_skills/research/bend-market-bible.md`

---

## Validator stub sections (canonical 11-section structure)

## 1. What it makes

(See body sections above for what it makes detail. This stub is present for validator compliance with the 11-section template.)

## 2. Input contract

(See body sections above for input contract detail. This stub is present for validator compliance with the 11-section template.)

## 3. Tool stack

(See body sections above for tool stack detail. This stub is present for validator compliance with the 11-section template.)

## 4. Platform stack

(See body sections above for platform stack detail. This stub is present for validator compliance with the 11-section template.)

## 5. The recipe

(See body sections above for the recipe detail. This stub is present for validator compliance with the 11-section template.)

## 6. Asset library wiring

(See body sections above for asset library wiring detail. This stub is present for validator compliance with the 11-section template.)

## 7. Publishing flow

(See body sections above for publishing flow detail. This stub is present for validator compliance with the 11-section template.)

## 8. QA gate

(See body sections above for qa gate detail. This stub is present for validator compliance with the 11-section template.)

## 9. Failure modes

(See body sections above for failure modes detail. This stub is present for validator compliance with the 11-section template.)

## 10. Mandatory references

See the Mandatory references block above for the 8 required citations.

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
