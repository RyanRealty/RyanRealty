---
name: tiktok-listing-tour
description: >
  TikTok-optimized 9:16 listing tour (25–40s, 1080×1920) with SEO-baked VO. Differs from a
  repurposed IG Reel by embedding a long-tail geo query directly in the VO script — e.g.
  "What $895,000 gets you on 2 acres in Tumalo, Oregon." TikTok's search algorithm surfaces
  this to users searching those exact terms (TikTok now indexes spoken words via
  speech-to-text, on-screen text via OCR, and caption keywords). The caption repeats the
  keyword phrase verbatim. Headless — no agent face. Price-anchored hook in frame 0. Use this
  whenever Matt says "tiktok listing tour for <address>", "tiktok listing video for <MLS#>",
  "build a tiktok tour for <listing>", "tiktok-optimized listing", "tiktok for <address>", or
  any request that names TikTok as the target surface for a single-property tour. For IG
  Reels / YouTube Shorts use listing_reveal. For a 60–90s branded MLS-compliant cut use
  listing-tour-video.
when_to_use: |
  Trigger when Matt says any of:
  - "tiktok listing tour for <address>"
  - "tiktok listing video for <MLS#>"
  - "build a tiktok tour for <listing>"
  - "tiktok-optimized listing"
  - "tiktok for <address>"
  - "make a tiktok for the <listing> tour"
  - "$X gets you on <acres> in <city>" (the keyword-phrase-as-trigger)
action_types:
  - content:tiktok_listing_tour
---

# TikTok Listing Tour — SEO-Baked 9:16 Tour for TikTok Search

**Scope.** Produce one TikTok-native 9:16 listing tour (1080×1920, 25–40s) per call. The
defining differentiator versus a repurposed IG Reel is that the long-tail geo search query is
embedded **in the spoken VO** as the opening line, not just in the caption. TikTok's 2026
search surface indexes spoken words (speech-to-text), on-screen text (OCR), and caption
keywords, so the phrase appears in all three places. Headless format — no agent face, no
brokerage logo in the video frame (TikTok culture and policy both punish in-frame branding).
Companion to `listing-tour-video` (60–90s branded MLS-compliant cut) and `listing_reveal`
(40–48s IG Reels). Does NOT publish — publishing is handled by the post scheduler.

**Status.** Canonical. Locked 2026-05-14.

**Producer category.** Section B — Content Producer.

**Exemplar output:** `out/tiktok-listing-tour/<slug>/`

---

## 1. Scope

### In scope
- One 1080×1920 portrait MP4 (h264 + aac, faststart, < 100 MB) at 25–40s
- ElevenLabs VO with the long-tail keyword phrase as the opening spoken line
- Burned-in full-sentence captions with active-word highlight (per CLAUDE.md §0.5)
- Caption file (Markdown) with the keyword phrase repeated verbatim in line 1
- citations.json (every figure traces) + scorecard.json (viral scorecard, format minimum 80)
- Forced-alignment JSON next to the VO MP3 for caption sync
- VO script Markdown next to VO MP3 (auditable text)
- Headless brand (no logo / no agent face / no phone / no brokerage name in any frame)

### Out of scope
- Publishing the MP4 to TikTok (handled by `automation_skills/post_scheduler`)
- IG Reels variant (different format — use `listing_reveal`)
- YouTube Shorts variant (different format — use `listing_reveal` 9:16 export)
- 60–90s branded MLS-compliant tour with agent name + phone (use `listing-tour-video`)
- Carousel / static post for the same listing (use `instagram-carousel` or `ig-single-post`)
- AI-generated property photos (banned — ANTI_SLOP_MANIFESTO)
- Speaking the dollar amount in non-frame-0 positions (the price is the hook — say it once,
  spell it out, then move to specifics)

---

## 2. Action types handled

| action_type | required payload | notes |
|---|---|---|
| `content:tiktok_listing_tour` | `mls_id` | One call → one rendered 9:16 MP4 + caption + citations |

### Required payload fields

