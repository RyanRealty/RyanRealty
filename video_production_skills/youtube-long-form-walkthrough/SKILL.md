---
name: youtube-long-form-walkthrough
description: >
  Canonical producer for the YouTube long-form walkthrough.  a 4-12 minute, 1920×1080 horizontal
  property tour for Ryan Realty listings priced $750,000 and above. The most durable lead asset
  per listing: YouTube search surfaces it for 12-36 months post-publish, far outlasting the
  24-72 hour half-life of IG Reels and TikTok cuts. Modeled on Enes Yilmazer (4.2M subs, 826M
  views) and Drumelia Real Estate (single villa tours hitting 17M+ views with a modest sub
  base): no face in thumbnails, no face in video frames, drone exterior approach with price
  reveal in the first 10 seconds, then exterior context → interior room-by-room walk →
  outdoor + lot context → neighborhood proof points → stats summary → showing CTA. Title
  format: "[Beds]BR/[Bath]BA [PropertyType] in [Neighborhood].  $[Price] | [City], Oregon."
  Use whenever Matt says "youtube longform for <address>", "youtube walkthrough for <MLS#>",
  "build the youtube walkthrough", "yt long-form for <listing>", or "the long youtube video
  for <address>." For short-form 9:16 listing reels use listing-tour-video or listing_reveal.
  For the monthly market data deep-dive use youtube-long-form-market-report.
when_to_use: |
  Trigger when Matt says any of:
  - "youtube longform for <address>"
  - "youtube longform for MLS <id>"
  - "youtube walkthrough for <address>"
  - "youtube walkthrough for <MLS#>"
  - "build the youtube walkthrough"
  - "yt long-form for <listing>"
  - "yt long-form for <address>"
  - "the long youtube video for <address>"
  - "long youtube tour for <address>"
  - "youtube property tour for <MLS#>"
action_types:
  - content:yt_longform_walkthrough
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
---

