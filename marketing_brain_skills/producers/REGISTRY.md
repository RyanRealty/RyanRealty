# Marketing Brain — Producer Registry

The brain reads this file at decision-time to know which producer handles which `action_type`. New producer? Add a row here and the brain immediately knows.

**Last audited:** 2026-08-18.
**Canonical source for each producer:** the `SKILL.md` at the listed path.
**Template for new producers:** `marketing_brain_skills/producers/TEMPLATE.md`.

> **UNUSED / DO NOT DISPATCH (2026-08-18 runtime crosswalk).** A REGISTRY row marked `UNUSED / DO NOT DISPATCH` has no writer: inbox-producer-registry, weekly `FORMAT_ROUTE_MAP`, and producer-runtime do not assign it. `resolveProducerFromRegistry` skips those rows. Do not invent a cron or dispatcher. Keep the SKILL.md (G35). Do not delete shipped TypeScript (newsletter send, saved-search-alerts, city/community/listing pages, expired-listing LP). Still live: CMA, content_engine, inbox-mapped producers, weekly-assigned producers.

> **VIDEO PRODUCERS DECOMMISSIONED — 2026-06-14 (Matt directive).** Every producer whose deliverable is a video has been removed from this registry. Because the brain resolves producers ONLY through this file, video `content:*` action_types no longer resolve to any producer and can never be dispatched or attempted. Removed: listing-tour-video, listing_reveal, market-data-video, youtube-long-form-market-report, news-video, neighborhood_tour, area_guides, data_viz_video, avatar_market_update, meme_content (video), earth_zoom, google_maps_flyover, market_report_video, news_video (avatar), coming-soon-teaser, tiktok-listing-tour, youtube-long-form-walkthrough, map_route_video, school_district_overlay, walkability_overlay, market_pulse_short, clip_compilation, monthly-market-report-orchestrator, listing_launch. The Remotion code (`video/`, `listing_video_v4/`, `video_production_skills/`, `scripts/build_*_video*.py`) remains on disk but is no longer brain-callable. To re-enable, re-add the rows.

---

## Section A — Content Orchestrators

Compound producers that delegate to multiple sub-producers in parallel. The brain emits one action row; the orchestrator fans it out.

| producer_name | path | action_types | approval | est. run_time | notes |
|---|---|---|---|---|---|
| list-kit | `social_media_skills/list-kit/` | `content:list_kit` | matt-review-draft | 15–30 min | v3 — at-Active orchestrator. Delegates to flyer-design, instagram-carousel (Pattern A/B/C/D), ig-single-post. (listing-tour-video delegation removed 2026-06-14 — video decommissioned.) Locked 2026-05-14. Script: `scripts/build-list-kit-orchestrator.mjs` |
| content_engine | `automation_skills/content_engine/` | internal router — all `content:*` actions execute through here; not emitted as an action_type itself | matt-review-draft | varies | No build script — internal routing bus, not a stand-alone producer |

---

## Section B — Content Producers

Single-deliverable specialists. Each handles one or more `content:*` action_types.

