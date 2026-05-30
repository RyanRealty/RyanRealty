# Canonical-library adoption audit (video pipeline) — 2026-05-28

Follow-up punch list from the producer-skill optimization pass. The SKILL.md
layer now cites the canonical shared libraries and that citation is enforced by
gate **G35** (`scripts/check-producer-skills.mjs`). This document maps the
separate, deeper question: where does the actual render code still **bypass**
those libraries by hardcoding values or rolling its own component.

Per Matt's 2026-05-28 decision the refactor is scoped to a **separate pass** —
this file is the punch list for that work. Read-only audit; no code was changed.

## Why this matters

A producer SKILL.md can correctly cite `safe-zones/canonical/safe-zones.ts`
while the Remotion comp it builds still hardcodes `y=1480`. The doc passes the
validator; the shipped video is still wrong. The four canonical libs exist so a
single change (e.g. a new caption font, a tuned Victoria setting) propagates to
every render. A bypasser silently opts out of that propagation.

## Adoption scoreboard

| Canonical library | Adopters | Bypassers | Notes |
|---|---|---|---|
| Safe zones (`safe-zones/canonical/safe-zones.ts`) | 10 comps import it | 7 (4 cascade-peaks local constants, 2 `listing_video_v4` hardcode `y=1480`, 1 partial) | cascade-peaks values are *wrong*, not just local |
| Captions (`captions/canonical/SingleWordCaption.tsx`) | 8 (incl. all legacy shims) | 2 (`TumaloLife`, `TumaloCascadeCreek`) | legacy CaptionBand/KineticCaptions/SentenceCaption are compliant shims — no action |
| Voice (`scripts/_voice_lib.py` / `lib/voice/alignment.ts`) | 14/14 main `build_*.py` | 15/15 `listing_video_v4/scripts/synth_*.py` | 12 of the 15 carry **drifted** voice settings |
| First-frame gate (`scripts/check_first_frame.py`) | 3/14 `build_*.py` + 4 render scripts | 11/14 `build_*.py` | coverage is backwards — render scripts have it, pipeline scripts don't |

## True bypassers (the refactor list)

### Captions — only 2 real bypassers
- `listing_video_v4/src/TumaloLife.tsx` — full inline sentence-caption renderer: wrong font (Geist, not Amboqia), retired `top:1480` zone, own fade logic. Triple violation (caption + safe-zone + font).
- `listing_video_v4/src/TumaloCascadeCreek.tsx` — byte-for-byte copy of the same bypass.

Good news: every named legacy caption component (`CaptionBand` in market-report / earnest / evergreen-education, `KineticCaptions` in market-report / market-report-yt-long, `SentenceCaption` in lv4/news) is already a thin shim that re-exports `SingleWordCaption`. The legacy names survive for API compatibility; the rendering is canonical. **No migration needed for the shims.**

### Safe zones
- `video/cascade-peaks/src/brand.ts` (+ `FactCard`, `ClosingCard`, `OpeningCard`, `AubreyButtePan`) — defines local `SAFE_TOP=420 / SAFE_BOTTOM=1180 / SAFE_LEFT=72 / SAFE_RIGHT=1008`. These are **wrong**, not just un-imported: canonical `PORTRAIT_SAFE.top=280`. The effective text window is narrower than every other producer and content can land in the platform-chrome zone.
- `listing_video_v4/src/TumaloLife.tsx` + `TumaloCascadeCreek.tsx` — hardcode `top:1480` (the retired caption zone that sits inside the platform action UI).
- `video/area_guides/src/AreaGuide.tsx` — partial: imports canonical safe-zones but hardcodes one internal `top:1180` offset instead of importing `PORTRAIT_SAFE.bottom`.

### Voice — the biggest gap
- All 15 `listing_video_v4/scripts/synth_*.py` bypass `_voice_lib` entirely. Three drift classes:
  - **9 scripts** (`synth_vo_v51.py`, `v53`–`v59`) frozen at pre-May settings (stability 0.55 / similarity 0.85 / style 0.0) — flatter delivery than canonical.
  - **3 scripts** (`synth_news_vo.py`, `synth_news_merger_vo.py`, `synth_news_remax_real.py`) at the old news preset (0.50 / 0.75 / 0.35).
  - **4 scripts** (`synth_bend_pulse_vo.py`, `synth_bend_pulse_v4_bridges.py`, `synth_bend_wildfire_r327.py`, `gen_tumalo_vo.py`) carry the *correct* canonical settings (0.40 / 0.80 / 0.50) but still inline the call, so a future canonical change won't reach them.
- Rogue one-off variants with inline ElevenLabs + no gate: `scripts/build_earth_zoom_real.py`, `scripts/build_google_maps_flyover_real.py`.

### First-frame gate — missing on 11/14 pipeline scripts
`build_earth_zoom.py`, `build_data_viz_video.py`, `build_listing_reveal.py`, `build_google_maps_flyover.py`, `build_market_pulse_short.py`, `build_map_route_video.py`, `build_news_video.py`, `build_news_video_avatar.py`, `build_school_district_overlay.py`, `build_walkability_overlay.py`, `build_youtube_long_form_market_report.py` — none invoke `scripts/check_first_frame.py` before publish.

## Top 8 refactor targets (ranked by frequency × severity)

| # | File | Producer | Issue |
|---|---|---|---|
| 1 | `listing_video_v4/src/TumaloLife.tsx` | listing_reveal | inline caption: wrong font + retired zone + own fade — triple violation |
| 2 | `listing_video_v4/src/TumaloCascadeCreek.tsx` | listing_reveal | copy-paste of #1 |
| 3 | `scripts/build_news_video.py` | news-video | `_voice_lib` ✓ but no first-frame gate; high-visibility, often dark title cards |
| 4 | `scripts/build_youtube_long_form_market_report.py` | youtube-long-form | no first-frame gate; ~20-min renders make late failures expensive |
| 5 | `video/cascade-peaks/src/brand.ts` (+4 comps) | cascade-peaks | wrong local safe-zone values vs canonical |
| 6 | `listing_video_v4/scripts/synth_vo_v51–v59.py` (9) | listing_reveal | drifted voice settings; one fix template covers all 9 |
| 7 | `scripts/build_listing_reveal.py` | listing_reveal | most-produced format, no first-frame gate |
| 8 | `listing_video_v4/scripts/synth_news_*.py` (3) | news clips | old news voice preset |

## Recommended sequencing for the refactor pass

1. **Captions (#1–#2)** — migrate the two Tumalo comps to `SingleWordCaption`. Smallest surface, worst violation, removes the only true caption bypassers. Re-render both to verify.
2. **First-frame gate (#3, #4, #7, then the rest)** — add `check_first_frame.py` to the 11 `build_*.py` pipeline scripts. Mechanical, low-risk, high-value; no re-render needed (it's a publish-time check).
3. **Voice drift (#6, #8)** — migrate the 12 drifted `synth_*.py` to `_voice_lib`. Listen-test a sample before/after. Settle whether `listing_video_v4/scripts/` should keep its own synth tree at all.
4. **cascade-peaks safe-zones (#5)** — replace `brand.ts` local constants with canonical imports; re-render the four comps.
5. **Delete rogue variants** — `build_earth_zoom_real.py`, `build_google_maps_flyover_real.py` if confirmed dead.

Each item should be its own reviewed change with a re-render where a comp is touched (captions / safe-zones), per the video-review gate in CLAUDE.md §0.5.