# YouTube Long-Form Walkthrough.  $750K+ Listing Tour Producer

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Build one 1920×1080, 4-12 minute YouTube walkthrough per call for a single Ryan Realty
listing at $750,000 or above. Optimized for YouTube search and watch-time retention.  the audience
arrives via long-tail queries ("homes in northwest crossing bend", "luxury homes in tetherow")
and watches the full tour before deciding whether to request a showing. This producer owns
composition, render, thumbnail, title, description, chapter markers, and the citations + scorecard
files. It does NOT own publishing to YouTube (that's the publisher capability) and it does NOT
own the short-form 9:16 cuts (those are `listing-tour-video` and `listing_reveal`).

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer (per
`marketing_brain_skills/producers/REGISTRY.md`).

---

## 1. Required references.  load before doing any work

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy | Every figure traces to a primary source. Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/yt-longform/<slug>/`. Wait for explicit approval. |
| `CLAUDE.md` §3.  Video Build Hard Rules | Format, hook, beats, VO, brand constraints. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | The YouTube description is a hashtag-supporting surface.  `#RyanRealtyBend` first in its tag block. The video FRAME carries no hashtags. |
| `design_system/ryan-realty/SKILL.md` | Navy `#102742` + cream `#faf8f4`, Amboqia/Geist/Azo Sans Medium type tiers, broker headshot rule, Jax mascot. |
| `design_system/ryan-realty/colors_and_type.css` | Color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Voice attributes, banned vocab union. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint. |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. |
| `video_production_skills/listing-tour-video/SKILL.md` | Beat library, motion primitives, photo discipline. The long-form is an expanded sibling. |
| `video_production_skills/listing_reveal/SKILL.md` | Two-layer overlay system reused for section title cards. |
| `video_production_skills/elevenlabs_voice/SKILL.md` | Victoria voice ID + canonical conversational settings (stability 0.40, similarity 0.80, style 0.50, `use_speaker_boost: true`, `eleven_turbo_v2_5`). |
| `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §3 + §11 | Listing video master rules. |
| `video_production_skills/VIRAL_GUARDRAILS.md` | Scorecard + YouTube long-form format minimum (ship floor 80). |
| `video_production_skills/quality_gate/SKILL.md` | QA gate procedure. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. No AI-generated property photos. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform layer.  YouTube long-form column. |
| `docs/research/best-practices-youtube.md` | Top-creator playbook. Enes / Drumelia / Sotheby's faceless model is the locked reference. |
| `marketing_brain_skills/producers/TEMPLATE.md` + `REGISTRY.md` | Template + Section B row. |

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:yt_longform_walkthrough` | `mls_id`, `drone_approach_video` (path or URL) | One call → one rendered MP4 + thumbnail + title + description + chapters + citations + scorecard. Listing must be `ListPrice >= 750000`; below that the producer halts with a gate failure. |

**$750K floor.** YouTube long-form is expensive in production hours and only earns its keep on
listings that deserve a 6-12 month evergreen asset. Below $750K, `listing-tour-video` short-form
is the better investment. Confirm the floor before any render.

### Payload schema

```typescript
interface YouTubeLongFormWalkthroughPayload {
  mls_id: string                       // required; must resolve to ListPrice >= 750000
  drone_approach_video: string         // required; path or URL to drone exterior approach
                                       // footage. > 8 seconds, ≥ 1920×1080, h264/mov/mp4.
  target_duration_minutes?: number     // default 6; valid range 4-12. Floor 4 min for YT
                                       // long-form search ranking; ceiling 12 min to keep
                                       // retention. The producer rounds to the nearest 0.5 min.
  open_house_callout?: {               // optional; if provided, surfaced in stats slide + CTA
    iso_date: string                   // YYYY-MM-DDTHH:mm-07:00
    duration_minutes: number           // typical 120
  }
  neighborhood_proof_points?: string[] // optional override; otherwise resolved from the
                                       // neighborhood-points table keyed on SubdivisionName / City
}
```

The brain populates `payload` from `marketing_brain_actions`. For manual invocation via
`marketing_brain_skills/produce/SKILL.md`, Matt provides the address + drone clip in natural
language and `produce` parses them.

---

## 3. Brief payload schema (action row contract)

```typescript
interface YouTubeLongFormWalkthroughActionRow {
  id: string                            // uuid from marketing_brain_actions
  action_type: 'content:yt_longform_walkthrough'
  target: string                        // e.g. 'mls:220189422'
  assigned_producer: 'video_production_skills/youtube-long-form-walkthrough'
  payload: YouTubeLongFormWalkthroughPayload
  data_evidence: {
    listing_status?: 'Active' | 'Coming Soon' | 'Pending'
    list_price?: number
    days_on_market?: number
    audit_source?: 'list-kit-orchestrator' | 'manual-trigger' | 'brain-cycle'
  }
  generation_reason: string
  status: 'pending'                     // always pending when producer first reads the row
}
```

---

## 4. The recipe

**Step 1.  Read the action row and lock it.**
Query `marketing_brain_actions` by `id`, confirm `status='pending'`, then:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

If the row isn't pending, halt and surface the current state rather than racing.

**Step 2.  Load §1 references.** Skipping any is non-compliant.

**Step 3.  Pull the listing record from Supabase (fresh, in-session).**
Per CLAUDE.md "Supabase listings Schema," every mixed-case column is double-quoted:

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "PostalCode", "StateOrProvince",
       "ListPrice", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt", "LotSizeAcres",
       year_built, "PropertyType", "PhotoURL", "StandardStatus", "PublicRemarks",
       "ListAgentFullName", "ListAgentEmail", "ListOfficeName", "SubdivisionName",
       "Latitude", "Longitude", "CumulativeDaysOnMarket", price_per_sqft
FROM listings
WHERE "MlsId" = '<mls-id>'
LIMIT 1;
```

**Gate check.  $750K floor.** If `"ListPrice" < 750000`: update `status='killed'` with
`executor_response={"error":"price_floor","list_price":<N>}` and surface to Matt: "MLS <id>
lists at $<rounded>. YouTube long-form is locked to $750K+. Use `listing-tour-video` instead?"

**Step 4.  Resolve listing agent → broker.**
Map `ListAgentFullName` / `ListAgentEmail` to `matt-ryan` / `paul-stevenson` / `rebecca-peterson`.
The broker does NOT appear in-frame (no face.  see §6); the end card and description signature
reference the listing agent's name in text only. If no match, surface and ask.

**Step 5.  Resolve neighborhood proof points.**
Pull 2-3 verified, specific facts from one of: local trail / landmark database
(`docs/data/bend-neighborhood-points.json` if present), Supabase `boundaries` distance-to-amenity
data, or a named primary source (park finder, trail association, school district).

Acceptable: "Half a mile from the Larkspur Trail trailhead." / "Three blocks from Bend High
School." / "Six-minute drive to downtown Bend."

Banned: "Walkable to local amenities." (no source) / "Close to everything Bend has to offer."
(generic) / "A vibrant neighborhood." (banned vocab).

Each proof point traces to `citations.json` (Step 13).

**Step 6.  Plan the chapter spec.**
Target duration is the payload value rounded to the nearest 0.5 min (default 6).

| Chapter | Default duration | Required |
|---|---|---|
| Drone approach + price reveal | 0:00-0:30 | Yes |
| Exterior context | 0:30-1:15 | Yes |
| Living room | 1:15-1:55 | Yes |
| Kitchen | 1:55-2:40 | Yes |
| Primary suite | 2:40-3:20 | Yes |
| Secondary bedrooms / bathrooms | 3:20-3:50 | If sqft > 2000 |
| Outdoor / lot context | 3:50-4:30 | Yes |
| Neighborhood proof points | 4:30-5:15 | Yes |
| Stats summary slide | 5:15-5:40 | Yes |
| Showing CTA + end card | 5:40-6:00 | Yes |

Adjust ±60s per section by photo depth. Each interior room is 30-60s.  never less, never more.
If sqft < 1800, collapse the secondary-bedrooms chapter into primary suite + outdoor.

**Step 7.  Build the BEATS array.**
Each beat is `(photo or clip, start frame, end frame, motion primitive, caption text, caption
start, caption end)`. Per `listing-tour-video/SKILL.md`: at least 4 different motion primitives
across the full video; never the same primitive on two consecutive beats. Primitives: slow
push-in (≤ 30% of beats), slow pull-out, horizontal pan, vertical pan, multi-point pan, parallax,
drone approach (Chapter 1 only), hard cut.

Order photos within each chapter wide → medium → detail. Never repeat a photo. Maintain
`out/yt-longform/<slug>/photo-manifest.json` listing every photo and its chapter+beat assignment.

**Step 8.  Generate the voice-over.**
Per `elevenlabs_voice/SKILL.md`: Victoria `qSeXEcewz7tA0Q0qk9fH`, model `eleven_turbo_v2_5`
(NEVER `eleven_v3`.  IPA phoneme tags drop silently on v3), settings stability 0.40 / similarity
0.80 / style 0.50 / `use_speaker_boost: true`. Chain `previous_text` across paragraphs. One MP3
per paragraph (one per chapter, split further if > 15s). Numbers spelled out ("475,000" → "four
hundred seventy five thousand"). IPA tags for Tumalo (`TUM-uh-low`), Deschutes (`dəˈʃuːts`),
Tetherow, Awbrey, Terrebonne, Paulina, Madras.

**No dollar amounts spoken in VO**.  price is on-screen overlay only.

After each MP3, request `/v1/forced-alignment` for word-level timestamps. Save alongside:

```
out/yt-longform/<slug>/vo/chapter-01-drone-approach.mp3
out/yt-longform/<slug>/vo/chapter-01-drone-approach.alignment.json
```

**Step 9.  Build the Remotion composition.**
Composition at `listing_video_v4/src/yt-longform/YouTubeLongFormWalkthrough.tsx`. 1920×1080,
30 fps. Build if absent.  adapt the listing-tour scaffold.

On-screen text rules:

- **Section title cards.** Amboqia Boriango 48 px, navy `#102742` on a 0.94-opacity cream
  footer bar at `y = 980 → y = 1080` (100 px tall), 64 px left padding. Each chapter opens
  with one.
- **Price reveal (drone approach).** Amboqia Boriango 96 px, `#faf8f4` with a 0.50-opacity
  navy scrim under the text only.  hard rectangle, no feathering, tabular numerals. Animates
  in between seconds 4-8, holds to ~9.5s, fades.
- **Stats summary slide.** Full-bleed cream `#faf8f4`. Amboqia 140 px primary numbers, Geist
  500 24 px labels. Five rows: price, beds, baths, sqft, year built. Tabular numerals. No
  animation.  let the data breathe.
- **Captions.** Geist 500 28 px `#faf8f4`, subtle `text-shadow: 0 2px 4px rgba(0,0,0,0.6)`.
  Never on a navy pill. Active-word weight transition only (500 → 700).  no scale spring (the
  spring caused the Tumalo chop). 300 ms crossfade between sentences. Forced-alignment timing.
- **End card.** Navy `#102742` bg; `logo-white.png` 480 px wide centered above a CTA
  "Reach out. We answer." in Amboqia 56 px navy-on-cream pill, then phone `541.213.6706`,
  `ryan-realty.com`, and the property page URL on three Geist 400 22 px lines (tabular
  numerals on the phone). 8 seconds.

**No face in the video**.  not the broker, not the photographer, not a stock human. Faceless
tour per the Enes / Drumelia / Sotheby's playbook. The listing agent's name appears in text
on the end card only.

**Step 10.  Render.**

```bash
cd listing_video_v4 && npx remotion render \
  src/index.ts YouTubeLongForm \
  out/yt-longform/<slug>/walkthrough.mp4 \
  --codec h264 --concurrency=1 --crf 20 \
  --image-format=jpeg --jpeg-quality=92
```

CRF 20 (not 22).  the 1080p YouTube quality bar is higher than vertical short-form.
`concurrency=1` is mandatory (Chrome OOMs higher). If the render OOMs, drop beat count ~20%
(collapse same-register beats) and retry. Max 2 auto-iterations before surfacing the OOM log.

**Step 11.  Build the deliverables alongside the video.**

`out/yt-longform/<slug>/title.txt`.  single line, verbatim:

```
<Beds>BR/<Bath>BA <PropertyType> in <Neighborhood>.  $<Price formatted> | <City>, Oregon
```

Examples: `4BR/3BA Single Family Home in Northwest Crossing.  $1,295,000 | Bend, Oregon` ·
`3BR/2BA Custom Home in Tumalo.  $895,000 | Tumalo, Oregon`.

The em-dash here is the ONE permitted em-dash on a YouTube title surface.  it's the locked
title formula. Em-dashes remain banned in body, captions, VO, and on-canvas copy.

`out/yt-longform/<slug>/description.md` (YouTube allows 5000 chars; Ryan Realty cap 4500). The
body has five blocks in this order:

1. **Opening (2-3 sentences)**.  full address, price, beds / baths / sqft / lot size.
2. **Neighborhood paragraph**.  2-3 specific facts (the verified proof points from Step 5).
3. **Market context paragraph**.  neighborhood / city inventory, DOM, price trend, pulled from
   `market_pulse_live` / `market_stats_cache`. Every figure traced.
4. **Chapters**.  `0:00 Drone approach + price reveal` / `0:30 Exterior context` /
   `1:15 Living room` / `1:55 Kitchen` / `2:40 Primary suite` /
   `3:20 Secondary bedrooms and bathrooms` / `3:50 Outdoor and lot context` /
   `4:30 Neighborhood proof points` / `5:15 Stats summary` / `5:40 Showing CTA`.
5. **Contact + signature + hashtag block:**
   ```
   Schedule a showing:
   Phone: 541.213.6706
   Web: ryan-realty.com
   Property page: ryan-realty.com/listings/<mls-id>

   Listed by <ListAgentFullName>, Ryan Realty.

   #RyanRealtyBend #BendOregon #BendRealEstate #<Neighborhood>Bend
   #CentralOregonRealEstate #LuxuryHomes #YouTube<City>
   ```

Hashtags only in the tag block (YouTube renders the first three above the description-fold as
clickable links.  `#RyanRealtyBend` first per the HARD RULE in CLAUDE.md "Voice + content").
**No mid-paragraph hashtags.**

`out/yt-longform/<slug>/chapters.txt`.  same timestamp list as in the description (YouTube reads
chapters from the description, but the standalone file is the canonical record).

**Step 12.  Generate the thumbnail.** Render as its own Remotion composition
(`YouTubeLongFormThumbnail`) at 1280×720 sRGB JPEG q92. Full spec in §6.

**Step 13.  Write citations.json.** One entry per figure shown or spoken; every neighborhood
proof point; every market-context stat in the description.

```json
{
  "figures": [
    { "figure": "$1,295,000", "source": "Supabase listings", "filter": "MlsId='220189422'",
      "column": "ListPrice", "value": 1295000, "fetched_at": "2026-05-14T14:32:00Z" },
    { "figure": "half a mile from the Larkspur Trail trailhead",
      "source": "Bend Park & Recreation District trail map",
      "filter": "trailhead='Larkspur Trail', listing_lat_lng='44.0..,-121.3..'",
      "column": "trail_distance_mi", "value": 0.5,
      "fetched_at": "2026-05-14T14:34:00Z" }
  ]
}
```

**Step 14.  Run the QA gate.** See §8. Any fail = halt, fix, re-render.

**Step 15.  Write the viral scorecard.** Per `VIRAL_GUARDRAILS.md`, YouTube long-form ship
floor is 80. Score 1-10 across the ten categories into `out/yt-longform/<slug>/scorecard.json`.
If score < 80, do not surface.  fix the lowest categories first.

**Step 16.  Transition to `ready` and surface to Matt.**

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"out/yt-longform/<slug>/walkthrough.mp4","title":"...","thumbnail":"out/yt-longform/<slug>/thumbnail.jpg","duration_seconds":<N>,"scorecard":{...}}'::jsonb
WHERE id='<id>';
```

Surface format in §6.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| ElevenLabs API | Victoria VO + forced-alignment | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH` |
| Remotion 4.0.290 | 1920×1080 render | `cd listing_video_v4 && npx remotion render` |
| ffmpeg (static-ffmpeg) | audio mix + concat + post-render checks | `listing_video_v4/node_modules/.bin/` |
| Replicate (optional) | Wan 2.7 i2v cinemagraph clips | `REPLICATE_API_TOKEN` |
| Brand assets | `logo-blue.png`, `logo-white.png`, `blue-dog.png` | `design_system/ryan-realty/assets/brand/` |
| Fonts | Amboqia Boriango, Azo Sans Medium, Geist | `listing_video_v4/public/fonts/` |
| Asset library CLI | post-approval registration | `lib/asset-library.mjs` |