| producer_name | path | action_types | approval | est. run_time | notes |
|---|---|---|---|---|---|
| blog-post | `social_media_skills/blog-post/` | `content:blog_post`, `content:seo_blog` | matt-review-draft | 5–10 min |
| facebook-lead-gen-ad | `social_media_skills/facebook-lead-gen-ad/` | `content:fb_lead_gen_ad`, `content:fb_ad` | matt-review-draft | 5–10 min | `scripts/build-fb-ad.mjs` builds ad-spec from market cache (partial — does not handle lead-form wiring). ⚠️ NO_SCRIPT — full lead-gen form producer script not yet built |
| flyer-design | `social_media_skills/flyer-design/` | `content:flyer`, `content:just_listed_flyer`, `content:open_house_flyer`, `content:feature_sheet` | matt-review-draft | 3–8 min | Script: `scripts/build_flyer_design_wrapper.py` |
| cma | `marketing_brain_skills/producers/cma/` | `content:cma` | matt-review-draft | 10–20 min (CMA build: subject + 6–10 comp flyers + branded map + 2-method pricing; signed by broker resolved from `public.brokers`) | Script: `scripts/build_cma_wrapper.py` |
| instagram-carousel | `social_media_skills/instagram-carousel/` | `content:ig_carousel` | matt-review-draft | 5–10 min | ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| meme_lord | `social_media_skills/meme_lord/` | `content:image_meme` | matt-explicit (Matt writes punchline) | 3–8 min |
| ig-single-post | `social_media_skills/ig-single-post/` | `content:ig_single_post` | matt-review-draft | 3–8 min | S1–S10 templates: Just Listed, Just Sold, Open House, Coming Soon, Price Improvement, Featured Listing, Agent Intro, Brag Stat, Press Feature, Market Data Card. Script: `scripts/build_ig_single_post_wrapper.py` |
| open-house-stories | `social_media_skills/open-house-stories/` | `content:open_house_stories` | matt-review-draft | 5–10 min | 5–7 frame Stories sequence with ManyChat keyword CTA |
| under-contract-announcement | `social_media_skills/under-contract-announcement/` | `content:under_contract_announcement` | matt-review-draft | 3–8 min | 4:5 static, data-only caption, NO celebration language |
| sold-deal-summary | `social_media_skills/sold-deal-summary/` | `content:sold_deal_summary` | matt-review-draft | 5–10 min | Dual deliverable: IG/FB static + LinkedIn native text (market-insight framing) |
| linkedin-document-carousel | `social_media_skills/linkedin-document-carousel/` | `content:linkedin_doc_carousel` | matt-review-draft | 15–30 min | 8–12 slide PDF, market-insight framing — NOT a listing brochure. 24% engagement vs 6% static |
| agent-coop-eflyer | `social_media_skills/agent-coop-eflyer/` | `content:agent_coop_eflyer` | matt-review-draft | 5–10 min | Agent-to-agent email blast. Subject is the hook. Distribution: Resend (`mail.ryan-realty.com`) |
| postcard-farm-mailer | `social_media_skills/postcard-farm-mailer/` | `content:postcard_mailer` | matt-review-draft | 8–15 min | USPS direct mail to 0.5-mile farm radius. at_list / at_sold variants |
| yard-sign-rider | `social_media_skills/yard-sign-rider/` | `content:yard_sign` | matt-review-draft | 5–10 min | 18×24 main sign + rider variants (just_listed / open_house / under_contract / sold) |
| neighbor-outreach-note | `social_media_skills/neighbor-outreach-note/` | `content:neighbor_note` | matt-review-draft | 5–10 min | Handwritten-style card text + flyer enclosure + Avery label sheet for 20-40 nearest neighbors |
| broker-contact-card | `social_media_skills/broker-contact-card/` | `content:broker_card` | matt-review-draft | 3–5 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| virtual_staging | `social_media_skills/virtual_staging/` | `content:virtual_staging` | matt-review-draft | 5–10 min (~$0.50–$2/img) | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| floor_plan_render | `social_media_skills/floor_plan_render/` | `content:floor_plan_render` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| comparable_grid | `social_media_skills/comparable_grid/` | `content:comparable_grid` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. CMA `lib/cma/build.ts` does not dispatch this SKILL. |
| testimonial_card | `social_media_skills/testimonial_card/` | `content:testimonial_card` | matt-review-draft | 3–8 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| map_static_card | `social_media_skills/map_static_card/` | `content:map_static_card` | matt-review-draft | 3–8 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| newsletter | `social_media_skills/newsletter/` | `content:newsletter` | matt-review-draft | 10–20 min | UNUSED / DO NOT DISPATCH. Live path is `newsletter-monthly-draft` / `newsletter-send` TS, not this SKILL. |
| listing-description | `social_media_skills/listing-description/` | `content:listing_description` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| cma-narrative | `marketing_brain_skills/producers/cma-narrative/` | `content:cma_narrative` | matt-review-draft | 8–15 min | UNUSED / DO NOT DISPATCH. CMA `lib/cma/build.ts` does not dispatch this SKILL. |
| market-report-blog | `social_media_skills/market-report-blog/` | `content:market_report_blog` | matt-review-draft | 10–20 min | UNUSED / DO NOT DISPATCH. Live market report is `/api/cron/market-report`, not this SKILL. |
| meta-creative-variant | `social_media_skills/meta-creative-variant/` | `content:meta_creative_variant` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| google-ads-copy | `social_media_skills/google-ads-copy/` | `content:google_ads_copy` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| nextdoor-business-ad | `social_media_skills/nextdoor-business-ad/` | `content:nextdoor_business_ad` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. |
| price-drop-digest | `marketing_brain_skills/producers/price-drop-digest/` | `content:price_drop_digest` | matt-review-draft | 5–10 min | UNUSED / DO NOT DISPATCH. Not assigned by weekly FORMAT_ROUTE_MAP or inbox. |

