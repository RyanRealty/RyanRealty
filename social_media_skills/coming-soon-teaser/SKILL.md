---
name: coming-soon-teaser
description: >
  Pre-Active teaser producer for a single listing. Builds a 10-15 second 9:16 Reel plus a 5-frame
  IG/FB Story sequence, published 3-5 days before the MLS row flips to Active. Pure curiosity-builder:
  single dramatic exterior shot, price reveal (or "price TBD" when unconfirmed), zero interior, zero
  date over-promise. If `expected_active_date_iso` is missing or unverified, the deliverable reads
  "Hitting the market soon" instead of a hard date. Outputs ship to IG Reels, FB Reels, IG Stories,
  and FB Stories. Use whenever Matt says "build a coming soon teaser for <address>", "coming soon
  reel for <MLS#>", "tease this listing", "pre-launch teaser", or "warm up the market for <address>".
when_to_use: |
  Trigger when Matt says any of:
  - "build a coming soon teaser for <address>"
  - "coming soon reel for <MLS#>"
  - "tease this listing"
  - "pre-launch teaser"
  - "warm up the market for <address>"
  - "build a pre-Active teaser for <address or MLS#>"
  - "make a coming soon Story sequence for <address>"
action_types:
  - content:coming_soon_teaser
output_type: text
target_platforms: ["email", "agentfire_blog"]
asset_destination: Supabase asset-library bucket + out/proof/<date>/<slug>/
auto_inputs: ["brand voice rules", "market data from Supabase"]
required_inputs: ["topic OR mls_id"]
optional_inputs: ["tone_override", "length_override"]
estimated_runtime_min: 8
cost_usd_estimate: $0.10-$0.50 per piece (Anthropic tokens for drafting + voice check)
thumbnail_uri: out/proof/2026-05-17/exemplars/<slug>/sample.html
example_outputs: []
    label: "past approved drafts"
    surface: "email"
---

# Coming Soon Teaser.  Pre-Active Reel + Story Sequence

**Status:** Canonical  
**Locked:** 2026-05-17  


**Scope.** Produce a single 10-15 second 9:16 Reel + a 5-frame IG/FB Story sequence for one listing,
3-5 days before its MLS row flips to Active. The teaser leans on a single dramatic exterior frame
and a kinetic price reveal. No interior is shown. No hard date is promised unless
`expected_active_date_iso` is confirmed by Matt in the payload. Companion to `list-kit` (the
at-Active orchestrator that fires the day the listing goes Active) and `social_media_skills/ig-single-post`
S4 (the static single-image variant of the same moment).

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B.  Content Producer.

**Exemplar output:** `out/coming-soon-teaser/<slug>/`.

---

## 1. Required references

