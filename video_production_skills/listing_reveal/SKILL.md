---
name: listing_reveal
description: "Formalized 16-beat photo-to-cinematic reel for every new listing. Tumalo Reservoir formula codified. Remotion + depth_parallax + audio_sync + ElevenLabs VO."
---

# Listing Reveal — Tumalo-Style 16-Beat Cinematic Reel

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` and `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md` before scaffolding any BEATS array. Every constraint in those files outranks convenience here.**

---

## What it is

A 40-48 second vertical video reel built from 16 photo beats, each 2.5-3 seconds, with deterministic Remotion motion on every beat. The format is codified from the Tumalo Reservoir video (16 beats, 45s, shipped and verified). It uses depth parallax on hero shots, Ken Burns motion on detail shots, audio sync to a beat-detected score, and ElevenLabs VO read against the listing copy. This is the standard deliverable for every new listing regardless of price point. The earth_zoom intro is optional — the listing_reveal works standalone.

**Platforms:** IG Reels (1080×1920 portrait), TikTok, YT Shorts. Horizontal crop (1920×1080) for MLS embed and listing website hero.

**Output length:** 40-48 seconds. Never under 40s (too few beats, too fast to absorb). Never over 48s (algorithm cliff).

---

## When to invoke

- New listing enters MLS active status and photographer has delivered at least 15 stills plus drone (20+ preferred)
- Listing video pipeline is triggered by `social_calendar/SKILL.md` full-tour slot
- Re-list of a previously active listing (full re-render, do not reuse prior beats — new curation required)
- Status change to Pending (re-render Beat 15 and 16 only, swap price for PENDING badge — do not re-render all 16 beats)

Do NOT invoke for:
- Fewer than 15 MLS photos (no filler, no AI-generated substitutes — hold until more photos delivered)
- Listings where photos have not been delivered by the photographer (never use builder stock photos or AI-generated interiors)
- Price reductions that do not warrant a full new reel (use `social_calendar/SKILL.md` single-room highlight slot instead)

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Photo pull + curation | Supabase `listing_photos` table | $0 | `SUPABASE_SERVICE_ROLE_KEY` |
| Beat assignment | `curate_beats.py` | $0 | — |
| Depth map generation (hero shots) | `depth_parallax/SKILL.md` (MiDaS) | $0 | Python/PyTorch |
| Audio beat detection | `audio_sync/SKILL.md` | $0 | ffmpeg + librosa |
| Remotion composition | `ListingRevealComp` | $0 | Node env |
| VO synthesis | ElevenLabs API | ~$0.003/char | `ELEVENLABS_API_KEY` |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |
| Optional Beat 0 | `earth_zoom/SKILL.md` | $0 (Earth Studio) | Google account |

---

## Beat structure — mandatory

16 beats. Each beat is 2.5-3.0 seconds. Total runtime: 40-48 seconds.

| Beat | Content | Motion type | Notes |
|------|---------|-------------|-------|
| 1 | Hook: strongest hero exterior OR unique feature | depth_parallax (push_in) | Price or feature on screen by frame 30 (1s). Address overlay. VO begins. |
| 2 | Signature feature: the shot that defines the property | depth_parallax or gimbal_walk | The one photo that makes someone stop scrolling. Mountain view, river, vaulted ceiling, etc. |
| 3 | Exterior from a different angle (side, driveway, backyard) | slow_pan_lr or push_counter | No re-use of Beat 1 angle |
| 4 | First re-hook: text shock or visual register change | Ken Burns or push_in | 25% mark. New text overlay with a second fact about the property |
| 5 | Great room / living space | slow_pan_lr | Widest angle of main living area |
| 6 | Kitchen — wide shot | push_in | Counters and appliances visible |
| 7 | Kitchen — detail (island, backsplash, hardware) | Ken Burns slow push | 2.5s beat. One specific feature |
| 8 | Dining | slow_pan_rl | Brief — 2.5s |
| 9 | Second re-hook: pattern interrupt | drone_aerial OR exterior_wide | 50% mark. Switch from interior to exterior register. Altitude change. |
| 10 | Primary bedroom | push_in | |
| 11 | Primary bath or a standout secondary space | Ken Burns | |
| 12 | Outdoor living: deck, patio, fire pit, pool | depth_parallax or push_counter | |
| 13 | View or natural feature | slow_pan_lr | Mountain, river, canyon, forest — whatever the property has |
| 14 | Closing aerial: drone pullback showing neighborhood context | push_counter slow | Different drone shot than Beat 9 |
| 15 | Data beat: price, beds, baths, sqft, lot | kinetic_stat_reveal | Navy background, gold accent, Amboqia headline. All five numbers on screen together. |
| 16 | CTA: address + "Tour link in bio" | static_hold or slow_push | Address centered, AzoSans, white on navy. No phone, no logo, no "REPRESENTED BY". |

**Motion variety rule:** Across 16 beats you must use at least 4 different motion types. Review `VIDEO_PRODUCTION_SKILL.md` Section 1 motion requirement before finalizing the BEATS array.

---

## Step-by-step workflow

### Step 1 — Pull photos from Supabase and confirm count

```bash
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('listing_photos')
  .select('id, url, photo_type, sort_order, width, height')
  .eq('listing_id', '<listing_id>')
  .order('sort_order')
  .then(({ data, error }) => {
    if (error) throw error;
    console.log('Photo count:', data.length);
    console.log(JSON.stringify(data.map(p => ({ id: p.id, type: p.photo_type, url: p.url })), null, 2));
  });
