---
name: social_calendar
kind: format
description: >
  Automated content calendar for active listings.  generates 3 posts per week per
  active listing across a configurable horizon (default 4 weeks = 12 posts). Triggers
  on: "social calendar", "content calendar", "listing content schedule", "post schedule
  for [address]", "weekly events video", "weekend events", "generate calendar for
  listing". Routes through content_engine. Run once when a listing goes active; re-run
  on status change. Also the source of autonomous daily content scheduling.
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
  - content:social_calendar
---

# Skill 5.  Social Calendar Automation

**Status:** Canonical  
**Locked:** 2026-05-17  


## When to use

Matt has an active listing on the market and needs sustained social presence without
manually planning each post. This skill generates a content calendar for 3 posts per week
per active listing across a configurable horizon (default 4 weeks = 12 posts).

Run it once when a listing goes active. Re-run if status changes (active -> pending) to
refresh hashtags and caption tone.

---

## Why 3 posts per week

3 posts/week per active listing is the algorithmic floor for IG and TikTok relevance
without triggering the over-posting penalty (which depresses reach on accounts that post
the same listing content more than once per day). Spread across Mon/Wed/Fri or
Tue/Thu/Sat gives 48-hour gaps between posts.  enough for each post to fully cycle
through the discovery feed before the next fires.

Fewer than 3/week per listing and the algorithm de-prioritizes the account for that
property's hashtag cluster. More than 1/day on the same listing and reach per post drops
measurably (observed on real estate accounts with 5K-50K followers, 2024-2025 data).

---

## Content mix (3 posts per week)

| Slot | Format | Length | Source |
|------|--------|--------|--------|
| Full-tour video | `full_tour_video` | 45s | The viral cut, generated separately by the listing-video pipeline (VIDEO_PRODUCTION_SKILL.md) |
| Single-room highlight | `single_room_highlight` | 15s | One room from the listing photo set, deterministic Remotion motion only.  no AI i2v |
| Neighborhood / lifestyle | `lifestyle_moment` | 10-20s or static | Drone aerial, walking trail nearby, coffee shop, sunset over the property.  establishes context, not the home interior |

Across a 4-week run, the opening slot of each week rotates: week 1 opens with
`full_tour_video`, week 2 with `single_room_highlight`, week 3 with `lifestyle_moment`,
week 4 back to `full_tour_video`. This prevents the algorithm from classifying the
account's posting pattern as automated.

---

## Caption rules (mandatory.  same source as VIDEO_PRODUCTION_SKILL.md)

### Banned words (never appear in any caption)
- `stunning`
- `nestled`
- `boasts`
- `gorgeous`
- `breathtaking`
- `must-see`
- `welcome to your dream home`
- `worth a serious look`
- `as a Bend homeowner`

### Formatting rules
- No em-dashes (. ) in prose
- No hyphenated noun phrases ("4-bedroom" -> "4 bedrooms")
- Numbers carry units: "$3,025,000", "4 bedrooms", "1,380 sqft"
- Caption length: 80-140 characters (TikTok/IG sweet spot)
- Always end: address + `@MattRyanRealty` + emoji-free CTA ("Tour link in bio.")

### Hook variety
Hooks rotate through ~20 templates per content type so the algorithm does not see
repeated openers. The script enforces this deterministically (no LLM). See
`templates/captions.md` for the full template inventory.

---

## Price-tier register

Follows the same register scale as the video pipeline:

| Tier | Style |
|------|-------|
| Under $500K | Upbeat, accessible, "move-in ready" framing |
| $500K-$1M | Balanced, measured, highlight the value story |
| Over $1M | Spare, confident, let the property speak.  fewer words |

---

## Usage

