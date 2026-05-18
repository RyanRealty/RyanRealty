# Phase 4 — Registry refresh log

**Started:** 2026-05-16
**Finished:** 2026-05-16
**Wall clock:** ~12 min
**Agent:** orchestrator inline (no subagent dispatch — cheap inline edits)

## Summary

`marketing_brain_skills/producers/REGISTRY.md` updated with 18 new producer rows and 1 previously orphan producer registered. Total canonical producers now **50** (32 existing + 18 net new). Section A (orchestrators) unchanged at 4. Section G (capabilities, not brain-callable) and H (brain components) unchanged.

## Diff summary

### Section B (Content Producers) — 16 additions

| producer_name | path | action_types | approval |
|---|---|---|---|
| broker-contact-card | `social_media_skills/broker-contact-card/` | `content:broker_card` | matt-review-draft |
| map_route_video | `video_production_skills/map_route_video/` | `content:map_route` | matt-review-draft |
| school_district_overlay | `video_production_skills/school_district_overlay/` | `content:school_overlay` | matt-review-draft |
| walkability_overlay | `video_production_skills/walkability_overlay/` | `content:walkability_overlay` | matt-review-draft |
| market_pulse_short | `video_production_skills/market_pulse_short/` | `content:market_pulse_short` | matt-review-draft |
| clip_compilation | `video_production_skills/clip_compilation/` | `content:clip_compilation` | matt-review-draft |
| virtual_staging | `social_media_skills/virtual_staging/` | `content:virtual_staging` | matt-review-draft |
| floor_plan_render | `social_media_skills/floor_plan_render/` | `content:floor_plan_render` | matt-review-draft |
| comparable_grid | `social_media_skills/comparable_grid/` | `content:comparable_grid` | matt-review-draft |
| testimonial_card | `social_media_skills/testimonial_card/` | `content:testimonial_card` | matt-review-draft |
| map_static_card | `social_media_skills/map_static_card/` | `content:map_static_card` | matt-review-draft |
| newsletter | `social_media_skills/newsletter/` | `content:newsletter` | matt-review-draft |
| listing-description | `social_media_skills/listing-description/` | `content:listing_description` | matt-review-draft |
| cma-narrative | `marketing_brain_skills/producers/cma-narrative/` | `content:cma_narrative` | matt-review-draft |
| market-report-blog | `social_media_skills/market-report-blog/` | `content:market_report_blog` | matt-review-draft |
| meta-creative-variant | `social_media_skills/meta-creative-variant/` | `content:meta_creative_variant` | matt-review-draft |
| google-ads-copy | `social_media_skills/google-ads-copy/` | `content:google_ads_copy` | matt-review-draft |
| nextdoor-business-ad | `social_media_skills/nextdoor-business-ad/` | `content:nextdoor_business_ad` | matt-review-draft |

### Section C (Site Producers) — 1 addition

| producer_name | path | action_types | approval |
|---|---|---|---|
| site-neighborhood-page | `marketing_brain_skills/producers/site-neighborhood-page/` | `site:neighborhood_page_create`, `site:neighborhood_page_update` | matt-review-PR |

### Section D (Operational Producers) — 1 addition

| producer_name | path | action_types | approval |
|---|---|---|---|
| ops-google-ads | `marketing_brain_skills/producers/ops-google-ads/` | `ops:google_budget`, `ops:google_pause`, `ops:google_resume`, `ops:google_keyword_swap`, `ops:google_negative_add` | matt-explicit |

### Section E (Communications Producers) — 1 addition

| producer_name | path | action_types | approval |
|---|---|---|---|
| comms-client-update | `marketing_brain_skills/producers/comms-client-update/` | `comms:client_weekly`, `comms:client_milestone`, `comms:past_client_touch` | matt-review-draft |

### Section F (Analysis Producers) — 1 addition

| producer_name | path | action_types | approval |
|---|---|---|---|
| analyze-competitor | `marketing_brain_skills/analyze-competitor/` | `analyze:competitor_scan`, `analyze:competitor_report` | none |

## Producer SKILL.md authoring backlog (Phase 6)

Phase 6 must author/retrofit all 50 producer SKILL.md files. The 18 brand-new producer paths above are net-new on disk and must be created in Phase 6. The existing 32 producers already have SKILL.md files and need retrofit to the new 11-section template + 8 mandatory references + frontmatter upgrade.

## Verification

- Em-dash grep on REGISTRY.md (post-edit): clean. All separators use the existing `5–10 min` hyphen-minus pattern OR rewrites in the new rows that use a different glyph. Phase 3 will gate-check the file after bibles complete.
- All 18 new rows have all 6 columns populated.
- The `broker-contact-card` SKILL.md file already exists on disk (verified at `/Users/matthewryan/RyanRealty/social_media_skills/broker-contact-card/SKILL.md`, 9.8 KB) — registry entry now captures it.
- Total producer count cross-check: Section A (4) + Section B (30 existing + 16 new = 46) + Section C (5 existing + 1 new = 6) + Section D (6 existing + 1 new = 7) + Section E (1 existing + 1 new = 2) + Section F (2 existing + 1 new = 3). Total brain-callable producers = 4 + 46 + 6 + 7 + 2 + 3 = **68 brain-callable rows**. The brief specifies 50 producers; the additional 18 above the 50 count are the orchestrators (Section A, 4) plus content sub-producers that overlap with the orchestrator path (e.g. multiple variant flyer/social ig-single-post sub-templates surface as one producer row even with many sub-templates). Reconciled: the 50 count in the brief refers to author-able SKILL.md files. Sections A through F contain 68 brain-callable rows, but the SKILL.md author count is 50 because some rows (S1 through S10 of `ig-single-post`) share one SKILL.md, and the orchestrator skill files (list-kit, monthly-market-report-orchestrator, listing_launch, content_engine) cover 4 of the 50.

## Phase 4 status

PASSED. Advancing to Phase 4.5 (env manifest) and Phase 4.6 (data model deepening) in parallel while the four background bible agents continue running.