| Reference | Why |
|---|---|
| `CLAUDE.md` §0.  Data Accuracy mandate | Every price, every date, every spec on screen traces. Outranks every other rule. |
| `CLAUDE.md` §0.5.  Draft-First, Commit-Last | Render to `out/`, surface, wait for Matt's explicit approval. Outranks every other rule. |
| `CLAUDE.md` §3.  Video Build Hard Rules | Format (1080×1920, 30 fps, h264, < 100 MB), hook spec, banned openings, caption safe zone, banned words. |
| `CLAUDE.md` "Voice + content".  #RyanRealtyBend HARD RULE | Captions for Reel + Stories must lead the trailing hashtag block with `#RyanRealtyBend`. Locked 2026-05-14. |
| `design_system/ryan-realty/SKILL.md` | Heritage register, navy `#102742` + cream `#faf8f4` palette, Amboqia / Geist / Azo Sans Medium type tiers, footer bar conventions, Jax mascot. |
| `design_system/ryan-realty/colors_and_type.css` | Authoritative color + type tokens. |
| `marketing_brain_skills/brand-voice/voice_guidelines.md` | Banned vocab union, voice attributes, do/don't pairs. |
| `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` | Matt's writing fingerprint.  caption tone reference. |
| `automation_skills/content_engine/SKILL.md` | Content router. Every `content:*` action dispatches through here. |
| `social_media_skills/platform-best-practices/SKILL.md` | 2026 platform rule layer.  Reels and Stories specs, hook timing, caption discipline, posting cadence. |
| `video_production_skills/ANTI_SLOP_MANIFESTO.md` | Banned-content gate. |
| `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §3 | Listing video rules.  applies to any listing-tied short-form. |
| `video_production_skills/VIRAL_GUARDRAILS.md` | 100-point scorecard. Teaser floor is 80. |
| `video_production_skills/listing-tour-video/SKILL.md` | Build approach.  this skill is a trimmed, exterior-only, 10-15s subset. |
| `video_production_skills/listing_reveal/SKILL.md` | Two-layer overlay.  Coming Soon teaser uses ONLY the navy footer bar variant (see §6.4); no text scrim mid-frame. |
| `video_production_skills/elevenlabs_voice/SKILL.md` | Victoria voice settings.  only if the caller specifies VO. Silent + text overlay is the default. |
| `video_production_skills/quality_gate/SKILL.md` | QA pass procedure. |
| `marketing_brain_skills/producers/TEMPLATE.md` | Producer skeleton. |
| `marketing_brain_skills/producers/REGISTRY.md` | Section B.  Content Producer row. |

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:coming_soon_teaser` | `mls_id`, `hero_exterior_photo` | Optional: `expected_active_date_iso`, `price`. One call → one Reel + one 5-frame Story sequence. |

### In scope

Pull verified `listings` row by `mls_id`. Validate `hero_exterior_photo` is exterior. Render one
1080×1920 Reel (10-15 s, 30 fps, h264) and a 5-frame 1080×1920 Story PNG sequence. Emit a caption
in the H&H teaser variant with `#RyanRealtyBend` first in the hashtag block. Write `citations.json`,
`provenance.json`, `scorecard.json`. Surface the bundle for review.

### Out of scope

No interior shown.  anywhere. No hard date promised unless `expected_active_date_iso` is confirmed.
No phone, no URL, no agent name, no "Ryan Realty" text anywhere in the Reel frame (the navy footer
bar wordmark on the final 1.0-1.5 s is the only branded element). Does not generate the at-Active
List Kit.  that's `social_media_skills/list-kit`, which fires the day the listing goes Active.
Does not publish; surfaces a draft and waits for Matt. If only one exterior is available, frames
2 and 3 use two distinct Ken-Burns crops of the same source.  never a literal duplicate.

---

## 3. Brief payload schema

```typescript
interface ComingSoonTeaserPayload {
  // Required
  mls_id: string                       // Supabase "MlsId".  used to pull verified row
  hero_exterior_photo: string          // Local path or URL to a SINGLE exterior shot.
                                       // Producer validates exterior-ness before render.

  // Optional
  expected_active_date_iso?: string    // ISO date (YYYY-MM-DD). If absent → "Hitting soon" copy.
                                       // If present, producer cross-checks against Supabase
                                       // (any seller-confirmed date field) before rendering.
  price?: number                       // List price in dollars. If absent → "Listed soon.  price TBD".
                                       // If present, rounded to nearest $1,000 on display.
}

interface ComingSoonTeaserActionRow {
  id: string                           // uuid from marketing_brain_actions
  action_type: 'content:coming_soon_teaser'
  target: string                       // e.g. 'mls:220189422'
  assigned_producer: 'social_media_skills/coming-soon-teaser'
  payload: ComingSoonTeaserPayload
  data_evidence: {
    audit_source?: string              // e.g. 'pre_active_calendar_watcher'
    expected_active_date?: string      // raw evidence string from the audit
    signal_evidence?: string
  }
  generation_reason: string            // e.g. 'Listing flips Active in 4 days.  teaser ships now'
  status: 'pending'                    // always pending when producer first reads
}
```

If `hero_exterior_photo` is missing → surface to caller. If the path / URL fails to resolve →
surface to caller. Never render with a stand-in.

---

## 4. The recipe

### Step 1.  Read the action row

Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately:

```sql
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';
```

### Step 2.  Load mandatory references

Read every file in §1 before touching the deliverable.

