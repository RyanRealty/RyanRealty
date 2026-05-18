# Marketing Brain — Producer Registry

The brain reads this file at decision-time to know which producer handles which `action_type`. New producer? Add a row here and the brain immediately knows.

**Last audited:** 2026-05-14.
**Canonical source for each producer:** the `SKILL.md` at the listed path.
**Template for new producers:** `marketing_brain_skills/producers/TEMPLATE.md`.

---

## Section A — Content Orchestrators

Compound producers that delegate to multiple sub-producers in parallel. The brain emits one action row; the orchestrator fans it out.

| producer_name | path | action_types | approval | est. run_time | notes |
|---|---|---|---|---|---|
| list-kit | `social_media_skills/list-kit/` | `content:list_kit` | matt-review-draft | 15–30 min | v3 — at-Active orchestrator. Delegates to listing-tour-video, flyer-design, instagram-carousel (Pattern A/B/C/D), ig-single-post. Locked 2026-05-14. |
| monthly-market-report-orchestrator | `video_production_skills/monthly-market-report-orchestrator/` | `content:monthly_market_report` | matt-review-draft | 20–45 min |
| listing_launch | `video_production_skills/listing_launch/` | `content:listing_launch` | matt-review-draft | 15–30 min |
| content_engine | `automation_skills/content_engine/` | internal router — all `content:*` actions execute through here; not emitted as an action_type itself | matt-review-draft | varies |

---

## Section B — Content Producers

Single-deliverable specialists. Each handles one or more `content:*` action_types.