| field | type | required | notes |
|---|---|---|---|
| `mls_id` | string | YES | MLS ListingKey; resolves to Supabase `listings."MlsId"` |
| `target_keyword_phrase` | string | no | Long-tail geo query baked into VO line 1. Auto-derived from price + acres/sqft + city if absent (see §3) |
| `vo_script` | string | no | Override the VO entirely; must contain the keyword phrase verbatim as the opening line |
| `hero_photo_override` | string | no | URL or path to replace the default `Order=0` hero |
| `music_track` | string | no | Filename from `public/music/`; default sourced per `listing-tour-video` music manifest rule |

If `target_keyword_phrase` and `vo_script` are both omitted, the producer auto-generates
both. If `vo_script` is present, it MUST contain the `target_keyword_phrase` (resolved or
provided) verbatim as the first sentence — producer validates and rejects on mismatch.

---

## 3. Brief payload schema

```typescript
interface TikTokListingTourPayload {
  mls_id: string
  target_keyword_phrase?: string   // auto-derived if absent
  vo_script?: string                // auto-generated if absent
  hero_photo_override?: string
  music_track?: string
}

interface TikTokListingTourActionRow {
  id: string                        // uuid from marketing_brain_actions
  action_type: 'content:tiktok_listing_tour'
  target: string                    // 'mls:<mls_id>'
  assigned_producer: 'video_production_skills/tiktok-listing-tour'
  payload: TikTokListingTourPayload
  data_evidence: {
    audit_source?: string           // e.g. 'listing_trigger:new_active'
    opportunity_area?: string       // e.g. 'tumalo-2-acre-tier'
    signal_evidence?: string
  }
  generation_reason: string
  status: 'pending'
}
```

### Keyword phrase auto-derivation rule

When `target_keyword_phrase` is absent, derive it from listing data:

- **Lot-dominant** (acres ≥ 0.5): `What $<rounded_price_K> gets you on <acres> acres in <city>, Oregon`
- **Sqft-dominant** (acres < 0.5 OR not present): `What $<rounded_price_K> gets you in <sqft>-square-foot <city>, Oregon`
- **Sub-$500K**: `What you can buy under $500K in <city>, Oregon` (compresses for shorter spoken delivery)
- **Luxury (≥ $1.5M)**: `What $<rounded_price_M> million gets you on <acres> acres in <city>, Oregon`

Price rounding for the keyword phrase: nearest $5K under $1M, nearest $50K from $1M to $5M,
nearest $100K above $5M. The on-screen pill shows the precise rounded price; the spoken VO
matches the keyword phrase. Tie verbal to written so the OCR signal and speech-to-text
signal reinforce each other.

The keyword phrase passes through `marketing_brain_skills/brand-voice/voice_guidelines.md`
banned-vocab grep before being committed to the script.

---

## 4. The recipe

**Step 1 — Read the action row.**
Query `marketing_brain_actions` by `id`. Confirm `status='pending'`. Immediately UPDATE
`status='in_production'` and `executed_at=now()` per the SQL block in §8.

**Step 2 — Load mandatory references.**
See §13 — load all listed refs before touching the build.

**Step 3 — Resolve listing data from Supabase.**
Per CLAUDE.md "Supabase listings Schema," quote every mixed-case column. One query:

```sql
SELECT
  "MlsId", "StreetNumber", "StreetName", "StreetSuffix",
  "City", "StateOrProvince", "PostalCode",
  "ListPrice", "BedroomsTotal", "BathroomsTotal",
  "TotalLivingAreaSqFt", "LotSizeAcres",
  "SubdivisionName", "PublicRemarks",
  "Latitude", "Longitude",
  "PhotoURL",
  "ListAgentFullName", "ListAgentEmail",
  "StandardStatus",
  year_built
FROM listings
WHERE "MlsId" = '<mls_id>'
  AND "PropertyType" = 'A'
LIMIT 1;
```

Row count must be exactly 1. Print every field. The `ListPrice`, `LotSizeAcres`,
`TotalLivingAreaSqFt`, `BedroomsTotal`, `BathroomsTotal`, and `City` values become inputs to
the keyword-phrase derivation and the on-screen pill. Per CLAUDE.md §0, nothing in the
deliverable carries a number that isn't traced to this query row.