---

## 6. Output format

**Draft lands at:** `out/yt-longform/<slug>/`

**Slug pattern:** `<city-lowercase>-<street-number>-<street-name-kebab>`.  same convention as
`list-kit/SKILL.md` §7.

**File structure:**

```
out/yt-longform/<slug>/
├── walkthrough.mp4            ← rendered 1920×1080 MP4, CRF 20, < 500 MB
├── thumbnail.jpg              ← 1280×720 sRGB JPEG q92
├── title.txt                  ← single line, verbatim title format
├── description.md             ← YouTube description body, ≤ 4500 chars
├── chapters.txt               ← canonical timestamp list
├── photo-manifest.json        ← every photo used + chapter+beat assignment
├── citations.json             ← one entry per figure shown or spoken
├── scorecard.json             ← viral scorecard, ship floor 80
└── vo/
    ├── chapter-01-drone-approach.mp3
    ├── chapter-01-drone-approach.alignment.json
    ├── chapter-02-exterior-context.mp3
    ├── chapter-02-exterior-context.alignment.json
    └──... (one pair per chapter)
```

### Thumbnail spec (1280×720)

- **Single hero shot** filling the frame.  exterior glamour or interior signature room.
  `object-fit: cover` with 1.10 zoom centered on subject. Prefer a verified twilight exterior
  from `PhotoURL`; fall back to the brightest hero exterior.