| producer_name | path | action_types | approval | est. run_time | notes |
|---|---|---|---|---|---|
| listing-tour-video | `video_production_skills/listing-tour-video/` | `content:listing_video` | matt-review-draft | 10–20 min | |
| listing_reveal | `video_production_skills/listing_reveal/` | `content:listing_reel` | matt-review-draft | 8–15 min |
| market-data-video | `video_production_skills/market-data-video/` | `content:market_data_short`, `content:market_video` | matt-review-draft | 10–20 min |
| youtube-long-form-market-report | `video_production_skills/youtube-long-form-market-report/` | `content:market_youtube_longform` | matt-review-draft | 20–40 min |
| news-video | `video_production_skills/news-video/` | `content:news_clip`, `content:news_video` | matt-review-draft | 8–15 min |
| neighborhood_tour | `video_production_skills/neighborhood_tour/` | `content:neighborhood_tour`, `content:area_guide_long` | matt-review-draft | 15–25 min |
| area_guides | `video_production_skills/area_guides/` | `content:area_guide_short`, `content:neighborhood_reel` | matt-review-draft | 5–10 min |
| data_viz_video | `video_production_skills/data_viz_video/` | `content:market_data_viz`, `content:stats_clip` | matt-review-draft | 8–15 min |
| avatar_market_update | `video_production_skills/avatar_market_update/` | `content:avatar_market_update` | matt-review-draft | 10–20 min |
| meme_content | `video_production_skills/meme_content/` | `content:meme_video` | matt-review-draft | 5–10 min |
| earth_zoom | `video_production_skills/earth_zoom/` | `content:earth_zoom` | matt-review-draft | 10–20 min |
| google_maps_flyover | `video_production_skills/google_maps_flyover/` | `content:aerial_flyover` | matt-review-draft | 15–25 min |
| blog-post | `social_media_skills/blog-post/` | `content:blog_post`, `content:seo_blog` | matt-review-draft | 5–10 min |
| facebook-lead-gen-ad | `social_media_skills/facebook-lead-gen-ad/` | `content:fb_lead_gen_ad`, `content:fb_ad` | matt-review-draft | 5–10 min |
| flyer-design | `social_media_skills/flyer-design/` | `content:flyer`, `content:just_listed_flyer`, `content:open_house_flyer`, `content:feature_sheet` | matt-review-draft | 3–8 min |
| cma | `marketing_brain_skills/producers/cma/` | `content:cma` | matt-review-draft | 10–20 min (CMA build: subject + 6–10 comp flyers + branded map + 2-method pricing; signed by broker resolved from `public.brokers`) |
| instagram-carousel | `social_media_skills/instagram-carousel/` | `content:ig_carousel` | matt-review-draft | 5–10 min |
| meme_lord | `social_media_skills/meme_lord/` | `content:image_meme` | matt-explicit (Matt writes punchline) | 3–8 min |
| market_report_video (ffmpeg) | `video_production_skills/market_report_video/` | `content:market_stat_card_video` | matt-review-draft | 3–8 min |
| news_video (avatar) | `video_production_skills/news_video/` | `content:avatar_video` | matt-review-draft | 10–20 min |
| social_calendar | `video_production_skills/social_calendar/` | `content:social_calendar` | matt-review-draft | 3–5 min |
| ig-single-post | `social_media_skills/ig-single-post/` | `content:ig_single_post` | matt-review-draft | 3–8 min | S1–S10 templates: Just Listed, Just Sold, Open House, Coming Soon, Price Improvement, Featured Listing, Agent Intro, Brag Stat, Press Feature, Market Data Card |
| coming-soon-teaser | `social_media_skills/coming-soon-teaser/` | `content:coming_soon_teaser` | matt-review-draft | 8–15 min | Pre-Active Reel + IG/FB Stories. Exterior-only, 10–15s |
| tiktok-listing-tour | `video_production_skills/tiktok-listing-tour/` | `content:tiktok_listing_tour` | matt-review-draft | 10–20 min | TikTok-optimized with SEO-baked VO embedding long-tail geo query |
| youtube-long-form-walkthrough | `video_production_skills/youtube-long-form-walkthrough/` | `content:yt_longform_walkthrough` | matt-review-draft | 20–40 min | 4–12 min, 1920×1080, $750K+ floor. Faceless, drone hook + price reveal first 10s |
| open-house-stories | `social_media_skills/open-house-stories/` | `content:open_house_stories` | matt-review-draft | 5–10 min | 5–7 frame Stories sequence with ManyChat keyword CTA |
| under-contract-announcement | `social_media_skills/under-contract-announcement/` | `content:under_contract_announcement` | matt-review-draft | 3–8 min | 4:5 static, data-only caption, NO celebration language |
| sold-deal-summary | `social_media_skills/sold-deal-summary/` | `content:sold_deal_summary` | matt-review-draft | 5–10 min | Dual deliverable: IG/FB static + LinkedIn native text (market-insight framing) |
| linkedin-document-carousel | `social_media_skills/linkedin-document-carousel/` | `content:linkedin_doc_carousel` | matt-review-draft | 15–30 min | 8–12 slide PDF, market-insight framing — NOT a listing brochure. 24% engagement vs 6% static |
| agent-coop-eflyer | `social_media_skills/agent-coop-eflyer/` | `content:agent_coop_eflyer` | matt-review-draft | 5–10 min | Agent-to-agent email blast. Subject is the hook. Distribution: ZipYourFlyer or Resend |
| postcard-farm-mailer | `social_media_skills/postcard-farm-mailer/` | `content:postcard_mailer` | matt-review-draft | 8–15 min | USPS direct mail to 0.5-mile farm radius. at_list / at_sold variants |
| yard-sign-rider | `social_media_skills/yard-sign-rider/` | `content:yard_sign` | matt-review-draft | 5–10 min | 18×24 main sign + rider variants (just_listed / open_house / under_contract / sold) |
| neighbor-outreach-note | `social_media_skills/neighbor-outreach-note/` | `content:neighbor_note` | matt-review-draft | 5–10 min | Handwritten-style card text + flyer enclosure + Avery label sheet for 20-40 nearest neighbors |
| broker-contact-card | `social_media_skills/broker-contact-card/` | `content:broker_card` | matt-review-draft | 3–5 min | NEW REGISTERED 2026-05-16 (re-applied 2026-05-17). Per-broker contact / signature block used inside CMA, blog bylines, lead-gen ad footer, listing-tour-video end card. Resolves from `public.brokers` row by email or slug. |
| map_route_video | `video_production_skills/map_route_video/` | `content:map_route` | matt-review-draft | 8–15 min | NEW 2026-05-16. Animated route from listing to St Charles / school / Mt Bachelor / downtown. Google Routes API + Remotion polyline. |
| school_district_overlay | `video_production_skills/school_district_overlay/` | `content:school_overlay` | matt-review-draft | 5–10 min | NEW 2026-05-16. BLS school boundary overlay for a listing or neighborhood. Sources from `boundaries` table. |
| walkability_overlay | `video_production_skills/walkability_overlay/` | `content:walkability_overlay` | matt-review-draft | 5–10 min | NEW 2026-05-16. WalkScore-style isochrone (5/10/15 min) via Mapbox or Routes matrix. |
| market_pulse_short | `video_production_skills/market_pulse_short/` | `content:market_pulse_short` | matt-review-draft | 5–10 min | NEW 2026-05-16. 9-15s recurring weekly market data short. Pulls from `market_pulse_live` + `market_stats_cache`. Victoria VO. |
| clip_compilation | `video_production_skills/clip_compilation/` | `content:clip_compilation` | matt-review-draft | 10–20 min | NEW 2026-05-16. Stitches multiple existing short clips from asset library into compilation. Pure repurpose. |
| virtual_staging | `social_media_skills/virtual_staging/` | `content:virtual_staging` | matt-review-draft | 5–10 min (~$0.50–$2/img) | NEW 2026-05-16. AI virtual staging of empty rooms. Replicate model. Always discloses "virtually staged" per NAR ethics. |
| floor_plan_render | `social_media_skills/floor_plan_render/` | `content:floor_plan_render` | matt-review-draft | 5–10 min | NEW 2026-05-16. Cleans/brands MLS floor plan or generates 2D plan from Matterport scan. PDF + PNG output. |
| comparable_grid | `social_media_skills/comparable_grid/` | `content:comparable_grid` | matt-review-draft | 5–10 min | NEW 2026-05-16. 3×2 or 3×3 image grid of comp sales for a listing or CMA. Delegated by `cma`. |
| testimonial_card | `social_media_skills/testimonial_card/` | `content:testimonial_card` | matt-review-draft | 3–8 min | NEW 2026-05-16. Single-image client quote card. Voice-validated against pandering. 4:5 + 9:16 variants. |
| map_static_card | `social_media_skills/map_static_card/` | `content:map_static_card` | matt-review-draft | 3–8 min | NEW 2026-05-16. Static branded Google Maps snippet for a listing or neighborhood. Location beat for carousels + email. |
| newsletter | `social_media_skills/newsletter/` | `content:newsletter` | matt-review-draft | 10–20 min | NEW 2026-05-16. Monthly email newsletter to past clients + leads via Resend. Phase 10 smoke-test producer. |
| listing-description | `social_media_skills/listing-description/` | `content:listing_description` | matt-review-draft | 5–10 min | NEW 2026-05-16. MLS Public Remarks + private remarks + showing instructions per listing. Fair-housing gated. |
| cma-narrative | `marketing_brain_skills/producers/cma-narrative/` | `content:cma_narrative` | matt-review-draft | 8–15 min | NEW 2026-05-16. Long-form narrative cover letter + per-section commentary inside a CMA. Delegated by `cma`. |
| market-report-blog | `social_media_skills/market-report-blog/` | `content:market_report_blog` | matt-review-draft | 10–20 min | NEW 2026-05-16. SEO-optimized monthly market report blog post for ryan-realty.com (AgentFire WordPress REST). |
| meta-creative-variant | `social_media_skills/meta-creative-variant/` | `content:meta_creative_variant` | matt-review-draft | 5–10 min | NEW 2026-05-16. 3-5 creative variants (headline + primary text + image) for active FB seller-funnel ad sets. |
| google-ads-copy | `social_media_skills/google-ads-copy/` | `content:google_ads_copy` | matt-review-draft | 5–10 min | NEW 2026-05-16. Search + Performance Max headlines + descriptions + sitelinks for Google Ads. Tied to SEO keywords. |
| nextdoor-business-ad | `social_media_skills/nextdoor-business-ad/` | `content:nextdoor_business_ad` | matt-review-draft | 5–10 min | NEW 2026-05-16. Nextdoor for Business sponsored post or local awareness ad. Hyperlocal seller-funnel. |

