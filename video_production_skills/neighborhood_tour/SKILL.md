---
name: neighborhood_tour
description: "Library generator for area guide videos. 19 named Bend-area neighborhoods/communities. Earth Studio flythrough + Remotion data overlay + ElevenLabs VO. Per-city JSON config with citation arrays."
---

# Neighborhood Tour — Area Guide Video Library Generator

**Read `video_production_skills/VIDEO_PRODUCTION_SKILL.md` and `CLAUDE.md` (Data Accuracy section) before writing any composition code. Every market stat in a neighborhood tour must have a verified source. No "best of" claims without comparative data. No AI-generated neighborhood photos.**

---

## What it is

A batch-rendered library of 60-90 second vertical area guide videos, one per named neighborhood or community in the Ryan Realty coverage area. Each video uses a Google Earth Studio scripted polygon flythrough of the neighborhood boundary as the visual spine, with Remotion overlays showing median price, school data (GreatSchools or state DOE source only), drive time to downtown Bend, and a 2-3 sentence factual color paragraph sourced from verified per-city configuration. ElevenLabs VO reads a per-neighborhood script populated from that same config. All 19 are batch-rendered and stored as a library in `out/neighborhood_tours/`.

**Platforms:** IG Reels (1080×1920), TikTok, YT Shorts. Horizontal cut for the website area guides pages (`app/area-guides/`).

**Output length:** 60-90 seconds. Under 60s = not enough depth to be useful. Over 90s = algorithm cliff for this format.

---

## Neighborhood inventory — confirmed list

This list was confirmed against `scripts/seed.ts` (the canonical community/city list for the repo). Do not add neighborhoods that are not in this list without also adding them to `scripts/seed.ts` and the Supabase communities or cities table.

**Cities (Supabase `cities` table):**
1. `bend` — Bend
2. `redmond` — Redmond
3. `sisters` — Sisters
4. `sunriver` — Sunriver (city entry; see also resort community below)
5. `la-pine` — La Pine
6. `prineville` — Prineville
7. `madras` — Madras
8. `terrebonne` — Terrebonne
9. `tumalo` — Tumalo
10. `crooked-river-ranch` — Crooked River Ranch
11. `powell-butte` — Powell Butte

**Communities within or adjacent to Bend (Supabase `communities` table):**
12. `northwest-crossing` — Northwest Crossing
13. `old-bend` — Old Bend
14. `awbrey-butte` — Awbrey Butte
15. `awbrey-glen` — Awbrey Glen
16. `tetherow` — Tetherow (resort)
17. `broken-top` — Broken Top
18. `discovery-west` — Discovery West
19. `shevlin-commons` — Shevlin Commons

**Resort communities (batch-render lower priority — on-demand only):**
- `black-butte-ranch`, `brasada-ranch`, `eagle-crest`, `pronghorn`, `caldera-springs`, `crosswater`, `vandevert-ranch`, `petrosa`, `river-rim`, `three-pines`, `mountain-high`

The core 19 above are the mandatory batch. Resort communities are on-demand renders, not part of the weekly batch.

**Note on Gilchrist:** Gilchrist was listed in the skill specification but is not in `scripts/seed.ts`. Do not create a neighborhood tour for Gilchrist until it is added to the cities table. Flag this to Matt.

---

## When to invoke

- Initial library build (batch all 19 core neighborhoods in one run)
- Quarterly refresh (re-render any neighborhood where median price has changed by 5%+ or DOM has shifted by 7+ days)
- New listing in a neighborhood that does not yet have a tour video
- Area guide page on the website needs a hero video (`app/area-guides/`)
- On-demand for a specific neighborhood at Matt's request

Do NOT invoke for:
- Neighborhoods not in the confirmed list (add to seed.ts first)
- Any neighborhood where verified market data is not available in Supabase (no data = no video, no estimates)
- Any claim about school quality, walkability, or demographics that cannot be sourced to GreatSchools, state DOE, Walk Score API, or Census ACS

---

## Tool chain