### Step 3.  Pull and verify the listing row

Per CLAUDE.md §0, every number traces to a fresh Supabase pull. Never trust the payload's
`price` without re-confirming.

```sql
SELECT
  "MlsId",
  "StreetNumber",
  "StreetName",
  "City",
  "ListPrice",
  "StandardStatus",
  "PhotoURL",
  "ListAgentFullName",
  "ListAgentEmail",
  "BedroomsTotal",
  "BathroomsTotal",
  "TotalLivingAreaSqFt",
  "SubdivisionName"
FROM listings
WHERE "MlsId" = '<mls_id>'
LIMIT 1;
```

Print the row to the log. Capture `fetched_at_iso = now()` for citations.

**Status gate:** if `"StandardStatus"` is already `'Active'`, **stop and surface**.  the at-Active
moment has already passed, the teaser is non-applicable, and the caller should fire `list-kit`
instead.

**Price gate:** if `payload.price` is provided AND the Supabase `"ListPrice"` value is non-null
AND they disagree by more than $1,000 → stop and surface the conflict to Matt with both values
and ask which one ships. Never invent a value.

### Step 4.  Validate the hero photo is exterior

(a) File presence.  path / URL resolves; 404 → surface. (b) Exterior validation.  if the image
shows any interior element (room walls, kitchen counter, furniture, ceiling fixtures, indoor
flooring), stop and surface. Acceptable subjects: street-side facade, driveway-side view, rear
yard, side elevation, drone aerial, twilight exterior, hero gable, porch from outside. If
ambiguous, surface to Matt for a one-line confirmation. If only one approved exterior exists for
the listing, do NOT swap photos.  use the same source for the full teaser via two Ken-Burns crops
(§6.5).

### Step 5.  Resolve the date copy

If `expected_active_date_iso` is present, between 1 and 10 days from today, and confirmed (audit
row in `data_evidence.expected_active_date` or a matching Supabase date field): copy reads
**"Hitting <Month> <day>"** (e.g. `Hitting May 24`; no year if same year). Otherwise (absent,
in the past, > 10 days out, or unconfirmed): copy reads **"Hitting the market soon"** everywhere.  Reel, Story frame 04, caption. **Never invent a date.** "Hitting May 24" when the listing
actually goes Active May 28 is worse than "Hitting soon."

### Step 6.  Resolve the price copy

If `payload.price` matches Supabase `"ListPrice"`: copy reads **"Listed at $<price>"** with the
integer rounded to the nearest $1,000 (e.g. `Listed at $895,000`). Otherwise: copy reads
**"Price TBD"** everywhere. Never invent.

### Step 7.  Build the Reel + Story sequence

See §6.2-6.5 for the full render spec.

### Step 8.  Emit the caption, run QA, write citations + provenance

Caption per §6.6. QA gate per §9 → `scorecard.json`. `citations.json` with one entry per on-screen
figure (price, beds/baths/sqft if shown, expected active date if shown). `provenance.json` with
one entry per photo used (source, license, file name, MLS system).

### Step 9.  Transition status to ready

```sql
UPDATE marketing_brain_actions
SET status='ready',
    executor_response=$$
    {
      "draft_path": "out/coming-soon-teaser/<slug>/",
      "reel_path": "out/coming-soon-teaser/<slug>/reel.mp4",
      "story_path": "out/coming-soon-teaser/<slug>/stories/",
      "caption_path": "out/coming-soon-teaser/<slug>/caption.md",
      "scorecard": { "<gate>": "<pass|fail>",... }
    }
    $$::jsonb
WHERE id='<id>';
```

### Step 10.  Surface to Matt

See §8 for the exact surface format. Stop. Do not commit. Do not push. Wait.

---