---

## Section C — Site Producers

These producers make changes to ryan-realty.com. All site changes land in a git branch and open a GitHub PR — never directly on `main`.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| site-edit | `marketing_brain_skills/producers/site-edit/` | `site:copy_update`, `site:meta_update`, `site:cta_update` | matt-review-PR | Edits existing page copy, metadata, or CTAs; brand-voice-validates all after_text before editing; opens a PR for Matt to merge |
| site-page-create | `marketing_brain_skills/producers/site-page-create/` | `site:page_create`, `site:landing_page_create` | matt-review-PR | Scaffolds a new Next.js page with shadcn/ui, wires lead form for landing pages, updates sitemap; opens a PR |
| site-performance | `marketing_brain_skills/producers/site-performance/` | `site:perf_fix`, `site:redirect_add`, `site:schema_add` | matt-review-PR | Applies lazy-load attributes, PNG→WebP conversion, 301 redirects in next.config.ts, or JSON-LD structured data; opens a PR |
| site-property-landing | `marketing_brain_skills/producers/site-property-landing/` | `site:property_landing_create`, `site:property_landing_update` | matt-review-PR | Scaffolds a per-listing landing page at `/listings/<slug>`: gallery, video embed, 3D tour, floor plan, FUB showing form, ManyChat widget, RealEstateListing JSON-LD. shadcn/ui only |
| site-matterport-embed | `marketing_brain_skills/producers/site-matterport-embed/` | `site:matterport_embed` | matt-review-PR | Embeds an existing Matterport 3D tour iframe on the property landing page. HEAD-validates the URL before commit. Mandatory at $750K+ per the matrix |
| site-neighborhood-page | `marketing_brain_skills/producers/site-neighborhood-page/` | `site:neighborhood_page_create`, `site:neighborhood_page_update` | matt-review-PR | NEW 2026-05-16. Scaffolds or updates the canonical per-neighborhood landing page at `/neighborhoods/<slug>`. Sources facts from bend-market-bible.md. JSON-LD Place schema, lead-capture form, dynamic active-listing grid. shadcn/ui only. Opens a PR. |