| Step | Tool | Cost | Auth |
|------|------|------|------|
| Per-city config | `neighborhood_tours/configs/<slug>.json` | $0 | — |
| Market data pull | Supabase `market_pulse_live` + `listings` | $0 | `SUPABASE_SERVICE_ROLE_KEY` |
| Boundary KML | Prebuilt per-city KML (see Step 1) | $0 | — |
| Earth Studio flythrough | Google Earth Studio | Free | Google account |
| PNG sequence | Earth Studio renderer | $0 | — |
| Remotion composition | `NeighborhoodTourComp` | $0 | Node env |
| VO synthesis | ElevenLabs API | ~$0.003/char | `ELEVENLABS_API_KEY` |
| School data | GreatSchools API (or static from state DOE) | Free tier | `GREATSCHOOLS_API_KEY` |
| Walk Score | Walk Score API | Free tier | `WALKSCORE_API_KEY` |
| Drive time | Google Maps Distance Matrix API | ~$0.005/req | `GOOGLE_MAPS_API_KEY` |
| Final encode | ffmpeg x264 CRF 24 | $0 | — |

---

## Per-city config schema

Each neighborhood has a JSON config at `video_production_skills/neighborhood_tour/configs/<slug>.json`. This file is the single source of truth for all non-Supabase data shown in the video.

```json
{
  "slug": "northwest-crossing",
  "display_name": "Northwest Crossing",
  "city": "Bend",
  "state": "OR",
  "type": "community",
  "boundary_kml": "video_production_skills/neighborhood_tour/boundaries/northwest-crossing.kml",
  "centroid": { "lat": 44.0832, "lng": -121.3421 },
  "flythrough_style": "polygon_orbit",
  "market_data_filter": {
    "table": "listings",
    "city": "Bend",
    "subdivision": "Northwest Crossing",
    "property_type": "A"
  },
  "school_data": {
    "elementary": "William E. Miller Elementary",
    "middle": "Pacific Crest Middle School",
    "high": "Summit High School",
    "greatschools_ids": ["110001", "110002", "110003"],
    "source": "GreatSchools API, pulled 2026-04-26",
    "source_url": "https://www.greatschools.org/oregon/bend/"
  },
  "walk_score": {
    "score": 52,
    "label": "Somewhat Walkable",
    "source": "Walk Score API, pulled 2026-04-26"
  },
  "drive_time_downtown_min": 8,
  "drive_time_source": "Google Maps Distance Matrix API, centroid to Brooks St, Bend OR, pulled 2026-04-26",
  "color_paragraph": "Northwest Crossing is a planned neighborhood built around walkability and outdoor access. Shevlin Park borders the west edge — residents can walk or bike directly into 652 acres of ponderosa forest. The neighborhood has a mix of new construction from the early 2000s through today, with a dedicated town center, farmers market, and network of paved trails connecting to the citywide path system.",
  "color_paragraph_source": "Oregon State University Extension, City of Bend Parks & Recreation — verified factual claims only",
  "citations": [
    {
      "claim": "Shevlin Park borders the west edge",
      "source": "City of Bend Parks & Recreation — shevlinpark.com"
    },
    {
      "claim": "652 acres",
      "source": "City of Bend Parks & Recreation — Shevlin Park page"
    },
    {
      "claim": "farmers market",
      "source": "Northwest Crossing Farmers Market — nwxmarket.com"
    }
  ],
  "banned_claims": [
    "best neighborhood in Bend",
    "most desirable",
    "top-rated schools"
  ]
}
```

**Every claim in `color_paragraph` must have a matching entry in `citations`.** If a claim cannot be sourced, it does not go in `color_paragraph`. The `banned_claims` array documents superlatives that were considered and rejected.

---

## Step-by-step workflow

### Step 1 — Confirm or create the per-city config

For each neighborhood in the batch:

```bash
ls video_production_skills/neighborhood_tour/configs/
```

If the config does not exist, create it using the schema above. For each data point in the config:
- Pull school data from GreatSchools API or Oregon Department of Education (`ode.state.or.us`)
- Pull Walk Score from Walk Score API
- Pull drive time from Google Maps Distance Matrix API
- Research and write the `color_paragraph` from verifiable sources — municipal parks departments, City of Bend planning documents, Oregon State archives, neighborhood association websites
- Write one `citations` entry per factual claim in the paragraph

Do not include any claim that does not have a citation. "Northwest Crossing has a vibrant community feel" is an opinion and is banned. "Northwest Crossing has a town center with weekly farmers markets" is a fact with a source.

### Step 2 — Pull market data for the neighborhood