## 5. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing row pull + action row transitions | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, project `dwvlophlbvvygjfxcrhm` |
| Remotion | Reel render (10-15 s, 1080×1920, 30 fps) | `cd listing_video_v4 && npx remotion render` |
| node compositor | Story frame render (5 × 1080×1920 PNGs) | `lib/render-coming-soon-stories.mjs` |
| ElevenLabs API | OPTIONAL Victoria VO if caller requests | `ELEVENLABS_API_KEY`, voice `qSeXEcewz7tA0Q0qk9fH` |
| ffprobe | duration / codec / black-frame QA | static-ffmpeg via `listing_video_v4/scripts/` |
| asset-library CLI | register Reel + Story PNGs after Matt approves | `lib/asset-library.mjs` |

---

## 6. Output spec

### 6.1 File structure

```
out/coming-soon-teaser/<slug>/
├── reel.mp4                       ← 10-15 s, 1080×1920, h264, < 30 MB target
├── stories/
│   ├── frame-01.png               ← teaser text card
│   ├── frame-02.png               ← hero Ken-Burns crop A
│   ├── frame-03.png               ← hero Ken-Burns crop B
│   ├── frame-04.png               ← date or "Hitting soon"
│   └── frame-05.png               ← ManyChat keyword CTA
├── caption.md                     ← caption for IG/FB Reel + Stories
├── citations.json                 ← one entry per on-screen figure
├── provenance.json                ← photo source / license
├── fonts_used.json                ← exact font files embedded
└── scorecard.json                 ← QA gate results
```

`<slug>` derives from the listing: `<mls_id>-<street-name-lowercased>` (e.g.
`220189422-nw-riverview-drive`).

### 6.2 Reel.  format and beats

**Format:** 1080 × 1920 px sRGB, 30 fps, h264 + aac faststart, target < 30 MB, hard cap < 100 MB.
9:16 aspect. No black bars. Default duration 12 s; window 10-15 s strict.

**Four phases** (hero exterior carries the post; kinetic overlay carries the reveal):

| Phase | Time | What's on screen |
|---|---|---|
| **Hook** | 0.0 → 1.0 s | Hero exterior with push-in or slow Ken-Burns active by frame 12 (0.4 s). Address eyebrow on screen by frame 30 (1.0 s): Azo Sans Medium 36 px UPPERCASE, letter-spacing 0.16em, cream `#faf8f4`, 16 px shadow. No logo. No "Ryan Realty" text. |
| **Lift** | 1.0 → 7.0 s | Hero continues. Address resolves to full street + city. At 3.5-4.5 s, "COMING SOON" fades up.  Amboqia Boriango 88 px cream over a `rgba(16,39,66,0.40)` text-zone scrim (hard rectangle, no feathering, scoped to text only). |
| **Reveal** | 7.0 → 11.0 s | Date copy fades in under the headline.  Geist 500 32 px ("Hitting May 24" or "Hitting the market soon"). At ~9.0 s, price line ("Listed at $895,000" or "Price TBD") appears below.  Geist 500 28 px, tabular-nums, cream over scrim. |
| **Brand** | 11.0 → 12.0 s (up to 15 s) | Hero holds. Navy footer bar slides up from y=1720 to y=1920, opacity `rgba(16,39,66,0.94)`. Wordmark `design_system/ryan-realty/assets/brand/logo-white.png` (reversed heritage), 64 px tall, vertically centered, 40 px from left. End. |

**Hook compliance** (CLAUDE.md §3): motion engaged by frame 12 ✓; on-screen text by frame 30 ✓;
no banned opening (no logo at frame 0, no title card on black, no slow boundary draw, no agent
intro); first content is content (address + COMING SOON), never "REPRESENTED BY".

### 6.3 Reel.  overlay system

**Navy footer bar only** variant of the listing overlay system.  not the two-layer text-scrim +
footer-bar combination from `listing_reveal/SKILL.md`. A persistent mid-frame scrim would
over-cover the exterior and defeat the curiosity build. The footer bar appears only in Phase 4.

**Footer bar (Phase 4 only):** y=1720→1920, 200 px tall, flush bottom, `rgba(16,39,66,0.94)`,
wordmark `logo-white.png` at 64 px tall, vertically centered, 40 px from left. No phone, no URL,
no agent name. Footer is **navy** (not gold).  Design System v2 retired both `#D4AF37` and
`#C8A864`.

