---
name: list-kit
description: >
  Orchestrator for the full Ryan Realty at-Active marketing kit per listing. Given an address or
  MLS#, pulls the verified listing record once and fans out to six parallel deliverables: listing
  video, three flyers (Just Listed, Feature Sheet, Open House), an IG carousel (one of Patterns
  A / B / C / D), and an IG single-image post (one of S1-S10 templates.  defaults to S1 Just
  Listed at-Active). Every deliverable reads from the same Supabase pull; copy and pricing
  match across the kit. Surfaces every deliverable for Matt's review before any commit or
  publish. Sub-skills own production; this skill owns routing, data accuracy, caption emission,
  the review gate, and asset library registration. Use this whenever Matt says "build a list
  kit", "list kit for <address>", "create a list kit for <MLS#>", "full marketing package",
  "all the listing assets", or any phrasing that asks for a complete listing launch package.
when_to_use: |
  Trigger when Matt says any of:
  - "build a list kit"
  - "list kit for <address or MLS#>"
  - "create a list kit for <address or MLS#>"
  - "/build-list-kit <address or MLS#>"
  - "full marketing package for <address>"
  - "all the listing assets for <address>"
  - "the at-active kit for <address>"
  - "kick off the listing for <address>"
action_types:
  - content:list_kit
output_type: operational
target_platforms: []
asset_destination: no asset; state mutation only (logged in marketing_decisions)
auto_inputs: ["current campaign/account state"]
required_inputs: ["account_id OR campaign_id"]
optional_inputs: ["budget_delta_pct", "pause_reason"]
estimated_runtime_min: 3
cost_usd_estimate: $0.01-$0.10 per call (mostly API quota; minimal Anthropic)
thumbnail_uri: out/proof/2026-05-17/exemplars/sample.html
example_outputs: []
---

# List Kit.  Ryan Realty At-Active Listing Marketing Orchestrator

**Status:** Canonical  
**Locked:** 2026-05-17  


## CRITICAL.  Canonical generators + approved-state reference

Before dispatching to any sub-skill, read:

1. **Approved-state reference (must read every time):** `public/template-picker/preview/list-kit-tumalo-v3.html`.  the canonical Tumalo Reservoir v3 kit Matt approved. Every new listing renders against it.
2. **Canonical generators (the layout is in the code, not the prose):**
   - `scripts/build_tumalo_v3_kit.py`.  Pattern A bare-photo carousel + Pattern B editorial hero + Pattern C magazine hero.
   - `scripts/build_single_image_posts.py`.  S1-S10 single-image post templates.
   - `scripts/build_pattern_d_panorama.py`.  Pattern D panorama-across-slides (parameterized).
3. **Working listing-specific adapters** (use as templates for new listings):
   - `scripts/build_schoolhouse_sold_posts.py`
   - `scripts/build_beaumont_pending_posts.py`

**Adapt by changing SRC paths + listing data + text content only. Never re-implement layout, fonts, scrim values, or text positions.** If the canonical script positions the "Sold" word at `y = H - 360` with `amboqia(180)`, every new listing's S2 uses the same. The Python generator code is the source of truth.  the SKILL.md prose can drift; the code cannot.

Banned in any list-kit render:

- Logo, broker headshot, phone, URL, or spec-line block burned into a Pattern A carousel slide.
- "JUST LISTED" / "JUST SOLD" / "UNDER CONTRACT" sticker badges on top of photos. The text moments are tracked typography per the approved S-template layouts.
- Writing a new HTML+Playwright compositor when the Python generator already produces the approved render.

Locked 2026-05-14 per `~/.claude/.../memory/feedback_use_approved_generators.md`.

---

**Scope.** Single entry point that builds every at-Active marketing deliverable for one listing.
One trigger from Matt produces six output deliverables (1 video, 3 flyers, 1 carousel, 1 single
post), surfaces them as a unit for review, and publishes on explicit approval. Pre-Active and
post-Active moments (coming-soon, open-house Stories, under-contract, sold) are handled by their
own producers.  this orchestrator focuses on the at-Active moment only.

