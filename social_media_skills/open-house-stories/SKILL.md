---
name: open-house-stories
description: >
  Renders a 5–7 frame Instagram + Facebook Stories sequence (1080×1920, 9:16) promoting a
  Ryan Realty open house event. Posted in the 24 hours before the event. Higher engagement
  than feed posts because Stories expire and reach the in-sphere audience. Frame 1 is the
  date/time card; frames 2–3 are best interior photos with reserved space for IG location
  stickers; frame 4 is a poll prompt ("Would you live here?"); frame 5 is a ManyChat keyword
  CTA ("DM OPENHOUSE for the address + directions"). Optional frames 6–7 carry an exterior
  hero or a hero stat. Companion to `ig-single-post` (S3 Open House feed card) and
  `instagram-carousel` (multi-slide open-house carousel). Use this whenever Matt asks for
  "open house stories for <address>", "build the open house story sequence", "stories for
  the open house at <MLS#>", or "open house promo." Always pair with the feed S3 card —
  Stories drive same-day reach, feed S3 carries the discovery surface.
when_to_use: |
  Trigger when Matt says any of:
  - "open house stories for <address>"
  - "build the open house story sequence"
  - "stories for the open house at <MLS#>"
  - "open house promo"
  - "story frames for tomorrow's open house"
  - "make the IG stories for the <address> open"
action_types:
  - content:open_house_stories
---

# Open House Stories — IG + FB Story Sequence

**Scope.** Render one 5–7 frame Instagram + Facebook Stories sequence per call, at 1080×1920
(9:16). Each frame is a PNG that Matt drops into the IG/FB Stories composer in order, then
overlays native IG stickers (location, poll, DM trigger) on the reserved zones the renderer
leaves clear. Emits the matching feed caption (used on any companion S3 feed post) alongside
the frames. Does NOT publish to Stories — that's a Matt-driven step in the IG composer because
native stickers (poll, location, DM trigger) cannot be applied via the Graph API today. Does
NOT render the feed S3 card — that's `ig-single-post`. Does NOT configure the ManyChat
automation — that's a separate `ops:manychat` action.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B — Content Producer.

**Exemplar output:** `out/open-house-stories/<slug>/frame-01.png ... frame-05.png + caption.md + sticker-overlays.json + citations.json`.

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy mandate | Every figure on the frames (price, date, time, address) traces to Supabase / MLS. Outranks all. |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Render to `out/`, surface, wait for Matt's explicit approval before commit. |
| `CLAUDE.md` "Voice + content" — #RyanRealtyBend HARD RULE | Companion caption emitted alongside the frames must include `#RyanRealtyBend` first in trailing hashtag block. |
| `design_system/ryan-realty/SKILL.md` | Heritage register: navy `#102742`, cream `#faf8f4`, Amboqia/Geist/Azo Sans Medium type tiers. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union; voice attributes. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint for the caption. |
| `social_media_skills/ig-single-post/SKILL.md` | S3 Open House feed card spec — the Stories sequence sits next to S3, not in place of it. |
| `social_media_skills/instagram-carousel/SKILL.md` | Footer band / safe-zone conventions inherited here. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 Stories rule layer — sticker zones, swipe-through timing, story-set cadence. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned content gate (applies to static frames too). |
| `automation_skills/content_engine/SKILL.md` | Content routing bus. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer template. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B row pointer. |

---

## 2. Action types handled

| action_type | required payload fields | notes |
|---|---|---|
| `content:open_house_stories` | `mls_id`, `open_date_iso`, `open_start_local`, `open_end_local`, `photos` (≥ 4 interior) | One call → 5–7 frame PNGs + caption.md + sticker-overlays.json |

---

## 3. Brief payload schema