```bash
python video_production_skills/neighborhood_tour/pull_neighborhood_data.py \
  --config video_production_skills/neighborhood_tour/configs/<slug>.json \
  --output out/neighborhood_tours/<slug>/market_data.json
```

The script executes:

```sql
SELECT
  percentile_cont(0.5) WITHIN GROUP (ORDER BY close_price) AS median_price,
  COUNT(*) AS row_count,
  ROUND(AVG(dom), 0) AS avg_dom,
  MIN(close_date) AS period_start,
  MAX(close_date) AS period_end
FROM listings
WHERE
  property_type = 'A'
  AND city = '<city>'
  AND subdivision ILIKE '%<subdivision>%'
  AND status = 'Closed'
  AND close_date >= NOW() - INTERVAL '12 months';
```

Also pulls active inventory count:

```sql
SELECT COUNT(*) AS active_count
FROM listings
WHERE
  property_type = 'A'
  AND city = '<city>'
  AND subdivision ILIKE '%<subdivision>%'
  AND status = 'Active';
```

**Minimum row count for median:** 5 closed sales. If fewer than 5 closed sales in the last 12 months, widen to 24 months. If still fewer than 5, display the city-level median with a note "City-level median — subdivision data limited" in the overlay citation. Never display a median computed from fewer than 5 sales without the note.

Write verification trace to `out/neighborhood_tours/<slug>/data_trace.txt`.

### Step 3 — Build the Earth Studio flythrough

The neighborhood tour uses a polygon orbit path (flythrough around the boundary perimeter at low altitude) rather than the straight-line descent used in `earth_zoom/SKILL.md`.

```bash
python video_production_skills/neighborhood_tour/generate_polygon_esp.py \
  --kml video_production_skills/neighborhood_tour/boundaries/<slug>.kml \
  --output out/neighborhood_tours/<slug>/flythrough.esp \
  --duration 30 \
  --fps 30 \
  --altitude 800 \
  --orbit-direction clockwise
```

The polygon orbit starts at the neighborhood's NW corner, orbits clockwise around the boundary at 800m AGL, completing one full circuit in 30 seconds.

Import to Earth Studio, render PNG sequence, convert to video per `earth_zoom/SKILL.md` Steps 3-5. Use 1080p (not 4K) for neighborhood tours — the additional resolution is not visible in the final portrait crop and slows Earth Studio render significantly.

```bash
ffmpeg -framerate 30 \
  -i "out/neighborhood_tours/<slug>/frames/frame%04d.png" \
  -c:v libx264 -crf 18 -preset slow \
  -pix_fmt yuv420p \
  out/neighborhood_tours/<slug>/flythrough_source.mp4
```

### Step 4 — Write and synthesize the VO script

Template (60-90s, ~150-200 words):

```
Beat 1 (hook): "<Neighborhood name>. <One specific distinguishing fact.>"
Beat 2 (context): "<What makes this area distinct — one sentence from color_paragraph.>"
Beat 3 (stats): "Right now, the median close price in <neighborhood> is <median_price>. Homes are averaging <dom> days on market."
Beat 4 (lifestyle): "<One verifiable lifestyle or access fact — from citations.>"
Beat 5 (schools/amenities): "Schools serving <neighborhood>: <school names from config>."
Beat 6 (drive time): "<Drive_time> minutes to downtown Bend."
Beat 7 (CTA): "Full neighborhood guide at ryan-realty.com."
```

Voice rules apply: no semicolons, no em-dashes, no "stunning", no "nestled", no "boasts", no AI filler language. Declarative sentences. Specific facts.

"duh-shoots" phonetic wherever Deschutes appears.

```bash
python video_production_skills/neighborhood_tour/synth_vo.py \
  --config video_production_skills/neighborhood_tour/configs/<slug>.json \
  --market-data out/neighborhood_tours/<slug>/market_data.json \
  --output-dir out/neighborhood_tours/<slug>/audio/ \
  --voice-id "$ELEVENLABS_VOICE_ID" \
  --model "eleven_turbo_v2_5"
```

### Step 5 — Remotion composition

`NeighborhoodTourComp` at `video/neighborhood_tour/src/NeighborhoodTourComp.tsx`.

Beat structure:

| Beat | Duration | Content | Overlay |
|------|----------|---------|---------|
| 1 | 5s | Earth Studio flythrough opening | Neighborhood name pill (Amboqia, 72px, navy pill) |
| 2 | 8s | Flythrough continues — wide view | Color paragraph sentence 1 (fade in) |
| 3 | 8s | Flythrough slows — mid-altitude | Median price + DOM stat card. Citation pill. |
| 4 | 8s | Flythrough at lower altitude | Lifestyle/access fact overlay |
| 5 | 8s | Flythrough final orbit | Schools: elementary, middle, high (source: GreatSchools pill) |
| 6 | 8s | Final descent toward neighborhood center | Drive time to downtown + Walk Score |
| 7 | 5s | Freeze on final frame + slow push | CTA: "ryan-realty.com" + area guide link |
| (end) | 10s | Freeze or slow push holds | No overlay — visual breathing room before platform chrome |

All stat overlay values come from `market_data.json` and the per-city config JSON. No hard-coded values in the Remotion component.

### Step 6 — Batch render all 19

```bash
python video_production_skills/neighborhood_tour/batch_render.py \
  --slugs "bend,redmond,sisters,sunriver,la-pine,prineville,madras,terrebonne,tumalo,crooked-river-ranch,powell-butte,northwest-crossing,old-bend,awbrey-butte,awbrey-glen,tetherow,broken-top,discovery-west,shevlin-commons" \
  --output-dir out/neighborhood_tours/ \
  --concurrency 1
```

Runs sequentially (concurrency=1 — one Remotion render at a time to avoid Chrome OOM). Full batch estimated at 3-4 hours.

### Step 7 — Post-render QA and encode

For each neighborhood in the batch:

```bash
python video_production_skills/neighborhood_tour/qa_batch.py \
  --output-dir out/neighborhood_tours/
```

The QA script runs:
- `ffprobe` duration check (60-90s gate)
- `ffmpeg blackdetect` (zero black sequences required)
- Frame extraction at 10s intervals
- OCR on stat overlays, diff against `market_data.json`
- Citation pill presence check (confirms source text visible on stat beats)

Failed neighborhoods are logged to `out/neighborhood_tours/batch_qa_failures.log`. Fix and re-render individually.

Final encode for each passing video:

```bash
for SLUG in bend redmond sisters ...; do
  ffmpeg -i out/neighborhood_tours/${SLUG}/tour_render.mp4 \
    -c:v libx264 -crf 24 -preset medium \
    -movflags faststart \
    -c:a aac -b:a 128k \
    out/neighborhood_tours/${SLUG}.mp4
done
```

---

## Anti-slop guardrails

Read `video_production_skills/ANTI_SLOP_MANIFESTO.md` before QA. Critical rules for this format:

- **No demographic stereotyping.** Do not characterize neighborhoods by who lives there. Describe the physical environment, amenities, and access. No implied demographic profiles.
- **No school rankings without a named source.** "Top-rated schools" is banned. "Summit High School — GreatSchools rating: 8/10 (pulled 2026-04-26)" is acceptable. If GreatSchools is unavailable, use Oregon Department of Education data with the URL.
- **No "best" claims without comparative data.** "One of Bend's best neighborhoods" is banned without a defined metric and comparison set.
- **No AI-generated neighborhood photos.** The Earth Studio flythrough is real satellite data. No generative fill on cloudy frames, no AI sky replacement.
- **Every claims in the video maps to a citations entry in the config JSON.** Run the citation coverage check before render:
  ```bash
  python video_production_skills/neighborhood_tour/check_citations.py \
    --config video_production_skills/neighborhood_tour/configs/<slug>.json
  ```
- **No median from fewer than 5 sales without the "limited data" note.** The data pull script enforces this — do not override.
- **No city-level data presented as neighborhood-level data** (unless explicitly labeled as city-level with the note).
- **Manifesto rules 1, 2, 3, 5** apply: no hallucinated data, no AI filler, no ambiguous source, no unverifiable comparative claims.
- **Manifesto rule 8** (human review gate): first 30 days of library production — Matt reviews each video before it goes to the website or social.

---

## Brand rules

