---
name: earth_zoom
description: "From-space-to-front-door cinematic intro for new listings. Scripted Google Earth Studio descent + Remotion composite + ElevenLabs VO."
---

# Earth Zoom — Google Earth Studio Descent to Front Door

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` before writing any composition code. All hard constraints (hook, beat length, retention, branding) apply to this format without exception.**

---

## What it is

A cinematic opening sequence that begins in low-Earth orbit and descends to the listing's front door in 8-12 seconds of rendered footage. The descent is generated in Google Earth Studio (free, browser-based, no API key needed for individual creators) by scripting a KML camera path from the listing's lat/lng coordinates. The PNG sequence from Earth Studio is imported into a Remotion composition where the address overlay, logo watermark, and ElevenLabs VO are composited on top. The final sequence is either used as Beat 1 of a full listing video or as a standalone 15-20s hook clip for social.

**Platforms:** IG Reels (1080×1920), YT Shorts (1080×1920), TikTok (1080×1920), horizontal cut for YT standard (1920×1080).

**Primary use:** New listing launch day. Secondary use: Price reduction announcement (re-zoom with updated price overlay).

---

## When to invoke

- New listing goes active in MLS and listing video pipeline is triggered
- Photographer has delivered assets and listing coordinates are confirmed in Supabase `listings` table
- Price reduction announcement where the property deserves a fresh hook
- Neighborhood tour intro (feeds into `neighborhood_tour/SKILL.md` as optional beat 1)
- Any video where the location itself is the story (views, acreage, rural setting, resort community proximity)

Do NOT invoke for:
- Listings in dense urban subdivisions where the satellite view looks identical to every neighbor
- Same-week re-renders of the same address (Earth Studio caches are reusable — check `out/earth_zoom/<listing_id>/` before re-running)

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Lat/lng pull | Supabase `listings` table | $0 | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` |
| Camera path generation | Python script `generate_esp.py` | $0 | None |
| Earth Studio rendering | Google Earth Studio (eartstudio.google.com) | Free | Google account |
| PNG sequence export | Earth Studio built-in renderer | $0 | Same Google account |
| Sequence-to-video | ffmpeg | $0 | Homebrew install |
| Remotion composite | Remotion `EarthZoomComp` | $0 (CPU) | Node env |
| VO synthesis | ElevenLabs API | ~$0.003/char | `ELEVENLABS_API_KEY` |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |

---

## Step-by-step workflow

### Step 1 — Pull listing coordinates from Supabase

```bash
# Pull lat/lng and address for the listing
# Replace <listing_id> with the actual MLS ID or Supabase UUID
node -e "
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('listings')
  .select('id, address, city, state, zip, latitude, longitude, list_price, bedrooms, bathrooms, sqft')
  .eq('id', '<listing_id>')
  .single()
  .then(({ data, error }) => {
    if (error) throw error;
    console.log(JSON.stringify(data, null, 2));
  });
"
```

Confirm the lat/lng resolves to the correct parcel before proceeding. Cross-check against Google Maps by pasting `<lat>,<lng>` into the URL bar. If the pin does not land on the subject property's lot, do not proceed — fix the coordinates in Supabase first.

Write the confirmed coordinates to `out/earth_zoom/<listing_id>/listing_meta.json`:

```json
{
  "listing_id": "<id>",
  "address": "1234 Example Rd",
  "city": "Bend",
  "state": "OR",
  "zip": "97702",
  "latitude": 44.0582,
  "longitude": -121.3153,
  "list_price": 895000,
  "bedrooms": 3,
  "bathrooms": 2,
  "sqft": 2100,
  "coordinates_verified": true,
  "coordinates_verified_at": "2026-04-26T10:00:00Z",
  "coordinates_source": "Supabase listings table, cross-checked Google Maps"
}
```

### Step 2 — Generate Earth Studio camera path (ESP file)

Google Earth Studio uses an `.esp` project file (JSON format) to define camera keyframes. The `generate_esp.py` script takes a lat/lng and outputs a ready-to-import `.esp` file that scripts a descent from 400 km altitude down to ground level, arriving at the property with a slight upward tilt to reveal the roof and yard.

```bash
python video_production_skills/earth_zoom/generate_esp.py \
  --lat 44.0582 \
  --lng -121.3153 \
  --address "1234 Example Rd, Bend OR" \
  --output out/earth_zoom/<listing_id>/camera_path.esp \
  --duration 10 \
  --fps 60 \
  --resolution 4k
```