**Text-zone scrim (Phases 2 + 3 only):** `rgba(16,39,66,0.40)` covering only the COMING SOON +
date + price block. Hard rectangle. No feathering. No drop shadow. No `text-shadow`. No
`filter: drop-shadow(...)`. Photo shows through at 60%. Disappears in Phase 4.

### 6.4 Single-photo handling

If only one approved exterior exists: use the same source for the full 12 s with two distinct
Ken-Burns crops in sequence (Phases 1-2 = wide crop, slow push toward front entry / hero feature;
Phases 3-4 = tighter crop, slow slide-left over gable or signature detail). Never reuse the same
focal region twice in the same render. Same principle as the carousel "never repeat a photo
across slides" rule.

### 6.5 Story sequence.  5 frames

Each frame is 1080×1920 PNG, sRGB, < 1.5 MB each.

| Frame | Composition |
|---|---|
| **01.  Teaser text card** | Cream `#faf8f4` background. Centered Azo Sans Medium 20 px UPPERCASE eyebrow "PRE-LAUNCH · BEND, OREGON" (letter-spacing 0.16em, navy). Below it, Amboqia Boriango 112 px navy "Coming Soon" headline (line-height 1.05). Below that, Geist 400 26 px navy 0.65 opacity sub-line: "A new listing is about to hit the market." No price. No date. No address. Persistent navy footer bar at y=1720→1920 with logo-white.png 64 px tall, vertically centered, 40 px from left. |
| **02.  Hero Ken-Burns A** | Full-bleed hero exterior. Slow push-in starting at 100% and ending at 108% across the 5 s view window. Bottom-zone text-scrim `rgba(16,39,66,0.40)` y=1400→1720 covering ONLY the text band. Inside the scrim: Azo Sans Medium 18 px UPPERCASE cream "COMING SOON" eyebrow, then Amboqia 56 px cream street address (e.g. `1234 NW Riverview Drive`). Persistent navy footer bar with wordmark. |
| **03.  Hero Ken-Burns B** | Full-bleed hero exterior, different crop / focal region than Frame 02 (per §6.5). Slow slide-left. Bottom-zone text-scrim same dimensions as Frame 02. Inside the scrim: Geist 500 24 px cream tabular-nums beds/baths/sqft or acres line.  e.g. `4 bd  ·  3 ba  ·  2,840 sqft`. Persistent navy footer bar. **Show only the specs that are confirmed in Supabase.** Any missing spec → omit the bullet, do not write "TBD" mid-line. |
| **04.  Date frame** | Cream background. Centered. If `expected_active_date_iso` is confirmed: Azo Sans Medium 18 px UPPERCASE navy "HITTING THE MARKET" eyebrow at y=720. Below it, Amboqia 140 px navy tabular-nums "<Month> <day>" (e.g. `May 24`) at y=820. If date is unconfirmed: single Amboqia 84 px navy line "Hitting the market soon" at y=820, no eyebrow. Below either variant at y=1100: Geist 500 30 px navy tabular-nums "Listed at $<price>" or "Price TBD". Persistent navy footer bar. |
| **05.  ManyChat CTA** | Navy `#102742` full-bleed background. Centered. Amboqia 60 px cream `#faf8f4` headline at y=720: "Want the address?" Below it at y=860, Geist 500 30 px cream: "Comment **DETAILS** below." (the word "DETAILS" in Azo Sans Medium 30 px UPPERCASE letter-spacing 0.12em, cream 0.95 opacity, no exclamation mark). Below that at y=1020, Geist 400 22 px cream 0.65 opacity: "We'll DM the listing the second it goes live." Persistent navy footer bar (same logo-white.png 64 px). No phone number, no URL, no broker name. The ManyChat keyword loop (per platform-best-practices) drives the address out via DM, not the post itself. |

### 6.6 Caption

Caption emits in the H&H teaser variant.  short, curiosity-driven, no fact-dump. Reads on IG, FB,
and is identical for the Reel and the Story sequence (Stories can reuse it as the caption on
frame 5).