- **Colors:** Navy `#102742` for all overlay pills, stat cards, and CTA card. Gold `#D4AF37` for neighborhood name headline border and price accent.
- **Fonts:** Amboqia for neighborhood name headline. AzoSans Medium for all stat values, school names, and citation pills.
- **No brokerage logo in frame** during the flythrough segment. Logo may appear in the CTA end card (5s) only.
- **No agent name or phone in frame** during the video. CTA card shows URL only — phone lives in the IG caption.
- **Citation pills:** bottom-right of every stat beat, AzoSans 20px, white on semi-transparent navy. Format: "Source: [name], [date]".
- **Text safe zone:** 900×1400 px centered in 1080×1920.

---

## Data verification

Verification trace for every displayed number:

```
median_price   — listings, PropertyType='A', City='<city>', Subdivision='<sub>', CloseDate last 12mo, percentile_cont(0.5) = <value> over <n> rows, pulled <timestamp>
avg_dom        — same filter, avg(dom) = <value> over <n> rows
active_count   — listings, Status='Active', PropertyType='A', City='<city>', Subdivision='<sub>', count = <value>, pulled <timestamp>
school_data    — GreatSchools API (or ODE), school IDs documented in config, pulled <timestamp>
walk_score     — Walk Score API, centroid lat/lng from config, pulled <timestamp>
drive_time     — Google Maps Distance Matrix API, centroid to Brooks St, Bend, pulled <timestamp>
```

Write to `out/neighborhood_tours/<slug>/data_trace.txt`. Must exist before render starts.

---

## Quality gate checklist

**Pre-render (per neighborhood):**
- [ ] Per-city config JSON exists and all fields populated
- [ ] Every claim in `color_paragraph` has a matching `citations` entry
- [ ] `check_citations.py` passed with zero uncited claims
- [ ] Market data pull executed fresh (or within 24 hours if batch-running same day)
- [ ] Minimum 5 closed sales in the Supabase query result (or "limited data" note configured)
- [ ] `data_trace.txt` written and complete
- [ ] School data from GreatSchools or ODE (not from memory or Wikipedia)
- [ ] Walk Score from Walk Score API (not estimated)
- [ ] Drive time from Google Maps API (not estimated)
- [ ] VO script reviewed for banned words, no "approximately"
- [ ] KML boundary file exists at configured path
- [ ] Earth Studio final frame confirmed over correct neighborhood

**Post-render (per neighborhood):**
- [ ] `ffprobe` duration: 60-90 seconds
- [ ] `ffmpeg blackdetect` returns zero black sequences
- [ ] OCR diff: all stat overlays match `market_data.json`
- [ ] Citation pill visible on every stat beat
- [ ] No "best", "top-rated", or superlative claims without comparative source
- [ ] No demographic characterizations
- [ ] School names and scores match config (not MLS data)
- [ ] No brokerage name, phone, or agent name during flythrough segment
- [ ] File size under 100 MB
- [ ] **Human review gate for first 30 days** (per ANTI_SLOP_MANIFESTO rule 8)

**Batch QA:**
- [ ] `batch_qa_failures.log` reviewed — zero failures remaining
- [ ] All 19 core neighborhood files present in `out/neighborhood_tours/`
- [ ] Gilchrist absence noted and flagged to Matt (not in seed.ts — do not create)

---

## Output paths

```
video_production_skills/neighborhood_tour/
  configs/<slug>.json               # Per-city config (source of truth for non-Supabase data)
  boundaries/<slug>.kml             # Neighborhood boundary polygons

out/neighborhood_tours/
  <slug>/
    market_data.json                # Supabase pull results
    data_trace.txt                  # Verification trace
    flythrough.esp                  # Earth Studio project
    frames/                         # PNG sequence
    flythrough_source.mp4           # ffmpeg source video
    audio/                          # ElevenLabs VO per beat
    tour_render.mp4                 # Remotion output
    qa_frames/                      # Extracted QA frames
  <slug>.mp4                        # Final CRF 24 deliverable (flat, named by slug)
  batch_qa_failures.log             # QA failures summary
```

---

## See also

- `video_production_skills/VIDEO_PRODUCTION_SKILL.md` — master video constraints
- `video_production_skills/earth_zoom/SKILL.md` — same Earth Studio toolchain (descent vs polygon orbit)
- `video_production_skills/data_viz_video/SKILL.md` — market data pull methodology (shared)
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — enforced rules
- `CLAUDE.md` — Data Accuracy section (mandatory)
- `scripts/seed.ts` — canonical neighborhood/city list (ground truth for which areas exist)
- `app/area-guides/` — website destination for these videos