**Flags:**

| Flag | Default | Description |
|------|---------|-------------|
| `--duration` | `10` | Descent duration in seconds (8-12 recommended) |
| `--fps` | `60` | Frame rate (60 for smooth descent; Earth Studio supports up to 60) |
| `--resolution` | `4k` | Output resolution: `4k` (3840×2160) or `1080p` |
| `--tilt-final` | `-15` | Camera tilt at arrival frame (negative = looking slightly down at property) |
| `--altitude-start` | `400000` | Start altitude in meters |
| `--altitude-end` | `200` | End altitude in meters (200m = roughly rooftop view) |

The descent curve is non-linear — it accelerates through the cloud layer and decelerates on final approach. This creates "terminal velocity feel" as specified. The camera spline is a cubic bezier. Do not use a linear interpolation path — it will feel like a slow boring zoom.

**Inspect the `.esp` output:** open it in a text editor and confirm `lat/lng` in the final keyframe matches `listing_meta.json` to within 0.0001 degrees.

### Step 3 — Import and render in Google Earth Studio

1. Open [eartstudio.google.com](https://eartstudio.google.com) in Chrome
2. File → Import Project → select `out/earth_zoom/<listing_id>/camera_path.esp`
3. Verify the camera path in the viewport — the final frame should hover over the correct parcel
4. If the final frame does not center on the subject property: adjust the final keyframe lat/lng manually in Earth Studio's keyframe editor, then export the corrected `.esp` back and update `camera_path.esp`
5. Render settings: Output → Image Sequence, Format: PNG, Frame Rate: 60, Resolution: 3840×2160 (4K)
6. Render to local folder: `~/Downloads/earth_studio_<listing_id>/`
7. Wait for render to complete (typically 5-10 minutes for 600 frames at 4K)
8. Move frames to repo: `mv ~/Downloads/earth_studio_<listing_id>/ out/earth_zoom/<listing_id>/frames/`

### Step 4 — QA: snap final frame and confirm address

```bash
# Extract the final frame (last PNG in the sequence)
LAST_FRAME=$(ls out/earth_zoom/<listing_id>/frames/*.png | sort | tail -1)

# Open final frame for visual inspection
open "$LAST_FRAME"
```

Compare the final frame side-by-side against the MLS photo of the property's aerial or front exterior. The roof shape, lot boundaries, and driveway configuration must match. If a neighboring property is centered in the final frame, the `.esp` file has the wrong endpoint coordinates — do not proceed to composite.

This QA step is mandatory. Shipping a video that zooms to the wrong house is a compliance failure.

### Step 5 — Convert PNG sequence to source video

```bash
ffmpeg -framerate 60 \
  -i "out/earth_zoom/<listing_id>/frames/frame%04d.png" \
  -c:v libx264 -crf 18 -preset slow \
  -pix_fmt yuv420p \
  out/earth_zoom/<listing_id>/earth_source_4k.mp4
```

Verify output duration:

```bash
ffprobe -v quiet -show_entries format=duration \
  -of default=noprint_wrappers=1 \
  out/earth_zoom/<listing_id>/earth_source_4k.mp4
```

Duration should match `--duration` from Step 2 (e.g., 10.00s for a 10-second path).

### Step 6 — Synthesize VO with ElevenLabs

Write the VO script. Rules from `VIDEO_PRODUCTION_SKILL.md` Section 2 apply:
- First spoken word is content — no "hey," "today," "welcome"
- VO begins within first 2 seconds of the composite
- No generic real estate language
- Max 12-15 words for the descent hook

Example scripts by property type:

**Mountain view / rural:**
> "44 acres. Smith Rock visible from the front porch. duh-shoots River corridor out back."

**In-town Bend:**
> "Three blocks from the Old Mill. duh-shoots River Trail out the back gate."

**Resort community:**
> "Inside Tetherow. First fairway views from every window."

Note: "Deschutes" must appear in the script as "duh-shoots" (memory rule — phonetic for ElevenLabs TTS to pronounce correctly).

```bash
python video_production_skills/earth_zoom/synth_vo.py \
  --text "44 acres. Smith Rock visible from the front porch. duh-shoots River corridor out back." \
  --output out/earth_zoom/<listing_id>/vo_hook.mp3 \
  --voice-id "$ELEVENLABS_VOICE_ID" \
  --model "eleven_turbo_v2_5"
```

Verify the MP3 plays correctly and the word "duh-shoots" is rendered as the correct Central Oregon river pronunciation before proceeding.

### Step 7 — Remotion composite

The `EarthZoomComp` Remotion composition lives at `video/earth_zoom/src/EarthZoomComp.tsx`. It accepts these props:

```typescript
type EarthZoomProps = {
  listingId: string;
  earthVideoSrc: string;        // path to earth_source_4k.mp4
  voAudioSrc: string;           // path to vo_hook.mp3
  address: string;              // "1234 Example Rd"
  cityStateZip: string;         // "Bend, OR 97702"
  listPrice: number;            // 895000
  beds: number;
  baths: number;
  sqft: number;
  orientation: 'portrait' | 'landscape';
};
```

The comp:
1. Plays the Earth Studio video full-bleed (portrait: crop center 1080×1920 from 4K source; landscape: crop center 1920×1080)
2. Fades in address overlay at frame 30 (0.5s) — white text, Amboqia, 72px, centered, navy pill background
3. VO audio starts at frame 0
4. At final 2 seconds (landing), fades in price + beds/baths/sqft stats pill (AzoSans Medium, 48px, navy background with gold border, 900px wide, centered)
5. Transitions to Beat 1 of the main listing video via 0.5s cross-dissolve

Render command:

```bash
npx remotion render \
  video/earth_zoom/src/index.ts \
  EarthZoomComp \
  out/earth_zoom/<listing_id>/earth_zoom_portrait.mp4 \
  --props='{"listingId":"<id>","earthVideoSrc":"out/earth_zoom/<listing_id>/earth_source_4k.mp4","voAudioSrc":"out/earth_zoom/<listing_id>/vo_hook.mp3","address":"1234 Example Rd","cityStateZip":"Bend, OR 97702","listPrice":895000,"beds":3,"baths":2,"sqft":2100,"orientation":"portrait"}' \
  --concurrency=1
```

### Step 8 — Post-render quality gate

Run the full gate before touching the file again:

```bash
# Duration check
ffprobe -v quiet -show_entries format=duration -of default=noprint_wrappers=1 \
  out/earth_zoom/<listing_id>/earth_zoom_portrait.mp4

# Blackdetect strict
ffmpeg -i out/earth_zoom/<listing_id>/earth_zoom_portrait.mp4 \
  -vf blackdetect=d=0.05:pix_th=0.05 -an -f null - 2>&1 | grep black_

# Extract frames for visual QA
ffmpeg -i out/earth_zoom/<listing_id>/earth_zoom_portrait.mp4 \
  -vf fps=2 out/earth_zoom/<listing_id>/qa_frames/frame_%03d.jpg

# Open QA frames
open out/earth_zoom/<listing_id>/qa_frames/
```

Visually confirm:
- Frame at 0s: Earth from altitude, motion engaged, no black
- Frame at ~50% descent: recognizable Central Oregon landscape visible (if clear weather)
- Final frame: rooftop/lot visible, matches MLS aerial or front-exterior photo
- Address overlay legible, correct address displayed
- Price pill displays correct dollar amount with dollar sign and commas

### Step 9 — Final encode

```bash
ffmpeg -i out/earth_zoom/<listing_id>/earth_zoom_portrait.mp4 \
  -c:v libx264 -crf 24 -preset medium \
  -movflags faststart \
  -c:a aac -b:a 128k \
  out/earth_zoom/<listing_id>/earth_zoom_portrait_final.mp4
```

File size must be under 100 MB. Check:

```bash
du -sh out/earth_zoom/<listing_id>/earth_zoom_portrait_final.mp4
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Rules that apply to this format:

- **No fake satellite imagery.** Every frame of the descent is real Google Earth satellite data. If cloud cover obscures the approach, note it in the QA log but do not swap in AI-generated clear-sky imagery.
- **No AI-generated landscapes.** The descent is 100% Earth Studio output. No upscaling with AI generative fill, no sky replacement.
- **No zoom to the wrong house.** The final frame QA in Step 4 is mandatory and non-skippable. A wrong-house zoom is not a minor error — it is a compliance failure. Kill the render, fix the coordinates, re-render.
- **No generic VO.** "Beautiful property in an amazing location" is banned. The script must state a specific, verifiable fact about the property (acreage, river, view, proximity to a named landmark).
- **No unverified coordinates.** Coordinates must trace to Supabase `listings` table with the cross-check note in `listing_meta.json`. Never hard-code lat/lng from memory or a prior script.
- **Manifesto rules 1-4** (no hallucinated data, no AI filler, no unverifiable claims, no recycled assets) apply directly.
- **Manifesto rule 8** (human review gate for new format): human scrub of final frame + address verification for the first 30 days of production use.

---

## Brand rules

- **Colors:** Navy `#102742` for all pill backgrounds and text scrim overlays. Gold `#D4AF37` for price display borders and accent lines. No other colors.
- **Fonts:** Amboqia for address and price headline. AzoSans Medium for beds/baths/sqft supporting stats.
- **No logo or brokerage name in the video frame.** Attribution lives in the IG caption and bio.
- **No agent name, phone number, or "REPRESENTED BY" in any frame.**
- **Gold border only on the price pill at arrival frame** — not during the descent sequence.
- **Text safe zone:** 900×1400 px centered inside 1080×1920 portrait.

---

## Data verification

The only data points displayed in the earth_zoom format are address, price, beds, baths, and sqft. All four come from the Supabase `listings` table pull in Step 1. The verification trace must appear in `listing_meta.json`:

```
address — Supabase listings, id=<id>, field=address
list_price — Supabase listings, id=<id>, field=list_price, pulled <timestamp>
bedrooms — Supabase listings, id=<id>, field=bedrooms
bathrooms — Supabase listings, id=<id>, field=bathrooms
sqft — Supabase listings, id=<id>, field=sqft
```

No rounding. If `list_price` is `895000`, display `$895,000`. Not `$895K`. Not `~$900K`.

---

## Quality gate checklist

**Pre-render:**
- [ ] `listing_meta.json` exists with all fields, `coordinates_verified: true`, and verification timestamp
- [ ] Final frame of Earth Studio render visually confirms correct property parcel
- [ ] `camera_path.esp` final keyframe lat/lng within 0.0001° of `listing_meta.json` coordinates
- [ ] VO script reviewed for banned words and generic phrases
- [ ] "duh-shoots" phonetic used wherever "Deschutes" appears in VO
- [ ] VO MP3 plays correctly, pronunciation verified by ear
- [ ] `earth_source_4k.mp4` duration matches `--duration` setting
- [ ] All asset paths in Remotion props exist on disk

**Post-render:**
- [ ] `ffprobe` duration: 8-20s (descent only) or up to 60s (if used as full hook sequence)
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] Frame at 0s: Earth from altitude, motion, no black, no logo
- [ ] Final frame: property visible, address overlay correct
- [ ] Price displays with dollar sign and commas, no rounding
- [ ] No brokerage name, phone, or agent name in any frame
- [ ] File size under 100 MB after CRF 24 encode
- [ ] Visual diff of final frame against MLS aerial photo (roof shape and lot match)
- [ ] **Human review gate for first 30 days of new format launch** (per ANTI_SLOP_MANIFESTO rule 8): Matt or designated reviewer signs off on final frame correctness and address accuracy before any publish