"
```

Minimum 15 photos required. If fewer than 15 are in Supabase, do not proceed — contact photographer. No AI-generated substitutes.

Download all photos to `out/listing_reveal/<listing_id>/photos/`:

```bash
node video_production_skills/listing_reveal/download_photos.js \
  --listing-id <listing_id> \
  --output-dir out/listing_reveal/<listing_id>/photos/
```

### Step 2 — Curate the best 16 photos

Photo curation is a judgment call and belongs to the Opus tier (per Orchestrator Policy). Do not delegate curation to Haiku or Sonnet.

Run the curation helper to surface the candidates:

```bash
python video_production_skills/listing_reveal/curate_beats.py \
  --photos-dir out/listing_reveal/<listing_id>/photos/ \
  --listing-id <listing_id> \
  --output out/listing_reveal/<listing_id>/beat_assignment.json
```

The script scores each photo by:
1. Resolution (minimum 2000px wide)
2. Exposure quality (histogram analysis — rejects blown-out or underexposed)
3. Photo type classification (exterior, interior, kitchen, bedroom, bath, aerial, detail)
4. Uniqueness within type (flags near-duplicate angles)

The output `beat_assignment.json` is a draft assignment. You must review each assignment against the beat structure table above and manually reorder if the draft mismatches the narrative arc.

**Curation rules:**
- Never assign the same room twice
- Beat 1 must be the single most compelling photo in the set (often the hero exterior or signature view)
- Beat 9 (50% interrupt) must be a drone aerial — if no drone photos, use the widest exterior angle available
- Never use a blurry, underexposed, or clipped photo even if it's the only photo of that room
- Exterior photos: minimum 2, maximum 3 across all 16 beats

Save the final manual assignment to `beat_assignment_final.json`.

### Step 3 — Generate depth maps for hero shots

Run `depth_parallax/SKILL.md` on Beats 1, 2, 12, and 13 (the four beats that most benefit from depth parallax). See that skill for full depth map generation instructions.

```bash
for BEAT in 1 2 12 13; do
  PHOTO=$(jq -r ".beats[$BEAT].photo_path" out/listing_reveal/<listing_id>/beat_assignment_final.json)
  python video_production_skills/depth_parallax/generate_depth_map.py \
    --input "$PHOTO" \
    --output-dir out/listing_reveal/<listing_id>/depth/beat_${BEAT}/
done
```

Check each depth map visually before running the Remotion render. A bad depth map (uniform gray, or inverted foreground/background) will produce uncanny warping on the hero shot — switch that beat to standard Ken Burns if the depth map is poor.

### Step 4 — Beat-detect the score and build sync points

Select the music track before this step. Use a royalty-free track from the approved library (see `audio_sync/SKILL.md` for sources and licensing rules).

```bash
python video_production_skills/audio_sync/detect_beats.py \
  --input public/audio/scores/<track_name>.mp3 \
  --output out/listing_reveal/<listing_id>/beat_timestamps.json \
  --target-beats 16
```

The script returns 16 beat timestamps that align with the musical grid. These timestamps become the `startSec` values in the BEATS array. Verify the returned timestamps sound natural when played back:

```bash
python video_production_skills/audio_sync/preview_cuts.py \
  --timestamps out/listing_reveal/<listing_id>/beat_timestamps.json \
  --audio public/audio/scores/<track_name>.mp3