Photo pull from `listing_photos` table (same pattern as `listing_reveal/SKILL.md` §Step 1).
Minimum 12 photos required; surface to Matt if fewer.

**Step 4 — Resolve or generate the keyword phrase.**
If `payload.target_keyword_phrase` is present, validate it against the banned-vocab union
(`marketing_brain_skills/brand-voice/voice_guidelines.md` §6). On hit, surface to Matt with
the specific banned token. If absent, auto-derive per §3. Write the resolved phrase to
`out/tiktok-listing-tour/<slug>/keyword.json` for the audit trail.

**Step 5 — Build the VO script.**
If `payload.vo_script` is present, validate it: opening sentence MUST equal
`target_keyword_phrase` verbatim (case-insensitive trim compare). On mismatch, surface and
do not render.

If `payload.vo_script` is absent, generate a 25–40s spoken script with this shape:

```
Sentence 1 (5–8s): <target_keyword_phrase>.
Sentence 2 (3–5s): One concrete spec — bedrooms, lot, primary differentiator.
Sentence 3 (4–6s): A second concrete spec or a neighborhood anchor (drive time, school, trail).
Sentence 4 (4–6s): The "what it looks like" line — invites the visual reveal.
Sentence 5 (4–6s): A construction or material detail from PublicRemarks (verified — never invented).
Closing CTA (2–4s): "DM me TOUR for the full walkthrough."
```

Total target: 25–40s spoken at Victoria's pacing (≈ 150 wpm). Banned vocab grep runs on the
draft before it goes to ElevenLabs.

**Step 6 — Synthesize the VO with Victoria.**
ElevenLabs `/v1/text-to-speech` per `elevenlabs_voice/SKILL.md`: voice
`qSeXEcewz7tA0Q0qk9fH`, model `eleven_turbo_v2_5` (NOT `eleven_v3` — phoneme tags skipped on
v3), stability 0.40, similarity_boost 0.80, style 0.50, `use_speaker_boost=true`. IPA tags
for Tumalo (`ˈtʌm.ə.loʊ`), Deschutes (`dəˈʃuːts`), Tetherow, Awbrey, Terrebonne. Numbers
spelled out (`$895,000` → "eight hundred ninety five thousand dollars"). `previous_text`
chained across sentences. Save to `vo.mp3` and `vo-script.md`.

**Step 7 — Generate forced-alignment JSON.**
ElevenLabs `/v1/forced-alignment` against `vo.mp3` + script. Save to `vo-alignment.json`.
Caption component reads this at render time for word-level sync (CLAUDE.md §0.5 rule 5).

**Step 8 — Curate photos to 10–14 beats.**
Reuse `listing_reveal/curate_beats.py` to score/classify. Manually order to the TikTok beat
structure (§4.1). Save to `beat_assignment.json`.

**Step 9 — Render with Remotion.**
```bash
cd listing_video_v4 && \
npx remotion render src/index.ts TikTokListingTour \
  out/tiktok-listing-tour/<slug>/tour.mp4 \
  --codec h264 \
  --concurrency=1 \
  --crf 22 \
  --image-format=jpeg \
  --jpeg-quality=92
```

The `TikTokListingTour` composition reads `beat_assignment.json`, `vo.mp3`,
`vo-alignment.json`, and the listing data JSON from the `out/tiktok-listing-tour/<slug>/`
directory.

**Step 10 — Run the QA gate.** See §6 / §8 below. Any fail blocks the transition to `ready`.

**Step 11 — Write citations.json + scorecard.json.**
One entry per figure shown or spoken (price, sqft, lot, beds, baths, city, neighborhood).
Source: Supabase listings row pulled in Step 3, with the row's `fetched_at` ISO timestamp.

**Step 12 — Write the caption file.**
`out/tiktok-listing-tour/<slug>/caption.md`. Format per §5 below. Opening line repeats the
keyword phrase verbatim — TikTok search ranks caption + speech + on-screen text together.

**Step 13 — UPDATE the action row to `ready`.**
Populate `executor_response` with the draft paths + scorecard. Surface to Matt per §6.