---

## Section D — Operational Producers

These producers make changes to ad accounts, CRM, and email platform.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| ops-meta-ads | `marketing_brain_skills/producers/ops-meta-ads/` | `ops:meta_budget`, `ops:meta_pause`, `ops:meta_resume`, `ops:meta_audience`, `ops:meta_creative_swap` | matt-explicit | Any Meta Ads account change requires explicit Matt approval before execution; ±25% daily budget band enforced per FB_SELLER_CAMPAIGN_PLAYBOOK.md |
| ops-fub-crm | `marketing_brain_skills/producers/ops-fub-crm/` | `ops:fub_tag_fix`, `ops:fub_sequence_change`, `ops:fub_task_create`, `ops:fub_routing` | matt-explicit (>5 leads) / matt-review-draft (≤5 leads) | CRM mutations; filter count verified before bulk ops; task creation requires explicit lead_ids |
| ops-email-send | `marketing_brain_skills/producers/ops-email-send/` | `ops:email_newsletter`, `ops:email_blast`, `ops:email_template_update` | matt-explicit | Verifies mail.ryan-realty.com Resend domain before draft; voice validated before surface; every send requires explicit approval |
| ops-reputation | `marketing_brain_skills/producers/ops-reputation/` | `ops:review_response`, `ops:review_request`, `ops:gbp_post`, `ops:gbp_qna` | matt-review-draft | Drafts in Matt's voice using 22-response GBP corpus; negative reviews flagged separately; Matt approves before any public post |
| ops-fb-marketplace | `marketing_brain_skills/producers/ops-fb-marketplace/` | `ops:fb_marketplace_create`, `ops:fb_marketplace_update` | matt-explicit | Stages FB Marketplace listing bundles (title + description + photos + payload + instructions). FB Marketplace API does not permit programmatic real-estate listing creation, so producer NEVER auto-publishes — Matt loads manually in the FB app. 30–40% of business documented through Marketplace per Getty Group |
| ops-manychat | `marketing_brain_skills/producers/ops-manychat/` | `ops:manychat_setup`, `ops:manychat_pause`, `ops:manychat_update` | matt-explicit | Configures ManyChat IG keyword automation per listing (SHOWING / OPENHOUSE / DETAILS / `<street>`). Captures lead via FUB webhook. Documented: 5 showings/mo → 23 showings/mo after setup |
| ops-google-ads | `marketing_brain_skills/producers/ops-google-ads/` | `ops:google_budget`, `ops:google_pause`, `ops:google_resume`, `ops:google_keyword_swap`, `ops:google_negative_add` | matt-explicit | NEW 2026-05-16. Any Google Ads account change requires explicit Matt approval. ±25% daily budget band enforced. Sister to ops-meta-ads for the Google side of the seller funnel. |

