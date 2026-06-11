# Central Oregon Map Video System — Format Spec v2 (Phase 0 output)

**Date:** 2026-06-10 · **Status:** Draft for Matt review (spec precedes build per directive)
**Extends:** `video/tumalo-aerial/` two-cut pipeline (26 areas rendered 2026-06-09, Awbrey Butte pilot approved). This spec upgrades the grammar; it does not rebuild the pipeline.
**Research base:** web sweep 2026-06-10 (earth-zoom meme economics, Harris/Vox map grammar, real-estate map services, 3D-tiles cinematics, HUD aesthetics) + `google_maps_flyover/SKILL.md` six plays + `VIRAL_GUARDRAILS.md` + `platform-best-practices/SKILL.md`. Full digests in session transcript 2026-06-10.

---

## Why this grammar (the three findings that drive everything)

1. **Zoom-IN beats zoom-out.** The earth-zoom meme is saturated as a zoom-OUT. The fresh variant opens at regional altitude and descends INTO the community, interrupted by data beats. Logarithmic altitude easing (fast high, slow low) is what separates cinematic from mechanical (Google Earth Studio best practices; Vox workflow).
2. **Expertise = camera + data arriving together.** Harris/Vox grammar: the boundary draws when the camera arrives, labels are sparse and each one is earned, stats appear at the narrative beat. A pre-loaded boundary or a label dump reads as decoration. Motion-tracked (3D-anchored) labels read as expensive; static screen-space HUD over moving aerial reads as template.
3. **Sparse beats spectacle.** HUD/grid aesthetics work only when every element resolves to a verified fact in brand colors. The 2026 trend in premium real-estate video is contextual data overlays (geo-anchored POI/stat tags), not sci-fi scan lines.

**Licensing note (load-bearing):** Google Earth Studio has NO commercial license — never use it. Our pipeline uses **Photorealistic 3D Tiles** via `3d-tiles-renderer`, which permits promotional video WITH visible Google attribution (`TilesAttributionOverlay` already in `TilesScene.tsx`) + `provenance.json` per render.

---

## The two-act camera grammar (both cuts)

**Act 1 — "Where this is" (regional establishing).** Camera opens 15–25 km out at 40–55° tilt with the Cascades on the horizon, already moving (motion by frame 12). Log-interpolated descent toward the community: covers 80% of the distance in the first 60% of the act, decelerating on approach. No linear interpolation anywhere.
**Act 2 — "What this is" (community orbit).** Hand-off below ~2,500 m AGL into the existing Catmull-Rom orbit/weave path. Banking on turns (existing low-pass bank rig). Tilt stays 40–60°; never top-down, never below ~30° except a final-beat push.

| Cut | Duration | Act 1 | Act 2 | Aspect |
|---|---|---|---|---|
| Hero (website) | 15 s | 0–5 s descent | 5–15 s orbit | 16:9 1920×1080 |
| Social/ad | 30–40 s (35 s default) | 0–8 s descent | 8–35 s community path | 9:16 1080×1920 |

## Overlay choreography — social cut ONLY (hero ships clean: zero text; subtle boundary only)

35 s timeline (timings scale proportionally for 30–40 s):

| t | Beat | Element | Spec |
|---|---|---|---|
| 0.0–1.0 s | Hook | Eyebrow + place name (existing title block) | On by frame 30. Amboqia 82 px / Geist eyebrow, upper safe zone. First frame must pass thumbnail gate. |
| ~3 s | Context | Region label ("CENTRAL OREGON" or anchor landmark) | One kinetic label, 3D-anchored, fades with descent. |
| ~8 s (25%) | **Pattern interrupt 1** | Act hand-off + **boundary draw** | TRUE progressive trace around the real polygon, completing in 1.5–2.0 s, timed to arrival. Navy stroke + cream counter-stroke (existing colors). Implement the trace — current `traceOn` is a no-op fade. |
| 10–22 s | Story | 2–3 kinetic POI labels, one at a time | 3D-anchored to verified coordinates (park, river, trailhead, school by name only). ≤5 labels total per video. 0.5 s in, ≥2 s hold, fade before next. |
| ~17 s (50%) | **Pattern interrupt 2** | First stat card OR route beat | "14 MIN TO OLD MILL" style — drive time computed live from Google Routes API, written to citations.json. Hold 2.5–3 s. |
| ~26 s (75%) | Payoff seed | Second data beat | Days-to-pending or active count (market_pulse_live / market_stats_cache, pulled fresh). |
| 29.75–35 s (final 15%) | **Kinetic stat reveal** | Median sale price (existing component) | Amboqia 100 px, tabular nums, scale-spring. No logo, no phone, no brokerage name. `ryan-realty.com` line stays (approved in pilot). |

**HUD register (the "high-tech" layer):** a quiet coordinate/altitude tick frame — thin 1 px cream rules at the frame edges, small Geist mono-style readouts (LAT/LON of the community centroid, altitude during descent), max 2 elements visible at once, all inside safe zones, all at ≤70% opacity. Every readout is a real value (the camera's actual altitude, the real centroid). No scan lines, no radar sweeps, no decorative brackets. Cut the HUD entirely on the hero.

**Caption rule:** these cuts have no VO. If VO is added later, single-word Amboqia captions via the canonical `SingleWordCaption` (CLAUDE.md §0.5) — never a third caption system.

## Clean + bright grade

Current renders skew dark/cool (navy bg `#0a1a2e`, heavy fog, ACES at default exposure). New grade, applied in-scene in `TilesScene`:
- toneMappingExposure ≈ 1.25–1.4 (tune on stills), hemisphere light up, warm key kept
- Fog distance pushed out + lightened toward `#cfdce9`; background to a bright sky gradient, never near-black (kills blackdetect risk + reads "daylight drone," not "satellite at dusk")
- Saturation kept natural — no Instagram teal-orange; before/after stills in the contact sheet for Matt

## Data + verification (non-negotiable)

- Boundaries: `boundary_geojson()` RPC / `data/resort-communities.json` / city GIS only. Never approximated.
- Stats: pulled fresh per render from `market_stats_cache` / `market_pulse_live` via the documented DAL patterns; every on-screen figure → `citations.json` with query + row + timestamp.
- Drive times: Google Routes API computed at build time, response stored in `citations.json`. No LLM-recall distances.
- POI label coordinates: Google Geocoding/Places or authoritative GIS, recorded in citations.
- `provenance.json` per render: Google Maps Platform 3D Tiles attribution + render date + key figures.

## Gates (per render, existing batch harness + scorecard)

first-frame thumbnail gate → blackdetect strict → duration → <100 MB (hero target <12 MB after size-targeted re-encode for LCP) → tilt/easing rules above → social cut scored vs VIRAL_GUARDRAILS (earth-zoom minimum **85**, auto-zeros apply) → citations + provenance present. Hero outputs: `public/videos/flyovers/<slug>/hero.mp4` + `poster.jpg` (committed only after Matt approval). Social cuts stay in `out/` until approved for distribution.

## Scope ladder

1. **Smoke test:** Bend city exemplar, both cuts, iterate until cinematic (tile-pop, horizon clip, phone-size legibility checks). 3D-tiles billing: no batch until Matt approves.
2. Batch A: 10 cities (Bend, Redmond, Sisters, Sunriver, La Pine, Madras, Prineville, Tumalo, Terrebonne, Powell Butte).
3. Batch B: re-render 26 existing neighborhoods/resorts through the v2 grammar (supersedes 2026-06-09 renders; re-encode the 37 MB Tetherow hero regardless).