- **Price overlay**.  Amboqia Boriango 96-120 px in yellow-cream `#fff4cc` with a dark outline
  / drop-shadow at `2px 2px 0 #102742`. The rounded list price (`$1,295,000`). Tabular numerals.
  Lower-third of the thumbnail (`y ≈ 480`), horizontally centered or on the rule-of-thirds.
  Verify contrast ratio ≥ 4.5:1 against the photo pixel sample under the overlay.
- **Heritage wordmark**.  `logo-blue.png` if the photo is bright, `logo-white.png` if dark.
  80 px wide at `x = 1170, y = 620`.
- **No face in thumbnail.** Per `docs/research/best-practices-youtube.md`: ultra-luxury
  thumbnails are property-only.
- **No "JUST LISTED" / "PRICE REDUCED" sticker.** No starburst, no banner.
- 1280×720, JPEG q92, sRGB, < 2 MB.

### Surface format (present to Matt exactly like this)

```
YouTube long-form walkthrough ready for review.  <StreetNumber> <StreetName>, <City>

  VIDEO
    Path: out/yt-longform/<slug>/walkthrough.mp4
    Duration: <Xm Ys> · Size: <N> MB · Resolution: 1920×1080 · 30 fps
    Scorecard: <N>/100 (YT long-form ship floor: 80)

  TITLE
    <verbatim title>

  THUMBNAIL
    Path: out/yt-longform/<slug>/thumbnail.jpg
    Price overlay: $<rounded> · Contrast: <ratio>:1 ✓

  DESCRIPTION
    Path: out/yt-longform/<slug>/description.md
    Char count: <N> / 4500 limit
    Chapter markers: <N> (matches video sections ✓)
    #RyanRealtyBend: first in tag block ✓

  VERIFICATION TRACE
    <one line per figure.  list price, beds, baths, sqft, lot, year built, each
     neighborhood proof point, each market-context stat>

  CITATIONS
    out/yt-longform/<slug>/citations.json

Reply "ship it" / "approved" / "go" to move to public/, commit + push, and queue the YouTube
upload (publisher capability.  separate step).
```