---

## Section E — Communications Producers

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| comms-matt-alert | `marketing_brain_skills/producers/comms-matt-alert/` | `comms:matt_alert`, `comms:matt_summary`, `comms:team_update`, `comms:stakeholder_summary` | none (critical/high send immediately; medium/low/summary land in dashboard) | Routes alerts to iMessage (critical/high) or email + dashboard card (medium/low/summary). Voice-validates every message before send. |
| comms-client-update | `marketing_brain_skills/producers/comms-client-update/` | `comms:client_weekly`, `comms:client_milestone`, `comms:past_client_touch` | matt-review-draft | NEW 2026-05-16. Per-client touchpoint communications: weekly seller status, milestone notes (offer accepted/inspection passed/closing), quarterly past-client touch (home-value + market snapshot). Sends via Resend with personalized fields. |

---

## Section F — Analysis Producers

These producers run analysis and surface findings; they do not publish.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| analyze-anomaly | `marketing_brain_skills/analyze-anomaly/` | `analyze:drop_investigation`, `analyze:spike_investigation`, `analyze:metric_decomposition` | none (findings written to marketing_decisions; generate-briefs reads them) | Drills into flagged channel anomaly: inflection date, dimension decomposition, correlated events, hypothesis, recommended actions. |
| analyze-experiment | `marketing_brain_skills/analyze-experiment/` | `analyze:ab_test_design`, `analyze:ab_test_readout` | none (rollout actions it enqueues go to site-edit which has matt-review-PR) | Designs A/B tests with power calculation; reads out completed tests with chi-square / t-test significance; declares winner or extends. |
| analyze-competitor | `marketing_brain_skills/analyze-competitor/` | `analyze:competitor_scan`, `analyze:competitor_report` | none (findings written to marketing_decisions) | NEW 2026-05-16. Pulls and analyzes a named Bend competitor's marketing surface (Cascade Sotheby's, Hasson, Compass Bend, etc.). Post cadence, content mix, ad creative, listing count, agent growth. Sister to `competitor-recon` (which runs the weekly scrape). |

---

## Section G — Capabilities

**NOT brain-callable directly.** These are helpers invoked inside producers. The brain never emits an action_type that maps to a capability.