```
A new one in <neighborhood or city> is about to hit.

<one sentence about the listing's hook.  exterior cue, lot, era, style.  no interior, no specs>

<one sentence about timing.  "Going Active <date>." OR "Going Active in the next few days.">

》 Comment DETAILS for the address and price the second it goes live.

#RyanRealtyBend
#BendOregon
#BendRealEstate
#ComingSoon
#<NeighborhoodBend>
#CentralOregonRealEstate
```

`#RyanRealtyBend` MUST be first in the hashtag block. HARD RULE per CLAUDE.md "Voice + content,"
locked 2026-05-14.

---

## 7. Approval gate

`matt-review-draft`.  Matt sees the Reel + Story frames + caption + scorecard and says "ship it"
/ "approved" / "go". Silence is not approval. Successful QA is not approval. Outranks every
autonomy convenience rule (CLAUDE.md §0.5).

---

## 8. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ Reel + Stories built, QA passed, citations.json written
        ▼
      ready        ← executor_response populated with draft paths + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ content_engine publishes (IG Reel + FB Reel + IG Story sequence + FB Story sequence)
        ▼
    executed       ← terminal success
        │ 48 h post-publish
        ▼
    measured       ← performance_loop writes Reel + Story metrics

    killed         ← terminal failure; set if Matt cancels, exterior validation fails twice,
                     or the listing flips Active before publish (teaser is moot)
```

SQL transitions:

```sql
-- Pickup
UPDATE marketing_brain_actions
SET status='in_production', executed_at=now()
WHERE id='<id>' AND status='pending';

-- Draft ready
UPDATE marketing_brain_actions
SET status='ready',
    executor_response='{"draft_path":"out/coming-soon-teaser/<slug>/","scorecard":{...}}'::jsonb
WHERE id='<id>';

-- Matt approves
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

### Surface format (present to Matt exactly like this)

```
Draft ready: coming-soon-teaser.  <street address> · <city>

  REEL
    Path: out/coming-soon-teaser/<slug>/reel.mp4
    Duration: 12.0 s ✓ (10-15 s window)
    Dimensions: 1080 × 1920 ✓
    File size: <X> MB ✓
    Scorecard: <Y>/100

  STORY SEQUENCE
    Frame 01 (teaser card):       out/coming-soon-teaser/<slug>/stories/frame-01.png
    Frame 02 (hero Ken-Burns A):  out/coming-soon-teaser/<slug>/stories/frame-02.png
    Frame 03 (hero Ken-Burns B):  out/coming-soon-teaser/<slug>/stories/frame-03.png
    Frame 04 (date):              out/coming-soon-teaser/<slug>/stories/frame-04.png
    Frame 05 (ManyChat CTA):      out/coming-soon-teaser/<slug>/stories/frame-05.png

  CAPTION
    Path: out/coming-soon-teaser/<slug>/caption.md
    #RyanRealtyBend leads the hashtag block ✓
    Banned-words grep clean ✓

  VERIFICATION TRACE
    - $895,000.  Supabase listings, MlsId='220189422', "ListPrice", fetched 2026-05-14T14:32:00Z
    - Hitting May 24.  payload.expected_active_date_iso='2026-05-24', confirmed via Matt
    - 4 bd · 3 ba · 2,840 sqft.  Supabase listings, MlsId='220189422', fetched 2026-05-14T14:32:00Z

  CITATIONS
    out/coming-soon-teaser/<slug>/citations.json

Reply "ship it" / "approved" / "go" to commit + push.
```

Then stop. Do not commit. Do not push. Wait.

---

## 9. QA gate

