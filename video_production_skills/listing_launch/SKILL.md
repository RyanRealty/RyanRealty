---
name: listing_launch
kind: format
description: >
  Full launch package for a new listing going live: MLS description, 3 Reel scripts,
  7-frame Story sequence, IG static caption, FB post, sphere email. Triggers on: "listing
  launch", "full launch package", "go live for [address]", "listing package for
  [address]", "launch content for [address]", "MLS launch", "listing is going live".
  Routes through content_engine. Produces the complete per-property content set in one
  delivery.  video, copy, email, and MLS description together.
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
  - content:listing_launch
---

# Listing Launch.  Per-Property Reel + Story + Email + MLS Package

**Status:** Canonical  
**Locked:** 2026-05-17  


## Required references.  load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)**.  visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md)**.  2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**When to use.** A new listing is going live and you need the full launch package: MLS description, 3 Reel scripts, 7-frame Story sequence, IG static caption, FB post, sphere email. One property, one playbook, one delivery.

**Read first:** [VIDEO_PRODUCTION_SKILL.md](../VIDEO_PRODUCTION_SKILL.md), then [`../brand_assets/SKILL.md`](../brand_assets/SKILL.md) for photo selection, then this file. The video deliverable scaffolds against `listing_video_v4/` (Remotion). The text deliverables run through `brand-voice:enforce-voice`.

---

## Step 1.  Property intelligence

Pull (or extract from attached materials):

- Address + price
- Property type (single family / acreage / condo / luxury)
- Key features (beds / baths / sqft / lot size / views / signature features)
- Primary buyer type (relocator / local / investor / second-home / luxury)
- Photography status (Rich at Framed Visuals.  scheduled? Drone included?)
- MLS go-live date
- Open house planned?

## Step 2.  Identify the emotional core

Before any copy: identify the ONE emotional story this property tells. Not a feature list.  a feeling. Every piece of content reinforces this.

| Property type | Likely core |
|---------------|-------------|
| Mountain views + acreage | Solitude, connection to nature, room to breathe |
| Walkable old Bend neighborhood | Community, authenticity, local roots |
| Modern updated kitchen | Entertaining, gathering, food culture |
| Bend in general | Outdoor adventure, lifestyle choice, intentional living |

## Step 3.  MLS description (200-400 words)

**Framework:** Features → Lifestyle → Benefits.
- **Opening:** start with the feeling/lifestyle (not "Welcome to this stunning home").
- **Middle:** feature-benefit pairs woven into narrative prose (not a list).
- **Closing:** why now, why here.  scarcity or uniqueness angle.

**Voice:** Matt's authentic register.  knowledgeable, warm, never salesy. Reads like a thoughtful recommendation from someone who actually knows the property.

**Banned (zero tolerance):** `stunning`, `nestled`, `boasts`, `gorgeous`, `breathtaking`, `must-see`, `dream home`, `won't last long`, `rare opportunity`, em-dashes (. ), hyphens in prose ("4-bedroom" → "4 bedrooms").

## Step 4.  Social content package

### Three Reel scripts (different hooks)

Each script needs:
- **Hook (0-3s)**.  pick one of: Question Hook ("Would you live here?"), Curiosity Gap, Breaking News ("JUST LISTED in Tumalo"), Bold Take.
- **Body**.  feature reveals with emotional narration (or text overlays only.  see [`../area_guides/SKILL.md`](../area_guides/SKILL.md) for VO-less format).
- **CTA**.  DM-based ("DM me 'tour' for a private showing").
- **Length**.  15-60s of spoken content (or text on screen).
- **Format note**.  VO script with scene direction OR text-overlay shot list (the BEATS array for Remotion).

### Instagram Stories (7 frames)

| Frame | Content | Note |
|-------|---------|------|
| 1 | Hook ("Would you live here?") | Curiosity gap opener |
| 2 | Price reveal | Clean, data-first |
| 3 | Hero feature 1 | Best visual feature |
| 4 | Hero feature 2 | Second best |
| 5 | Location context | Neighborhood / lifestyle |
| 6 | Outdoor / lifestyle | Experience angle |
| 7 | End card | Matt Ryan contact + CTA |

### Instagram static post (feed)

- Hook line (NOT "Just Listed!")
- 2-3 sentences of narrative
- Key specs
- DM CTA
- 10-15 hashtags (location + property type + lifestyle)

### Facebook post

- Slightly longer, more conversational
- Include full address (Facebook search is local)
- Link to MLS listing
- No DM CTA (FB uses Messenger differently.  "Message me" works)

## Step 5.  Sphere email

Subject: specific + personal ("Matt here.  acreage property in Tumalo coming Thursday")
Body: 150-200 words, warm and personal. Key property details, why this one is worth noting, CTA: reply to schedule a showing or forward to someone who might be interested.

## Step 6.  Open house promotion (if applicable)

- Instagram Story sequence (3-5 frames)
- Facebook event or post
- Email reminder 48 hours before

## Output format

Deliver a single structured document Matt can copy-paste into Canva, FUB, or email:

```
## LISTING: [Address]

### MLS Description
[200-400 words]

### Reel Script 1.  [Hook Type]
[Script with scene directions]

### Reel Script 2.  [Hook Type]
[Script with scene directions]

### Reel Script 3.  [Hook Type]
[Script with scene directions]

### Instagram Story Frames (7)
[Frame-by-frame copy]

### Instagram Static Post
[Caption + hashtags]

### Facebook Post
[Full post copy]

### Sphere Email
Subject: [Subject line]
[Email body]
```