**Status.** Canonical (v3). Locked 2026-05-14. Sub-skills own production; this skill owns routing,
data accuracy, caption emission, the review gate, and asset library registration.

**Producer category.** Section A.  Content Orchestrator (per `marketing_brain_skills/producers/REGISTRY.md`).

---

## 1. Purpose

A list kit eliminates the coordination tax of building listing marketing piece-by-piece. The
producer pulls the live listing record once, verifies the data once, and fans out to every
deliverable in parallel. Matt reviews the full package as a unit and ships it as a unit.

Every deliverable in the kit traces to the same verified Supabase record. Copy, specs, and
pricing are consistent across the video, flyers, carousel, and single post.  because they all
read from a single source pull, not from memory, a brief, or prior chat turns.

---

## 2. Required references.  load before doing any work

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every number traces to a verified primary source. No fabricating, no rounding to fill, no "approximately." Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Nothing ships until Matt explicitly approves. Successful builds are not approval. Outranks every other rule. |
| `CLAUDE.md` §3.  Video Build Hard Rules | Listing video format, hook, beats, VO, brand constraints. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | Every caption on every hashtag-supporting platform leads its hashtag block with `#RyanRealtyBend`. Locked 2026-05-14. |
| `design_system/ryan-realty/SKILL.md` | Brand registers (heritage vs web), color/type decision tree, asset cheat sheet. |
| `design_system/ryan-realty/colors_and_type.css` | CSS variables (color tokens, type families, spacing, radii, shadows). |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Voice attributes, banned vocab/phrases/tropes, do/don't pairs per channel. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's actual writing.  voice fingerprint reference. |
| `automation_skills/content_engine/SKILL.md` | All content actions route through here. Never bypass. |
| `video_production_skills/listing-tour-video/SKILL.md` | Listing video sub-skill.  locked architecture, beats, Ken Burns curves. |
| `video_production_skills/listing_reveal/SKILL.md` | Two-layer overlay system (text scrim + navy footer bar). |
| `social_media_skills/flyer-design/SKILL.md` | Flyer sub-skill.  Just Listed / Feature Sheet / Open House. |
| `social_media_skills/instagram-carousel/SKILL.md` | Carousel sub-skill.  Patterns A/B/C/D. |
| `social_media_skills/ig-single-post/SKILL.md` | Single-image post sub-skill.  S1-S10 templates. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform rule layer. Mandatory per CLAUDE.md "Skill self-binding." |
| `video_production_skills/asset-library/SKILL.md` | Asset registration at kit close. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. |

---

## 3. Broker headshots

Three normalized broker headshots live at `design_system/ryan-realty/assets/team/`:

- `matt-ryan.png` (transparent, default) / `.jpg`.  Matt Ryan
- `paul-stevenson.png` / `.jpg`.  Paul Stevenson
- `rebecca-peterson.png` / `.jpg`.  Rebecca Peterson

Use the `.png` (transparent) by default.  drops cleanly onto any background. Fall back to `.jpg`
only if a transparent-aware renderer isn't available.

**Listing-agent rule.** Every per-listing deliverable in the kit (flyers, single post, carousel
CTA slide, video end card) includes the listing agent's headshot. Resolve from the Supabase row
(`ListAgentEmail`, `ListAgentFullName`) to one of the three brokers. For brand-led content
elsewhere (market reports, news clips, neighborhood guides) the brokerage speaks.  use the Jax
mascot from `assets/brand/blue-dog.png` instead. This rule does not change in the kit because
the kit is always per-listing.

---

## 4. Inputs (mandatory)

Matt provides one of:

- **Address**.  street number + street name (e.g. "1234 NW Riverview Dr, Bend"). City optional.
- **MLS#**.  the `"MlsId"` value from the `listings` table (e.g. "220189422").

Optional payload fields (defaults apply if omitted):

| Field | Default | Notes |
|---|---|---|
| `carousel_pattern` | `A` | One of `A` / `B` / `C` / `D`. See §10. |
| `single_post_template` | `S1` (Just Listed) | One of `S1`-`S10`. See §11. |
| `open_house_date` | none | If provided, Open House flyer renders with date+time. If omitted, that flyer is skipped. |
| `voice_pattern` | `default` | Caption tone variant. Default = H&H tag-block. See §12. |