```typescript
interface OpenHouseStoriesPayload {
  mls_id: string                   // Required — e.g. '220189422'. Used to pull address,
                                   // price, list agent, photos from Supabase.
  open_date_iso: string            // Required — full ISO datetime, e.g.
                                   // '2026-05-17T18:00:00Z'. Used to derive day-of-week
                                   // and date copy.
  open_start_local: string         // Required — local time string, e.g. '11:00 AM'.
                                   // Renderer does NOT convert timezones — the caller
                                   // passes the value as it should appear on screen.
  open_end_local: string           // Required — local time string, e.g. '1:00 PM'.
  photos: string[]                 // Required — at least 4 interior photo paths or URLs.
                                   // Frames 2 and 3 each consume one. Frames 6–7 (if
                                   // present) may consume an exterior or hero.
  manychat_keyword?: string        // Optional — DM trigger keyword. Default 'OPENHOUSE'.
                                   // Uppercase letters and digits only. No spaces.
  include_hero_frame?: boolean     // Optional — if true, append exterior hero as frame 6.
                                   // Default false.
  include_stat_frame?: boolean     // Optional — if true, append a hero stat as frame 7
                                   // (e.g. '1.2 acres', '4 bd 3 ba', 'finished basement').
                                   // Default false.
  hero_stat_label?: string         // Required iff include_stat_frame=true.
  hero_stat_value?: string         // Required iff include_stat_frame=true.
}

interface OpenHouseStoriesActionRow {
  id: string
  action_type: 'content:open_house_stories'
  target: string                   // e.g. 'mls:220189422'
  assigned_producer: 'social_media_skills/open-house-stories'
  payload: OpenHouseStoriesPayload
  data_evidence: {
    audit_source?: string
    opportunity_area?: string
    signal_evidence?: string
  }
  generation_reason: string
  status: 'pending'
}
```

The renderer derives address, price, beds/baths/sqft, list agent, and city from the Supabase
`listings` row keyed by `mls_id`. Do not pass these in the payload — pull them live so the
draft reflects the current row state at render time.

---

## 4. The recipe

**Step 1 — Read the action row.**
Query `marketing_brain_actions` by `id`. Confirm `status = 'pending'`. Immediately
`UPDATE status='in_production', executed_at=now()` per §8 SQL.

**Step 2 — Load mandatory references.**
Before touching any deliverable, read the §1 list in this file. Non-negotiable: `CLAUDE.md`
§0, §0.5, and the design system. If any reference fails to load, surface to Matt — do not
render with stale or assumed brand specs.

**Step 3 — Validate payload.**
- `mls_id`: non-empty string.
- `open_date_iso`: parseable ISO datetime, **must be in the future** (≥ now). A past date
  → surface to Matt, do not render.
- `open_start_local`, `open_end_local`: non-empty strings matching `HH:MM AM/PM` format.
- `photos`: array length ≥ 4.
- `manychat_keyword` (if present): regex `/^[A-Z0-9]{3,20}$/`. If absent, default `'OPENHOUSE'`.
- `include_stat_frame === true`: require `hero_stat_label` and `hero_stat_value`.

Any validation failure → surface to caller with the specific field. Do not render.

**Step 4 — Pull and verify source data.**
Query Supabase `listings` for the row. Use mixed-case quoted column names per CLAUDE.md
"Supabase listings Schema":

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
       "ListPrice", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
       "ListAgentFullName", "ListAgentEmail", "StandardStatus", "PhotoURL"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Confirm `"StandardStatus" = 'Active'` (or `'Coming Soon'`). If `'Closed'`, `'Pending'`,
`'Cancelled'`, or `'Expired'` — surface to Matt, do not render. (You cannot promote an
open house at a listing that is no longer eligible to host one.)

Resolve `list_agent_slug` from `"ListAgentEmail"` to one of `matt-ryan` / `paul-stevenson` /
`rebecca-peterson`. If no match → surface; do not guess.

