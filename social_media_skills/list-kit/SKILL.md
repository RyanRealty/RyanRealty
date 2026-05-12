---
name: list-kit
description: Orchestrator for the full Ryan Realty single-listing marketing package. Given an address or MLS#, fans out in parallel to produce a listing video, three flyers (Just Listed, Property Feature Sheet, Open House), and an Instagram carousel. All outputs follow the Ryan Realty design system (navy #102742 primary, cream #faf8f4 background, Amboqia Boriango display, Geist body). Surfaces every deliverable for Matt's review before any commit or publish. Sub-skills own the production; this skill owns the routing and the review gate.
when_to_use: |
  Trigger when Matt says any of:
  - "build a list kit"
  - "create a list kit for <address>"
  - "list kit for <address or MLS#>"
  - "/build-list-kit <address or MLS#>"
  - "full marketing package for <address>"
  - "all the listing assets for <address>"
---

# List Kit — Ryan Realty Listing Marketing Orchestrator

**Scope:** Single entry point that builds every marketing deliverable for one listing. One trigger from Matt produces 5 output files (1 video, 3 flyers, 1 carousel), surfaces them for review, and publishes on explicit approval.

**Status:** Canonical. Locked 2026-05-12. Sub-skills own production; this skill owns routing, data accuracy, the review gate, and asset library registration.

---

## 1. Purpose

A List Kit eliminates the coordination tax of building listing marketing piece-by-piece. The agent pulls the live listing record once, verifies the data once, and fans out to every deliverable in parallel. Matt reviews the full package as a unit and ships it as a unit.

Every deliverable in the kit traces to the same verified Supabase record. Copy, specs, and pricing are consistent across the video, flyers, and carousel — because they all read from a single source pull, not from memory, a brief, or prior chat turns.

---

## 2. Required references — load before doing any work

Read all of the following before scaffolding any deliverable. The data accuracy mandate and draft-first rule outrank every other instruction in every sub-skill.

| Reference | Why |
|---|---|
| `CLAUDE.md` §0 — Data Accuracy mandate | Every number must trace to a verified primary source. No fabricating, no rounding to fill, no "approximately." |
| `CLAUDE.md` §0.5 — Draft-First, Commit-Last | Nothing ships until Matt explicitly approves. Successful builds are not approval. |
| `CLAUDE.md` §3 — Video Build Hard Rules | Listing video format, hook, beats, VO, and brand constraints. |
| `design_system/ryan-realty/SKILL.md` | Canonical brand: navy `#102742`, cream `#faf8f4`, Amboqia Boriango display, Geist body, Heritage vs Web register split. |
| `design_system/ryan-realty/README.md` | Full color, type, imagery, voice, and layout spec. Definitive source for the monochrome navy system. |
| `video_production_skills/listing-tour-video/SKILL.md` | Listing video sub-skill — locked architecture, beat spec, Ken Burns curves, ambient audio. |
| `video_production_skills/listing_reveal/SKILL.md` | Overlay system — two-layer spec (text scrim + logo footer bar). |
| `social_media_skills/flyer-design/SKILL.md` | Flyer sub-skill — layout, type, margins, photo hero, broker footer. |
| `social_media_skills/instagram-carousel/SKILL.md` | Carousel sub-skill — 8-slide spec, persistent footer, slide numerals, visual continuity. |
| `video_production_skills/asset-library/SKILL.md` | Asset registration at kit close — manifest at `data/asset-library/manifest.json`. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. Twelve rules, all ship-blockers. |

---

## 3. Inputs (mandatory)

Matt must provide one of:

- **Address** — street number + street name (e.g. "1234 NW Riverview Dr, Bend"). City optional but helpful for disambiguation.
- **MLS#** — the `"MlsId"` value from the `listings` table (e.g. "220189422").

**If address provided:** fuzzy-match against `CONCAT("StreetNumber", ' ', "StreetName")` + `"City"` in the `listings` table. Use `ILIKE` or `similarity()` for partial matches. Per CLAUDE.md schema rules, every mixed-case column name must be double-quoted in SQL.

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
       "ListPrice", "StandardStatus"