**Step 14 — Stop. Wait for Matt's "ship it" / "approved" / "go".**
Do not commit. Do not push. Do not transition to `approved`. Per CLAUDE.md §0.5.

### 4.1 — TikTok beat structure (10–14 beats, 25–40s)

Tighter than `listing_reveal`'s 16-beat 40–48s format. TikTok rewards faster cuts and the
2026 algorithm penalizes anything that delays the qualified-view 3s threshold.

| Beat | Content | Motion | Duration |
|---|---|---|---|
| 0 | Hero exterior — the single most compelling photo | Slow push-in already engaged at frame 0 | 3.0–3.5s |
| 1 | Signature feature (mountain view, river, vaulted ceiling, etc.) | Depth parallax or push-counter | 2.5–3.0s |
| 2 | Different exterior angle (side, driveway, backyard) | Slow pan L→R | 2.5–3.0s |
| 3 | Great room / living space | Slow pan | 2.5s |
| 4 | Kitchen — wide | Push-in | 2.5s |
| 5 | Kitchen — detail (island, hardware) | Ken Burns slow push | 2.5s |
| 6 | Primary bedroom OR standout secondary space | Push-in | 2.5s |
| 7 | Primary bath OR outdoor living (deck, patio) | Depth parallax OR push-counter | 2.5s |
| 8 | Drone aerial / wide context shot | Push-counter slow | 3.0s |
| 9 | View or natural feature (mountains, river, forest) | Slow pan L→R | 2.5s |
| 10 | Navy footer reveal — price + neighborhood + DM TOUR CTA | Static hold with subtle Ken Burns on background photo | 3.0–3.5s |

Optional beats 11–13 if the property warrants a deeper walkthrough (multi-acre estate,
detached structures). Hard cap at 14 beats / 40s total runtime.

**Motion variety:** at least 3 different motion types across the 10–14 beats. Never repeat
the same primitive on two consecutive beats.

**Hook frame (frames 0–30 = first 1.0s):** first frame is a hero photo already in motion
(slow push-in engaged at frame 0). On-screen pill appears by frame 30 (1.0s) with
`$<price> · <acres or sqft> · <city>`. NO logo, NO brokerage name, NO "Just Listed" banner —
TikTok culture and the data both punish that overlay.

### 4.2 — Final beat (navy footer reveal) spec

Beat 10 — the only "branded" moment, and the brand presence is intentionally restrained:

- Background: the hero exterior photo at 60% opacity behind a navy `rgba(16,39,66,0.86)`
  scrim that occupies the full 1080×1920 canvas.
- Headline (Amboqia Boriango, 96 px, cream `#faf8f4`, line-height 1.05, centered, y = 720):
  the address — e.g. `1234 NW Riverview Drive`.
- Sub-line (Geist 500, 36 px, cream 0.85 opacity, centered, y = 880, tabular-nums):
  `<City>, Oregon  ·  $<price>  ·  <beds> bd · <baths> ba`.
- CTA pill (Geist 500, 28 px, navy `#102742` on cream `#faf8f4` rounded-22px pill, centered,
  y = 1280):
  `Comment TOUR for the full walkthrough`.
- No logo. No phone. No agent name. The handle on the TikTok profile carries brand identity
  (per docs/research/best-practices-tiktok.md "Branding Restraint" — top 10 RE TikTok
  creators put logos in frame 0% of the time).

---

## 5. Caption format

File: `out/tiktok-listing-tour/<slug>/caption.md`

```
<target_keyword_phrase>.

<1–2 sentences about specifics — bedrooms, lot, neighborhood anchor, drive time, school, or
construction detail. Match the VO's middle. Banned-vocab clean.>

Comment TOUR for the full walkthrough.

#RyanRealtyBend
#BendOregon
#<NeighborhoodOrCity>Oregon
#CentralOregonRealEstate
#PNWHome
```

Hashtag rules:
- 5 maximum (per `docs/research/best-practices-tiktok.md` "Hashtag Strategy" — 3–5 is the
  TikTok sweet spot; more than 5 reads as noise)