---

## Section C — Site Producers

These producers make changes to ryan-realty.com. All site changes land in a git branch and open a GitHub PR — never directly on `main`. **No `scripts/build_*.py` / `build-*.mjs` expected for site producers** — they execute via code-writing + PR creation, not a standalone render script.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| site-edit | `marketing_brain_skills/producers/site-edit/` | `site:copy_update`, `site:meta_update`, `site:cta_update` | matt-review-PR | Edits existing page copy, metadata, or CTAs; brand-voice-validates all after_text before editing; opens a PR for Matt to merge |
| site-page-create | `marketing_brain_skills/producers/site-page-create/` | `site:page_create`, `site:landing_page_create` | matt-review-PR | Scaffolds a new Next.js page with shadcn/ui, wires lead form for landing pages, updates sitemap; opens a PR |
| site-performance | `marketing_brain_skills/producers/site-performance/` | `site:perf_fix`, `site:redirect_add`, `site:schema_add` | matt-review-PR | Applies lazy-load attributes, PNG→WebP conversion, 301 redirects in next.config.ts, or JSON-LD structured data; opens a PR |
| site-property-landing | `marketing_brain_skills/producers/site-property-landing/` | `site:property_landing_create`, `site:property_landing_update` | matt-review-PR | Scaffolds a per-listing landing page at `/listings/<slug>`: gallery, video embed, 3D tour, floor plan, FUB showing form, ManyChat widget, RealEstateListing JSON-LD. shadcn/ui only |
| site-matterport-embed | `marketing_brain_skills/producers/site-matterport-embed/` | `site:matterport_embed` | matt-review-PR | Embeds an existing Matterport 3D tour iframe on the property landing page. HEAD-validates the URL before commit. Mandatory at $750K+ per the matrix |
| site-neighborhood-page | `marketing_brain_skills/producers/site-neighborhood-page/` | `site:neighborhood_page_create`, `site:neighborhood_page_update` | matt-review-PR | UNUSED / DO NOT DISPATCH. Neighborhood pages already shipped in `app/`. Do not re-scaffold via this SKILL. |
| site-community-page | `marketing_brain_skills/producers/site-community-page/` | `site:community_page_create`, `site:community_page_update` | matt-review-PR | UNUSED / DO NOT DISPATCH. Community pages already shipped in `app/`. Do not re-scaffold via this SKILL. |
| listing-alerts | `marketing_brain_skills/producers/listing-alerts/` | `ops:listing_alerts_setup`, `ops:listing_alerts_digest_send`, `ops:listing_alerts_pause`, `ops:listing_alerts_unsubscribe` | matt-review-PR (setup), none (runtime) | UNUSED / DO NOT DISPATCH. No `/api/cron/listing-alerts-digest`. Live path is `/api/cron/saved-search-alerts`. |
| buyers-guide | `marketing_brain_skills/producers/buyers-guide/` | `content:buyers_guide_create`, `content:buyers_guide_update`, `ops:buyers_guide_setup`, `ops:buyers_guide_send` | matt-review-PR (create/update/setup), none (send) | UNUSED / DO NOT DISPATCH. No inbox/weekly/cron writer. Do not invent a buyers-guide cron. |
| expired-listing-lp | `marketing_brain_skills/producers/expired-listing-lp/` | `content:expired-listing-audit`, `content:expired-listing-lp-update` | matt-review-draft | UNUSED / DO NOT DISPATCH. Live path is sync-delta + `/lp/expired-listing` TS. detect-expired-listings is manual-only and does not assign this SKILL. |
| site-subdivision-page | `marketing_brain_skills/producers/site-subdivision-page/` | `site:subdivision_page_create`, `site:subdivision_page_update` | matt-review-PR | UNUSED / DO NOT DISPATCH. Subdivision pages already shipped in `app/`. Do not re-scaffold via this SKILL. |
| site-listing-page | `marketing_brain_skills/producers/site-listing-page/` | `site:listing_page_create`, `site:listing_page_update`, `site:listing_page_archive`, `ops:listing_pages_batch_sync` | matt-review-PR | UNUSED / DO NOT DISPATCH. Listing detail already shipped in `app/`. Do not re-scaffold via this SKILL. |
| site-city-page | `marketing_brain_skills/producers/site-city-page/` | `site:city_page_create`, `site:city_page_update` | matt-review-PR | UNUSED / DO NOT DISPATCH. City pages already shipped in `app/`. Do not re-scaffold via this SKILL. |

