# Producer tool-utilization audit — 2026-05-28

Code-truth audit of what tools each producer **actually** calls vs. the best tool available for its job. Triggered by Matt's observation that producers aren't using their tools optimally. Findings are derived from reading the actual build scripts + Remotion comps (4 parallel cluster audits), not from the inventory docs (which are stale). The four copy-wrapper findings in Tier 1 were spot-verified by hand.

## Executive summary

The problem is worse and more concrete than "underused fancy tools." Three layers:

1. **A cluster of producers ship a frozen Tumalo exemplar regardless of payload** (copy-wrapper stubs). For a CMA or listing video this is a data-accuracy / correctness failure, not a quality nit. The real generators already exist — this is a wiring gap, not a build-from-scratch gap.
2. **Real producers that underuse available tools** — the SOTA AI-video stack (Kling/Veo/Seedance/Hailuo/Wan/Luma) is billed and reachable but almost entirely unused; the Spark cross-check gate is typed but never called; ElevenLabs forced-alignment + SFX unused; the competitor-design-recon library is populated but read by zero producers; 3D-tiles flyovers default to PIL mock stubs.
3. **Open loops, blocked-on-env producers, and missing producers** — GA4→budget and FUB-engagement→lead loops don't exist; blog/newsletter blocked on unset env; several registered producers have no implementation.

## Execution-path caveat (read before acting on Tier 1)

There are two execution paths and it determines how urgent the stubs are:
- **Canonical:** the `producer-runtime` cron reads the producer's `SKILL.md` and executes via Claude. For `cma`, the recipe says to hit `/api/cma/[slug]` — so via this path the CMA is built correctly and the Python wrapper is irrelevant.
- **Legacy:** the orchestrators (`build-listing-launch-orchestrator.mjs`, `build-monthly-market-report-orchestrator.mjs`) and `test-all-producers.mjs` invoke `scripts/run-producer.mjs` → `producer-inventory.mjs` → the Python `build_*.py` **stub** → Tumalo exemplar.

So the stubs are definitely wired into the orchestrator + test path. Whether they reach production depends on which path the brain actually dispatches through. **Trace `producer-runtime` vs the orchestrator dispatch before deciding the blast radius.** Regardless, the stubs should be replaced — they make `test-all-producers.mjs` green on a lie (a passing test that copies a known-good asset proves nothing).

## Tier 1 — CRITICAL: copy-wrapper stubs (hand-verified)

Each `shutil.copy`/`copytree`s a hardcoded exemplar regardless of payload. Real generator exists in every case.

| Producer | Stub script | Ships (for any payload) | Real generator that exists | Fix |
|---|---|---|---|---|
| cma | `scripts/build_cma_wrapper.py` | `public/cmas/cma-19496-tumalo-reservoir/` | `/api/cma/[slug]/pdf` + `/api/cma/generate` (Puppeteer + Supabase + Spark + broker resolve) | Wrapper POSTs payload to the API, polls slug, pulls PDF |
| listing-tour-video | `scripts/build_listing_tour_video.py` | `…/19496-tumalo-reservoir/videos/cascade-and-creek.mp4` | `video/listing-tour/scripts/prepare-tour.ts` (Supabase photos + Wan i2v + ElevenLabs + Remotion) | Re-point `producer-inventory.mjs` to `prepare-tour.ts` |
| market_data_video | `scripts/build_market_data_video.py` | `public/v5_library/bend_market_report_ytd2026.mp4` | `video/market-report/src/` Remotion comp + data layer | Wire script to render comp with fresh Supabase payload |
| market_report_video | `scripts/build_market_report_video.py` | `…/bend_pulse/bend_pulse_part2.mp4` | same comp as above | Merge into market_data_video |
| flyer-design | `scripts/build_flyer_design_wrapper.py` | `…/19496-tumalo-reservoir/flyers/*.png` | `scripts/render-just-listed-flyer.mjs` (@napi-rs/canvas, real data) | Wrapper builds config, calls the renderer |
| ig-single-post | `scripts/build_ig_single_post_wrapper.py` | `…/19496-tumalo-reservoir/v3/single-image/*.jpg` | `scripts/render-ig-carousel-slide.mjs` (Playwright + HTML) pattern | Config-driven compositor |
| neighborhood_tour | `scripts/build_neighborhood_tour.py` | `…/19496-tumalo-reservoir/videos/tumalo-life.mp4` | (none yet) Earth Studio / 3D-tiles per SKILL.md | Build real pipeline OR refuse non-Tumalo payloads |
| clip_compilation | `scripts/build_clip_compilation.py` | hardcoded `bend_pulse_part*.mp4` paths | `lib/asset-library.mjs` search | Query asset library by theme_slug from payload |

`test-all-producers.mjs` passes these because they copy a known-good asset and emit valid sidecars — the green checkmark is meaningless for the stubs.

## Tier 2 — HIGH: real producers underusing available tools

