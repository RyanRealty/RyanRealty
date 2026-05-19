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

  // ─── Section B — video producers (Python + PIL + ffmpeg + ElevenLabs) ─────
  'listing_reveal':                { runner: 'python3', script: 'scripts/build_listing_reveal.py', section: 'B' },
  'news_video':                    { runner: 'python3', script: 'scripts/build_news_video.py', section: 'B' },
  'area_guides':                   { runner: 'python3', script: 'scripts/build_area_guides.py', section: 'B' },
  'data_viz_video':                { runner: 'python3', script: 'scripts/build_data_viz_video.py', section: 'B' },
  'avatar_market_update':          { runner: 'python3', script: 'scripts/build_avatar_market_update.py', section: 'B' },
  'meme_content':                  { runner: 'python3', script: 'scripts/build_meme_content.py', section: 'B' },
  'earth_zoom':                    { runner: 'python3', script: 'scripts/build_earth_zoom.py', section: 'B' },
  'google_maps_flyover':           { runner: 'python3', script: 'scripts/build_google_maps_flyover.py', section: 'B' },
  'news_video_avatar':             { runner: 'python3', script: 'scripts/build_news_video_avatar.py', section: 'B' },
  'tiktok_listing_tour':           { runner: 'python3', script: 'scripts/build_tiktok_listing_tour.py', section: 'B' },
  'map_route_video':               { runner: 'python3', script: 'scripts/build_map_route_video.py', section: 'B' },
  'school_district_overlay':       { runner: 'python3', script: 'scripts/build_school_district_overlay.py', section: 'B' },
  'walkability_overlay':           { runner: 'python3', script: 'scripts/build_walkability_overlay.py', section: 'B' },
  'clip_compilation':              { runner: 'python3', script: 'scripts/build_clip_compilation.py', section: 'B' },
  'youtube_long_form_market_report':{ runner: 'python3', script: 'scripts/build_youtube_long_form_market_report.py', section: 'B' },

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
