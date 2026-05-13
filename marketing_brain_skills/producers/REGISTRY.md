# Marketing Brain — Producer Registry

The brain reads this file at decision-time to know which producer handles which `action_type`. New producer? Add a row here and the brain immediately knows.

**Last audited:** 2026-05-13.
**Canonical source for each producer:** the `SKILL.md` at the listed path.
**Template for new producers:** `marketing_brain_skills/producers/TEMPLATE.md`.

---

## Section A — Content Orchestrators

Compound producers that delegate to multiple sub-producers in parallel. The brain emits one action row; the orchestrator fans it out.

| producer_name | path | action_types | approval | est. run_time |
|---|---|---|---|---|
| list-kit | `social_media_skills/list-kit/` | `content:list_kit` | matt-review-draft | 15–30 min |
| monthly-market-report-orchestrator | `video_production_skills/monthly-market-report-orchestrator/` | `content:monthly_market_report` | matt-review-draft | 20–45 min |
| listing_launch | `video_production_skills/listing_launch/` | `content:listing_launch` | matt-review-draft | 15–30 min |
| content_engine | `automation_skills/content_engine/` | internal router — all `content:*` actions execute through here; not emitted as an action_type itself | matt-review-draft | varies |

---

## Section B — Content Producers

Single-deliverable specialists. Each handles one or more `content:*` action_types.

| producer_name | path | action_types | approval | est. run_time |
|---|---|---|---|---|
| listing-tour-video | `video_production_skills/listing-tour-video/` | `content:listing_video` | matt-review-draft | 10–20 min |
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
| instagram-carousel | `social_media_skills/instagram-carousel/` | `content:ig_carousel` | matt-review-draft | 5–10 min |
| meme_lord | `social_media_skills/meme_lord/` | `content:image_meme` | matt-explicit (Matt writes punchline) | 3–8 min |
| market_report_video (ffmpeg) | `video_production_skills/market_report_video/` | `content:market_stat_card_video` | matt-review-draft | 3–8 min |
| news_video (avatar) | `video_production_skills/news_video/` | `content:avatar_video` | matt-review-draft | 10–20 min |
| social_calendar | `video_production_skills/social_calendar/` | `content:social_calendar` | matt-review-draft | 3–5 min |

---

## Section C — Site Producers

**Status: pending build** (next wave). These producers make changes to ryan-realty.com.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| site-edit | `marketing_brain_skills/producers/site-edit/` | `site:copy_update`, `site:hero_update` | matt-review-PR | Edits existing page copy or hero content; opens a PR for Matt to merge |
| site-page-create | `marketing_brain_skills/producers/site-page-create/` | `site:page_create`, `site:landing_page` | matt-review-PR | Scaffolds a new Next.js page; opens a PR |
| site-performance | `marketing_brain_skills/producers/site-performance/` | `site:perf_fix`, `site:seo_fix` | matt-review-PR | Fixes Core Web Vitals or SEO issues surfaced by audit-website |

---

## Section D — Operational Producers

**Status: pending build.** These producers make changes to ad accounts, CRM, and email platform.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| ops-meta-ads | `marketing_brain_skills/producers/ops-meta-ads/` | `ops:meta_ads_pause`, `ops:meta_ads_budget`, `ops:meta_ads_new_campaign` | matt-explicit | Any Meta Ads account change requires explicit Matt approval before execution |
| ops-fub-crm | `marketing_brain_skills/producers/ops-fub-crm/` | `ops:fub_tag`, `ops:fub_stage`, `ops:fub_assign` | matt-explicit | CRM mutations; explicit approval required |
| ops-email-send | `marketing_brain_skills/producers/ops-email-send/` | `ops:email_blast`, `ops:email_drip_add` | matt-review-draft | Drafts email for Matt's review before Resend send |
| ops-reputation | `marketing_brain_skills/producers/ops-reputation/` | `ops:gbp_review_response`, `ops:review_flag` | matt-review-draft | Drafts GBP review responses in Matt's voice; Matt approves before post |

---

## Section E — Communications Producers

**Status: pending build.** Internal alerts to Matt.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| comms-matt-alert | `marketing_brain_skills/producers/comms-matt-alert/` | `comms:alert`, `comms:digest` | none | Sends iMessage or Slack notification to Matt; no content approval gate — these are brain status reports, not published content |

---

## Section F — Analysis Producers

**Status: pending build.** These producers run analysis and surface findings; they do not publish.

| producer_name | path | action_types | approval | notes |
|---|---|---|---|---|
| analyze-anomaly | `marketing_brain_skills/producers/analyze-anomaly/` | `analyze:anomaly`, `analyze:spike` | none (findings surfaced in digest) | Deep-dives into a flagged channel anomaly; writes finding to marketing_decisions |
| analyze-experiment | `marketing_brain_skills/producers/analyze-experiment/` | `analyze:experiment_result` | none | Concludes a running A/B test; writes winner + rationale to marketing_decisions |

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