Then stop. Do not commit. Do not push. Do not upload. Wait for Matt's explicit approval.

---

## 7. Approval gate

**This producer uses:** `matt-review-draft`.

Matt sees the rendered MP4 path, thumbnail, title, description, scorecard, and verification
trace, and replies with "ship it" / "approved" / "go" before any commit or upload. Silence is
not approval. A passing scorecard is not approval. A clean QA gate is not approval.

Per CLAUDE.md §0.5: nothing leaves `out/` until Matt explicitly signs off on THIS specific
deliverable on THIS turn.

---

## 8. Status flow

```
pending → in_production → ready → approved → executed → measured
                                                │
                                       killed ◄─┘  (price floor / OOM / Matt cancel)
```

```sql
-- On pickup:
UPDATE marketing_brain_actions SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready', executor_response='{"draft_path":"...","scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';

-- On publish complete:
UPDATE marketing_brain_actions SET status='executed' WHERE id='<id>';
```

### QA gate (extends the shared gate)

Any fail = halt and fix or surface. Run every check before transitioning to `ready`.

| # | Check | Pass condition |
|---|---|---|
| 1 | ListPrice floor | `"ListPrice" >= 750000` |
| 2 | Duration | 4-12 min (`ffprobe` Duration in `[240s, 720s]`) |
| 3 | Resolution + fps + codec | 1920×1080, 30 fps, h264, AAC, faststart |
| 4 | File size | < 4 GB (typical < 500 MB) |
| 5 | Hook.  frame 0 | Drone footage frame (not logo, not black, not title card) |
| 6 | Hook.  price reveal | Price overlay visible between seconds 4 and 8 |
| 7 | No face in any video frame | Spot-check 12 evenly-spaced frames + every section title card.  zero human faces |
| 8 | No face in thumbnail | Visual review of `thumbnail.jpg` |
| 9 | Chapter markers match sections | Every `chapters.txt` timestamp lands on a beat boundary (± 1s tolerance) |
| 10 | Title format | Matches `<Beds>BR/<Bath>BA <PropertyType> in <Neighborhood>.  $<Price> \| <City>, Oregon` |
| 11 | Description includes city + state | "Bend, Oregon" / "Tumalo, Oregon" appears in the opening 2-3 sentences |
| 12 | #RyanRealtyBend first in description tag block | Grep position against other hashtags |
| 13 | Banned vocab clean | Grep on-canvas text + VO + description + title against `voice_guidelines.md` §6.  zero hits |
| 14 | Data verified | Every figure traces to `citations.json` |
| 15 | Photo set integrity | No repeats across beats; every photo from MLS (`PhotoURL`) or Matt-approved; no AI photos (ANTI_SLOP_MANIFESTO) |
| 16 | VO model | `eleven_turbo_v2_5` (not `eleven_v3`) |
| 17 | No dollar amounts spoken in VO | Grep alignment JSONs for currency words near numbers.  zero hits |
| 18 | Captions sync | Forced-alignment timestamps; 300 ms crossfade; no frame-level flashes |
| 19 | Motion variety | ≥ 4 different motion primitives; never the same primitive on two consecutive beats |
| 20 | End card | Navy bg, `logo-white.png`, CTA + phone + URL + property URL, 8s duration |
| 21 | Thumbnail price contrast | Sampled ratio ≥ 4.5:1 under the price overlay |
| 22 | Color compliance | Navy `#102742` + cream `#faf8f4` only on chrome. No gold (retired) |
| 23 | Scorecard | ≥ 80 across the 10 categories |