FROM listings
WHERE CONCAT("StreetNumber", ' ', "StreetName") ILIKE '%riverview%'
  AND ("City" ILIKE '%bend%' OR '%bend%' = '%')
LIMIT 10;
```

**If multiple matches:** present the candidate rows to Matt and ask him to disambiguate before pulling the full record. Never guess which listing is intended.

**If no matches:** report back with the exact input, confirm the `StandardStatus` filter is not over-narrowing, and ask Matt to verify the address or provide the MLS#.

---

## 4. Data pull from Supabase

Once the correct listing is identified, pull these columns in a single query. Every mixed-case column name is double-quoted per CLAUDE.md.

```sql
SELECT
  "MlsId",
  "StreetNumber",
  "StreetName",
  "City",
  "PostalCode",
  "ListPrice",
  "BedroomsTotal",
  "BathroomsTotal",
  "TotalLivingAreaSqFt",
  year_built,
  "PhotoURL",
  "StandardStatus",
  "PublicRemarks",
  "ListAgentFullName",
  "ListOfficeName",
  "SubdivisionName",
  "CumulativeDaysOnMarket",
  price_per_sqft
FROM listings
WHERE "MlsId" = '<mls-id>'
LIMIT 1;
```

**Before any render, produce a verification trace per CLAUDE.md §0:**

> `"$849,000 list price — Supabase listings, MlsId='220189422', ListPrice = 849000, fetched 2026-05-12T14:32Z, 1 row"`

Every figure shown in any deliverable (price, beds, baths, sqft, year built) must have a trace line in `kit-manifest.json`. No trace, no ship.

**Never inherit numbers from a prior chat turn, a brief, web articles, or another agent session.** Pull fresh in this session.

**Photo pull:** `"PhotoURL"` may be a single URL or a JSON array. Parse accordingly. Pull all available photos and pass the full set to each sub-skill. Sub-skills select photos per their own spec; the kit passes the raw array, never pre-curates.

---

## 5. Build flow

```
TRIGGER ──────► PARSE INPUT (address or MLS#)
                    │
                    ▼
              FUZZY-MATCH in Supabase
                    │
            ┌── multiple matches? ──► ASK MATT TO DISAMBIGUATE
            │
            ▼ (single match confirmed)
        FULL DATA PULL (14+ columns per §4)
                    │
                    ▼
        VERIFICATION TRACE (one line per figure)
                    │
           ┌────────┴────────────────────────────────────┐
           │    Fan out — 4 parallel build streams       │
           │  5.1 Listing video (listing-tour-video)     │
           │  5.2 Flyer 1: Just Listed (flyer-design)    │
           │  5.3 Flyer 2: Property Feature Sheet        │
           │  5.4 Flyer 3: Open House (flyer-design)     │
           │  5.5 Instagram Carousel (instagram-carousel) │
           └────────┬────────────────────────────────────┘
                    │  (all 5 complete or fail visibly)
                    ▼
            QA GATE (per-deliverable + kit-level, §9)
                    │
                    ▼
            DRAFT SURFACE TO MATT (§10 format)
                    │
           ◄──── WAIT FOR EXPLICIT APPROVAL ────►
                    │  ("ship it" / "go" / "approved")
                    ▼
            PUBLISH STEP (§11)
                    │
                    ▼
            ASSET LIBRARY REGISTRATION (§8)
                    │
                    ▼
            git commit + push to main
```

**Failure of one stream does not block the others.** Surface each failure in the review package with a one-line diagnosis and an offer to retry.

---

## 6. Slugging convention

Every output path uses a consistent slug derived from the listing address:

```
<city-lowercase>-<street-number>-<street-name-kebab>
# Example: bend-1234-nw-riverview-dr
```

All deliverables for a kit live under `out/list-kits/<slug>/`. The same slug is used for asset library `used_in` tags and the publish destination `public/list-kits/<slug>/`.

---

## 7. Deliverable specs

### 7.1 Listing video

**Delegates to:** `video_production_skills/listing-tour-video/SKILL.md` + `video_production_skills/listing_reveal/SKILL.md`

**Format:** 1080×1920 portrait, 30–45s, h264 + aac, faststart, < 100 MB.

**Hook rule:** motion by frame 12 (0.4s), on-screen text by frame 30 (1.0s). First word is content — address, price, or a specific fact about the listing. No logo, no brokerage name, no "REPRESENTED BY" in frame 0.

**Design system — overlay spec (updated from old gold spec):**

Per `design_system/ryan-realty/SKILL.md`: the List Kit follows the new monochrome navy system. **No gold.** The footer bar uses navy `#102742` at 0.70 opacity with the heritage wordmark from `design_system/ryan-realty/assets/brand/logo-blue.png` (580px wide, vertically centered). Heritage register applies to all listing marketing — Amboqia Boriango for any new display text in overlay, navy monochrome on cream or dark backgrounds.

Two-layer overlay (per `listing_reveal/SKILL.md`):
- **Layer 1 — text-zone scrim:** `rgba(0,0,0,0.40)` covering only the address/price block. No feathering. No drop shadows.
- **Layer 2 — logo footer bar:** `rgba(16,39,66,0.70)` (navy at 70% opacity), 200px tall, flush bottom (y=1720→1920). Heritage wordmark `logo-blue.png`, 580px wide, vertically centered. No drop shadow on logo.
- Clean unobstructed photo strip between layers.

**VO:** Victoria, voice ID `qSeXEcewz7tA0Q0qk9fH`, `eleven_turbo_v2_5`, stability 0.40, similarity_boost 0.80, style 0.50, use_speaker_boost true. Sentences short. Numbers spelled out for ingestion ("eight hundred forty nine thousand dollars"). IPA phoneme tags for Deschutes (`dəˈʃuːts`), Tumalo (`TUM-uh-low`), and other tricky Central Oregon names.

**Captions:** full-sentence with active-word highlight. No word-by-word reveal. Synced to ElevenLabs forced-alignment timestamps. Safe zone y 1480–1720, x 90–990. Never overlay the logo footer bar.

**Banned words in VO and captions:** stunning, nestled, boasts, charming, pristine, gorgeous, breathtaking, must-see, dream home, meticulously maintained, entertainer's dream, tucked away, hidden gem, truly, spacious, cozy, luxurious, updated throughout.

**Output:** `out/list-kits/<slug>/video/<slug>.mp4`

### 7.2 Flyer 1 — Just Listed (digital social)

**Delegates to:** `social_media_skills/flyer-design/SKILL.md`

**Format:** 1080×1350 px (4:5 portrait, Instagram feed + Facebook native)

**Design register:** Heritage — Amboqia Boriango display headline, Geist body/data, navy `#102742` monochrome on cream `#faf8f4` background. Heritage wordmark from `design_system/ryan-realty/assets/brand/logo-blue.png` in broker footer. No gold. Warm stone neutrals for secondary elements.

**Required content blocks:**
- "JUST LISTED" stamp or eyebrow (Amboqia, UPPERCASE, navy, tracked 0.08em)
- Property address (Amboqia display, navy)
- Price in `$XXX,000` format — tabular numerals
- Bed · Bath · Sqft data row (Geist 500, middle-dot separators)
- Hero photo (top or full-bleed, navy scrim for text legibility)
- Ryan Realty broker footer: heritage wordmark + `541.213.6706` + `ryan-realty.com`

**Voice:** direct, specific — "3 bd · 2 ba · 1,820 sqft. Delivered turn-key, 2024 roof." Not "stunning home!" Not "tucked away in a lovely neighborhood!"

**Output:** `out/list-kits/<slug>/flyers/just-listed.png` (or PDF)

### 7.3 Flyer 2 — Property Feature Sheet (print + digital)

**Delegates to:** `social_media_skills/flyer-design/SKILL.md`

**Format:** 8.5×11 in at 300 dpi (print-ready PDF) + 2550×3300 px PNG for digital distribution

**Design register:** Heritage — same navy/cream system as the Just Listed flyer. Print output must use `assets/brand/logo-blue.png` (the heritage wordmark for print per `design_system/ryan-realty/SKILL.md` asset cheat sheet — "heritage wordmark (print): logo-blue.png (navy)"). Amboqia Boriango for headline and section labels. Geist for all data.

**Required content blocks:**
- Full address header (Amboqia, large, navy)
- List price in headline position
- Specs grid: beds, baths, sqft, year built, lot size if available, HOA if available (em-dash `—` for unavailable values per CLAUDE.md)
- Hero photo (top third of page)
- Secondary photos grid (2–4 photos, if available in `"PhotoURL"` set)
- Property description block — drawn from `"PublicRemarks"`, edited to remove banned words before render. If `"PublicRemarks"` is empty or contains only banned language, leave the block blank rather than fabricating copy
- Broker footer: heritage wordmark, agent name from `"ListAgentFullName"`, `"ListOfficeName"`, phone `541.213.6706`, `ryan-realty.com`, MLS# disclosure line

**Output:** `out/list-kits/<slug>/flyers/feature-sheet.pdf` + `feature-sheet.png`

### 7.4 Flyer 3 — Open House (digital + print)

**Delegates to:** `social_media_skills/flyer-design/SKILL.md`

**Format:** 1080×1350 px digital (same as Just Listed) + 8.5×11 print PDF

**Required input from Matt:** open house date, time, and whether the event has been scheduled. If no open house is scheduled, surface this to Matt and ask whether to (a) skip the flyer, (b) leave date as "[DATE · TIME — TBD]" placeholder, or (c) create a generic showing-request flyer instead. Never invent a date.

**Design register:** Heritage. Same navy/cream system. Amboqia display for "OPEN HOUSE" header. Geist for date, time, and address data. Heritage wordmark in footer.

**Required content blocks:**
- "OPEN HOUSE" header (Amboqia, UPPERCASE, navy, large — this is a display moment)
- Date and time (Geist 600, tabular numerals)
- Address (Amboqia or Geist depending on hierarchy — match the sub-skill's template)
- Price + key specs (Geist, middle-dot separators)
- Hero photo
- Broker footer

**Output:** `out/list-kits/<slug>/flyers/open-house.png` + `open-house.pdf`

### 7.5 Instagram Carousel

**Delegates to:** `social_media_skills/instagram-carousel/SKILL.md`

**Format:** 8 slides, 1080×1350 px each, visual continuity maintained across all slides via persistent footer logo bar and slide numerals.

**Design register:** Heritage for cover slide (Amboqia display, navy/cream). Web register allowed for interior data slides (Geist, warm stone card backgrounds, tabular stats) — but both registers must share the same color system (navy `#102742`, cream `#faf8f4`, warm stone).

**Slide structure (default):**

| Slide | Content |
|---|---|
| 1 — Cover | Hero photo full-bleed, address in Amboqia, price in headline, "JUST LISTED" eyebrow |
| 2 — Key specs | Beds, baths, sqft, year built — data card on cream background |
| 3 — Photo | Full-bleed interior or feature photo — no text overlay except the persistent footer |
| 4 — Feature highlight | One specific standout detail drawn from `"PublicRemarks"` (e.g. "Open-concept great room. Vaulted ceilings, 20-ft span." — Geist, direct, no clichés) |
| 5 — Photo | Full-bleed exterior or lot photo |
| 6 — Location context | Neighborhood name + 2–3 specific proximity facts (e.g. "0.3 mi to the Deschutes River Trail.") — sourced from verified geography, never invented |
| 7 — Market context | 1–2 verified market stats for the city/neighborhood (median price, DOM, MoS) — pulled from Supabase `market_pulse_live` or `market_stats_cache`, traced per CLAUDE.md §0 |
| 8 — CTA | "Your local team. 541.213.6706. ryan-realty.com." Heritage wordmark centered. "It's About Relationships." tagline. |

**Persistent elements across all 8 slides:**
- Footer bar: navy `rgba(16,39,66,0.70)`, 80–100px tall, flush bottom. Heritage wordmark (small) left-aligned. Slide numeral right-aligned (e.g. "3 / 8"), Geist 400.
- Consistent safe-zone margin (90px all edges).

**Slide 7 — market context data gate:** if the market stat cannot be verified (no Supabase row, Spark reconciliation failure, < 30 SFR closed sales in the period), cut the market context slide and shift slide 8 (CTA) to position 7. Deliver a 7-slide carousel rather than one wrong number.

**Output:** `out/list-kits/<slug>/carousel/slide-01.png` … `slide-08.png` (or slide-07.png if market context cut)

---

## 8. Output structure

```
out/list-kits/<slug>/
├── kit-manifest.json          # See §8.1 below
├── video/
│   └── <slug>.mp4
├── flyers/
│   ├── just-listed.png
│   ├── feature-sheet.pdf
│   ├── feature-sheet.png
│   ├── open-house.png
│   └── open-house.pdf
└── carousel/
    ├── slide-01.png
    ├── slide-02.png
    ├── slide-03.png
    ├── slide-04.png
    ├── slide-05.png
    ├── slide-06.png
    ├── slide-07.png
    └── slide-08.png           # may be absent if market context cut
```

### 8.1 kit-manifest.json

Write this file alongside the deliverables before presenting to Matt. Every figure in every deliverable must appear in `verification_traces`.

```json
{
  "kit_id": "list-kit-<slug>",
  "mls_id": "<MlsId>",
  "address": "<StreetNumber> <StreetName>, <City>, OR <PostalCode>",
  "list_price": 000000,
  "fetched_at_iso": "2026-05-12T14:32:00Z",
  "deliverables": {
    "video": "out/list-kits/<slug>/video/<slug>.mp4",
    "flyer_just_listed": "out/list-kits/<slug>/flyers/just-listed.png",
    "flyer_feature_sheet_pdf": "out/list-kits/<slug>/flyers/feature-sheet.pdf",
    "flyer_feature_sheet_png": "out/list-kits/<slug>/flyers/feature-sheet.png",
    "flyer_open_house_png": "out/list-kits/<slug>/flyers/open-house.png",
    "flyer_open_house_pdf": "out/list-kits/<slug>/flyers/open-house.pdf",
    "carousel_slides": ["slide-01.png", "..."]
  },
  "verification_traces": [
    {
      "figure": "$849,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 849000,
      "fetched_at": "2026-05-12T14:32:00Z"
    }
  ],
  "design_system_version": "ryan-realty/SKILL.md 2026-05-12",
  "kit_status": "draft"
}
```

---

## 9. Asset library registration

After Matt approves and deliverables are moved to `public/list-kits/<slug>/`, register every output in the asset library per `video_production_skills/asset-library/SKILL.md`.

Each asset gets:

```json
{
  "asset_id": "list-kit-<slug>-video",
  "file_path": "public/list-kits/<slug>/video/<slug>.mp4",
  "asset_type": "video",
  "used_in": ["list-kit-<slug>"],
  "subject_tags": ["list-kit", "<city-lowercase>", "<slug>"],
  "mls_id": "<MlsId>",
  "registered_at": "<iso-timestamp>"
}
```

Tag pattern for every file in the kit:
- `used_in`: `["list-kit-<slug>"]`
- `subject_tags`: `["list-kit", "<city-lowercase>", "<address-slug>", "<mls-id>"]`

Register all 8–10 files in a single batch write to the manifest.

---

## 10. QA gate

### Per-deliverable gates (delegate to each sub-skill)

**Video:**
- `ffprobe` duration in [30s, 45s]
- `ffmpeg blackdetect` (pix_th=0.05) returns zero sequences
- Frame at 0s has motion + content
- No frozen frames at beat boundaries
- No logo / "Ryan Realty" / phone / agent name in any frame except footer bar (which is the approved exception)
- File < 100 MB
- Banned-words grep clean across VO script and captions
- All on-screen numbers trace to `kit-manifest.json` verification_traces
- No gold in frame (new spec — monochrome navy only)

**Flyers (all three):**
- All figures (price, beds, baths, sqft, year built) trace to the same Supabase pull
- No banned words in any copy block
- Broker footer present and accurate (`ListAgentFullName`, `541.213.6706`, `ryan-realty.com`, MLS# disclosure)
- `PublicRemarks` content has been screened and sanitized (banned words removed or block left blank)
- No AI-generated property photos used
- Heritage wordmark used as the pre-rendered image from `design_system/ryan-realty/assets/brand/logo-blue.png`, not re-typeset

**Carousel:**
- 7 or 8 slides present (8 if market context verified, 7 if not)
- Persistent footer bar on every slide
- Slide numeral correct and sequential
- Market context slide (7) figures trace to Supabase with row count and filter documented
- No banned words in any slide copy

### Kit-level gate (run after all per-deliverable gates pass)

- All 5 deliverable groups present or accounted for (failure noted in manifest with reason)
- `kit-manifest.json` exists and contains a verification trace for every numeric figure across all deliverables
- All figures are consistent across deliverables (same price, same specs — no drift from one flyer to another)
- No deliverable references a figure not in the Supabase pull (no invented data)
- `kit_status` in manifest = "draft" (never auto-set to "approved")

If the kit-level gate fails on any item: halt, surface to Matt with the specific failure, offer to fix before presenting for review.

---

## 11. Draft surface format

When all deliverables are ready (or visibly failed with a diagnosis), present to Matt in one message:

```
List Kit ready for review — <StreetNumber> <StreetName>, <City>

  VIDEO
    Path: out/list-kits/<slug>/video/<slug>.mp4
    Duration: <Xs> · Size: <N> MB · Beats: <N>
    Scorecard: <N>/100 (ship floor: 85)

  FLYERS
    Just Listed:      out/list-kits/<slug>/flyers/just-listed.png
    Feature Sheet:    out/list-kits/<slug>/flyers/feature-sheet.pdf + .png
    Open House:       out/list-kits/<slug>/flyers/open-house.png + .pdf
                      [or: SKIPPED — no open house date provided]

  CAROUSEL
    Slides: out/list-kits/<slug>/carousel/ (slide-01 … slide-0N.png)
    Slide count: N (N=8 with market context, N=7 if market context cut)

  VERIFICATION TRACE
    <N> figures verified — kit-manifest.json:
    - $<price> ListPrice — Supabase listings, MlsId='<id>', fetched <iso>
    - <N> bd — Supabase listings, MlsId='<id>', BedroomsTotal = <N>
    - <N> ba — Supabase listings, MlsId='<id>', BathroomsTotal = <N>
    - <N> sqft — Supabase listings, MlsId='<id>', TotalLivingAreaSqFt = <N>
    [... one line per figure, all deliverables]

  KIT MANIFEST
    out/list-kits/<slug>/kit-manifest.json

Reply "ship it" to move to public/list-kits/<slug>/ and commit + push.
```

Then stop. Do not commit. Do not push. Do not move any file. Wait for Matt's explicit approval.

---

## 12. Publish step (post-approval)

When Matt says "ship it" / "go" / "approved" / "publish":

1. **Copy deliverables to public:**
   ```
   public/list-kits/<slug>/video/<slug>.mp4
   public/list-kits/<slug>/flyers/just-listed.png
   public/list-kits/<slug>/flyers/feature-sheet.pdf
   public/list-kits/<slug>/flyers/feature-sheet.png
   public/list-kits/<slug>/flyers/open-house.png
   public/list-kits/<slug>/flyers/open-house.pdf
   public/list-kits/<slug>/carousel/slide-01.png … slide-0N.png
   public/list-kits/<slug>/kit-manifest.json (update kit_status: "approved")
   ```

2. **Register in asset library** (§9).

3. **git add** the specific files above (not `git add -A` — the out/ directory is gitignored and must not be staged).

4. **Commit** with message referencing the MLS# and deliverable count.

5. **Push to origin/main immediately** — no "saved locally" commits.

6. **Optional — queue to post_scheduler:** only if Matt explicitly says "and publish to social" or "schedule it." The default is commit+push only. If post_scheduler is triggered, route:
   - Just Listed flyer → IG feed, FB page, LinkedIn
   - Carousel → IG carousel post
   - Video → IG Reels, FB Reels
   - Each post gets a platform-specific caption per `social_media_skills/platforms/` specs. No posting without a reviewed caption — surface captions for Matt's review separately.

---

## 13. What not to do

1. **Never fabricate property facts.** If `"BedroomsTotal"` is null, show `—` on the flyer. Do not guess, do not infer from square footage, do not write "3 bedrooms" because the photos look like a 3-bedroom house.

2. **Never use AI-generated property photos.** Every photo in every deliverable must come from `"PhotoURL"` (the actual MLS listing photos). Per `ANTI_SLOP_MANIFESTO.md`: AI-passed-as-real property photos is a hard ship-blocker. There is no exception.

3. **Never deliver a partial kit.** All 5 deliverable groups ship together. If one fails, fix it or surface it to Matt — do not ship 4 of 5 and call it done. The review package must account for every deliverable.

4. **Never push without Matt's approval.** A successful render, a passing QA gate, a complete kit-manifest.json — none of these are approval. Only Matt's explicit "ship it" / "go" / "approved" grants push permission per CLAUDE.md Draft-First, Commit-Last.

5. **Never inherit numbers from chat context, prior sessions, a brief, or a web article.** Even if Matt quoted the price in his message, pull it fresh from Supabase and verify it matches. The Supabase record is the source of truth, not the conversation.

6. **Never use gold.** The List Kit follows the new Ryan Realty design system: monochrome navy `#102742` only. No `#D4AF37`, no `#C8A864`, no gold hex of any variant. The old locked spec in CLAUDE.md (gold logo in the listing video footer) is superseded by the new design system for all List Kit deliverables.

7. **Never re-typeset the wordmark.** Per `design_system/ryan-realty/SKILL.md`: "Don't invent a wordmark — the pre-rendered mark in `assets/brand/logo-blue.png` and the 14 numbered variations are the brand. Use them as images; don't re-typeset." This applies to flyers, carousel footer, and the video footer bar.

8. **Never use banned words.** Any caption, VO, flyer copy, or carousel text containing "stunning," "nestled," "boasts," "charming," "pristine," "gorgeous," "breathtaking," "must-see," "dream home," "meticulously maintained," "entertainer's dream," "tucked away," "hidden gem," "truly," "spacious," "cozy," "luxurious," or "updated throughout" is a non-ship. Screen `"PublicRemarks"` before pulling it into flyer or carousel copy and sanitize.

9. **Never skip the carousel market context verification gate.** If the market stat on slide 7 cannot be traced to a live Supabase query with row count and filter documented, cut the slide. A 7-slide carousel is better than a carousel with an unverified stat.

10. **Never publish to social without separate caption review.** The commit+push step is the default. Social distribution is opt-in, requires Matt's explicit instruction, and requires a caption review pass before any post goes live.

---

## 14. See also

- `video_production_skills/listing-tour-video/SKILL.md` — video sub-skill (locked architecture, photo-to-beat mapping, Ken Burns curves, ambient audio spec, QA gate)
- `video_production_skills/listing_reveal/SKILL.md` — two-layer overlay system (text scrim + navy footer bar + logo)
- `social_media_skills/flyer-design/SKILL.md` — flyer sub-skill (editorial layout, photo hero, broker footer, print vs digital spec)
- `social_media_skills/instagram-carousel/SKILL.md` — carousel sub-skill (8-slide spec, persistent footer, slide continuity)
- `video_production_skills/asset-library/SKILL.md` — asset manifest at `data/asset-library/manifest.json`, CLI at `lib/asset-library.mjs`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — twelve banned-content rules, all ship-blockers
- `video_production_skills/elevenlabs_voice/SKILL.md` — canonical Victoria voice settings (single source of truth: stability 0.40, similarity 0.80, style 0.50, model eleven_turbo_v2_5)
- `design_system/ryan-realty/SKILL.md` — portable brand manifest
- `design_system/ryan-realty/README.md` — full design system spec
- `design_system/ryan-realty/colors_and_type.css` — all CSS variables (color tokens, type families, spacing, radii, shadows)
- `CLAUDE.md` §0 — data accuracy mandate (non-negotiable)
- `CLAUDE.md` §0.5 — draft-first, commit-last (non-negotiable)
- `CLAUDE.md` §3 — video build hard rules (format, hook, beats, VO, brand)