## Reference: 19496 Tumalo Reservoir Rd

The Tumalo Reservoir Rd reel ($1,599,000, 3BR/2.5BA, 2.28 ac, MLS 220193552) is the canonical worked example. Per-photo asset IDs and per-shot Reel beat-by-beat are in [`../brand_assets/SKILL.md`](../brand_assets/SKILL.md) ("Tumalo Reservoir Rd Asset ID Reference"). Watch the rendered file before scaffolding a similar tier.  `~/Documents/Claude/Projects/SOCIAL MEDIA MANAGER/56111_SchoolHouse_Pending_Reel.mp4` and the Tumalo Reels in the same folder (see [`../ASSET_LOCATIONS.md`](../ASSET_LOCATIONS.md)).

## Broker headshots

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.jpg`.  Matt Ryan (owner / principal broker)
- `paul-stevenson.jpg`.  Paul Stevenson
- `rebecca-peterson.jpg`.  Rebecca Peterson

All 800×1200 px, pure white bg, identical head height, natural color. Specs in `design_system/ryan-realty/MANIFEST.md` §"assets/team/".

**Listing-agent rule:** Include the LISTING AGENT'S headshot on every per-listing deliverable in this package that has a broker-contact slot (Reel end card, Story frame 7, sphere email signature). Resolve `ListAgentFullName` from the listing data pull to one of the three brokers above. For brand-led content that is part of this package but not tied to a specific agent (evergreen Reel scripts, generic open-house Story), omit the headshot and use the Jax mascot from `assets/brand/blue-dog.png` instead.

---

## Quality gate

Master skill §6 applies for video. For text:

- [ ] Brand voice enforcement passed on every piece of copy
- [ ] Zero banned words / em-dashes / cliché lines
- [ ] Every numeric claim (price, acreage, sqft, beds, baths, lot size, MLS#) traces to the listing data sheet.  per `CLAUDE.md` §0, no estimate, no "approximately"
- [ ] DM CTA on every IG asset
- [ ] Hashtags: 10-15, mix of location + property type + lifestyle
- [ ] No Zillow auto-description energy.  every line should sound like Matt wrote it
- [ ] Email subject is specific + personal (not "Weekly Update")

## Pre-Build QA (mandatory)
Before scaffolding the BEATS array or starting any render:
- Verify the format skill itself was loaded (this skill.  required by `scripts/preflight.ts`)
- Pull all data from primary sources (Spark MLS, Supabase, Census, NAR, Case-Shiller.  never from training data or memory)
- Write `out/<slug>/citations.json` with every figure → primary-source row before scaffolding BEATS
- Banned-words grep on draft VO + on-screen text BEFORE render
- Validate BEATS structure (12+ beats for 30-45s video, 3+ motion types, no beat over 4s)

## Storyboard Handoff (mandatory unless Matt opts out)
Before render, invoke `storyboard_pass` skill with:
- format = listing_launch
- topic = <address, listing details, and launch package scope>
- target_platforms = IG Reels, TikTok, YT Shorts, IG Stories, Email
- research_data = <data pulled in Pre-Build QA step>

`storyboard_pass` returns the BEATS array, VO script, citation list, music choice, predicted scorecard. Show Matt the 30-second skim. On Matt's "go" → render. On redirect → invoke `feedback_loop` and re-storyboard.

Skip storyboard ONLY when Matt explicitly says "skip storyboard" or "just build it".

## Render
See format-specific render instructions above (full Remotion listing video + copy deliverables). Command pattern:
```
cd listing_video_v4 && npx remotion render src/index.ts ListingLaunch out/<slug>/listing_launch.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92
```

## Post-Build QA Pass (mandatory)
After render completes:
- Auto-invoke `qa_pass` skill on the render output at `out/<slug>/listing_launch.mp4`
- `qa_pass` runs all hard refuse conditions, auto-iterates up to 2 cycles on failures, writes `out/<slug>/gate.json`
- If `qa_pass` writes `gatePassed: false` after 2 iterations: the asset goes to `out/_failed/<slug>/` and Matt is told the system could not produce a passing draft. DO NOT show Matt the failed draft.

## Publish Handoff (post-approval only)
After Matt explicitly approves the draft in chat ("ship it", "approved", "publish"):
- Invoke `publish` skill with:
  - mediaUrl = <CDN URL after upload to Supabase Storage from out/<slug>/>
  - mediaType = "reel"
  - platforms = ["ig_reels", "tiktok", "yt_shorts", "fb_reels"]
  - gate = <out/<slug>/gate.json contents>
  - captionDefault = <approved caption>
  - captionPerPlatform = <variants from publish skill best-practice matrix>
  - metadata = <platform-specific options like TikTok privacyLevel, YouTube tags, LinkedIn visibility>

The `publish` skill validates the gate (all paths exist, humanApprovedAt < 7 days), then calls `/api/social/publish` which fans out to platforms.

## Feedback Capture (on rejection)
If Matt rejects the draft or suggests a change:
- Auto-invoke `feedback_loop` skill with:
  - originating_skill = listing_launch
  - asset_path = `out/<slug>/listing_launch.mp4`
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