---

## Output paths

```
out/earth_zoom/<listing_id>/
  listing_meta.json          # coordinates, address, price — verified
  camera_path.esp            # Earth Studio project file
  frames/                    # PNG sequence from Earth Studio (4K, 60fps)
  earth_source_4k.mp4        # ffmpeg-encoded source video from frames
  vo_hook.mp3                # ElevenLabs VO
  qa_frames/                 # Extracted frames for visual QA
  earth_zoom_portrait.mp4    # Remotion render output (pre-encode)
  earth_zoom_portrait_final.mp4    # Final CRF 24 deliverable
  earth_zoom_landscape_final.mp4   # Horizontal cut (if needed)
```

Logs:
```
out/earth_zoom/<listing_id>/render.log   # Remotion stdout
out/earth_zoom/<listing_id>/qa.log       # Quality gate results
```

---

## See also

- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master constraints, beat length, hook rules
- `video_production_skills/VIRAL_VIDEO_CONSTRAINTS.md` — pre-render and post-render checklists
- `video_production_skills/listing_reveal/SKILL.md` — earth_zoom is Beat 0 of the listing_reveal pipeline
- `video_production_skills/neighborhood_tour/SKILL.md` — earth_zoom flythrough is the standard opener for neighborhood tours
- `video_production_skills/depth_parallax/SKILL.md` — depth parallax replaces earth_zoom on listings where satellite view is obscured or uninformative
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — manifesto rules enforced in this skill
