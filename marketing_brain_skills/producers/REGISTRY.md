# Marketing Brain — Producer Registry

The brain reads this file at decision-time to know which producer handles which `action_type`. New producer? Add a row here and the brain immediately knows.

**Last audited:** 2026-06-14.
**Canonical source for each producer:** the `SKILL.md` at the listed path.
**Template for new producers:** `marketing_brain_skills/producers/TEMPLATE.md`.

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
| social_calendar | `video_production_skills/social_calendar/` | `content:social_calendar` | matt-review-draft | 3–5 min | ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| ig-single-post | `social_media_skills/ig-single-post/` | `content:ig_single_post` | matt-review-draft | 3–8 min | S1–S10 templates: Just Listed, Just Sold, Open House, Coming Soon, Price Improvement, Featured Listing, Agent Intro, Brag Stat, Press Feature, Market Data Card. Script: `scripts/build_ig_single_post_wrapper.py` |
| open-house-stories | `social_media_skills/open-house-stories/` | `content:open_house_stories` | matt-review-draft | 5–10 min | 5–7 frame Stories sequence with ManyChat keyword CTA |
| under-contract-announcement | `social_media_skills/under-contract-announcement/` | `content:under_contract_announcement` | matt-review-draft | 3–8 min | 4:5 static, data-only caption, NO celebration language |
| sold-deal-summary | `social_media_skills/sold-deal-summary/` | `content:sold_deal_summary` | matt-review-draft | 5–10 min | Dual deliverable: IG/FB static + LinkedIn native text (market-insight framing) |
| linkedin-document-carousel | `social_media_skills/linkedin-document-carousel/` | `content:linkedin_doc_carousel` | matt-review-draft | 15–30 min | 8–12 slide PDF, market-insight framing — NOT a listing brochure. 24% engagement vs 6% static |
| agent-coop-eflyer | `social_media_skills/agent-coop-eflyer/` | `content:agent_coop_eflyer` | matt-review-draft | 5–10 min | Agent-to-agent email blast. Subject is the hook. Distribution: Resend (`mail.ryan-realty.com`) |
| postcard-farm-mailer | `social_media_skills/postcard-farm-mailer/` | `content:postcard_mailer` | matt-review-draft | 8–15 min | USPS direct mail to 0.5-mile farm radius. at_list / at_sold variants |
| yard-sign-rider | `social_media_skills/yard-sign-rider/` | `content:yard_sign` | matt-review-draft | 5–10 min | 18×24 main sign + rider variants (just_listed / open_house / under_contract / sold) |
| neighbor-outreach-note | `social_media_skills/neighbor-outreach-note/` | `content:neighbor_note` | matt-review-draft | 5–10 min | Handwritten-style card text + flyer enclosure + Avery label sheet for 20-40 nearest neighbors |
| broker-contact-card | `social_media_skills/broker-contact-card/` | `content:broker_card` | matt-review-draft | 3–5 min | NEW REGISTERED 2026-05-16 (re-applied 2026-05-17). Per-broker contact / signature block used inside CMA, blog bylines, lead-gen ad footer, listing-tour-video end card. Resolves from `public.brokers` row by email or slug. |
| virtual_staging | `social_media_skills/virtual_staging/` | `content:virtual_staging` | matt-review-draft | 5–10 min (~$0.50–$2/img) | NEW 2026-05-16. AI virtual staging of empty rooms. Replicate model. Always discloses "virtually staged" per NAR ethics. |
| floor_plan_render | `social_media_skills/floor_plan_render/` | `content:floor_plan_render` | matt-review-draft | 5–10 min | NEW 2026-05-16. Cleans/brands MLS floor plan or generates 2D plan from Matterport scan. PDF + PNG output. ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| comparable_grid | `social_media_skills/comparable_grid/` | `content:comparable_grid` | matt-review-draft | 5–10 min | NEW 2026-05-16. 3×2 or 3×3 image grid of comp sales for a listing or CMA. Delegated by `cma`. |
| testimonial_card | `social_media_skills/testimonial_card/` | `content:testimonial_card` | matt-review-draft | 3–8 min | NEW 2026-05-16. Single-image client quote card. Voice-validated against pandering. 4:5 + 9:16 variants. |
| map_static_card | `social_media_skills/map_static_card/` | `content:map_static_card` | matt-review-draft | 3–8 min | NEW 2026-05-16. Static branded Google Maps snippet for a listing or neighborhood. Location beat for carousels + email. |
| newsletter | `social_media_skills/newsletter/` | `content:newsletter` | matt-review-draft | 10–20 min | NEW 2026-05-16. Monthly email newsletter to past clients + leads via Resend. Phase 10 smoke-test producer. |
| listing-description | `social_media_skills/listing-description/` | `content:listing_description` | matt-review-draft | 5–10 min | NEW 2026-05-16. MLS Public Remarks + private remarks + showing instructions per listing. Fair-housing gated. |
| cma-narrative | `marketing_brain_skills/producers/cma-narrative/` | `content:cma_narrative` | matt-review-draft | 8–15 min | NEW 2026-05-16. Long-form narrative cover letter + per-section commentary inside a CMA. Delegated by `cma`. ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| market-report-blog | `social_media_skills/market-report-blog/` | `content:market_report_blog` | matt-review-draft | 10–20 min | NEW 2026-05-16. SEO-optimized monthly market report blog post for ryan-realty.com (AgentFire WordPress REST). |
| meta-creative-variant | `social_media_skills/meta-creative-variant/` | `content:meta_creative_variant` | matt-review-draft | 5–10 min | NEW 2026-05-16. 3-5 creative variants (headline + primary text + image) for active FB seller-funnel ad sets. |
| google-ads-copy | `social_media_skills/google-ads-copy/` | `content:google_ads_copy` | matt-review-draft | 5–10 min | NEW 2026-05-16. Search + Performance Max headlines + descriptions + sitelinks for Google Ads. Tied to SEO keywords. |
| nextdoor-business-ad | `social_media_skills/nextdoor-business-ad/` | `content:nextdoor_business_ad` | matt-review-draft | 5–10 min | NEW 2026-05-16. Nextdoor for Business sponsored post or local awareness ad. Hyperlocal seller-funnel. |
| price-drop-digest | `marketing_brain_skills/producers/price-drop-digest/` | `content:price_drop_digest` | matt-review-draft | 5–10 min | NEW 2026-06-09. Weekly social artifact from the Price Drop Radar DAL (getPriceDropDigest). Produces city-scoped or region-wide short-form social post (IG caption + IG static card + optional IG Reel hook). Pulls live data from `lib/data/listings/getPriceDrops.ts`. ⚠️ NO_SCRIPT — skill-only, runs via producer-runtime cron. |

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
| site-neighborhood-page | `marketing_brain_skills/producers/site-neighborhood-page/` | `site:neighborhood_page_create`, `site:neighborhood_page_update` | matt-review-PR | NEW 2026-05-16. Scaffolds or updates the canonical per-neighborhood landing page at `/neighborhoods/<slug>`. Sources facts from bend-market-bible.md. JSON-LD Place schema, lead-capture form, dynamic active-listing grid. shadcn/ui only. Opens a PR. |
| site-community-page | `marketing_brain_skills/producers/site-community-page/` | `site:community_page_create`, `site:community_page_update` | matt-review-PR | NEW 2026-05-18. Tier 2 of the four-tier search-authority stack (city → community → subdivision → listing). Scaffolds a Next.js dynamic route at `/lp/<community>/` for resort and master-planned communities (Tetherow, Pronghorn, Broken Top, Sunriver, Caldera Springs, etc.). ISR every 6h pulls live market_stats_cache + listings. Static config in data/resort-communities.json. JSON-LD Place + RealEstateAgent. Sub-neighborhood horizontal carousel. Buyer track (showing + alerts + guide) + seller CMA. shadcn/ui only. Opens a PR. |
| listing-alerts | `marketing_brain_skills/producers/listing-alerts/` | `ops:listing_alerts_setup`, `ops:listing_alerts_digest_send`, `ops:listing_alerts_pause`, `ops:listing_alerts_unsubscribe` | matt-review-PR (setup), none (runtime) | NEW 2026-05-18. Saved-search backend for buyer landing-page funnel. Captures criteria from Custom Alerts forms on community/subdivision/city LPs, matches nightly against listings table, emails branded daily digest via Resend at 7:00am PT. Includes unsubscribe, pause-on-broker-reply, admin queue. Migration creates listing_alerts + listing_alert_matches tables. FUB lead created on every subscribe. |
| buyers-guide | `marketing_brain_skills/producers/buyers-guide/` | `content:buyers_guide_create`, `content:buyers_guide_update`, `ops:buyers_guide_setup`, `ops:buyers_guide_send` | matt-review-PR (create/update/setup), none (send) | NEW 2026-05-18. Per-community buyer's guide PDF that backs the "Soft start" card on every community LP's buyer track. Canonical web version at `/lp/<community>/buyers-guide/` (Next.js + ISR 6h) for SEO/AEO; PDF generated from same page via Puppeteer so they never drift. Request handler at `/api/buyers-guide/request` captures form submissions, creates FUB lead, emails PDF via Resend. Weekly cron regenerates stale PDFs. |
| expired-listing-lp | `marketing_brain_skills/producers/expired-listing-lp/` | `content:expired-listing-audit`, `content:expired-listing-lp-update` | matt-review-draft | REGISTERED 2026-05-28 (live since 2026-05-17). Per-listing expired/withdrawn/canceled audit (5-cause framework: price vs comps, photo quality, MLS description, syndication, agent responsiveness) plus the shared `/lp/expired-listing` LP. Triggered by hourly `/api/cron/detect-expired-listings` OR direct invocation. Voice gated against `voice_guidelines.md` §4.7 — never pander, never editorialize, no comparison framing. Output: `public/expired-listings/<slug>/audit.html`. |
| site-subdivision-page | `marketing_brain_skills/producers/site-subdivision-page/` | `site:subdivision_page_create`, `site:subdivision_page_update` | matt-review-PR | NEW 2026-05-18. Tier 3 of the four-tier search-authority stack. Scaffolds a Next.js dynamic route at `/lp/<community>/<subdivision>/` for sub-plats inside a parent community (Heath/Tartan Druim/Triple Knot in Tetherow). Lighter than community page (~800-1,200 lines). ISR 6h. KPIs fall back to parent when sample < 3. Parent's sub-neighborhood carousel updates to link to real route on merge. shadcn/ui. PR. |
| site-listing-page | `marketing_brain_skills/producers/site-listing-page/` | `site:listing_page_create`, `site:listing_page_update`, `site:listing_page_archive`, `ops:listing_pages_batch_sync` | matt-review-PR | NEW 2026-05-18. Tier 4 (deepest) of the four-tier search-authority stack. Scaffolds a Next.js dynamic route at `/lp/listings/<mls-slug>/` for EVERY relevant SFR in the Oregon RMLS feed (our listings + OPM). ISR 1h. Two modes: our listings (full broker block, marketing language) vs OPM (mandatory IDX attribution per Oregon RMLS rules, showing CTA routes to our buyer's agent). Nightly cron walks listings table and dispatches create/update/archive actions. JSON-LD RealEstateListing schema. Beats Zillow on the address SERP via parent-community context, verified HOA, drive times, schools, comp set. shadcn/ui. PR per listing (or batch PR up to 20). |
| site-city-page | `marketing_brain_skills/producers/site-city-page/` | `site:city_page_create`, `site:city_page_update` | matt-review-PR | NEW 2026-05-18. Tier 1 (TOP) of the four-tier search-authority stack. Scaffolds a Next.js dynamic route at `/lp/<city>/` for Bend, Sisters, Redmond, La Pine, Tumalo, Terrebonne, Madras. ISR 6h. Broadest of the four tiers: includes city-wide KPIs, tile grid of every resort community + neighborhood, relocation block (cost-of-living, schools, climate, employers), peer-city comparison, full city map with community/neighborhood pins. The top-of-funnel SEO surface for "homes for sale in <City> Oregon" queries. shadcn/ui. PR. |

---

## Section D — Operational Producers

These producers make changes to ad accounts, CRM, and email platform. **No `scripts/build_*.py` / `build-*.mjs` expected for ops producers** — they execute via direct API calls from within the skill, not a standalone render script.

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
| comms-matt-alert | `marketing_brain_skills/producers/comms-matt-alert/` | `comms:matt_alert`, `comms:matt_summary`, `comms:team_update`, `comms:stakeholder_summary` | none (critical/high send immediately; medium/low/summary land in dashboard) | Routes alerts to iMessage (critical/high) or email + dashboard card (medium/low/summary). Voice-validates every message before send. Script: `scripts/build-comms-matt-alert.mjs` |
| comms-client-update | `marketing_brain_skills/producers/comms-client-update/` | `comms:client_weekly`, `comms:client_milestone`, `comms:past_client_touch` | matt-review-draft | NEW 2026-05-16. Per-client touchpoint communications: weekly seller status, milestone notes (offer accepted/inspection passed/closing), quarterly past-client touch (home-value + market snapshot). Sends via Resend with personalized fields. Script: `scripts/build-comms-client-update.mjs` |

---

## Section F — Analysis Producers

These producers run analysis and surface findings; they do not publish.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| analyze-anomaly | `marketing_brain_skills/analyze-anomaly/` | `analyze:drop_investigation`, `analyze:spike_investigation`, `analyze:metric_decomposition` | none (findings written to marketing_decisions; generate-briefs reads them) | Drills into flagged channel anomaly: inflection date, dimension decomposition, correlated events, hypothesis, recommended actions. ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |
| analyze-experiment | `marketing_brain_skills/analyze-experiment/` | `analyze:ab_test_design`, `analyze:ab_test_readout` | none (rollout actions it enqueues go to site-edit which has matt-review-PR) | Designs A/B tests with power calculation; reads out completed tests with chi-square / t-test significance; declares winner or extends. Script: `scripts/build-analyze-experiment.mjs` |
| analyze-competitor | `marketing_brain_skills/analyze-competitor/` | `analyze:competitor_scan`, `analyze:competitor_report` | none (findings written to marketing_decisions) | NEW 2026-05-16. Pulls and analyzes a named Bend competitor's marketing surface (Cascade Sotheby's, Hasson, Compass Bend, etc.). Post cadence, content mix, ad creative, listing count, agent growth. Sister to `competitor-recon` (which runs the weekly scrape). ⚠️ NO_SCRIPT — skill-only, must be hand-built before brain dispatch can produce |

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
| listing_trigger | `automation_skills/triggers/listing_trigger/` | New listing INSERT fires full content suite | No — event trigger |
| market_trigger | `automation_skills/triggers/market_trigger/` | Nightly cron; fires if any metric moves >5% | No — event trigger |
| trend_trigger | `automation_skills/triggers/trend_trigger/` | Monday 5am; outputs 10 trend candidates for social_calendar | No — event trigger |
| publish | `automation_skills/automation/publish/` | Post-approval publish skill; enforces gate.json | Capability |
| post_scheduler | `automation_skills/automation/post_scheduler/` | Drains post_queue every 5 min; calls platform APIs | Capability |
| engagement_bot | `automation_skills/automation/engagement_bot/` | Triages comments/DMs; drafts replies for Matt's approval | Capability |
| performance_loop | `automation_skills/automation/performance_loop/` | Sunday 6am; scores posts, shifts content mix toward winners | Capability |
| ab_testing | `automation_skills/automation/ab_testing/` | Multi-variant epsilon-greedy testing for hooks, CTAs | Capability |
| qa_pass | `automation_skills/automation/qa_pass/` | Pre-review gate; auto-iterates up to 2 cycles on fixable failures | Capability |
| feedback_loop | `automation_skills/automation/feedback_loop/` | Captures Matt's rejections as permanent rules in originating skill's SKILL.md | Capability |

---

## How to add a new producer

1. Add a row to the appropriate section (A–F) above with all columns filled.
2. Create the SKILL.md at the listed path, starting from `marketing_brain_skills/producers/TEMPLATE.md`.
3. Declare `action_types` in the SKILL.md frontmatter — these must exactly match what you put in the registry table.
4. The brain discovers producers by reading this file. No other registration is needed.
5. Commit the SKILL.md and this updated REGISTRY.md in the same PR.