If address is provided, fuzzy-match against `CONCAT("StreetNumber", ' ', "StreetName")` +
`"City"` using `ILIKE`. If multiple matches, present candidate rows and ask Matt to disambiguate
before pulling the full record. If no matches, report back with the exact input and confirm the
`StandardStatus` filter is not over-narrowing.

```sql
SELECT "MlsId", "StreetNumber", "StreetName", "City", "PostalCode",
       "ListPrice", "StandardStatus"
FROM listings
WHERE CONCAT("StreetNumber", ' ', "StreetName") ILIKE '%riverview%'
  AND ("City" ILIKE '%bend%' OR '%bend%' = '%')
LIMIT 10;
```

---

## 5. Data pull from Supabase

Once the listing is identified, pull these columns in a single query. Every mixed-case column is
double-quoted per CLAUDE.md schema rules.

```sql
SELECT
  "MlsId",
  "StreetNumber", "StreetName", "City", "PostalCode",
  "ListPrice",
  "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
  "Latitude", "Longitude",
  year_built,
  "PhotoURL",
  "StandardStatus",
  "PublicRemarks",
  "ListAgentFullName", "ListAgentEmail",
  "ListOfficeName",
  "SubdivisionName",
  "CumulativeDaysOnMarket",
  price_per_sqft
FROM listings
WHERE "MlsId" = '<mls-id>'
LIMIT 1;
```

**Verification trace.** Before any render, produce one line per figure shown in any deliverable:

> `"$849,000 list price.  Supabase listings, MlsId='220189422', ListPrice = 849000, fetched 2026-05-14T14:32Z, 1 row"`

Every figure that appears anywhere in the kit (price, beds, baths, sqft, year built, DOM,
price/sqft) must have a trace line in `kit-manifest.json`. No trace, no ship.

**Never inherit numbers from a prior chat turn, brief, web article, or another agent session.**
Pull fresh in this session.

**Photo set.** `"PhotoURL"` is a JSON array. Parse and pass the full set to each renderer.
Renderers select photos per their own spec; the orchestrator does not pre-curate.

---

## 6. Build flow

```
TRIGGER ──► PARSE INPUT ──► FUZZY MATCH ──► DISAMBIGUATE if needed
                                │
                                ▼
                        FULL DATA PULL (§5)
                                │
                                ▼
                        VERIFICATION TRACE
                                │
   ┌────────────────────────────┴─────────────────────────────┐
   │  Fan out.  six parallel build streams                    │
   │  6.1  Listing video         → listing-tour-video         │
   │  6.2  Just Listed flyer     → flyer-design               │
   │  6.3  Feature Sheet flyer   → flyer-design               │
   │  6.4  Open House flyer*     → flyer-design (if date)     │
   │  6.5  IG Carousel           → instagram-carousel         │
   │       (pattern A / B / C / D)                            │
   │  6.6  IG Single Post        → ig-single-post             │
   │       (template S1 /... / S10)                          │
   │  6.7  Captions for IG       → §12 H&H tag-block format   │
   └────────────────────────────┬─────────────────────────────┘
                                │
                                ▼
                        QA GATE (§13)
                                │
                                ▼
                        DRAFT SURFACE TO MATT (§14)
                                │
              ◄─── WAIT FOR EXPLICIT APPROVAL ───►
                                │
                                ▼
                        PUBLISH STEP (§15)
                                │
                                ▼
                        ASSET LIBRARY REGISTRATION (§9)
                                │
                                ▼
                        git commit + push to main
```

Failure of one stream does not block others. Surface each failure in the review package with a
one-line diagnosis and an offer to retry.

---

## 7. Slugging

```
<city-lowercase>-<street-number>-<street-name-kebab>
# Example: bend-1234-nw-riverview-dr
```

Same slug used for `out/list-kits/<slug>/`, asset-library `used_in` tags, and
`public/list-kits/<slug>/` publish destination.