---

## 9. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| ListPrice < $750K | Step 3 returns price under floor | Halt. `status='killed'`. Surface: "Use `listing-tour-video` instead." Do not render. |
| Drone footage missing | `drone_approach_video` doesn't resolve or < 8s | Halt and ask: (a) provide clip, (b) downgrade to listing-tour-video short-form, (c) substitute Google Photorealistic 3D Tiles aerial. Default: ask, don't pick. |
| Drone footage low-res | < 1920×1080 source | Halt. Upscaled drone looks soft at 1080p YT. Source higher-res or substitute 3D Tiles. |
| Render OOM | Remotion / Chrome OOM | Drop beat count ~20% (collapse same-register beats), confirm `concurrency=1`, retry. Max 2 iterations, then surface last successful frame + memory log. |
| Thumbnail price contrast fail | Sampled ratio < 4.5:1 | Deepen outline 2→4 px, re-sample. If still failing, swap photo for one with darker subject under the price. Still failing → surface with the ratio. |
| `PublicRemarks` contains banned vocab | Banned-word grep hits | Strip the offending sentences. If remarks become empty, leave that description paragraph blank.  never paraphrase or invent. |
| Neighborhood proof point unverified | Can't source to primary | Drop it. Three → two is fine, two → one is fine, one → expand market context. Never invent. |
| Broker not resolved | `ListAgentFullName` no match | Surface to Matt. End card defaults to "Listed by Ryan Realty" until resolved. |
| Phoneme tag dropped ("TOO-muh-low") | VO used `eleven_v3` | Regenerate with `eleven_turbo_v2_5`. v3 silently skips phoneme tags. |
| Title overruns 100 chars | Long neighborhood + long type | Drop `PropertyType` first (use "Home"), then collapse "Northwest Crossing" → "NW Crossing". Never drop the city. |
| Description overruns 4500 chars | Verbose proof points + market context | Tighten proof points to 2 facts, market context to 2 sentences. Never trim chapters or contact block. |
| Photo set < 12 distinct images | Thin photo coverage | Halt. Long-form needs ≥ 12 distinct shots. Surface: backfill from Spark, request Matterport / re-shoot, or downgrade. |
| Scorecard < 80 | YT long-form ship floor missed | Fix the lowest-scoring categories first. Max 2 iterations, then surface specific category scores. |
| ElevenLabs 4xx/5xx | Synth fails | Retry once after 30s with same payload. If second fails, surface the request + error. Do not fall back to a different voice. |

