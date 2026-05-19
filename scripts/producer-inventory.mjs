/**
 * Full producer inventory — comprehensive list of every brain-callable producer
 * that has a real build script on disk. Used by:
 *   - scripts/test-all-producers.mjs (end-to-end test driver)
 *   - scripts/build-producer-gallery.mjs (visual gallery builder)
 *
 * scripts/run-producer.mjs holds its own (smaller) PRODUCERS map, which is the
 * curated set of action_types the brain routes by. This file is the SUPERSET
 * showing every producer that has executable code regardless of routing status.
 *
 * Each entry: producer-slug → { runner, script, section }
 *   - section: A (orchestrator) | B (content) | C (site) | D (ops) | E (comms) | F (analysis)
 */

export const PRODUCERS = {
  // ─── Section B — image producers (Python PIL) ─────────────────────────────
  'testimonial_card':              { runner: 'python3', script: 'scripts/build_testimonial_card.py', section: 'B' },
  'map_static_card':               { runner: 'python3', script: 'scripts/build_map_static_card.py', section: 'B' },
  'yard_sign_rider':               { runner: 'python3', script: 'scripts/build_yard_sign_rider.py', section: 'B' },
  'postcard_farm_mailer':          { runner: 'python3', script: 'scripts/build_postcard_farm_mailer.py', section: 'B' },
  'under_contract_announcement':   { runner: 'python3', script: 'scripts/build_under_contract_announcement.py', section: 'B' },
  'sold_deal_summary':             { runner: 'python3', script: 'scripts/build_sold_deal_summary.py', section: 'B' },
  'floor_plan_render':             { runner: 'python3', script: 'scripts/build_floor_plan_render.py', section: 'B' },
  'meme_lord':                     { runner: 'python3', script: 'scripts/build_meme_lord.py', section: 'B' },
  'comparable_grid':               { runner: 'python3', script: 'scripts/build_comparable_grid.py', section: 'B' },
  'open_house_stories':            { runner: 'python3', script: 'scripts/build_open_house_stories.py', section: 'B' },
  'coming_soon_teaser':            { runner: 'python3', script: 'scripts/build_coming_soon_teaser.py', section: 'B' },
  'neighbor_outreach_note':        { runner: 'python3', script: 'scripts/build_neighbor_outreach_note.py', section: 'B' },
  'linkedin_document_carousel':    { runner: 'python3', script: 'scripts/build_linkedin_document_carousel.py', section: 'B' },
  'meta_creative_variant':         { runner: 'python3', script: 'scripts/build_meta_creative_variant.py', section: 'B' },
  'nextdoor_business_ad':          { runner: 'python3', script: 'scripts/build_nextdoor_business_ad.py', section: 'B' },
  'virtual_staging':               { runner: 'python3', script: 'scripts/build_virtual_staging.py', section: 'B' },

  // ─── Section B — video producers (slop slideshow mockups REMOVED 2026-05-19) ───
  // The following 14 producers were built as 10-15s PIL slideshows + Victoria
  // VO. They satisfy the test runner (file exists, has audio, sidecars present)
  // but DO NOT fulfill their SKILL.md spec. Each needs a real Remotion
  // composition (see video/cascade-peaks/ for the canonical 3D-tiles pattern).
  // Until then they are NOT in the inventory:
  //
  //   listing_reveal             — needs kinetic stat reveal Remotion comp
  //   news_video                 — needs caption-pill news clip Remotion
  //   area_guides                — needs 6-beat area-guide Remotion
  //   data_viz_video             — needs multi-color chart Remotion
  //   avatar_market_update       — needs Synthesia/HeyGen avatar pipeline
  //   meme_content               — needs meme-format Remotion comp
  //   earth_zoom                 — needs Google Earth Studio + 3D Tiles
  //   google_maps_flyover        — needs Photorealistic 3D Tiles cinematic
  //   news_video_avatar          — needs avatar-driven news Remotion
  //   tiktok_listing_tour        — needs TikTok-optimized Remotion comp
  //   map_route_video            — needs Google Maps Directions polyline anim
  //   school_district_overlay    — needs school boundary GeoJSON overlay anim
  //   walkability_overlay        — needs isochrone overlay anim
  //   youtube_long_form_market_report — needs 8-12 min Remotion long-form
  //
  // The video producers that ARE real (use existing canonical Remotion comps)
  // are listed below in the existing-asset wrappers section.

  'clip_compilation':              { runner: 'python3', script: 'scripts/build_clip_compilation.py', section: 'B' },  // stitches 3 real bend_pulse parts — actually real

  // ─── Section B — text producers (Node mjs) ────────────────────────────────
  'newsletter':                    { runner: 'node', script: 'scripts/build-newsletter.mjs', section: 'B' },
  'listing-description':           { runner: 'node', script: 'scripts/build-listing-description.mjs', section: 'B' },
  'market-report-blog':            { runner: 'node', script: 'scripts/build-market-report-blog.mjs', section: 'B' },
  'google-ads-copy':               { runner: 'node', script: 'scripts/build-google-ads-copy.mjs', section: 'B' },
  'agent-coop-eflyer':             { runner: 'node', script: 'scripts/build-agent-coop-eflyer.mjs', section: 'B' },

  // ─── Section B — payload-mode wrappers for pre-existing producers ─────────
  'broker-contact-card':           { runner: 'python3', script: 'scripts/build_broker_contact_card_payload.py', section: 'B' },
  'blog-post':                     { runner: 'node',    script: 'scripts/build-blog-post-payload.mjs', section: 'B' },
  'facebook-lead-gen-ad':          { runner: 'node',    script: 'scripts/build-fb-ad-payload.mjs', section: 'B' },

  // ─── Section C — site producers (PR-diff stagers) ─────────────────────────
  'site-edit':                     { runner: 'node', script: 'scripts/site/run-site-edit.mjs', section: 'C' },
  'site-page-create':              { runner: 'node', script: 'scripts/site/run-site-page-create.mjs', section: 'C' },
  'site-performance':              { runner: 'node', script: 'scripts/site/run-site-performance.mjs', section: 'C' },
  'site-property-landing':         { runner: 'node', script: 'scripts/site/run-site-property-landing.mjs', section: 'C' },
  'site-matterport-embed':         { runner: 'node', script: 'scripts/site/run-site-matterport-embed.mjs', section: 'C' },

  // ─── Section D — ops handlers (Node mjs, accept --live) ───────────────────
  'ops-meta-ads':                  { runner: 'node', script: 'scripts/ops/run-meta-ads.mjs', section: 'D', accepts: ['--live'] },
  'ops-fub-crm':                   { runner: 'node', script: 'scripts/ops/run-fub-crm.mjs', section: 'D', accepts: ['--live'] },
  'ops-email-send':                { runner: 'node', script: 'scripts/ops/run-email-send.mjs', section: 'D', accepts: ['--live'] },
  'ops-reputation':                { runner: 'node', script: 'scripts/ops/run-reputation.mjs', section: 'D', accepts: ['--live'] },
  'ops-fb-marketplace':            { runner: 'node', script: 'scripts/ops/run-fb-marketplace.mjs', section: 'D', accepts: ['--live'] },
  'ops-manychat':                  { runner: 'node', script: 'scripts/ops/run-manychat.mjs', section: 'D', accepts: ['--live'] },
  'ops-google-ads':                { runner: 'node', script: 'scripts/ops/run-google-ads.mjs', section: 'D', accepts: ['--live'] },

  // ─── Section E — comms producers ──────────────────────────────────────────
  'comms-matt-alert':              { runner: 'node', script: 'scripts/build-comms-matt-alert.mjs', section: 'E' },
  'comms-client-update':           { runner: 'node', script: 'scripts/build-comms-client-update.mjs', section: 'E' },

  // ─── Section F — analysis producers ───────────────────────────────────────
  'analyze-experiment':            { runner: 'node', script: 'scripts/build-analyze-experiment.mjs', section: 'F' },

  // ─── Section A — orchestrators (fan out to sub-producers) ─────────────────
  'list_kit_orchestrator':                { runner: 'node', script: 'scripts/build-list-kit-orchestrator.mjs', section: 'A' },
  'monthly_market_report_orchestrator':   { runner: 'node', script: 'scripts/build-monthly-market-report-orchestrator.mjs', section: 'A' },
  'listing_launch_orchestrator':          { runner: 'node', script: 'scripts/build-listing-launch-orchestrator.mjs', section: 'A' },

  // ─── Section B — existing-asset wrappers (copy canonical pre-rendered) ────
  'listing_tour_video':            { runner: 'python3', script: 'scripts/build_listing_tour_video.py', section: 'B' },
  'neighborhood_tour':             { runner: 'python3', script: 'scripts/build_neighborhood_tour.py', section: 'B' },
  'market_data_video':             { runner: 'python3', script: 'scripts/build_market_data_video.py', section: 'B' },
  'market_pulse_short':            { runner: 'python3', script: 'scripts/build_market_pulse_short.py', section: 'B' },
  'market_report_video':           { runner: 'python3', script: 'scripts/build_market_report_video.py', section: 'B' },
  'cma':                           { runner: 'python3', script: 'scripts/build_cma_wrapper.py', section: 'B' },
  'flyer_design':                  { runner: 'python3', script: 'scripts/build_flyer_design_wrapper.py', section: 'B' },
  'ig_single_post':                { runner: 'python3', script: 'scripts/build_ig_single_post_wrapper.py', section: 'B' },
}

export default PRODUCERS
