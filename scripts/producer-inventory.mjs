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
  // 'floor_plan_render' — DEPRECATED 2026-05-20, moved to scripts/_deprecated/.
  // Per Matt review: real floor plans come from the listing photographer, not
  // from a generated SVG. See scripts/_deprecated/README.md.
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
  //   All 12 of these were rebuilt as real Remotion compositions 2026-05-20.
  //   Each registered at the bottom of this file with `remotion` + `comp` keys.
  //   ✅ listing_reveal · news_video · area_guides · data_viz_video · meme_content
  //   ✅ tiktok_listing_tour · map_route_video · school_district_overlay
  //   ✅ walkability_overlay · earth_zoom · google_maps_flyover
  //   ✅ youtube_long_form_market_report (uses video/market-report-yt-long/)
  //   BLOCKED on external dependencies (documented):
  //     news_video_avatar     — Synthesia API + Matt avatar training
  //     avatar_market_update  — SYNTHESIA_AVATAR_ID config
  //
  // The video producers that ARE real (use existing canonical Remotion comps)
  // are listed below in the existing-asset wrappers section.

  // clip_compilation — script deleted 2026-08-18 with Remotion factory.

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

  'cma':                           { runner: 'python3', script: 'scripts/build_cma_wrapper.py', section: 'B' },
  'flyer_design':                  { runner: 'python3', script: 'scripts/build_flyer_design_wrapper.py', section: 'B' },
  'ig_single_post':                { runner: 'python3', script: 'scripts/build_ig_single_post_wrapper.py', section: 'B' },

  // Remotion video producers (listing_tour_video, news_video, earth_zoom_real,
  // youtube_long_form_market_report, …) were deleted 2026-08-18 with the
  // Remotion factory. Live video is Studio: lib/studio + /admin/studio.
}

export default PRODUCERS