### Open spec questions (best-call documentation)

- **Auto-translate / multi-language description.** English only until Matt names a market.
- **Publishing.** Approved cuts move to `public/yt-longform/<slug>/walkthrough.mp4` and the
  publisher capability handles YouTube Data API v3 upload. This producer does NOT upload.
- **Cards + end screens.** Not rendered into the MP4.  configured post-upload via the publisher
  capability. The MP4 ships clean.

---

## 10. Related skills and references

The full §1 table is the authoritative load list. Quick map by role:

**Mandatory rule layers**.  `CLAUDE.md` §0, §0.5, §3, "Voice + content"; `design_system/ryan-realty/SKILL.md`; `marketing_brain_skills/brand-voice/voice_guidelines.md` + `corpus/gbp_responses.md`.

**Format skills delegated to**.  `video_production_skills/listing-tour-video/SKILL.md` (beat library, motion primitives, photo discipline); `video_production_skills/listing_reveal/SKILL.md` (two-layer overlay system reused for section title cards).

**Capabilities used**.  `video_production_skills/elevenlabs_voice/SKILL.md` (Victoria + conversational settings); `video_production_skills/quality_gate/SKILL.md` (QA gate); `video_production_skills/asset-library/SKILL.md` (post-approval registration).

**Pipeline + governance**.  `automation_skills/content_engine/SKILL.md` (routing bus); `social_media_skills/platform-best-practices/SKILL.md` (YouTube long-form column); `video_production_skills/ANTI_SLOP_MANIFESTO.md` (banned content); `video_production_skills/VIRAL_GUARDRAILS.md` (scorecard); `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §3 + §11.

**Research source**.  `docs/research/best-practices-youtube.md` (Enes / Drumelia / Sotheby's faceless model.  the locked reference for the no-face, drone-led format).

**Registry entry**.  `marketing_brain_skills/producers/REGISTRY.md` Section B row `youtube-long-form-walkthrough`.

**Sibling producers (separate triggers, not this one):**

- `video_production_skills/listing-tour-video/SKILL.md`.  60-90s branded 9:16 listing tour
- `video_production_skills/listing_reveal/SKILL.md`.  40-48s viral 9:16 reel
- `video_production_skills/youtube-long-form-market-report/SKILL.md`.  8-12 min market data deep-dive (no listing.  market analysis only)
- `social_media_skills/list-kit/SKILL.md`.  at-Active marketing orchestrator that may dispatch this producer as part of a $750K+ kit

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

## 11. Tool gap suggestions

Tool gap suggestions: see tool-acquisition-recommendations.md for the aggregated list across all producers.