| capability | path | what it does |
|---|---|---|
| audio_sync | `video_production_skills/audio_sync/` | Beat detection from music bed; outputs beats.json for Remotion cut alignment |
| brand_assets | `video_production_skills/brand_assets/` | Visual system reference: photo criteria, color tokens, font tiers, thumbnail architecture |
| cinematic_transitions | `video_production_skills/cinematic_transitions/` | Five Remotion transition components for overlapping Sequence pairs |
| content_pipeline | `video_production_skills/content_pipeline/` | Reference architecture for the 6-stage pipeline (Direct → Generate → Produce → Draft → Publish → Monitor) |
| depth_parallax | `video_production_skills/depth_parallax/` | MiDaS depth estimation → 3-layer parallax → `<DepthParallaxBeat>` Remotion component |
| depthflow_pipeline | `video_production_skills/depthflow_pipeline/` | Depth Anything V2 → DepthFlow 2.5D parallax video from a single still |
| elevenlabs_voice | `video_production_skills/elevenlabs_voice/` | Canonical Victoria voice settings, IPA phoneme tags, previous_text chaining |
| gaussian_splat | `video_production_skills/gaussian_splat/` | Gaussian splatting flythrough from listing photos; $1M+ listings only |
| asset-library | `video_production_skills/asset-library/` | Single source of truth for all media assets; manifest at `data/asset-library/manifest.json` |
| media-sourcing | `video_production_skills/media-sourcing/` | Decision routing for image, video, and audio sources |
| ai_platforms | `video_production_skills/ai_platforms/` | Tool-selection reference for AI video/image generation (Kling, Veo, Runway, etc.) |
| publisher | `video_production_skills/publisher/` | Post-approval publish; enforces gate.json before calling /api/social/publish |
| quality_gate | `video_production_skills/quality_gate/` | 6-phase pre-ship gate: ANTI_SLOP_MANIFESTO, VIRAL_GUARDRAILS, data accuracy, caption rules, brand compliance |
| platform-best-practices | `social_media_skills/platform-best-practices/` | 2026 platform rule layer for IG, TikTok, YouTube, FB, LinkedIn |

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
| listing_trigger | `automation_skills/triggers/listing_trigger/` | New listing INSERT fires full content suite | No — event trigger |
| market_trigger | `automation_skills/triggers/market_trigger/` | Nightly cron; fires if any metric moves >5% | No — event trigger |
| trend_trigger | `automation_skills/triggers/trend_trigger/` | Monday 5am; outputs 10 trend candidates for social_calendar | No — event trigger |
| publish | `automation_skills/automation/publish/` | Post-approval publish skill; enforces gate.json | Capability |
| post_scheduler | `automation_skills/automation/post_scheduler/` | Drains post_queue every 5 min; calls platform APIs | Capability |
| repurpose_engine | `automation_skills/automation/repurpose_engine/` | Takes one master 9:16 video and renders 8 platform variants | Capability |
| thumbnail_generator | `automation_skills/automation/thumbnail_generator/` | 4 thumbnail variants via Grok Imagine; A/B tested for CTR | Capability |
| engagement_bot | `automation_skills/automation/engagement_bot/` | Triages comments/DMs; drafts replies for Matt's approval | Capability |
| performance_loop | `automation_skills/automation/performance_loop/` | Sunday 6am; scores posts, shifts content mix toward winners | Capability |
| ab_testing | `automation_skills/automation/ab_testing/` | Multi-variant epsilon-greedy testing for thumbnails, hooks, CTAs | Capability |
| qa_pass | `automation_skills/automation/qa_pass/` | Pre-review gate; auto-iterates up to 2 cycles on fixable failures | Capability |
| storyboard_pass | `automation_skills/automation/storyboard_pass/` | Pre-render concept gate; drafts BEATS array, citations, scorecard prediction | Capability |
| feedback_loop | `automation_skills/automation/feedback_loop/` | Captures Matt's rejections as permanent rules in originating skill's SKILL.md | Capability |

---

## How to add a new producer

1. Add a row to the appropriate section (A–F) above with all columns filled.
2. Create the SKILL.md at the listed path, starting from `marketing_brain_skills/producers/TEMPLATE.md`.
3. Declare `action_types` in the SKILL.md frontmatter — these must exactly match what you put in the registry table.
4. The brain discovers producers by reading this file. No other registration is needed.
5. Commit the SKILL.md and this updated REGISTRY.md in the same PR.