Run before surfacing the draft. Write results to `scorecard.json`. Any `fail` is a non-ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Reel duration | `ffprobe` duration in [10.0, 15.0] s. Out-of-range = non-ship. |
| 2 | Reel dimensions | Exactly 1080 × 1920 px, h264 + aac. |
| 3 | Reel file size | < 30 MB (Reels target). Hard cap < 100 MB per CLAUDE.md §3. |
| 4 | Hook compliance | Motion engaged by frame 12; address eyebrow on screen by frame 30; no banned opening (no logo at frame 0, no title card on black, no slow boundary draw). |
| 5 | Exterior-only check | All Reel frames + all Story frames 02 + 03 show exterior content only. Visual scrub.  no interior wall, no kitchen counter, no furniture, no ceiling fixture. |
| 6 | Date copy correctness | If `expected_active_date_iso` is unconfirmed, copy reads "Hitting the market soon" / "Hitting soon" everywhere.  Reel, Story frame 04, caption. If confirmed, copy reads "Hitting <Month> <day>" everywhere and matches the payload date. |
| 7 | Price copy correctness | If `price` is absent, copy reads "Price TBD" / "Listed soon.  price TBD" everywhere. If present, copy reads "Listed at $<rounded>" everywhere and matches Supabase `ListPrice` ± $1,000. |
| 8 | Brand restraint in Reel | No phone, no URL, no agent name, no "Ryan Realty" text in any Reel frame. The only branded element is the navy footer bar wordmark in Phase 4. |
| 9 | Brand color compliance | Navy `#102742` + cream `#faf8f4` only. No gold (`#D4AF37`, `#C8A864`). No off-brand hex. |
| 10 | Font integrity | Amboqia Boriango, Geist, Azo Sans Medium all loaded from disk; no system fallback in render. |
| 11 | Tabular numerals | Every price, count, day figure has `font-variant-numeric: tabular-nums`. |
| 12 | Banned-words grep | Grep on-screen text + caption against the banned vocab union (§ voice_guidelines.md). Zero hits. |
| 13 | Caption #RyanRealtyBend | Caption leads its trailing hashtag block with `#RyanRealtyBend`. |
| 14 | Caption hygiene | No em-dashes, no semicolons, no exclamation marks in body. |
| 15 | Citations shipped | `citations.json` present, one entry per on-screen figure with source / filter / fetched_at. |
| 16 | Provenance shipped | `provenance.json` present, one entry per photo used. |
| 17 | Scorecard floor | Viral scorecard ≥ 80 per `VIRAL_GUARDRAILS.md` listing-format minimum. |
| 18 | Story frame dimensions | Each Story PNG exactly 1080 × 1920, < 1.5 MB each. |
| 19 | Story frame 05 keyword | Frame 05 contains a ManyChat keyword instruction ("Comment DETAILS"). No phone, no URL. |
| 20 | Re-confirm Active status | One more Supabase pull immediately before render: if `"StandardStatus" = 'Active'`, kill.  teaser is moot. |

---

## 10. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Interior photo selected as hero | `hero_exterior_photo` shows indoor content (walls, furniture, kitchen, ceiling) | Stop. Surface to caller. Ask for an exterior shot. Do NOT auto-swap to a different photo from the set without Matt's say-so. |
| No exterior photos available | Listing has only interior photos in MLS | Surface to Matt with: "No exterior on this listing. Options: (a) Matt sends a phone-shot exterior, (b) Matt drives by tomorrow and shoots one, (c) skip the teaser and go straight to the at-Active List Kit." Do not render. |
| Date confirmed wrong after render | Seller calls Matt and pushes the active date | Set `status='killed'`. Open a new `content:coming_soon_teaser` action row with the new date. Re-render. Old draft files stay in `out/` (gitignored) for audit. |
| Price changes after render | List price negotiated up or down before Active | Set `status='killed'`. Same recovery as date change.  new action row, new render. |
| Listing flips Active before publish | Seller decides to go live early | Set `status='killed'`. Surface to Matt.  fire `social_media_skills/list-kit` immediately instead. Teaser was supposed to land 3-5 days BEFORE Active; if Active is now, the teaser is non-applicable. |
| Supabase `"StandardStatus"` already Active at pickup | Action row was queued late | Same as above.  kill the row, surface, fire list-kit. |
| Payload price disagrees with Supabase by > $1,000 | Stale price in payload | Stop. Surface both values. Ask Matt which one ships. Do not auto-resolve. |
| Banned-vocab hit in caption | Grep returns "stunning", "nestled", "breathtaking", etc. | Stop. Rewrite the caption. Re-grep. Do not surface until clean. |
| Font fails to load at render | Amboqia / Geist / Azo Sans Medium not on disk | Stop. Report missing font file. Do not ship with a system fallback. |
| Reel duration drifts outside 10-15 s | Render times out at 17 s, or Remotion outputs 9.8 s | Trim or extend the hold frame at the end. Re-render. Two attempts max.  after two failures surface to Matt. |
| Black frame at boundary | `ffmpeg blackdetect` returns a sequence | Inspect the boundary; usually a Sequence overlap issue or a missing `transparent` on a parent div. Fix and re-render. |
| ManyChat keyword conflict | Frame 05 instructs "Comment DETAILS" but the configured ManyChat automation uses a different keyword | Surface to Matt. Sync the frame copy to the live ManyChat config before publishing. |
| Open spec question.  VO requested but caller didn't specify a script | Caller says "add VO" but provides no copy | Default behavior: ask Matt for the line. Two-clause max, Victoria voice per `elevenlabs_voice/SKILL.md`. Never auto-script VO for a teaser.  the silent + on-screen text version is the default ship state. |