---

## Section D — Operational Producers

These producers make changes to ad accounts, CRM, and email platform. **No `scripts/build_*.py` / `build-*.mjs` expected for ops producers** — they execute via direct API calls from within the skill, not a standalone render script.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| ops-meta-ads | `marketing_brain_skills/producers/ops-meta-ads/` | `ops:meta_budget`, `ops:meta_pause`, `ops:meta_resume`, `ops:meta_audience`, `ops:meta_creative_swap` | matt-explicit | Any Meta Ads account change requires explicit Matt approval before execution; ±25% daily budget band enforced per FB_SELLER_CAMPAIGN_PLAYBOOK.md |
| ops-email-send | `marketing_brain_skills/producers/ops-email-send/` | `ops:email_newsletter`, `ops:email_blast`, `ops:email_template_update` | matt-explicit | Verifies mail.ryan-realty.com Resend domain before draft; voice validated before surface; every send requires explicit approval |
| ops-reputation | `marketing_brain_skills/producers/ops-reputation/` | `ops:review_response`, `ops:review_request`, `ops:gbp_post`, `ops:gbp_qna` | matt-review-draft | Drafts in Matt's voice using 22-response GBP corpus; negative reviews flagged separately; Matt approves before any public post |
| ops-fb-marketplace | `marketing_brain_skills/producers/ops-fb-marketplace/` | `ops:fb_marketplace_create`, `ops:fb_marketplace_update` | matt-explicit | Stages FB Marketplace listing bundles (title + description + photos + payload + instructions). FB Marketplace API does not permit programmatic real-estate listing creation, so producer NEVER auto-publishes — Matt loads manually in the FB app. 30–40% of business documented through Marketplace per Getty Group |
| ops-manychat | `marketing_brain_skills/producers/ops-manychat/` | `ops:manychat_setup`, `ops:manychat_pause`, `ops:manychat_update` | matt-explicit | Configures ManyChat IG keyword automation per listing (SHOWING / OPENHOUSE / DETAILS / `<street>`). Captures lead via FUB webhook. Documented: 5 showings/mo → 23 showings/mo after setup |
| ops-google-ads | `marketing_brain_skills/producers/ops-google-ads/` | `ops:google_budget`, `ops:google_pause`, `ops:google_resume`, `ops:google_keyword_swap`, `ops:google_negative_add` | matt-explicit | UNUSED / DO NOT DISPATCH. Not in inbox-producer-registry or weekly FORMAT_ROUTE_MAP. |

---

## Section E — Communications Producers

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| comms-matt-alert | `marketing_brain_skills/producers/comms-matt-alert/` | `comms:matt_alert`, `comms:matt_summary`, `comms:team_update`, `comms:stakeholder_summary` | none (critical/high send immediately; medium/low/summary land in dashboard) | Routes alerts to iMessage (critical/high) or email + dashboard card (medium/low/summary). Voice-validates every message before send. Script: `scripts/build-comms-matt-alert.mjs` |
| comms-client-update | `marketing_brain_skills/producers/comms-client-update/` | `comms:client_weekly`, `comms:client_milestone`, `comms:past_client_touch` | matt-review-draft | UNUSED / DO NOT DISPATCH. Not in inbox-producer-registry or weekly FORMAT_ROUTE_MAP. CRM sequences own client touches. |

---

## Section F — Analysis Producers

These producers run analysis and surface findings; they do not publish.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| analyze-anomaly | `marketing_brain_skills/analyze-anomaly/` | `analyze:drop_investigation`, `analyze:spike_investigation`, `analyze:metric_decomposition` | none (findings written to marketing_decisions; generate-briefs reads them) | Drills into flagged channel anomaly: inflection date, dimension decomposition, correlated events, hypothesis, recommended actions. ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| analyze-experiment | `marketing_brain_skills/analyze-experiment/` | `analyze:ab_test_design`, `analyze:ab_test_readout` | none (rollout actions it enqueues go to site-edit which has matt-review-PR) | Designs A/B tests with power calculation; reads out completed tests with chi-square / t-test significance; declares winner or extends. Script: `scripts/build-analyze-experiment.mjs` |
| analyze-competitor | `marketing_brain_skills/analyze-competitor/` | `analyze:competitor_scan`, `analyze:competitor_report` | none (findings written to marketing_decisions) | UNUSED / DO NOT DISPATCH. Live scrape is `competitor-recon` + `/api/cron/marketing-competitor-recon`. This producer is not assigned. |

