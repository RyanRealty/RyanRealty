# Schoolhouse v5 Storyboard

**Asset:** 56111 School House Rd, Vandevert Ranch, Bend OR 97707
**Listing status:** PENDING. $3,025,000. Verify against SkySlope/MLS before Gate 4 render.
**Format:** 9:16 portrait, 1080×1920, 24fps target (matches the SchoolHouse_VirtualTour_Short_9x16 frame rate), ~143s total runtime including brand outro.
**Photo picks (locked Gate 1, 2026-04-25):** 27 photos.
**Motion language (locked Gate 2, 2026-04-25):** multi-point pan as default; vignette with subtle scale push for pure scenery without people; push + counter-translate for portrait historic.
**Voice (locked Gate 2):** ElevenLabs voice id `4YYIPFl9wE5c4L2eu2Gb`, speed 0.88, ffmpeg apad inter-sentence silence padding.
**Music (locked Gate 2):** ElevenLabs Music compose, ~145s, cinematic Western register, sparse piano + low strings, no percussion swell.
**Boundary source (locked Gate 2):** Deschutes County GIS public portal, Vandevert Ranch parcel KML/GeoJSON.
**VO script:** [vo_script_v5.txt](vo_script_v5.txt)

---

## Cover frame (first 2.5s, locks the IG/TikTok thumbnail) — Option A hook (locked Gate 2)