---

## 8. Output structure

```
out/list-kits/<slug>/
├── kit-manifest.json          ← see §8.1
├── captions/
│   ├── carousel-caption.md    ← IG carousel caption (H&H format)
│   ├── single-post-caption.md ← IG single-post caption (H&H format)
│   └── caption-validation.json
├── video/
│   └── <slug>.mp4
├── flyers/
│   ├── just-listed.png
│   ├── feature-sheet.pdf
│   ├── feature-sheet.png
│   ├── open-house.png         ← optional
│   └── open-house.pdf         ← optional
├── carousel/
│   ├── pattern.json           ← which pattern (A/B/C/D) was rendered
│   └── slide-01.png … slide-NN.png
└── single-post/
    ├── template.json          ← which S-template (S1..S10) was rendered
    └── post.png
```

### 8.1 kit-manifest.json

```json
{
  "kit_id": "list-kit-<slug>",
  "mls_id": "<MlsId>",
  "address": "<StreetNumber> <StreetName>, <City>, OR <PostalCode>",
  "list_price": 0,
  "carousel_pattern": "A",
  "single_post_template": "S1",
  "fetched_at_iso": "2026-05-14T14:32:00Z",
  "deliverables": {
    "video": "out/list-kits/<slug>/video/<slug>.mp4",
    "flyer_just_listed": "out/list-kits/<slug>/flyers/just-listed.png",
    "flyer_feature_sheet": "out/list-kits/<slug>/flyers/feature-sheet.pdf",
    "flyer_open_house": "out/list-kits/<slug>/flyers/open-house.png",
    "carousel_slides": ["slide-01.png", "..."],
    "single_post": "out/list-kits/<slug>/single-post/post.png",
    "carousel_caption": "out/list-kits/<slug>/captions/carousel-caption.md",
    "single_post_caption": "out/list-kits/<slug>/captions/single-post-caption.md"
  },
  "verification_traces": [
    {
      "figure": "$849,000",
      "source": "Supabase listings",
      "filter": "MlsId='220189422'",
      "column": "ListPrice",
      "value": 849000,
      "fetched_at": "2026-05-14T14:32:00Z"
    }
  ],
  "design_system_version": "ryan-realty/SKILL.md 2026-05-12",
  "kit_status": "draft"
}
```

---

## 9. Asset library registration

After Matt approves and deliverables are moved to `public/list-kits/<slug>/`, register every
output in the asset library per `video_production_skills/asset-library/SKILL.md`. Tag pattern:

- `used_in`: `["list-kit-<slug>"]`
- `subject_tags`: `["list-kit", "<city-lowercase>", "<address-slug>", "<mls-id>"]`

Register all 8-12 files in a single batch write to the manifest.

---

## 10. Carousel.  Pattern decision

Default pattern is **A** unless Matt's payload says otherwise. The four patterns are
alternative visual approaches; **pick one per listing**, do not mix.

| Pattern | What it is | When to default to it |
|---|---|---|
| **A** | 10-slide carousel of unaltered, color-corrected listing photos at 1080×1350. Zero overlay. Persistent navy/cream footer with logo + slide numeral. Photo carries the post. | Most listings. Photo-forward. Lowest production cost. Highest dwell. |
| **B** | Single hero (1080×1350) with Amboqia Boriango editorial headline + conversational price line. Top-scrim only. "The Agency" register. | When the headline does the work.  premium architecture, signature property, story-led. |
| **C** | Single hero with Geist 500 magazine caption + Azo Sans Medium tracked eyebrow + small Ryan Realty white wordmark in top-right. Bottom-scrim. Coldwell Banker Global Luxury register. | When data-forward + restrained editorial caption beats a headline. |
| **D** | Panorama across three slides.  one wide aerial sliced into three portrait tiles (1080×1350 each) flowing seamlessly when swiped. | When the listing's lot, acreage, or location IS the story. Aerial photo required. |