---

## Section G — Capabilities

**NOT brain-callable directly.** These are helpers invoked inside producers. The brain never emits an action_type that maps to a capability.

| capability | path | what it does |
|---|---|---|
| platform-best-practices | `social_media_skills/platform-best-practices/` | 2026 platform rule layer for IG, TikTok, YouTube, FB, LinkedIn |

> The 13 video/media capability skills (audio_sync, brand_assets, cinematic_transitions, content_pipeline, depth_parallax, depthflow_pipeline, elevenlabs_voice, gaussian_splat, asset-library, media-sourcing, ai_platforms, publisher, quality_gate) were **deleted 2026-06-15** with `video_production_skills/`. The `data/asset-library/manifest.json` data file remains.

---

## Section H — Brain Components

**NOT producers.** Internal brain skills that generate action rows but do not execute them.

| skill | path | role |
|---|---|---|
| weekly-cycle | `marketing_brain_skills/weekly-cycle/` | Top-level brain orchestrator; runs all audits + diagnose + generate-briefs |
| diagnose-performance | `marketing_brain_skills/diagnose-performance/` | WoW/MoM deltas, z-score anomalies, channel rankings from marketing_channel_daily |
| generate-briefs | `marketing_brain_skills/generate-briefs/` | Synthesis layer: gathers signals, maps to ranked action rows with voice validation |
| audit-ads | `marketing_brain_skills/audit-ads/` | Audits paid Meta Ads; surfaces creative fatigue, budget drift, CPL anomalies |
| audit-crm | `marketing_brain_skills/audit-crm/` | Audits FUB CRM: lead quality, SLA, pipeline health, qualified-seller-leads north star |
| audit-website | `marketing_brain_skills/audit-website/` | Audits GA4 + GSC + FUB: traffic sources, SEO, conversion funnel |
| brand-voice | `marketing_brain_skills/brand-voice/` | Enforces Ryan Realty voice on every action row before dispatch |
| competitor-recon | `marketing_brain_skills/competitor-recon/` | Weekly Apify scrape of 8 Bend competitors + 2 national disruptors |
| platform-trends | `marketing_brain_skills/platform-trends/` | Algorithm changes, trending formats, trending audio; feeds generate-briefs |
| snapshot-channels | `marketing_brain_skills/snapshot-channels/` | Daily analytics pull from every connected channel into marketing_channel_daily |

---

## Section I — Automation Pipeline

Cron-driven infrastructure that is brain-adjacent but not directly brain-callable.

| skill | path | role | brain-callable? |
|---|---|---|---|
| listing_trigger | `automation_skills/triggers/listing_trigger/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/listing-watch` does not exist. | No — STOP |
| market_trigger | `automation_skills/triggers/market_trigger/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/market-trigger` does not exist. | No — STOP |
| trend_trigger | `automation_skills/triggers/trend_trigger/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/trend-trigger` does not exist. | No — STOP |
| publish | `automation_skills/automation/publish/` | Live path: `/api/social/publish` + `/api/cron/publisher-sweep` | Capability |
| post_scheduler | `automation_skills/automation/post_scheduler/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/post-scheduler` does not exist. | No — STOP |
| buffer_poster | `automation_skills/automation/buffer_poster/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/buffer-poster` does not exist. | No — STOP |
| engagement_bot | `automation_skills/automation/engagement_bot/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/engagement-pull` does not exist. | No — STOP |
| performance_loop | `automation_skills/automation/performance_loop/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/performance-loop` does not exist. | No — STOP |
| ab_testing | `automation_skills/automation/ab_testing/` | UNUSED / DO NOT DISPATCH. Claimed `/api/cron/ab-test-check` does not exist. | No — STOP |
| qa_pass | `automation_skills/automation/qa_pass/` | Pre-review gate; auto-iterates up to 2 cycles on fixable failures | Capability |
| feedback_loop | `automation_skills/automation/feedback_loop/` | Captures Matt's rejections as permanent rules in originating skill's SKILL.md | Capability |

---

## How to add a new producer

1. Add a row to the appropriate section (A–F) above with all columns filled.
2. Create the SKILL.md at the listed path, starting from `marketing_brain_skills/producers/TEMPLATE.md`.
3. Declare `action_types` in the SKILL.md frontmatter — these must exactly match what you put in the registry table.
4. The brain discovers producers by reading this file. No other registration is needed.
5. Commit the SKILL.md and this updated REGISTRY.md in the same PR.