```

If a beat timestamp lands in an awkward musical position (e.g., mid-phrase silence), shift it by ±0.2s and document the adjustment in `beat_timestamps.json`.

### Step 5 — Write the VO script

The VO script covers Beats 1-14 (Beat 15 is a stat card without VO, Beat 16 is address only). Total word count: 60-90 words. Voice rules from `VIDEO_PRODUCTION_SKILL.md` Section 2 apply.

**Banned words in any VO or on-screen text:**
- stunning, nestled, boasts, coveted, dream home, charming, must-see, gorgeous, breathtaking, amazing, perfect, luxury (unless it is a verifiable luxury tier — never as a descriptor), opportunity

**VO structure:**
- Beat 1: specific fact (address + the one thing that makes this property worth watching)
- Beats 2-8: short factual descriptions of what is on screen (not what it feels like — what it is)
- Beats 9-14: outdoor context, neighborhood, natural features
- No VO on Beats 15 and 16

Save script to `out/listing_reveal/<listing_id>/vo_script.txt`.

Synthesize with ElevenLabs:

```bash
python video_production_skills/listing_reveal/synth_vo.py \
  --script out/listing_reveal/<listing_id>/vo_script.txt \
  --output-dir out/listing_reveal/<listing_id>/audio/ \
  --voice-id "$ELEVENLABS_VOICE_ID" \
  --model "eleven_turbo_v2_5"
```

The script synthesizes each VO line separately, chains `previous_text` for prosody continuity, and saves individual MP3 files numbered by beat (e.g., `beat_01_vo.mp3`).

Verify each audio file plays correctly and no beat VO is clipped or overlapping. Check duration — each VO file must be at least 0.5s shorter than the beat duration so there is no VO overlap at beat boundaries.

### Step 6 — Build the BEATS array in Remotion

Open `video/listing_reveal/src/ListingRevealComp.tsx`. The BEATS array drives the entire composition.

Each beat entry:

```typescript
{
  beatIndex: 0,
  photoPath: 'out/listing_reveal/<id>/photos/photo_01.jpg',
  depthDir: 'out/listing_reveal/<id>/depth/beat_1',  // null if no depth map
  motion: 'depth_parallax',  // or: 'ken_burns', 'slow_pan_lr', 'slow_pan_rl', 'push_in', 'push_counter', 'gimbal_walk'
  startSec: 0.0,
  durationSec: 3.0,
  voAudioPath: 'out/listing_reveal/<id>/audio/beat_01_vo.mp3',  // null for Beats 15 and 16
  textOverlay: {
    line1: '1234 Example Rd',
    line2: 'Bend, OR 97702',
    style: 'address_pill'  // or: 'stat_card', 'cta_card', 'none'
  }
}
```

Beat 15 uses the `stat_card` style which renders all five data points simultaneously:

```typescript
{
  beatIndex: 14,
  motion: 'kinetic_stat_reveal',
  startSec: 37.5,
  durationSec: 3.0,
  voAudioPath: null,
  statCard: {
    price: 895000,
    beds: 3,
    baths: 2,
    sqft: 2100,
    lotSqft: 43560,  // acres: 43560 = 1 acre — convert to acres for display
    status: 'ACTIVE'  // or 'PENDING'
  }
}
```

Verify every `photoPath` and `depthDir` path exists on disk before running the render.

### Step 7 — Render

```bash
npx remotion render \
  video/listing_reveal/src/index.ts \
  ListingRevealComp \
  out/listing_reveal/<listing_id>/listing_reveal_portrait.mp4 \
  --props="$(cat out/listing_reveal/<listing_id>/remotion_props.json)" \
  --concurrency=1
```

Expected render time: 5-15 minutes on Mac mini M-series depending on photo count and depth parallax beats.

### Step 8 — Post-render quality gate

Full gate documented in next section. Run every check. Do not skip any item.

### Step 9 — Final encode

```bash
ffmpeg -i out/listing_reveal/<listing_id>/listing_reveal_portrait.mp4 \
  -c:v libx264 -crf 24 -preset medium \
  -movflags faststart \
  -c:a aac -b:a 128k \
  out/listing_reveal/<listing_id>/listing_reveal_portrait_final.mp4
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Rules that directly apply:

- **All 16 photos must exist in the MLS photo set.** If you cannot match every photo in the video back to an MLS photo, the video does not ship. No AI-generated photos. No builder stock. No photographer stock from a different property.
- **No banned words in VO or on-screen text.** Run the banned-word check script: `python video_production_skills/listing_reveal/check_banned_words.py --script out/listing_reveal/<id>/vo_script.txt`
- **No same room twice.** Each interior space appears exactly once across 16 beats.
- **No AI photo-to-video on interior shots** (Kling/Runway/Hailuo are banned for interiors — they melt architectural details). Depth parallax and Ken Burns are deterministic Remotion motion only.
- **No generic price framing.** "Priced to sell" and "incredible value" are banned in VO and captions. State the price and let the viewer decide.
- **Manifesto rules 1-5** (no hallucinated data, no AI filler, no ambiguous provenance, no recycled clips, no unverifiable claims) apply.
- **Manifesto rule 8** (human review gate): new format trigger activates on first 30 days of production use — Matt or reviewer approves each render before publish.