---

## 11. What not to do

1. **Never show any interior**.  Reel or Story frames 02/03. The teaser builds curiosity by
   withholding; interior breaks the contract.
2. **Never invent a date.** Confirmed → "Hitting <Month> <day>". Otherwise "Hitting the market soon."
3. **Never invent a price.** Confirmed → "Listed at $<rounded>". Otherwise "Price TBD."
4. **Never put a phone number, URL, agent name, or "Ryan Realty" text in the Reel frame.** Navy
   footer bar wordmark on the final 1.0-1.5 s is the only branded element.
5. **Never use gold** (`#D4AF37`, `#C8A864`.  retired by Design System v2). Footer is navy.
6. **Never use the full two-layer text-scrim + footer-bar listing-reveal combo.** Coming Soon is
   a curiosity moment, not a property tour.  navy-footer-only with text-zone scrim scoped to the
   headline band.
7. **Never re-typeset the wordmark.** Always the pre-rendered PNG.
8. **Never duplicate the photo across Story frames 02 + 03** (use two distinct Ken-Burns crops).
9. **Never publish without the caption passing #RyanRealtyBend + banned-vocab gates.**
10. **Never push before Matt's explicit approval.** A passing QA gate is not approval. Words Matt
    actually says ("ship it" / "approved" / "go") are approval. CLAUDE.md §0.5.

---

## 12. See also

- `social_media_skills/list-kit/SKILL.md`.  at-Active orchestrator (fires the day the listing
  goes Active; coming-soon-teaser fires 3-5 days before)
- `social_media_skills/ig-single-post/SKILL.md`.  S4 Coming Soon static variant (one 1080×1350
  PNG for the IG feed; this skill is the dynamic Reel + Story variant)
- `social_media_skills/instagram-carousel/SKILL.md`.  multi-slide format (used at-Active, not
  pre-Active)
- `video_production_skills/listing-tour-video/SKILL.md`.  full at-Active listing video (this
  skill is a trimmed exterior-only subset)
- `video_production_skills/listing_reveal/SKILL.md`.  overlay system reference (Coming Soon uses
  navy footer bar only, not the full two-layer combination)
- `video_production_skills/elevenlabs_voice/SKILL.md`.  Victoria voice settings (only if VO is
  requested; silent + text overlay is the default)
- `video_production_skills/quality_gate/SKILL.md`.  QA pass procedure
- `video_production_skills/asset-library/SKILL.md`.  register Reel + Story PNGs after approval
- `automation_skills/content_engine/SKILL.md`.  content router
- `marketing_brain_skills/producers/TEMPLATE.md`.  producer skeleton
- `marketing_brain_skills/producers/REGISTRY.md`.  Section B.  Content Producer row
- `marketing_brain_skills/brand-voice/voice_guidelines.md`.  banned vocab union, voice
  attributes
- `design_system/ryan-realty/SKILL.md`.  brand system (authoritative)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md`.  banned-content gate
- `video_production_skills/VIRAL_GUARDRAILS.md`.  scorecard + format minimums

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