**Pattern C font note.** v3 spec is **Geist 500** for the magazine caption body, per
Design System v2. The 2026-05-14 visual reference rendered Pattern C with Azo Sans Medium.  that
predates this lock. If Matt wants Azo Sans Medium back, the path is to amend Design System v2 (it
reserves Azo Sans Medium for arched ribbon sub-labels), not to except Pattern C.

**Pattern D requires** a wide aerial photo with sufficient horizontal resolution (≥ 4500 px wide
at a 16:9-ish ratio) and `Latitude`/`Longitude` for verification. If the aerial isn't available,
surface to Matt and ask whether to (a) source a drone shot, (b) downgrade to Pattern A.

The orchestrator passes `pattern: 'A' | 'B' | 'C' | 'D'` to `instagram-carousel` in the action
payload. The renderer owns the visual realization.

---

## 11. Single post.  S-template decision

Default at-Active template is **S1 (Just Listed)**. The full S-template catalog:

| Template | Use | Default trigger |
|---|---|---|
| **S1** | Just Listed | At-Active (this kit's default) |
| **S2** | Just Sold | At-Sold (separate producer: `sold-deal-summary`) |
| **S3** | Open House | When an open house is scheduled.  can run in this kit if `open_house_date` provided |
| **S4** | Coming Soon | Pre-Active (separate producer: `coming-soon-teaser`) |
| **S5** | Price Improvement | Status change to Price Reduced (separate trigger) |
| **S6** | Featured Listing of the Week | Editorial / curated brand-led pick (separate trigger) |
| **S7** | Agent Intro | Broker / team intro (separate trigger) |
| **S8** | Brag Stat | A specific stat about the brokerage (separate trigger) |
| **S9** | Press Feature | When Ryan Realty earns a press mention (separate trigger) |
| **S10** | Market Data Card | Per-city / per-neighborhood market stat (separate producer) |

All 1080×1350. Brand fonts only (Amboqia display, Geist body, Azo Sans Medium accent. 
arched-ribbon use only). Navy `#102742` on cream `#faf8f4`. No gold.

The orchestrator passes `template: 'S1'` (or whichever Matt names) to `ig-single-post` in the
action payload. The renderer owns the visual realization.

---

## 12. Captions.  H&H tag-block format

Every IG post (carousel and single-post) ships with a caption. Two formats:

### Default (Patterns A / B / C and S-templates)

```
[Location-anchored opening.  neighborhood or street name, one specific anchor]

[Materials / architecture / construction-detail middle.  1-3 specific facts pulled from PublicRemarks]

[Lifestyle close.  one specific local detail: trail, brewery, school, view, drive time]

》 [Address]  ·  [Price]  ·  [BR/BA]  ·  [acres or sqft]

#RyanRealtyBend
#BendOregon
#BendRealEstate
#[Neighborhood]Bend
#CentralOregonRealEstate
```

### Panorama variant (Pattern D only)

Identical structure, but the opening reads:

```
SWIPE → | [hook]
```

…to invite the swipe.

### Caption hard rules

1. **`#RyanRealtyBend` MUST be the first hashtag in the trailing block.** This is the locked rule
   from CLAUDE.md "Voice + content" (2026-05-14). Captions missing it are non-compliant.
2. **No banned vocab.** Run captions through the brand-voice validator against the full union
   from `marketing_brain_skills/brand-voice/voice_guidelines.md` §6.
3. **No exclamation marks** in body prose. (One per caption max if absolutely needed at the close.  but the brand voice rules say "rare." Default is zero.)
4. **No em-dashes, no semicolons** in caption body. The 》separator IS allowed (it's a glyph,
   not punctuation).
5. **Price rounded** to the nearest thousand: `$895,000`, never `$894,750`.
6. **Acres or sqft**.  pick the more relevant. Lot-dominant listings use acres; structure-dominant
   listings use sqft.
7. **Neighborhood name in hashtags** must match `SubdivisionName` from the Supabase row when
   present; falls back to city name when not.

### Captions for non-hashtag-supporting platforms

Per CLAUDE.md "Voice + content," **don't inject hashtags** into surfaces that don't honor them.
The kit's captions are for IG / FB / TikTok / Threads / X / Pinterest / YouTube descriptions.
For blog body, email body, broker email signatures, FUB lead-nurture emails.  caption emission
is OUT OF SCOPE for this orchestrator (those are handled by their own producers).

---

## 13. QA gate

### Per-deliverable gates (delegate to each sub-skill)

**Video** (full spec in `listing-tour-video/SKILL.md`):
- `ffprobe` duration in [30s, 45s]
- `ffmpeg blackdetect` (pix_th=0.05) returns zero sequences
- Frame at 0s has motion + content
- No frozen frames at beat boundaries
- No logo / "Ryan Realty" / phone / agent name in any frame except footer bar
- File < 100 MB
- Banned-words grep clean
- All on-screen numbers trace to `kit-manifest.json`
- Navy footer bar (not gold).  v2 brand

**Flyers** (full spec in `flyer-design/SKILL.md`):
- All figures trace to the same Supabase pull
- No banned words in any copy block
- Broker footer present and accurate
- `PublicRemarks` sanitized (banned words removed or block left blank)
- No AI-generated property photos
- Heritage wordmark as pre-rendered image, never re-typeset
- `design_review_checklist.json` all `pass`

**Carousel** (full spec in `instagram-carousel/SKILL.md`):
- Pattern A: 10 slides, every photo unique, persistent footer
- Pattern B: 1 slide, top-scrim only, Amboqia headline
- Pattern C: 1 slide, bottom-scrim, Geist 500 caption, Azo Sans Medium eyebrow
- Pattern D: 3 slides, panorama continuity verified at swipe boundaries
- All on-screen numbers trace
- No banned words

**Single post** (full spec in `ig-single-post/SKILL.md`):
- Template-specific layout passes
- All on-screen numbers trace
- No banned words

**Captions** (this skill enforces):
- `#RyanRealtyBend` first in trailing hashtag block
- No banned vocab (validator)
- No em-dashes, no semicolons in body
- 》separator on the tag line
- Pattern D caption opens with `SWIPE → |`

### Kit-level gate (after all per-deliverable gates pass)

- All 6 deliverable groups present or accounted for (failure noted with reason)
- `kit-manifest.json` exists and contains a verification trace for every numeric figure
- All figures consistent across deliverables (same price, same specs.  no drift)
- No deliverable references a figure not in the Supabase pull
- `kit_status` in manifest = `"draft"` (never auto-set to `"approved"`)

Failure on any item: halt, surface to Matt with the specific failure, offer to fix before
presenting.

---

## 14. Draft surface format

When all deliverables are ready (or visibly failed with diagnosis), present to Matt in one
message:

```
List Kit ready for review.  <StreetNumber> <StreetName>, <City>

  VIDEO
    Path: out/list-kits/<slug>/video/<slug>.mp4
    Duration: <Xs> · Size: <N> MB · Beats: <N>
    Scorecard: <N>/100 (ship floor: 85)

  FLYERS
    Just Listed:      out/list-kits/<slug>/flyers/just-listed.png
    Feature Sheet:    out/list-kits/<slug>/flyers/feature-sheet.pdf +.png
    Open House:       out/list-kits/<slug>/flyers/open-house.png +.pdf
                      [or: SKIPPED.  no open house date provided]

  CAROUSEL
    Pattern: <A | B | C | D>
    Slides: out/list-kits/<slug>/carousel/slide-01.png … slide-NN.png
    Slide count: N

  SINGLE POST
    Template: <S1 |... | S10>
    Path: out/list-kits/<slug>/single-post/post.png

  CAPTIONS
    Carousel caption:  out/list-kits/<slug>/captions/carousel-caption.md
    Single post:       out/list-kits/<slug>/captions/single-post-caption.md
    #RyanRealtyBend: present in both ✓
    Voice validation:  out/list-kits/<slug>/captions/caption-validation.json

  VERIFICATION TRACE
    <N> figures verified.  kit-manifest.json:
    - $<price> ListPrice.  Supabase listings, MlsId='<id>', fetched <iso>
    - <N> bd.  Supabase listings, MlsId='<id>', BedroomsTotal = <N>
    - <N> ba.  Supabase listings, MlsId='<id>', BathroomsTotal = <N>
    - <N> sqft.  Supabase listings, MlsId='<id>', TotalLivingAreaSqFt = <N>
    [... one line per figure]

  KIT MANIFEST
    out/list-kits/<slug>/kit-manifest.json

Reply "ship it" to move to public/list-kits/<slug>/ and commit + push.
```

Then stop. Do not commit. Do not push. Do not move any file. Wait for Matt's explicit approval.

---

## 15. Publish step (post-approval)

When Matt says "ship it" / "go" / "approved" / "publish":

1. **Copy deliverables to public:**
   ```
   public/list-kits/<slug>/video/<slug>.mp4
   public/list-kits/<slug>/flyers/*
   public/list-kits/<slug>/carousel/slide-*.png
   public/list-kits/<slug>/single-post/post.png
   public/list-kits/<slug>/captions/*.md
   public/list-kits/<slug>/kit-manifest.json (update kit_status: "approved")
   ```

2. **Register in asset library** (§9).

3. **Update the `marketing_brain_actions` row:**
   ```sql
   UPDATE marketing_brain_actions
   SET status='executed',
       executor_response='{"draft_path":"public/list-kits/<slug>/","kit_status":"approved","deliverable_count":<N>}'::jsonb
   WHERE id='<action_id>';
   ```

4. **git add** specific files only (not `git add -A`.  `out/` is gitignored).

5. **Commit** with message referencing MLS# and deliverable count.

6. **Push to origin/main immediately**.  no "saved locally" commits.

7. **Optional: queue to publisher**.  only if Matt explicitly says "and publish to social" or
   "schedule it." Routes through `automation_skills/automation/publish/`. Each platform post gets
   a platform-specific caption derived from §12 + the platform best-practices skill.

---

## 16. Action row contract

The producer reads from `marketing_brain_actions`:

```typescript
interface ListKitAction {
  id: string                  // uuid
  action_type: 'content:list_kit'
  target: string              // 'mls:<MlsId>' or 'address:<slug>'
  assigned_producer: 'social_media_skills/list-kit'
  payload: {
    mls_id?: string
    address?: string
    city?: string
    carousel_pattern?: 'A' | 'B' | 'C' | 'D'   // default A
    single_post_template?: 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9' | 'S10'   // default S1
    open_house_date?: string  // ISO datetime
    voice_pattern?: 'default' | 'panorama'  // panorama auto-set when carousel_pattern='D'
  }
  data_evidence?: jsonb
  status: 'pending'
}
```

Status flow per `TEMPLATE.md` §8:

```
pending → in_production → ready → approved → executed → measured
```

---

## 17. What not to do

1. **Never fabricate property facts.** If `BedroomsTotal` is null, show `. ` on the deliverable.
   Do not guess from photos or square footage.
2. **Never use AI-generated property photos.** Every photo comes from `"PhotoURL"`. Per
   `ANTI_SLOP_MANIFESTO.md`: ship-blocker.
3. **Never deliver a partial kit silently.** All 6 deliverable groups ship together. If one
   fails, fix it or surface it.  do not ship 5 of 6 and call it done.
4. **Never push without Matt's approval.** A successful render, a passing QA gate, a complete
   `kit-manifest.json`.  none of these are approval.
5. **Never inherit numbers from chat context, prior sessions, briefs, or web articles.** Pull
   fresh from Supabase, verify match, every time.
6. **Never use gold** in any kit deliverable. Monochrome navy `#102742` on cream `#faf8f4` is
   the v2 brand. `#D4AF37` / `#C8A864` are retired tokens.
7. **Never re-typeset the wordmark.** Use pre-rendered images from `assets/brand/` only.
8. **Never use banned vocab.** Run every caption / VO / flyer copy / carousel text through the
   voice_guidelines.md banned list before render.
9. **Never skip the carousel pattern decision.** Default A is fine, but the decision is recorded
   in `pattern.json` and `kit-manifest.json`.  never silent.
10. **Never publish to social without separate caption review.** Commit + push is the default.
    Social distribution is opt-in, requires explicit instruction, and requires the caption to
    have passed §12's hard rules.
11. **Never mix patterns in the same listing.** Pick A, B, C, or D.  never two.
12. **Never ship a caption missing `#RyanRealtyBend`** on any IG / FB / TikTok / Threads / X /
    Pinterest / YouTube surface. CLAUDE.md "Voice + content".  locked 2026-05-14.

---

## 18. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Listing not found | `WHERE "MlsId"=...` returns 0 rows | Report exact input, ask Matt to verify or supply MLS# |
| Multiple address matches | Fuzzy match returns >1 row | Present candidates, ask Matt to disambiguate |
| Photo set < 4 distinct | Pattern A needs ≥10, flyer needs ≥4 | Surface to Matt. Offer: backfill from Spark, downgrade Pattern A to A-collapsed (fewer slides), or skip carousel |
| Pattern D requested without aerial | No wide drone shot in PhotoURL | Surface to Matt. Offer: source drone, downgrade to A |
| `PublicRemarks` contains banned vocab | Banned-word grep hits in remarks | Strip the offending sentences. If remarks become empty, leave the property description block blank.  do not paraphrase/rewrite |
| Voice validation fails | Caption voice fingerprint score < threshold | Re-write the caption. Max 2 auto-iterations. Then surface to Matt with the specific rule citation |
| Render timeout | Remotion / compositor process hangs > 10 min | Kill the process, report last successful frame + error log |
| Carousel pattern asset miss | logo-blue.png, fonts not on disk | Stop. Report missing assets. Do not fall back to system fonts |
| Missing env var | Supabase / API key not set | Report which var, which tool. Do not guess or hard-code |

---

## 19. See also

- `social_media_skills/instagram-carousel/SKILL.md`.  Patterns A/B/C/D renderer
- `social_media_skills/ig-single-post/SKILL.md`.  S1-S10 single-image renderer
- `social_media_skills/flyer-design/SKILL.md`.  flyers
- `video_production_skills/listing-tour-video/SKILL.md`.  listing video
- `video_production_skills/listing_reveal/SKILL.md`.  overlay system
- `video_production_skills/asset-library/SKILL.md`.  manifest registration
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md`.  Section A row
- `automation_skills/content_engine/SKILL.md`.  content routing bus
- `social_media_skills/platform-best-practices/SKILL.md`.  2026 platform rules
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  voice + banned vocab
- `design_system/ryan-realty/SKILL.md`.  brand system

**Related listing-moment producers** (separate triggers, not in this kit):

- `social_media_skills/coming-soon-teaser/`.  pre-Active Reel
- `social_media_skills/neighbor-outreach-note/`.  pre-Active handwritten note + flyer
- `social_media_skills/open-house-stories/`.  IG/FB Stories sequence
- `social_media_skills/under-contract-announcement/`.  under-contract static
- `social_media_skills/sold-deal-summary/`.  sold post (IG + LinkedIn)
- `social_media_skills/postcard-farm-mailer/`.  USPS at-list + at-sold
- `social_media_skills/yard-sign-rider/`.  physical signage
- `social_media_skills/linkedin-document-carousel/`.  LinkedIn PDF
- `social_media_skills/agent-coop-eflyer/`.  agent-to-agent email
- `video_production_skills/tiktok-listing-tour/`.  TikTok-optimized video
- `video_production_skills/youtube-long-form-walkthrough/`.  $750K+ YT
- `marketing_brain_skills/producers/site-property-landing/`.  property page
- `marketing_brain_skills/producers/ops-fb-marketplace/`.  FB Marketplace
- `marketing_brain_skills/producers/ops-matterport-embed/`.  Matterport embed
- `marketing_brain_skills/producers/ops-manychat/`.  ManyChat automation

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

## Content-producer additional references

- `automation_skills/content_engine/SKILL.md`
- `social_media_skills/platform-best-practices/SKILL.md`
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`
- `video_production_skills/VIRAL_GUARDRAILS.md`