---

## Brand rules

- **Colors:** Navy `#102742` for all pill backgrounds, stat cards, CTA cards. Gold `#D4AF37` for price display, accent borders, and stat card separators.
- **Fonts:** Amboqia for address headline, price, and Beat 16 CTA address. AzoSans Medium for beds/baths/sqft/lot supporting stats and VO captions.
- **No logo in frame.** No brokerage name in frame. No phone number in frame. No agent name in frame.
- **Beat 16 CTA:** address + "Tour link in bio." — nothing more. White text, navy background, Amboqia, centered, 72px.
- **Caption delivery:** all brokerage attribution, phone, and social handle live in the IG caption, not the video frame.
- **Text safe zone:** 900×1400 px centered in 1080×1920.
- **On-screen numbers carry units:** "$895,000" not "$895K". "3 bedrooms" not "3 bd". "2,100 sqft" not "2100".

---

## Data verification

The stat card on Beat 15 displays: price, beds, baths, sqft, lot. All five must trace to Supabase `listings` table, pulled fresh in Step 1. Verification trace:

```
list_price   — Supabase listings, id=<id>, field=list_price, pulled <timestamp>
bedrooms     — Supabase listings, id=<id>, field=bedrooms
bathrooms    — Supabase listings, id=<id>, field=bathrooms
sqft         — Supabase listings, id=<id>, field=sqft
lot_sqft     — Supabase listings, id=<id>, field=lot_sqft
```

Write this trace to `out/listing_reveal/<listing_id>/data_trace.txt`. If any field is null in Supabase, do not estimate — pull from MLS direct and document the source.

---

## Quality gate checklist

**Pre-render:**
- [ ] Photo count: 15 minimum in Supabase, 16 selected and curated
- [ ] `beat_assignment_final.json` reviewed manually — no same room twice
- [ ] Every selected photo verifiably exists in the MLS photo set (visual match, not filename match)
- [ ] Depth maps generated for Beats 1, 2, 12, 13 — each map visually inspected
- [ ] Beat timestamps from audio sync reviewed by ear
- [ ] VO script checked for banned words — zero hits
- [ ] All VO MP3 files play correctly, no clipping, no overlap between beats
- [ ] BEATS array has 4+ different motion types
- [ ] All `photoPath` and `depthDir` paths confirmed to exist on disk
- [ ] `data_trace.txt` written with source for all five stat card values

**Post-render:**
- [ ] `ffprobe` duration: 40-48 seconds
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] Frame at 0s: hero exterior, motion engaged, address overlay, no black
- [ ] Frame at 25% mark: new visual register or text overlay (Beat 4 re-hook)
- [ ] Frame at 50% mark: drone aerial or exterior — pattern interrupt confirmed
- [ ] Frame at final 15%: kinetic stat card — price, beds, baths, sqft, lot all visible
- [ ] No frozen frames at any beat boundary
- [ ] No brokerage name, phone, or agent name in any frame
- [ ] No banned words visible in any on-screen text
- [ ] File size under 100 MB after CRF 24 encode
- [ ] All on-screen numbers carry units
- [ ] **Human review gate for first 30 days** (per ANTI_SLOP_MANIFESTO rule 8)

---

## Output paths

```
out/listing_reveal/<listing_id>/
  photos/                          # Downloaded MLS photos
  depth/beat_1/ ... beat_16/       # Depth maps (only for depth_parallax beats)
  audio/beat_01_vo.mp3 ... 14/     # ElevenLabs VO per beat
  beat_assignment_final.json       # Curated 16-beat assignment
  beat_timestamps.json             # Audio sync timestamps
  vo_script.txt                    # Full VO script
  remotion_props.json              # Props JSON for render command
  data_trace.txt                   # Verification trace for all stat card values
  listing_reveal_portrait.mp4      # Remotion output (pre-encode)
  listing_reveal_portrait_final.mp4
  listing_reveal_landscape_final.mp4  # Horizontal cut if requested
  qa_frames/                       # Extracted QA frames
```

---

## See also

- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master constraints
- `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md` — pre/post render checklists
- `video_production_skills/depth_parallax/SKILL.md` — depth parallax detail
- `video_production_skills/audio_sync/SKILL.md` — beat detection and audio sync
- `video_production_skills/earth_zoom/SKILL.md` — optional Beat 0 intro
- `video_production_skills/social_calendar/SKILL.md` — listing_reveal feeds the full-tour slot
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — enforced rules