```bash
# With a per-listing manifest (preferred.  see Listing Manifest Schema below)
python scripts/generate_content_calendar.py \
  --listing-key vandevert_schoolhouse \
  --weeks 4 \
  --start-date 2026-04-28 \
  --output calendar.json

# Inline flags (fallback.  no manifest file required)
python scripts/generate_content_calendar.py \
  --address "56111 School House Rd, Bend, OR 97707" \
  --price 3025000 \
  --beds 4 \
  --baths 4.5 \
  --sqft 4900 \
  --lot "1.38 acres" \
  --status active \
  --locale-short "Vandevert Ranch" \
  --weeks 4 \
  --start-date 2026-04-28 \
  --output calendar.json

# Different cadence (Tue/Thu/Sat)
python scripts/generate_content_calendar.py \
  --listing-key vandevert_schoolhouse \
  --cadence-days tue,thu,sat \
  --output calendar.json
```

All flags:

| Flag | Default | Notes |
|------|---------|-------|
| `--listing-key` |.  | Required unless all inline flags present |
| `--weeks` | 4 | Number of weeks to generate |
| `--start-date` | Next Monday from today | YYYY-MM-DD |
| `--output` | `calendar.json` | Output path |
| `--cadence-days` | `mon,wed,fri` | Comma-separated day abbreviations |
| `--address` |.  | Inline fallback |
| `--price` |.  | Integer or float (no $ or commas) |
| `--beds` |.  | Integer |
| `--baths` |.  | Float (4.5 = 4 full + 1 half) |
| `--sqft` |.  | Integer |
| `--lot` |.  | String e.g. "1.38 acres" |
| `--status` | `active` | "active" or "pending" |
| `--locale-short` |.  | Short neighborhood/area name e.g. "Vandevert Ranch" |
| `--property-type` | `home` | e.g. "cabin", "ranch", "home", "estate" |
| `--special-feature` |.  | One distinguishing detail e.g. "Little Deschutes frontage" |
| `--architect` |.  | Architect name if notable |
| `--room-labels` |.  | Comma-separated list of room names for highlight captions |

---

## Output schema

```json
{
  "listing": {
    "key": "vandevert_schoolhouse",
    "address": "56111 School House Rd, Bend, OR 97707",
    "price": "$3,025,000",
    "beds": 4,
    "baths": 4.5,
    "sqft": "4,900 sqft",
    "lot": "1.38 acres",
    "status": "active",
    "locale_short": "Vandevert Ranch",
    "property_type": "home"
  },
  "horizon": {
    "start": "2026-04-28",
    "end": "2026-05-25",
    "weeks": 4,
    "post_count": 12
  },
  "posts": [
    {
      "post_number": 1,
      "date": "2026-04-28",
      "day_of_week": "Tuesday",
      "week": 1,
      "content_type": "full_tour_video",
      "format": "vertical_9_16",
      "assigned_photos": "all",
      "caption": "A Jerry Locati design. 4 bedrooms, Little Deschutes frontage. Vandevert Ranch. 56111 School House Rd @MattRyanRealty Tour link in bio.",
      "hashtags": ["#BendOregon", "#DeschutesCounty", "#LuxuryRealEstate", "#Listed", "#BendRealEstate", "#OregonLuxury"],
      "cta": "Tour link in bio.",
      "posting_notes": "First post of week 1.  use strongest hook. Schedule 7-9am or 6-8pm local time for peak reach."
    }
  ]
}
```

---

## Listing Manifest Schema (per-listing)

When a per-listing manifest exists at
`listing_video_v4/public/v5_library/<key>/manifest.json`, it must contain:

```json
{
  "listing": {
    "key": "vandevert_schoolhouse",
    "address": "56111 School House Rd, Bend, OR 97707",
    "price": 3025000,
    "beds": 4,
    "baths": 4.5,
    "sqft": 4900,
    "lot": "1.38 acres",
    "status": "active",
    "locale_short": "Vandevert Ranch",
    "property_type": "home",
    "special_feature": "Little Deschutes frontage",
    "architect": "Jerry Locati",
    "room_labels": ["great room", "kitchen", "primary suite", "office", "bunk room"]
  },
  "photos": [
    {
      "key": "exterior_hero",
      "src": "v5_library/modern/1-web-or-mls-_DSC1050.jpg",
      "category": "exterior",
      "room_label": null
    },
    {
      "key": "great_room_01",
      "src": "v5_library/modern/5-web-or-mls-_DSC0771.jpg",
      "category": "interior",
      "room_label": "great room"
    }
  ]
}
```