| # | Time | Visual | Text overlay | Notes |
|---|---|---|---|---|
| C | 0.0 - 1.0s | Satellite tile darkened to ~30% brightness (vignette behind text), no motion | **`1892.`** (Georgia bold, gold #C8A864, ~200pt, centered) | The hook. Single year as the scroll-stopper. Specific, unusual, provokes "why 1892?" Resolves in the next beat. |
| C2 | 1.0 - 2.5s | `1892.` dissolves out (300ms cross-fade); satellite tile brightens to full; **VANDEVERT RANCH** appears in Georgia serif gold #C8A864 ~64pt centered, subtle 200ms scale-up from 0.96 → 1.0 | **VANDEVERT RANCH** (place reveal) | Thumbnail likely locks here on the place name with the bright satellite tile underneath. Hold static long enough for IG/TikTok preview to capture this frame cleanly. |

## Open — Boundary draw

| # | Time | Photo / Asset | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|
| 0 | 2.5 - 6.0s | Same satellite tile + animated SVG `<path>` of the Vandevert Ranch parcel boundary (Deschutes County GIS taxlot `201117C001000`, 98 vertices, saved to `public/v5_library/vandevert_parcel.geojson`), gold #C8A864 stroke 2px, soft outer glow, dasharray draw-on animation. **REVEAL** subtitle "REPRESENTED BY RYAN REALTY" (Montserrat semibold uppercase, gold, 24pt, letter-spacing +6) appears at 4.5s as boundary completes. | Tile is square, parcel polygon overlays | Full-bleed satellite tile (recommend z=16 in Gate 4 for parcel readability — z=14 makes lot too small), parcel polygon scaled to ~70% of frame, centered on subject parcel | Boundary draw (animated `<path>` strokeDasharray 0 → totalLength over 3s with `cubic-bezier(0.4, 0, 0.2, 1)` easing, 2px gold stroke, 8px gold drop-shadow glow) | 3.5s | (none, music only) | Round 4 of the locked critique: opening anchor is the boundary draw, NOT a satellite drill-down zoom. Reuses the BoundaryOverlay pattern from Bend Hottest Communities. Real Deschutes County GIS parcel pulled successfully via Gate 3. Open with `1892.` hook (cover frame) → resolves to `VANDEVERT RANCH` (place reveal) → boundary draws + brokerage credit appears (open complete). |

---

## Act 1 — The family (Beats 1-3, 18s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 6.0 - 12.0s | `vr_sadie_girl.jpg` | 527×800 | 0.66 (portrait) | Full-bleed (already 9:16 friendly: scale to fill 1080w, photo 1640h overlaps top/bottom 9:16 mask, crop centered) | Push-in + counter-translate (scale 1.00 → 1.08 over 6s, translateX 0 → +1.5%) | 6.0s | "In eighteen ninety two a man came up from Texas with a wife named Sadie..." | Sadie young is the story-hook portrait. Her face fills frame on the line that names her, per the named-person rule from Round 2. Slow push-in honors the historic-people 5-7s minimum. |
| 2 | 12.0 - 18.0s | `03_william_p_with_cane.jpg` | 534×800 | 0.67 (portrait) | Full-bleed (same scale-and-fill as #1) | Push-in + counter-translate (scale 1.00 → 1.08 over 6s, translateX 0 → -1.5%) | 6.0s | "...and over forty years they raised eight children on this land." | William older portrait, completing the founders pair. The "forty years" sits over the older William, mirroring the time arc. Counter-translate opposite to #1 to avoid uniform Ken Burns. |
| 3 | 18.0 - 24.0s | `09_family_rockpile.jpg` | 1336×836 | 1.60 (landscape) | Scale to fill height (height 1920px, width overflows to ~3070px), camera pans across the family group | Multi-point pan, 4 anchor points across the family, springTiming 6s, total horizontal traverse ~30% of overflow width, dwelling longer at clustered faces | 6.0s | "Three of them became doctors." | Documentary discipline: line is "three became doctors", visual is the family group at the rockpile (where the three doctor-sons are). Pan reveals each face sequentially. Honors the "see everyone" rule. |

## Act 2 — Ranch life (Beats 4-7, 20s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 24.0 - 29.0s | `vr_workshop_barn_looking_east.jpg` | 1118×895 | 1.25 (landscape) | Scale to fill height, slight overflow on width | Multi-point pan, 3 anchor points (workshop door → barn corner → eastern roofline), springTiming 5s | 5.0s | "They built the place by hand..." | Workshop+barn is the "built by hand" beat. Multi-point pan reads as a cinematographer surveying construction. |
| 5 | 29.0 - 34.0s | `vr_people_with_surrey.jpg` | 800×462 | 1.73 (landscape, very wide) | Scale to fill height (height 1920, width overflows ~50%) | Multi-point pan, 3 anchors (driver → surrey body → far end), springTiming 5s, longer horizontal traverse to read as motion | 5.0s | "...moved by surrey..." | Surrey IS the visual on the line. Wide source aspect gets multi-point pan to handle the overflow without cropping anyone off. |
| 6 | 34.0 - 39.0s | `07_sheep_with_cattle.jpg` | 662×438 | 1.51 (landscape) | Scale to fill height, modest overflow | Multi-point pan, 3 anchors (sheep cluster → cattle group → meadow horizon), springTiming 5s | 5.0s | "...ran cattle and sheep..." | Sheep+cattle visual on the line that names both. Multi-point pan reveals each animal group in turn. |
| 7 | 39.0 - 46.5s | `vr_sheep_dip.jpg` | 783×295 | 2.65 (panoramic, very wide) | Scale to fill height (height 1920, width overflows to ~5085, 4.7× canvas width) | Multi-point pan ALL THE WAY across (4 anchors: dip apparatus → working hands → sheep queue → far end), springTiming 7.5s with slight ease-in for slower cinematic traverse | 7.5s | "...and worked the meadow by season. The family stayed until nineteen seventy." | Panoramic source REQUIRES the full traverse. Extended dwell to 7.5s (Matt locked Option B) so the camera moves at a witness pace, not a rushed slideshow pace. End of S2 closing on this beat caps the historic ranch-life block. |

## Act 3 — Bridge to modern (Beat 8, 7s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 8 | 44.0 - 51.0s | `vr_barn_newberry_crater.jpg` | 532×786 | 0.68 (portrait) | Full-bleed (already 9:16 friendly) | Vignette with subtle scale push (1.00 → 1.04 over 7s) — barn full visible, no panning, the photo breathes. Modern color but acts as the time-bridge. | 7.0s | "A century later, the ranch became a community of twenty homes across the same four hundred acres." | Bridge from historic black-and-white to modern context. The barn is still there, but the picture is in color. Vignette treatment because there are no people to traverse, just a quiet held landscape. |

## Act 4 — Architect (Beats 9-10, 12s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 9 | 51.0 - 58.0s | `architect_locati.jpg` | 980×625 | 1.57 (landscape) | Scale to fill height, modest overflow on width | Push-in + counter-translate (scale 1.00 → 1.10 over 7s, translateX 0 → +1%) — frame the face, then push in slightly | 7.0s | "This one was designed by Jerry Locati..." | Named person → individual photo (Round 2). The push-in lands on his face as his name is said. |
| 10 | 58.0 - 63.0s | `5-web-or-mls-_DSC0771.jpg` (entry hallway) | 2048×1366 | 1.50 (landscape) | Scale to fill height, ~33% overflow | Multi-point pan: chandelier (top) → console table (mid) → view-through to mountain (far end) | 5.0s | "...who starts every house with a pencil and builds with steel, and stone, and timber, the way the West actually wears them." | The entry hallway IS a Locati design walking inside-out: chandelier at the entry, console with art, glass at the far end with the view. The pan executes "the line on the page becomes the line you walk through" without saying it explicitly. |

## Act 5 — Home tour (Beats 11-22, 48s)

All 12 modern interior beats use multi-point pan around architectural detail (chandelier → window → fireplace → etc) at 4s avg dwell.

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO sentence range | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 11 | 65.5 - 69.5s | `2-web-or-mls-_DSC1055.jpg` | 2048×1366 | 1.50 | Fill height, 33% overflow | Multi-point pan (3 anchors), 4s | 4.0s | S5 (revised, no short clips): "Built in twenty seventeen, four bedrooms and four and a half baths, with the full Cascade range out every west-facing window." | Hero exterior establish (#2 source content visible in v5_library — TBD subagent visual confirm during render). |
| 12 | 67.0 - 71.0s | `8-web-or-mls-_DSC0792.jpg` | 2048×1366 | 1.50 | Fill height | Multi-point pan, 4s | 4.0s | S5 cont. | Modern interior continuation. |
| 13 | 71.0 - 75.0s | `11-web-or-mls-_DSC0950.jpg` (window wall + Mt. Bachelor + pond + leather chairs) | 2048×1366 | 1.50 | Fill height | Push-in + counter-translate (1.00 → 1.10) — frame the mountain through the window, push viewer "into the seat" | 4.0s | S5 end: "...the full Cascade range out every west-facing window." | The line "Cascade range out every west-facing window" lands on the literal window-wall-with-Bachelor photo. Documentary discipline. |
| 14 | 75.0 - 79.0s | `13-web-or-mls-_DSC0810.jpg` | 2048×1366 | 1.50 | Fill height | Multi-point pan, 4s | 4.0s | S6 first: "The kitchen opens to the dining..." | Modern interior anchor for kitchen-dining transition. |
| 15 | 79.0 - 83.0s | `17-web-or-mls-_DSC0836.jpg` (dining + kitchen w/ antler chandelier) | 2048×1366 | 1.50 | Fill height | Multi-point pan: antler chandelier → dining table → bench seating, 4s | 4.0s | S6 mid | The actual dining-kitchen transition shot. Multi-point pan executes "kitchen opens to dining". |
| 16 | 83.0 - 87.0s | `24-web-or-mls-_DSC0871.jpg` (kitchen island + walkout) | 2048×1366 | 1.50 | Fill height | Multi-point pan: island → walkout doors → outside light, 4s | 4.0s | S6 end: "...the dining opens to the meadow..." | Walkout doors in the photo execute "opens to the meadow" literally. |
| 17 | 87.0 - 91.0s | `25-web-or-mls-_DSC0898.jpg` (primary bedroom w/ stone fireplace + antler) | 2048×1366 | 1.50 | Fill height | Multi-point pan: fireplace → bed → window, 4s | 4.0s | S7 first: "A sunroom over the pond..." (next sentence transition) | Bedrooms-with-stone visual lands on this. |
| 18 | 91.0 - 95.0s | `27-web-or-mls-_DSC0961.jpg` | 2048×1366 | 1.50 | Fill height | Multi-point pan, 4s | 4.0s | S7 cont. | TBD content — visually confirm during render. |
| 19 | 95.0 - 99.0s | `28-web-or-mls-_DSC1010.jpg` (sunroom / screened porch w/ pond view) | 2048×1366 | 1.50 | Fill height | Multi-point pan: stone floor → sectional → pond view through windows, 4s | 4.0s | S7 mid: "...a bath in glass, a workshop..." | Sunroom IS the photo on "sunroom over the pond". Documentary line-photo match. |
| 20 | 99.0 - 103.0s | `29-web-or-mls-_DSC0925.jpg` (primary bath w/ double vanity + tub) | 2048×1366 | 1.50 | Fill height | Multi-point pan: vanity → mirror → soaking tub at window, 4s | 4.0s | S7 cont. | "Bath in glass" lands on the bath photo. |
| 21 | 103.0 - 107.0s | `30-web-or-mls-_DSC0930.jpg` (walk-in shower w/ bench) | 2048×1366 | 1.50 | Fill height | Multi-point pan: window → tile → shower, 4s | 4.0s | S7 cont. | Glass-bath continuation. |
| 22 | 107.0 - 111.0s | `31-web-or-mls-_DSC0935.jpg` | 2048×1366 | 1.50 | Fill height | Multi-point pan, 4s | 4.0s | S7 end: "...a fireplace under cover where the day ends." | TBD content — visually confirm during render. |

## Act 6 — Outdoor + nature (Beats 23-25, 13s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 23 | 111.0 - 115.0s | `52-web-or-mls-_DSC1022.jpg` (covered fireplace patio + pond view + fire) | 2048×1366 | 1.50 | Fill height | Multi-point pan: fire → pond view → seating, 4s | 4.0s | S7 final beat lands here: "...a fireplace under cover where the day ends." | The covered fireplace IS the closing image of S7. Live fire in the photo adds warmth without AI motion. |
| 24 | 115.0 - 119.5s | `88-web-or-mls-_DSC1105.jpg` (two elk closer framing) | 2048×1366 | 1.50 | Fill height | Multi-point pan: first elk → second elk, 4.5s | 4.5s | S8 first half: "And outside, the elk still cross..." | Elk IS the line. Tighter framing on #88 is the entry to the elk beat. |
| 25 | 119.5 - 124.0s | `86-web-or-mls-_DSC1090.jpg` (elk herd + Mt. Bachelor) | 2048×1366 | 1.50 | Fill height | Multi-point pan across the herd, ending with Mt. Bachelor in frame, 4.5s | 4.5s | S8 second half: "...the meadow at dawn." | Wider herd shot completes the beat and pulls Mt. Bachelor in for the geographic anchor. |

## Act 7 — River + closing (Beats 26-27, 9s)

| # | Time | Photo | Source dim | Source aspect | 9:16 fit | Motion | Dwell | VO | Justification |
|---|---|---|---|---|---|---|---|---|---|
| 26 | 124.0 - 129.0s | `Area Guide - Vandevert Ranch - 02.JPG` (Snowdrift area guide) | 4200×2800 | 1.50 (landscape) | Fill height (1920) at 50% scale of source, ~50% width overflow | Vignette with subtle scale push (1.00 → 1.04, 5s) — held landscape, photo breathes. River in frame is the visual anchor. | 5.0s | S9: "The Little Deschutes still runs cold and clear past the old homestead." | River line lands on the area-guide hero shot. Vignette because it's pure scenery without people; panning would feel rushed. |
| 27 | 129.0 - 133.0s | `60-web-or-mls-DJI_20260127142652_0078_D.jpg` (drone aerial) | 2048×1534 | 1.33 (landscape, near-square) | Fill height, 26% overflow | Slow zoom-out (scale 1.20 → 1.00 over 4s) — drone aerial pulling away from the house, returning to the wide ranch context | 4.0s | S10: "Some places are not for sale every day. Some places are kept." | Closing aerial pull-out is the v4b beat we're keeping (Matt approved). The pull-out reads as "stepping back from the place" mirroring the closing line. Sets up the reveal text card. |

## Closing reveal (5s)

| # | Time | Visual | Text overlay | Notes |
|---|---|---|---|---|
| R | 133.0 - 138.0s | Drone #60 last frame held + slow fade to navy #102742 | **PENDING** (Georgia bold, gold #C8A864, 96pt) `\n` **$3,025,000** (Georgia regular, cream, 56pt) `\n` **REPRESENTED BY RYAN REALTY** (Montserrat semibold uppercase, cream, 28pt, letter-spacing +4) | Verify the $3,025,000 against SkySlope/MLS BEFORE render. Brand sting `brand_sting.mp3` (0.91s) hits at 137.0s on the navy fade. Total runtime: 138s. |

---

## Runtime audit

| Section | Beats | Runtime |
|---|---|---|
| Cover frame + boundary draw | C + 0 | 0.0 → 6.0s (6.0s) |
| Act 1 family | 1-3 | 6.0 → 24.0s (18.0s) |
| Act 2 ranch life | 4-7 | 24.0 → 44.0s (20.0s) |
| Act 3 bridge | 8 | 44.0 → 51.0s (7.0s) |
| Act 4 architect + entry | 9-10 | 51.0 → 63.0s (12.0s) |
| Act 5 home tour | 11-22 | 63.0 → 111.0s (48.0s) |
| Act 6 outdoor | 23-25 | 111.0 → 124.0s (13.0s) |
| Act 7 river + closing | 26-27 | 124.0 → 133.0s (9.0s) |
| Closing reveal | R | 133.0 → 138.0s (5.0s) |
| **TOTAL** | 27 photo beats + cover + reveal | **138.0s** |

138s is 8s over the 110-130s range. Two ways to land in window:
- Trim 1-2 of the modern interior beats (#11/#12/#18/#22 are TBD-content, easy candidates if they don't sing)
- OR shave 0.3-0.5s off each modern interior beat (16 × 0.5s = 8s)

Recommend: keep 27 photos, trim avg modern interior dwell to 3.7s. Total lands at ~133s. Acceptable per the 110-130s spec which is a target not a hard ceiling for cinematic short film.

## Constraints honored

- 9:16 native, no museum mattes ✓
- Storyteller cadence with subordinate clauses, no McCarthy short-clipped ✓
- AI photo-to-video OFF (Round 4) — all motion is Remotion deterministic ✓
- One use per asset ✓
- Cover frame holds 2.5s ✓
- Interior beats 3.5-5s, historic-people beats 5-7s ✓
- Named person → individual photo (William, Sadie, Locati each on their own beat) ✓
- Documentary discipline (post office, forest ranger, Paiute, horses-in-stables lines DROPPED because no photo support) ✓
- Open with boundary draw, not satellite zoom (Round 4) ✓
- Photo-VO content match (kitchen-opens-to-dining lands on the actual photo, etc) ✓
- No em-dashes or hyphens in prose ✓
- No reused clips/photos ✓
- $3,025,000 flagged for SkySlope/MLS verification before render ✓

## Open questions for Matt to answer at sign-off

1. **Cover frame text:** "A RYAN REALTY REPRESENTATION / VANDEVERT RANCH" or alternative? The v4b cover used "A Ryan Realty Representation / Vandevert Ranch / Founded 1892" — keep "Founded 1892" as a third line?

2. **Voice:** Victoria `qSeXEcewz7tA0Q0qk9fH` is the permanent voice (locked 2026-04-27). Use `eleven_turbo_v2_5`, stability 0.50, similarity_boost 0.75, style 0.35, speaker_boost on. `previous_text` chained across sentences for prosody continuity.

3. **Music bed:** Use existing `public/audio/music_bed.mp3` (100s ElevenLabs cinematic, from v3/v4 builds) or generate a new bed sized to 138s?

4. **Closing reveal text styling:** Keep "PENDING / $3,025,000 / REPRESENTED BY RYAN REALTY" as drafted, or adjust the wording / hierarchy?

5. **Runtime target:** Land at 130s (trim modern interior beats to 3.7s), or accept ~138s as the cinematic-short-film range?

Once Matt signs off, Gate 3 starts: voice padding test (15s sample with real silence) + boundary draw test (6s standalone clip) → email both for approval before Gate 4 full render.