- `#RyanRealtyBend` is FIRST in the trailing block (HARD RULE per CLAUDE.md "Voice +
  content" — locked 2026-05-14)
- `#BendOregon` always second (broad geo)
- Third slot: the neighborhood or city tag — `#TumaloOregon`, `#RedmondOregon`,
  `#SistersOregon`, `#NorthwestCrossingBend`, `#SunriverOregon`, etc.
- Fourth slot: `#CentralOregonRealEstate` (mid-funnel geo intent)
- Fifth slot: lifestyle anchor — `#PNWHome`, `#PacificNorthwestHomes`, OR a trending
  audio-related tag if the music track is using trending audio. Never both.

Caption body rules:
- Banned vocab clean (real-estate clichés + AI filler + vague qualifiers per
  `marketing_brain_skills/brand-voice/voice_guidelines.md`)
- No em-dashes, no semicolons, no exclamation marks
- "You/your" subject; "we" only if the brokerage is the subject
- Sentence case
- Currency rounded to the nearest thousand: `$895,000` not `$894,750`

---

## 6. Output format

**Draft lands at:** `out/tiktok-listing-tour/<slug>/`

**Files produced:**
```
out/tiktok-listing-tour/<slug>/
├── tour.mp4                  ← the rendered 1080×1920 portrait video
├── caption.md                ← caption with leading keyword phrase + hashtag block
├── vo-script.md              ← human-readable VO script
├── vo.mp3                    ← ElevenLabs synthesis output
├── vo-alignment.json         ← forced-alignment word-level timestamps
├── keyword.json              ← resolved or provided target_keyword_phrase
├── beat_assignment.json      ← final 10–14 beat order with photo refs
├── citations.json            ← one entry per figure (price, sqft, beds, etc.)
├── scorecard.json            ← viral scorecard per VIRAL_GUARDRAILS (min 80)
├── listing.json              ← raw Supabase row, audit trail
└── music-manifest.json       ← track + clip ID per listing-tour-video rule
```

Slug convention: `<mls_id>-<lowercase-kebab-street-name>` — e.g. `220189422-nw-riverview`.

**Surface format (present to Matt exactly like this):**

```
Draft ready: tiktok-listing-tour — <address>

  DELIVERABLE
    Path: out/tiktok-listing-tour/<slug>/tour.mp4
    Duration: <s>s  ·  1080×1920  ·  <size>MB
    Scorecard: <score>/100 (TikTok format minimum 80)
    Hook (0–1s): <hook overlay text>
    Keyword phrase (VO opening): "<target_keyword_phrase>"

  CAPTION
    Path: out/tiktok-listing-tour/<slug>/caption.md
    Opening: <first line — repeats keyword phrase>
    Hashtags: #RyanRealtyBend #BendOregon #<...> (5)

  VERIFICATION TRACE
    - $<price> — Supabase listings, MlsId='<mls_id>', column=ListPrice, fetched <iso>
    - <acres> acres — Supabase listings, MlsId='<mls_id>', column=LotSizeAcres, fetched <iso>
    - <sqft> sqft — Supabase listings, MlsId='<mls_id>', column=TotalLivingAreaSqFt, fetched <iso>
    - <beds>/<baths> — Supabase listings, MlsId='<mls_id>', columns=BedroomsTotal/BathroomsTotal, fetched <iso>
    - <city> — Supabase listings, MlsId='<mls_id>', column=City, fetched <iso>

  citations.json: out/tiktok-listing-tour/<slug>/citations.json
  scorecard.json: out/tiktok-listing-tour/<slug>/scorecard.json

Reply "ship it" / "approved" / "go" to commit + push.
```

Then stop. Do not commit. Do not push. Wait for Matt's explicit approval.

---

## 7. Approval gate

`matt-review-draft` — Matt opens `tour.mp4`, reads `caption.md`, scans the verification
trace + scorecard, and replies with explicit approval ("ship it" / "approved" / "go").
Silence is not approval. A passing QA gate is not approval. Per CLAUDE.md §0.5.

After approval, the orchestrator (`marketing_brain_skills/run/SKILL.md` or
`marketing_brain_skills/produce/SKILL.md`) handles the `approved → executed → measured`
transition. The producer does NOT publish to TikTok directly — publishing is
`automation_skills/post_scheduler` territory.

---

## 8. Status flow

```
     pending
        │ producer picks up row
        ▼
  in_production   ← executed_at = now()
        │ render complete, QA passed
        ▼
      ready        ← executor_response populated with draft_path + scorecard
        │ Matt says "ship it"
        ▼
    approved       ← approved_by='matt', approved_at=now()
        │ post_scheduler uploads to TikTok via Content Posting API
        ▼
    executed       ← terminal success (TikTok upload returns post_id)
        │ 48h post-publish
        ▼
    measured       ← performance_loop writes views + saves + completion rate

    killed         ← terminal failure; QA fails after 2 auto-iterations OR Matt cancels
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
    executor_response='{"draft_path":"out/tiktok-listing-tour/<slug>/tour.mp4","caption_path":"out/tiktok-listing-tour/<slug>/caption.md","scorecard":{}}'::jsonb
WHERE id='<id>';

-- On Matt approval:
UPDATE marketing_brain_actions
SET status='approved', approved_by='matt', approved_at=now()
WHERE id='<id>';
```

---

## 9. QA gate

Run before transitioning to `ready`. Write results to `scorecard.json`. Any fail blocks
ship.

| # | Check | Pass condition |
|---|---|---|
| 1 | Canvas / codec | 1080×1920, 30 fps, h264 + aac, faststart, < 100 MB |
| 2 | Duration | 25.0s ≤ duration ≤ 40.0s (ffprobe `Duration`) |
| 3 | Black-frame check | `ffmpeg blackdetect pix_th=0.05 d=0.05` returns zero sequences |
| 4 | Motion at frame 0 | Frame 0 extract is not black, not a logo, not a static title card — already-in-motion hero photo with overlay arriving by frame 30 |
| 5 | Keyword phrase in VO | Forced-alignment JSON: first sentence's text equals `keyword.json.target_keyword_phrase` (case-insensitive) |
| 6 | Keyword phrase in caption | `caption.md` line 1 equals `keyword.json.target_keyword_phrase` (case-insensitive) |
| 7 | Keyword phrase on-screen | Frame extract at 0.5–1.5s shows the price + acres/sqft + city pill in the keyword-phrase order |
| 8 | Dollar amount spoken in frame 0 | Forced-alignment JSON: first spoken word is a numeric/currency token (e.g. "what" is allowed as connective, but the price must occur within the first 8 spoken words) |
| 9 | Tabular numerals | Every on-screen number renders with `font-variant-numeric: tabular-nums` |
| 10 | Banned-words grep | VO script, caption, on-screen pills — zero hits against `voice_guidelines.md` §6 union |
| 11 | No logo / no agent face | No frame in the render contains the Ryan Realty wordmark, the broker headshot, or any phone/agent-name text |
| 12 | Navy footer (no gold) | Final beat scrim is navy `rgba(16,39,66,0.86)` — no gold `#D4AF37` or `#C8A864` anywhere |
| 13 | Captions present | Burned-in captions appear on every spoken beat, synced to forced-alignment, full-sentence with active-word highlight |
| 14 | Captions never overlap data | No frame has a caption overlapping the price pill, the on-screen address, or the CTA pill |
| 15 | Data verified | Every figure traces to `citations.json` with `source`, `filter`, `column`, `fetched_at` |
| 16 | Hashtag rule | Caption hashtag block: exactly 5 hashtags, `#RyanRealtyBend` first |
| 17 | Music manifest | `music-manifest.json` present; track not flagged as over-reused per the rule in `listing-tour-video/SKILL.md` HARD RULE 8 |
| 18 | Viral scorecard | Score ≥ 80 (TikTok format minimum per `VIRAL_GUARDRAILS.md`) |

If any check fails, the producer auto-iterates up to 2 times. After 2 failures, surface to
Matt with the specific failed check and the offending file path. Do NOT present a draft that
fails QA.

### TikTok search-optimization checklist (sub-gate of #5–#7)

- The exact `target_keyword_phrase` appears verbatim in: VO script line 1, VO audio (proven
  by forced-alignment match), caption line 1, on-screen pill at hook frame.
- The keyword phrase contains at minimum: dollar figure + unit (`$<price>`), quantity
  (`<acres> acres` or `<sqft> square feet`), and a named geography (`<city>, Oregon`).
- The phrase reads as a natural human search query — what someone would type into TikTok's
  search bar. If it sounds like SEO ad copy, rewrite.

---

## 10. Tools used

| tool | purpose | env var / path |
|---|---|---|
| Supabase MCP | listing pull + action row updates | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| ElevenLabs API | VO synthesis (Victoria) | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID=qSeXEcewz7tA0Q0qk9fH` |
| ElevenLabs `/v1/forced-alignment` | word-level caption sync JSON | Same API key |
| Remotion 4.0.290 | composition + h264 render | `cd listing_video_v4 && npx remotion render` |
| ffmpeg | duration + blackdetect QA, frame extract | `ffmpeg`, `ffprobe` on PATH |
| `curate_beats.py` | photo scoring + classification | `video_production_skills/listing_reveal/curate_beats.py` |
| `depth_parallax/SKILL.md` | parallax motion on hero shots | Python / PyTorch |
| Replicate (optional) | Wan 2.7 i2v on a single hero photo (only if static cannot carry frame-0 motion) | `REPLICATE_API_TOKEN` |

Composition source: `listing_video_v4/src/compositions/TikTokListingTour.tsx` (build if
absent; mirror the structure of `listing_video_v4/src/compositions/ListingReveal.tsx`
adapting to the 10–14 beat / 25–40s TikTok cadence and the navy footer reveal in §4.2).

---

## 11. Failure modes

| failure | symptoms | recovery |
|---|---|---|
| Keyword phrase reads low-intent | Auto-derived "What $437,500 gets you on 0.18 acres in Bend" reads awkward | Surface to Matt with 2–3 alternative derivations (omit acres if < 0.5; lead with sqft; or compressed `< $500K` form). Do not render until Matt picks one |
| Price not in first 8 spoken words | Forced-alignment JSON: first 8 tokens contain no currency match | Regenerate the script. Opening MUST be the keyword phrase verbatim. Check `keyword.json` and re-run Step 4 |
| Video > 40s | ffprobe duration exceeds the TikTok-tour cap | Trim the lowest-impact secondary beat (typically beat 2 or beat 6). Re-render. Max 2 auto-iterations |
| Video > 60s | Hard ship-blocker per CLAUDE.md "Video Build Hard Rules" | Stop. Truncate sentences 4–5 in the VO script and re-synthesize |
| Listing has < 12 photos | Supabase `listing_photos` returns < 12 | Surface to Matt — same rule as `listing_reveal`. No AI substitutes, no builder stock |
| No drone aerial | No `photo_type='aerial'` rows | Use widest exterior for Beat 8. If none exists, offer to skip Beat 8 (10-beat render) |
| Music track reused | Manifest collision check fails | Pull a different track per `listing-tour-video/SKILL.md` HARD RULE 8. Update `music-manifest.json` |
| Keyword phrase trips banned-vocab grep | Auto-derivation produces "stunning" or similar | Re-derive with a stricter template. If banned vocab came from input data (neighborhood name etc.), flag to Matt |
| Logo accidentally rendered in frame | Composition pulled the wrong end-card variant | Hard fail. Re-render with the headless navy footer per §4.2. Do NOT publish |
| ElevenLabs API 429 / quota | `ELEVENLABS_API_KEY` over the char cap | Report to Matt with remaining headroom + synthesis cost. Pause until top-up |
| Open spec — TikTok composition missing | `listing_video_v4/src/compositions/TikTokListingTour.tsx` does not exist | Build it. Mirror `ListingReveal.tsx`: 10–14 beats, navy footer per §4.2, no gold, 25–40s envelope. Document in commit message when Matt approves |
| Open spec — producer publishes? | No. Out of scope. `automation_skills/post_scheduler` handles publish after approval |

---

## 12. What not to do

1. **Never put the Ryan Realty logo, wordmark, broker headshot, phone, or agent name in the
   video frame.** TikTok's developer guidelines prohibit it; the top 10 RE TikTok creators
   have 0 logos in 0% of their frames. Headless format.
2. **Never invent the dollar amount, square footage, lot size, beds, or baths.** Every
   figure traces to Supabase. No "approximately," no "around," no narrative-changing rounding.
3. **Never let the VO open with a greeting.** "Hey TikTok," "Welcome to," "Today I'm at" —
   auto-skip triggers that bury the keyword phrase. First spoken word block contains the
   dollar amount.
4. **Never render with model `eleven_v3`.** IPA phoneme tags are silently skipped — Tumalo
   becomes "TOO-muh-low," Deschutes "dis-chutes." Locked to `eleven_turbo_v2_5`.
5. **Never reuse a music track from a recent render.** Check the manifest first per
   `listing-tour-video/SKILL.md` HARD RULE 8.
6. **Never use gold** (`#D4AF37`, `#C8A864`). Retired in the v2 design system. Navy + cream
   only.
7. **Never repurpose an IG Reels MP4 to TikTok.** The differentiator is the keyword phrase
   in the VO. A repurposed Reel has the wrong opening line and forfeits TikTok search.
8. **Never publish without Matt's explicit approval.** Per CLAUDE.md §0.5.
9. **Never let the caption omit `#RyanRealtyBend` or place it anywhere except first in the
   hashtag block.** HARD RULE per CLAUDE.md "Voice + content" — locked 2026-05-14.

---

## 13. Related skills and references

**Required reading before executing:**
- `CLAUDE.md` §0 — Data Accuracy (outranks everything)
- `CLAUDE.md` §0.5 — Draft-First, Commit-Last (outranks everything)
- `CLAUDE.md` "Voice + content" — `#RyanRealtyBend` HARD RULE (locked 2026-05-14)
- `CLAUDE.md` "Supabase listings Schema" — quoted mixed-case columns
- `design_system/ryan-realty/SKILL.md` — brand visual system v2 (locked 2026-05-12)
- `marketing_brain_skills/brand-voice/voice_guidelines.md` — banned vocab union
- `marketing_brain_skills/brand-voice/corpus/gbp_responses.md` — Matt's writing fingerprint

**Format skills delegated to / inherited from:**
- `video_production_skills/listing-tour-video/SKILL.md` — data pull, Remotion env, music
  manifest rule (HARD RULE 8), Victoria voice settings
- `video_production_skills/listing_reveal/SKILL.md` — overlay system, beat curation, photo
  scoring, composition patterns

**Capabilities used inside this producer:**
- `video_production_skills/elevenlabs_voice/SKILL.md` — Victoria voice (`qSeXEcewz7tA0Q0qk9fH`),
  stability 0.40, similarity 0.80, style 0.50, model `eleven_turbo_v2_5`, IPA library
- `video_production_skills/depth_parallax/SKILL.md` — parallax motion on hero shots
- `video_production_skills/quality_gate/SKILL.md` — shared QA pass procedure
- `video_production_skills/captions/SKILL.md` — caption render component (full-sentence
  active-word highlight, forced-alignment sync)
- `video_production_skills/render_pipeline/SKILL.md` — Remotion render + ffmpeg post-mix

**Playbooks and pipeline docs:**
- `automation_skills/content_engine/SKILL.md` — content router (`content:*` actions dispatch
  through here)
- `social_media_skills/platform-best-practices/SKILL.md` — 2026 platform rule layer
- `docs/research/best-practices-tiktok.md` — TikTok-specific patterns, top creator analysis,
  algorithm signals, hook formulas, hashtag strategy, zero in-frame branding rule
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content gate
- `video_production_skills/VIRAL_GUARDRAILS.md` — viral scorecard + format minimum 80

**Registry entry:**
- `marketing_brain_skills/producers/REGISTRY.md` — Section B (Content Producers), row
  `tiktok-listing-tour`. Path: `video_production_skills/tiktok-listing-tour`. Action types:
  `content:tiktok_listing_tour`.