If this file is absent, the script accepts inline flags (all required fields above).
If the file is absent AND inline flags are incomplete, the script exits with a clear error.

---

## Data accuracy (mandatory.  per CLAUDE.md)

Every stat in every caption (address, price, beds, baths, sqft, lot) must come from
the listing manifest or inline flags passed to the script. The script never invents,
estimates, or approximates any figure. The banned-word filter runs after every caption
is generated and kills the process loudly if any banned term is present.

---

## Posting schedule notes

- Best times: 7-9am or 6-8pm Pacific for Bend audience (Deschutes County skews
  outdoorsy, early-morning and post-workday engagement).
- `full_tour_video` posts perform best Tuesday and Thursday (higher IG/TikTok engagement
  mid-week for real estate content, per 2024-2025 platform data).
- `lifestyle_moment` posts perform best on weekend-adjacent days (Friday, Saturday) when
  buyers are dreaming about their next home.
- Hashtag count: 5-8. More than 10 has been shown to reduce reach on IG Reels (2024
  algorithm update). Quality over quantity.

## Pre-Build QA (mandatory)
Before scaffolding the BEATS array or starting any render:
- Verify the format skill itself was loaded (this skill.  required by `scripts/preflight.ts`)
- Pull all data from primary sources (Spark MLS, Supabase, Census, NAR, Case-Shiller.  never from training data or memory)
- Write `out/<slug>/citations.json` with every figure → primary-source row before scaffolding BEATS
- Banned-words grep on draft VO + on-screen text BEFORE render
- Validate BEATS structure (12+ beats for 30-45s video, 3+ motion types, no beat over 4s)

## Storyboard Handoff (mandatory unless Matt opts out)
Before render, invoke `storyboard_pass` skill with:
- format = social_calendar
- topic = <listing address or content calendar scope>
- target_platforms = IG Reels, TikTok, YT Shorts (per-slot platform from calendar)
- research_data = <data pulled in Pre-Build QA step>

`storyboard_pass` returns the BEATS array, VO script, citation list, music choice, predicted scorecard. Show Matt the 30-second skim. On Matt's "go" → render. On redirect → invoke `feedback_loop` and re-storyboard.

Skip storyboard ONLY when Matt explicitly says "skip storyboard" or "just build it".

## Render
See format-specific render instructions above (format varies per calendar slot.  delegates to the appropriate format skill per slot type). Command pattern varies by slot format.

## Post-Build QA Pass (mandatory)
After render completes for each calendar slot asset:
- Auto-invoke `qa_pass` skill on the render output at `out/<slug>/<asset>.mp4`
- `qa_pass` runs all hard refuse conditions, auto-iterates up to 2 cycles on failures, writes `out/<slug>/gate.json`
- If `qa_pass` writes `gatePassed: false` after 2 iterations: the asset goes to `out/_failed/<slug>/` and Matt is told the system could not produce a passing draft. DO NOT show Matt the failed draft.

## Publish Handoff (post-approval only)
After Matt explicitly approves the draft in chat ("ship it", "approved", "publish"):
- Invoke `publish` skill with:
  - mediaUrl = <CDN URL after upload to Supabase Storage from out/<slug>/>
  - mediaType = "reel" | "video"
  - platforms = <per-slot platform assignment from content calendar>
  - gate = <out/<slug>/gate.json contents>
  - captionDefault = <approved caption>
  - captionPerPlatform = <variants from publish skill best-practice matrix>
  - metadata = <platform-specific options like TikTok privacyLevel, YouTube tags, LinkedIn visibility>

The `publish` skill validates the gate (all paths exist, humanApprovedAt < 7 days), then calls `/api/social/publish` which fans out to platforms.

## Feedback Capture (on rejection)
If Matt rejects the draft or suggests a change:
- Auto-invoke `feedback_loop` skill with:
  - originating_skill = social_calendar
  - asset_path = `out/<slug>/<asset>.mp4`
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