Derive:
- `address` from `"StreetNumber" || ' ' || "StreetName"`, plus city.
- `day_of_week` from `open_date_iso` localized to America/Los_Angeles (Bend's timezone).
- `formatted_date`: `Saturday, May 17` (no year if same year; otherwise add year).
- `price_rounded` from `"ListPrice"` rounded to nearest `$1,000`.
- `specs_line` from beds / baths / `"TotalLivingAreaSqFt"`.

**Step 5 — Pre-render asset audit.**
Confirm on disk before invoking the compositor:
- Fonts: `design_system/ryan-realty/fonts/Amboqia_Boriango.otf`, `AzoSans-Medium.ttf`,
  Geist (`next/font/geist`).
- Logo: `design_system/ryan-realty/assets/brand/logo-white.png` (reversed wordmark — the
  Stories footer band is dark).
- Broker headshot: `design_system/ryan-realty/assets/team/<list_agent_slug>.png` (transparent
  PNG default).
- Photos: every entry in `payload.photos` resolves (local path on disk OR public URL fetchable
  in this session). If any photo fails to load → surface; do not substitute or skip.

Missing any asset → stop, surface, do not fall back.

**Step 6 — Render the frame sequence.**
Invoke the compositor:

```bash
node lib/render-open-house-stories.mjs \
  --payload out/open-house-stories/<slug>/payload.json \
  --out-dir out/open-house-stories/<slug>/
```

Compositor lives at `lib/render-open-house-stories.mjs` (build if absent; mirrors the canvas
pipeline used by `lib/render-ig-single-post.mjs` per `ig-single-post/SKILL.md`). One PNG per
frame, named `frame-01.png` through `frame-NN.png` with zero-pad.

**Step 7 — Emit sticker-overlays.json.**
A placement guide so Matt can drop native IG stickers on the reserved zones without guessing
coordinates. Schema:

```json
{
  "frames": [
    {
      "frame": 2,
      "stickers": [
        {
          "type": "ig_location",
          "label": "Bend, Oregon",
          "zone": { "x": 90, "y": 1500, "w": 900, "h": 120 }
        }
      ]
    },
    { "frame": 4, "stickers": [{ "type": "ig_poll", "question": "Would you live here?", "zone": { "x": 140, "y": 880, "w": 800, "h": 200 } }] },
    { "frame": 5, "stickers": [{ "type": "ig_dm_trigger", "keyword": "OPENHOUSE", "zone": { "x": 140, "y": 1080, "w": 800, "h": 200 } }] }
  ]
}
```

**Step 8 — Emit caption.md.**
Same H&H caption used for the companion S3 feed post promoting the open house. Format:

```
[Address-anchored opening — street name + open-house day, one specific anchor]

[Materials / property-detail middle — 1–3 specific facts about the listing]

[Lifestyle close — one specific local detail: trail, walk to coffee, school, view]

》 [Address]  ·  [Price]  ·  [BR/BA]  ·  [sqft or acres]
》 Open <Day>, <Start> – <End>

#RyanRealtyBend
#BendOpenHouse
#BendOregon
#BendRealEstate
#[Neighborhood]Bend
#CentralOregonRealEstate
```

Voice: declarative, no exclamation marks, no "must-see" / "open house this weekend!", no
em-dashes or semicolons. Facts only.

**Step 9 — Run the QA gate (§9).**
Write results to `design_scorecard.json`. Any `fail` = non-ship; iterate or surface.

**Step 10 — Write citations.json.**
One entry per figure on any frame (price, address fragments, beds/baths/sqft, date, time).
Schema per CLAUDE.md §0:

```json
{
  "figures": [
    {
      "figure": "$895,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 895000,
      "fetched_at": "2026-05-14T14:32:00Z"
    },
    {
      "figure": "Saturday, May 17 · 11:00 AM – 1:00 PM",
      "source": "marketing_brain_actions.payload",
      "filter": "id='<action_id>'",
      "column": "open_date_iso + open_start_local + open_end_local",
      "value": "2026-05-17T18:00:00Z / 11:00 AM / 1:00 PM",
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ]
}
```

**Step 11 — Transition the action row.**

```sql
UPDATE marketing_brain_actions
SET status = 'ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/open-house-stories/<slug>/',
      'frame_count', <N>,
      'scorecard', <scorecard_jsonb>
    )
WHERE id = '<action_id>';
```

**Step 12 — Surface the draft to Matt (§6 format).** Stop. Wait for explicit approval.

---

## 5. Frame design specs

Canvas: 1080 × 1920 px, sRGB, PNG output, every frame.

**Persistent footer band** (every frame, byte-identical):
- `y = 1780 → y = 1920` (140 px tall).
- Background: `rgba(16,39,66,0.94)` (near-opaque navy).
- Logo: `design_system/ryan-realty/assets/brand/logo-white.png`, 52 px tall, vertically
  centered, 40 px from left edge.
- Slide numeral (Geist 500, 16 px, `#faf8f4`, tabular-nums, right-aligned, 40 px from right
  edge, vertically centered): format `3 / 5` with spaces around the slash.
- No phone, no URL, no agent name, no "Ryan Realty" text — the wordmark carries the brand.

**Safe zone.** Content stays within 90 px inset on left/right and 90 px from top. Frame-specific
content area runs `y = 90 → y = 1780` (1690 px tall, 900 px wide with 90 px insets).

**Sticker zones.** Frames 2, 3, 4, and 5 reserve a hard rectangle for the IG native sticker.
The renderer does NOT render the sticker — Matt overlays it in the IG composer. The reserved
zone is a clear rectangle (no rendered text or graphics that the sticker would cover).

### 5.1 Frame 1 — Date/Time card

- **Background:** cream `#faf8f4` (full frame, no photo).
- **Eyebrow** (Azo Sans Medium, 20 px, navy `#102742`, UPPERCASE, letter-spacing 0.18em,
  centered, `y = 480`): `OPEN HOUSE · <CITY>` (e.g. `OPEN HOUSE · BEND`).
- **Headline** (Amboqia Boriango, 88 px, navy, centered, `y = 600`, line-height 1.0):
  `OPEN HOUSE`.
- **Date** (Geist 500, 32 px, navy, centered, tabular-nums, `y = 880`):
  `<day_of_week>, <formatted_date>` (e.g. `Saturday, May 17`).
- **Time** (Geist 500, 32 px, navy, centered, tabular-nums, `y = 940`):
  `<open_start_local> – <open_end_local>` (e.g. `11:00 AM – 1:00 PM`).
- **Address line** (Geist 400, 24 px, navy 0.65 opacity, centered, `y = 1080`):
  the full address.
- **Heritage illustration** (optional, max 220 px wide, navy, centered at `y = 1260`):
  one element from `design_system/ryan-realty/assets/brand/` — e.g. `blue-dog.png` for a
  warm relationship-register touch, or `scene-tower.png` for a Bend-anchored visual.

### 5.2 Frames 2 and 3 — Interior photos with IG location sticker zone

- **Background:** full-bleed interior photo from `payload.photos` (`object-fit: cover`,
  no zoom, no filter beyond a neutral color-grade pass).
- **Top scrim** (address strip): `rgba(16,39,66,0.62)` covering `y = 0 → y = 130` (130 px
  tall). Hard rectangle, no feathering.
- **Address strip text** (Geist 500, 24 px, `#faf8f4`, tabular-nums where numeric, vertically
  centered in the scrim, 90 px from left edge): the address.
- **IG location sticker zone** (reserved clear rectangle): `x = 90, y = 1500, w = 900,
  h = 120`. Renderer leaves this zone clear of text or graphics. Matt drops the IG location
  sticker (`Bend, Oregon` or the neighborhood) on this zone in the IG composer.
- Frame 2 photo = best interior shot from `payload.photos[0]`.
- Frame 3 photo = second-best interior from `payload.photos[1]`. Must be a different room
  than frame 2 (renderer checks distinct-photo identity, not room semantics — caller
  responsibility to order photos correctly).

### 5.3 Frame 4 — Poll prompt

- **Background:** navy `#102742` (full frame, no photo).
- **Eyebrow** (Azo Sans Medium, 18 px, `#faf8f4` 0.65 opacity, UPPERCASE, letter-spacing
  0.16em, centered, `y = 600`): `<ADDRESS>`.
- **Headline** (Geist 500, 32 px, `#faf8f4`, centered, `y = 700`, line-height 1.2,
  max two lines): `Would you live here?`
- **IG poll sticker zone** (reserved clear rectangle): `x = 140, y = 880, w = 800, h = 200`.
  Renderer leaves this zone clear. Matt drops the native IG poll sticker with the question
  `Would you live here?` and the default `Yes` / `No` options.
- **Spec line** (Geist 400, 20 px, `#faf8f4` 0.65 opacity, centered, tabular-nums,
  `y = 1240`): `<N> bd  ·  <N> ba  ·  <N> sqft  ·  $<price_rounded>`.
- No exclamation mark in the headline. Direct fact-question framing.

### 5.4 Frame 5 — ManyChat keyword CTA

- **Background:** cream `#faf8f4` (full frame, no photo).
- **Eyebrow** (Azo Sans Medium, 18 px, navy, UPPERCASE, letter-spacing 0.16em, centered,
  `y = 600`): `WANT THE DETAILS?`.
- **CTA headline** (Geist 500, 28 px, navy, centered, `y = 760`, line-height 1.3, max three
  lines): `DM <keyword> for the address and directions to the open house tomorrow.`
  - `<keyword>` is `payload.manychat_keyword` or default `OPENHOUSE`.
  - "tomorrow" only if `open_date_iso` is exactly 1 day after render time. Else: use the
    relative phrase — "this Saturday", "today", or the specific date. Renderer computes the
    correct phrase from `open_date_iso − now()`.
- **IG DM trigger sticker zone** (reserved clear rectangle): `x = 140, y = 1080, w = 800,
  h = 200`. Renderer leaves this zone clear. Matt drops the IG DM-trigger sticker (keyword
  reply automation) on this zone.
- **Note line** (Geist 400, 18 px, navy 0.55 opacity, centered, `y = 1340`, max two lines):
  `Reply <keyword> in DMs. We send the address straight back.`
- **Broker headshot** (transparent PNG, 160 px wide circular crop, centered at `y = 1500`,
  `border-radius: 50%`): the resolved listing agent.
- **Broker name** (Geist 500, 18 px, navy, centered, `y = 1700`): `<Full Name>, <role>`.
  Role: `Owner / Principal Broker` (Matt) · `Principal Broker` (Paul, Rebecca).

ManyChat automation MUST be configured separately. The Stories renderer does not configure
the automation — that is an `ops:manychat` action. If the automation isn't live, the keyword
won't trigger a DM. Surface this dependency to Matt in the draft surface (§6) so the
automation is verified before Stories publish.

### 5.5 Frame 6 (optional) — Exterior hero

- Only if `include_hero_frame === true`.
- **Background:** full-bleed exterior hero photo (twilight preferred; pull from
  `payload.photos` last entry, or surface to caller if no exterior is identified).
- **Bottom scrim** (address + open-house strip): `rgba(16,39,66,0.62)` covering
  `y = 1600 → y = 1780` (180 px tall). Hard rectangle.
- **Address** (Geist 500, 24 px, `#faf8f4`, tabular-nums, left-aligned at 90 px,
  `y = 1620`): the address.
- **Open-house line** (Geist 400, 20 px, `#faf8f4` 0.85 opacity, left-aligned at 90 px,
  `y = 1660`): `Open <day_of_week>, <open_start_local> – <open_end_local>`.

### 5.6 Frame 7 (optional) — Hero stat

- Only if `include_stat_frame === true`. Requires `hero_stat_label` and `hero_stat_value`.
- **Background:** cream `#faf8f4`.
- **Eyebrow** (Azo Sans Medium, 18 px, navy 0.65 opacity, UPPERCASE, letter-spacing 0.16em,
  centered, `y = 600`): the hero stat label (`<HERO_STAT_LABEL>`).
- **Stat value** (Amboqia Boriango, 140 px, navy, centered, tabular-nums, `y = 720`,
  line-height 1.0): the hero stat value (e.g. `1.2 acres`, `4 bd 3 ba`, `Finished basement`).
- **Address line** (Geist 400, 22 px, navy 0.55 opacity, centered, `y = 1100`): the address.

---

## 6. Output structure and surface format

```
out/open-house-stories/<slug>/
├── payload.json                ← the action row's payload field
├── frame-01.png                ← date/time card (1080×1920)
├── frame-02.png                ← interior photo 1 with location sticker zone
├── frame-03.png                ← interior photo 2 with location sticker zone
├── frame-04.png                ← poll prompt with IG poll sticker zone
├── frame-05.png                ← ManyChat keyword CTA with DM sticker zone
├── frame-06.png                ← (optional) exterior hero
├── frame-07.png                ← (optional) hero stat
├── caption.md                  ← H&H caption (companion to feed S3)
├── sticker-overlays.json       ← placement guide for IG composer
├── citations.json              ← one entry per figure
├── provenance.json             ← photo source + license traces
├── fonts_used.json             ← exact font files embedded
└── design_scorecard.json       ← QA gate results
```

**Slug convention:** `<mls_id>-<open_date_iso-yyyy-mm-dd>` e.g.
`220189422-2026-05-17`. URL-safe, lowercase, hyphenated.

**Surface format (present to Matt exactly like this):**

```
Open house stories ready for review — <address> · <day> <date>

  FRAMES (<N>)
    Path: out/open-house-stories/<slug>/
    01 · Date/time card                       (1080×1920)
    02 · Interior — IG location sticker zone  (1080×1920)
    03 · Interior — IG location sticker zone  (1080×1920)
    04 · Poll prompt — IG poll sticker zone   (1080×1920)
    05 · CTA — IG DM sticker zone (keyword: <KEYWORD>)  (1080×1920)
    [06 · Exterior hero] [07 · Hero stat]

  STICKER OVERLAYS
    Guide: out/open-house-stories/<slug>/sticker-overlays.json
    Matt drops IG stickers on the reserved zones in the IG composer.
    Frame 2+3: IG location sticker → 'Bend, Oregon' (or neighborhood).
    Frame 4: IG poll → 'Would you live here?' (Yes / No).
    Frame 5: IG DM trigger → keyword '<KEYWORD>'.

  MANYCHAT DEPENDENCY
    Keyword: <KEYWORD>
    Automation status: [verify via ops:manychat — must be live before publish]

  CAPTION
    Path: out/open-house-stories/<slug>/caption.md
    Companion to feed S3 Open House post (same caption, paired publish).

  VERIFICATION TRACE
    - $<price> — Supabase listings, MlsId='<id>', fetched <iso>
    - <day>, <date> — payload.open_date_iso='<iso>'
    - <start> – <end> — payload.open_start_local / open_end_local
    - <N> bd · <N> ba · <N> sqft — Supabase listings, MlsId='<id>'

  citations.json: out/open-house-stories/<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push.
```

Then stop. Do not commit. Do not push. Do not paste frames into the IG composer for Matt.
Wait for explicit approval.

---

## 7. Approval gate

`matt-review-draft` — Matt opens the frames in `out/open-house-stories/<slug>/`, reads the
caption.md and sticker-overlays.json, and replies "ship it" / "approved" / "go".

Silence is not approval. A passing QA gate is not approval. A successful render is not
approval.

On approval: commit the `out/open-house-stories/<slug>/` directory (including the PNG
frames, caption.md, sticker-overlays.json, citations.json) to `main`, push to origin
immediately per memory `feedback_always_push.md`. Then `UPDATE status='approved'` on the
action row per §8 SQL.

Publish itself is a Matt-driven step in the IG/FB Stories composer (native stickers cannot
be applied via the Graph API). The producer does not auto-publish.

---

## 8. Status flow

```
     pending
        │ producer reads row, picks up
        ▼
  in_production   ← executed_at = now()
        │ frames rendered, QA passed, citations.json written
        ▼
      ready        ← executor_response populated with draft_path + frame_count + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ git commit + push of out/open-house-stories/<slug>/ to main
        ▼
    executed       ← terminal success (frames are committed; Stories publish is Matt-driven)
        │ 48h post-open-house
        ▼
    measured       ← performance_loop records IG Stories reach + poll responses
                     + DM-keyword triggers via ManyChat API

    killed         ← terminal failure; set if Matt cancels or QA fails after 2 auto-iterations
```

SQL transitions:

```sql
-- On pickup:
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- On draft ready:
UPDATE marketing_brain_actions
SET status='ready',
    executor_response = jsonb_build_object(
      'draft_path', 'out/open-house-stories/<slug>/',
      'frame_count', <N>,
      'scorecard', <scorecard_jsonb>
    )
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. QA gate

Run before surfacing the draft. Write results to `design_scorecard.json`. Any `fail` =
non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Canvas dimensions | Every frame is exactly 1080 × 1920 px |
| 2 | Frame count | 5, 6, or 7 frames — matches payload booleans (5 default, +1 if `include_hero_frame`, +1 if `include_stat_frame`) |
| 3 | Footer band byte-identical | Same `y`, height, opacity, logo path, logo size, numeral style across every frame |
| 4 | Safe zone | No critical content within 90 px of any edge except the photo and footer band |
| 5 | Sticker zones clear | Frames 2, 3, 4, 5 have no rendered text/graphics inside their reserved sticker zones per §5.2 / §5.3 / §5.4 |
| 6 | Date in future | `open_date_iso` strictly greater than `now()` at render time |
| 7 | Listing eligible | `StandardStatus` is `Active` or `Coming Soon` — never `Pending`, `Closed`, `Cancelled`, `Expired` |
| 8 | Photos distinct | Frame 2 photo and frame 3 photo are different files (different SHA) |
| 9 | Photo provenance | All photos traced in `provenance.json` to MLS or approved source. No AI-generated property photos |
| 10 | Font integrity | Amboqia, Geist, Azo Sans Medium all loaded from disk; no fallback in render |
| 11 | Tabular numerals | Every price / count / day / time / pct has `font-variant-numeric: tabular-nums` |
| 12 | Data verified | Every figure traces to `citations.json` with source, filter, fetched_at |
| 13 | Color compliance | Navy `#102742` + cream `#faf8f4` only. No gold. No off-brand hex |
| 14 | Banned words clean | Grep all on-frame text + caption.md against `voice_guidelines.md` union — zero hits |
| 15 | No exclamation marks | Zero `!` characters in any rendered text or in caption.md |
| 16 | No em-dashes / semicolons in body | Zero `—` or `;` in caption.md body (em-dash allowed only as no-data placeholder, which does not apply here) |
| 17 | #RyanRealtyBend present | caption.md trailing hashtag block leads with `#RyanRealtyBend` |
| 18 | Broker resolved | `ListAgentEmail` mapped to one of three brokers; transparent PNG headshot present on frame 5 |
| 19 | Keyword format | `manychat_keyword` matches `/^[A-Z0-9]{3,20}$/` |
| 20 | File size | Each PNG < 3 MB; full directory < 25 MB |

Banned-vocab grep covers (from `voice_guidelines.md`): stunning, nestled, charming, pristine,
gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream,
hidden gem, truly, spacious, cozy, luxurious, turnkey, immaculate, premier, luxury, boutique,
delve, leverage, tapestry, navigate, robust, seamless, comprehensive, elevate, unlock,
approximately, roughly, about, around, "won't last", "act fast", "don't miss out".

---

## 10. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Missing required payload field | `mls_id`, `open_date_iso`, `open_start_local`, `open_end_local`, or `photos` absent | Surface to caller with the specific field. Do not render. Do not invent a date or time. |
| Date in the past | `open_date_iso` ≤ `now()` | Surface to Matt. Promoting an open house after it has already happened is non-compliant. Set `status='killed'` if Matt confirms. |
| Fewer than 4 interior photos | `payload.photos.length < 4` | Surface to caller; ask for additional photos from the MLS or Matt's drive. Do not pad with stock or duplicate frames. |
| Listing not eligible | `StandardStatus` is `Pending`, `Closed`, `Cancelled`, or `Expired` | Surface to Matt with the current status. Open houses do not promote on non-active listings. Set `status='killed'` if confirmed. |
| Broker not resolved | `ListAgentEmail` doesn't map to matt-ryan / paul-stevenson / rebecca-peterson | Surface to Matt to confirm broker identity. Do not guess. |
| Photo download failure | Any photo URL returns non-200 or local path doesn't exist | Surface to caller with the specific photo. Do not substitute or skip — the missing photo could be the lead. |
| AI-generated property photo detected | `provenance.json` source flagged AI | Hard fail per `video_production_skills/ANTI_SLOP_MANIFESTO.md`. Do not render. |
| Font missing | Amboqia / Geist / Azo Sans Medium not on disk | Stop. Report the specific missing file path. Do not ship with system fonts. |
| Banned vocab in caption | Grep hit in caption.md | Stop. Re-write the caption clause. Re-validate. |
| Exclamation mark on frame or in caption | QA check 15 fails | Stop. Re-write the offending text. Re-render the frame. |
| ManyChat automation not configured | Verified by checking the `ops:manychat` registry / Supabase | Surface to Matt in the draft surface (§6) BEFORE asking for approval. Note: stories may publish without the automation live, but the DM keyword won't trigger a response. Matt's call. |
| Keyword collision | `manychat_keyword` matches an existing automation for a different listing | Surface to Matt; suggest appending a 3-digit suffix (e.g. `OPENHOUSE127`). Do not silently overwrite. |
| Render OOM / hang | Compositor process exceeds 5 min or 4 GB | Kill the process. Report to Matt with the last successful frame index and the error log. |
| Open spec: timezone handling | `open_date_iso` is UTC; Bend is America/Los_Angeles. Renderer assumes Bend timezone for `day_of_week` and `formatted_date`. If the listing is in a different timezone, surface to Matt | Document the choice in `provenance.json` under `timezone_assumption`. |

---

## 11. Related skills and references

**Required reading before executing (mandatory refs):**
- `CLAUDE.md` §0 — Data Accuracy mandate (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content" — #RyanRealtyBend HARD RULE
- `design_system/ryan-realty/SKILL.md` — brand visual system
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — voice enforcement
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's writing fingerprint

**Sibling content producers (visual continuity):**
- `social_media_skills/ig-single-post/SKILL.md` — S3 Open House feed card (paired publish)
- `social_media_skills/instagram-carousel/SKILL.md` — multi-slide listing carousel
- `social_media_skills/flyer-design/SKILL.md` — print + door-hanger open-house flyer

**Capabilities used inside this producer:**
- `lib/render-open-house-stories.mjs` — canvas compositor (build if absent; mirrors
  `lib/render-ig-single-post.mjs`)
- IG / FB Stories publish step is Matt-driven in the native composer because native stickers
  (poll, location, DM trigger) cannot be applied via the Graph API today

**Playbooks and pipeline docs:**
- `automation_skills/content_engine/SKILL.md` — content routing bus; all `content:*` actions
  dispatch through here
- `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate
- `marketing_brain_skills/producers/TEMPLATE.md` — producer template

**Related ops actions:**
- `ops:manychat` — configures the keyword-trigger automation that frame 5 depends on. Must
  be live before Stories publish or the keyword DM won't auto-respond.

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section B (Content Producers), row
  `open-house-stories`

---

## 12. What not to do

1. **Never use AI-generated property photos.** Hard fail per `ANTI_SLOP_MANIFESTO.md`.
2. **Never substitute fonts.** If Amboqia, Geist, or Azo Sans Medium isn't on disk, stop.
3. **Never invent or pad photos.** If `payload.photos.length < 4`, surface — don't reuse
   frame 2's photo as frame 3.
4. **Never re-typeset the wordmark.** Always use the pre-rendered `logo-white.png`.
5. **Never use exclamation marks.** Zero `!` in any rendered text or in caption.md.
6. **Never use em-dashes or semicolons in body.** Frame copy and caption body stay clean.
7. **Never use gold.** Navy + cream only. No `#D4AF37`, no `#C8A864`.
8. **Never promote an open house at an ineligible listing.** `Pending` / `Closed` /
   `Cancelled` / `Expired` → surface, do not render.
9. **Never publish a date in the past.** Renderer rejects past dates at validation time.
10. **Never assume the ManyChat automation is live.** Check; if it isn't, surface the
    dependency to Matt in the draft surface so he can decide whether to publish without it
    or pause until the automation is configured.
11. **Never auto-publish to IG/FB Stories.** The native stickers (poll, location, DM trigger)
    must be added in the IG composer by Matt. The producer commits the frames; Matt publishes.
12. **Never overwrite an existing keyword automation.** If `manychat_keyword` collides,
    surface and suggest a suffix.