| Producer / area | Current | Available / optimal | Action |
|---|---|---|---|
| listing_reveal | `build_listing_reveal.py` renders 3 static PIL frames (~6s) | its OWN complete Remotion comp `video/listing_reveal/src/ListingRevealComp.tsx` (Ken Burns, captions, overlay, kinetic reveal, ~34s) | Wire script to `npx remotion render` (mirror `build_tiktok_listing_tour.py:310`). Most-dispatched listing producer. |
| data_viz_video | `PRICES=[745,720…690]` hardcoded in BOTH `build_data_viz_video.py:20` and `DataVizComp.tsx:79`; citations say "illustrative" | live `market_stats_cache` 12-mo window | **Data-accuracy fix.** Pull live, pass as inputProps. Ships invented chart today. |
| AI video stack (cluster-wide) | Ken Burns / Unsplash / Pexels stock for hero + b-roll. Only `prepare-tour.ts` uses Wan i2v | Replicate Kling/Veo3/Seedance/Hailuo/Wan/Luma (billed, reachable). Inventory: "should be using yesterday" | Add i2v hero beats (tiktok_listing_tour, listing_reveal); Seedance/Veo-Fast b-roll for area_guides + market reports (~$0.50–$2/video) |
| earth_zoom, google_maps_flyover | default to PIL crosshair **mock** stubs | real Photorealistic 3D Tiles pipeline already built in `video/tumalo-aerial/` (`_real.py` variants) | Promote `_real.py` to default; demote PIL stub |
| Spark cross-check gate | `sparkValue`/`sparkDeltaPct` typed in `VideoProps.ts` but **no market producer calls Spark** | mandatory \|delta\|>1% pre-render gate per CLAUDE.md | **Data-accuracy fix.** Gate is design-only today; wire the actual Spark call |
| ElevenLabs forced-alignment | most VO producers skip it → captions absent/unsynced | `_voice_lib.get_forced_alignment()` | Call after every VO synth; populate single-word caption timestamps |
| ElevenLabs SFX | genuinely unused | `/v1/sound-generation` (same key) | Optional whoosh/thump on transitions |
| Voice drift | `prepare-tour.ts` calls ElevenLabs inline with NO voice_settings (API defaults, not Victoria 0.40/0.80/0.50); 12 `listing_video_v4/scripts/synth_*.py` drifted | canonical `_voice_lib.py` / `lib/voice/alignment.ts` | Route all synth through the shared lib |
| competitor-design-recon | `out/design-recon/` populated (5 formats, 426-ad sample) but **read by zero producers** | flat producers should `load_recon()` at build time per CLAUDE.md Tier 4 | Add recon read to linkedin-doc-carousel, meta-creative-variant, nextdoor, flyer, carousel |
| check_first_frame.py | missing on ~11/14 video build scripts | the first-frame ship-blocker gate | Add post-render call to each |

## Tier 3 — loops, blocked-on-env, missing

**Open loops** (described in docs, not wired):
- GA4 view-velocity → video-budget: NO (snapshot lands in `marketing_channel_daily`; no decision fn reads it to adjust spend).
- FUB video-engagement → lead: NO (metric tracked in `measurement-loop.ts`; no code creates/tags a FUB contact from watch events).
- Meta CAPI: PARTIAL (wired on seller LP + contact form; buyer LP missing; `META_CAPI_ACCESS_TOKEN` not confirmed set; fire-and-forget swallows errors).
- Inngest listing→render→publish: PARTIAL (only fires MLS sync; no `listing.created` event, no `createFunction()` handler anywhere; the real pipeline is the marketing-brain cron stack).

**Blocked on env (DEAD until set):**
- blog-post / market-report-blog: `WP_AGENTFIRE_APP_PASSWORD` etc. unset.
- newsletter: `RESEND_FROM` unset (producer self-kills).
- avatar_market_update: `SYNTHESIA_AVATAR_ID` unset; Remotion comp unbuilt.

**Missing / aspirational (in REGISTRY or CLAUDE.md, no implementation):**
- youtube-long-form-walkthrough (NO_SCRIPT), lifestyle-community, development-showcase, weekend-events-video (dir absent), neighborhood-overview (duplicate alias of area_guides), WalkabilityOverlay.tsx comp (script works, can't render without it).

**Print fidelity:** postcard / yard-sign render at ~60 PPI proof, not 300 DPI print-ready. neighbor-outreach uses synthetic addresses (should pull BatchData with TCPA `litigator` exclusion per MEMORY).

## Stale inventory claims disproved (API_INVENTORY.md needs a refresh)

- "AI video models currently UNUSED" — partially false; `prepare-tour.ts` uses Wan i2v; Grok Imagine wired in evergreen-education (`lib/grok-video.ts`).
- "No production deliverable uses a licensed Shutterstock asset" — false; market-report fetches Shutterstock photo + video.
- Geocoding API "not enabled" — irrelevant to current producers (all take lat/lng from payload).
- Meta token "expired" — false (corrected inline 2026-05-18: never-expires, full scopes).
- `news_video_avatar` "uses Synthesia" — false; PIL headshot composite, zero Synthesia calls.
- `avatar_market_update` registry label — it has a script, but the script is a prerequisite-check stub that exits without output.

## Recommended sequencing

1. **Trace the dispatch path** (producer-runtime cron vs orchestrator/run-producer) to size Tier 1 blast radius. 1-2h.
2. **Tier 1 data-accuracy stubs first** — cma, market_data_video, then listing-tour/flyer/ig-single. Wire to the real generators. Highest correctness risk.
3. **Tier 2 data-accuracy** — data_viz_video live data + the Spark cross-check gate. These ship wrong numbers today.
4. **listing_reveal → Remotion** (biggest single quality jump, most-dispatched).
5. **AI-video stack adoption** — start with i2v hero beats + Seedance b-roll; measure cost.
6. **recon consumption + forced-alignment + first-frame gate** — mechanical, cross-cutting.
7. **Unblock env producers** (blog, newsletter) — 30-min DNS/dashboard tasks.
8. **Loops + missing producers** — larger, schedule separately.

Each fix that touches a shipped deliverable re-renders + goes through the draft-first review gate per CLAUDE.md §0.5. Several Tier 1/2 items are data-accuracy fixes that outrank everything per CLAUDE.md §0.
