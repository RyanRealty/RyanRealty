# Marketing Brain — Tools Registry

The brain and its producers read this file at decision-time to know which external tool handles which capability. Parallel to [`marketing_brain_skills/producers/REGISTRY.md`](../producers/REGISTRY.md) — that one is the producer-to-action-type lookup; this one is the tool-to-capability lookup.

A producer that needs to scrape an Instagram profile looks here for the canonical Apify actor. A capability skill that needs to TTS a script looks here for the canonical voice. A site producer that needs to push a blog post looks here for the AgentFire pattern. **Editing a tool's auth/cost/usage inline inside a producer is non-compliant — update this registry instead.**

**Last audited:** 2026-05-18. (apify, anthropic-classifier, supabase, replicate, spark_mls, meta_graph, resend, ga4, ga4-instrumentation, gsc, youtube_data, google_business_profile, follow_up_boss, tiktok_api, x_api, agentfire_wordpress, linkedin_api — 17 of 33 authored.)
**Canonical source for each tool:** the `SKILL.md` at the listed path.
**Template for new tool skills:** use [`video_production_skills/elevenlabs_voice/SKILL.md`](../../video_production_skills/elevenlabs_voice/SKILL.md) as the structural reference.

---

## Status legend

- ✅ **authored** — full SKILL.md exists at the listed path; producers may rely on it.
- 📝 **stub** — path reserved; SKILL.md is a placeholder. Producers should inline-document and the registry should grow.
- ↗️ **referenced** — SKILL.md exists elsewhere (older skill tree); this row points to it.
- ❌ **needs verification** — tool is used in code but no skill exists and config may be drifted.

---

## Section A — AI / LLM

Generative + interpretive AI capabilities. Each entry covers one provider; model selection lives inside each SKILL.md.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| anthropic-classifier | [`marketing_brain_skills/tools_registry/classifier/`](classifier/SKILL.md) | ✅ | Topic + format + treatment tagging via Haiku/Sonnet; Message Batches API for bulk; reads canonical taxonomy from [`lib/marketing-brain/topic-taxonomy.ts`](../../lib/marketing-brain/topic-taxonomy.ts) | competitor-recon classifier pass, future content_performance tagging, any brain skill that needs structured LLM tagging |
| elevenlabs_voice | [`video_production_skills/elevenlabs_voice/`](../../video_production_skills/elevenlabs_voice/SKILL.md) | ↗️ | TTS via Victoria voice (`qSeXEcewz7tA0Q0qk9fH`); IPA phoneme tags for Bend place names; previous_text chaining | every video producer that synths VO |
| replicate | [`marketing_brain_skills/tools_registry/replicate/`](replicate/SKILL.md) | ✅ | Gateway to AI video (Kling v2.1 Master, Veo 3, Hailuo 02, Seedance 1 Pro, Wan 2.5 i2v, Luma Ray 2) and image (FLUX 1.1 Pro, SDXL); polling + webhook patterns documented | listing-tour-video, listing_reveal, area_guides, depthflow_pipeline |
| fal_ai | `marketing_brain_skills/tools_registry/fal-ai/` | 📝 | Alt AI gateway; currently low priority (balance dry per CLAUDE.md) | none active |
| openai | `marketing_brain_skills/tools_registry/openai/` | 📝 | Fallback LLM if Anthropic rate-limited; image generation via DALL·E or gpt-image-1 | none default-on |

---

## Section B — Data sources

First-party APIs Ryan Realty owns or pays for. These are NOT scraping targets — they have stable contracts.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| supabase | [`marketing_brain_skills/tools_registry/supabase/`](supabase/SKILL.md) | ✅ | Postgres + RLS + Edge Functions; ryan-realty-platform project `dwvlophlbvvygjfxcrhm`; listings ~140 cols (mixed-case quirk documented), marketing_channel_daily, marketing_brain_actions, competitor_intel, content_classification, audit_runs | every brain skill + every producer |
| spark_mls | [`marketing_brain_skills/tools_registry/spark-mls/`](spark-mls/SKILL.md) | ✅ | Live MLS data via SparkAPI (replication endpoint); RETS OData filter syntax; Spark x Supabase reconciliation gate; MoS formula locked | market-data-video, monthly-market-report, listing-tour-video, generate-briefs |
| ga4 | [`marketing_brain_skills/tools_registry/ga4/`](ga4/SKILL.md) | ✅ | Google Analytics 4 via Data API + service account `viewer@ryanrealty.iam.gserviceaccount.com`; sessions, traffic sources, top pages, conversion events, funnel analysis | snapshot-channels-ga4, audit-website, diagnose-performance |
| ga4-instrumentation | [`marketing_brain_skills/tools_registry/ga4-instrumentation/`](ga4-instrumentation/SKILL.md) | ✅ | Canonical contract between site (event firing via `lib/tracking.ts` `trackEvent`), GA4 property `527333348` admin config (Key events, custom dimensions, audiences), and brain ingestor scope. Landing-page tracking convention + UTM standard. Read before adding any new event, building any new LP, or extending the GA4 ingestor. | every component that calls `trackEvent`, every new LP under `app/lp/` or `public/lp/`, audit-website, brain ingestor extensions |
| gsc | [`marketing_brain_skills/tools_registry/gsc/`](gsc/SKILL.md) | ✅ | Google Search Console — URL-prefix property `https://ryan-realty.com/` (NOT sc-domain); inverse-metric gotcha for position; Search Analytics API query patterns; 10 locked tracked queries | snapshot-channels-gsc, audit-website (seo layer), generate-briefs |
| follow_up_boss | [`marketing_brain_skills/tools_registry/follow-up-boss/`](follow-up-boss/SKILL.md) | ✅ | FUB CRM via v1 API; Basic auth (not Bearer); tag matching is case-insensitive multi-form (Title Case + kebab + automation tags); /v1/people has no date-filter params — use fetchInDateWindow; north-star metric (qualified_seller_leads); SLA thresholds (hot 5m, warm 30m) | snapshot-channels-fub, audit-crm, generate-briefs, ops-fub-crm |
| meta_graph | [`marketing_brain_skills/tools_registry/meta-graph/`](meta-graph/SKILL.md) | ✅ | Meta Graph API — long-lived page token with full publishing scopes; ads + page + IG insights; v25.0 pinned; campaign-status-on-insights gotcha documented | snapshot-channels-meta, audit-ads, every publisher target Meta |
| google_business_profile | [`marketing_brain_skills/tools_registry/gbp/`](gbp/SKILL.md) | ✅ | GBP Performance API (NOT deprecated Insights API); locked metric `call_clicks`; user OAuth token (not service-account); date-integer gotcha; post + photo publisher via v4 My Business API | snapshot-channels-gbp, ops-reputation |
| youtube_data | [`marketing_brain_skills/tools_registry/youtube-data/`](youtube-data/SKILL.md) | ✅ | YouTube Data API v3 (channel metadata, video list, upload) + Analytics API v2 (views, watch time, average_view_percentage, CTR); two-API architecture; scope + impressions-at-video-dimension gotchas documented | snapshot-channels-youtube, diagnose-performance, generate-briefs, future publisher |
| tiktok_api | [`marketing_brain_skills/tools_registry/tiktok-api/`](tiktok-api/SKILL.md) | ✅ | TikTok Open Platform v2; own-account video list + profile metrics; fields-in-query-string gotcha; open_id backfill logic; tier-gated completion_rate; Content Posting API scaffolded (not live) | snapshot-channels-tiktok, future publisher |
| x_api | [`marketing_brain_skills/tools_registry/x-api/`](x-api/SKILL.md) | ✅ | X / Twitter v2 API; OAuth 2.0 PKCE; replies is north-star metric (13.5× weight); /2/users/me aggressively rate-limited on Free/Basic — call once per run, not per day | snapshot-channels-x, future publisher |
| linkedin_api | [`marketing_brain_skills/tools_registry/linkedin-api/`](linkedin-api/SKILL.md) | ✅ | LinkedIn Marketing API; Community Management API mutually exclusive with Share-on-LinkedIn on current dev app — dev-app architecture decision pending Matt before org analytics unblock; publishing via `/rest/posts` works today | snapshot-channels-linkedin (analytics blocked; followers_count live), `/api/social/publish` (publishing live) |

---

## Section C — Scraping + competitive intelligence

Tools that pull data from sources outside our first-party contracts.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| apify | [`marketing_brain_skills/tools_registry/apify/`](apify/SKILL.md) | ✅ | Web-scraping platform; canonical actor registry per platform (IG, TikTok, YouTube, Facebook, LinkedIn, Google SERP, GMB reviews); cost model | competitor-recon, future audit expansion |
| websearch | `marketing_brain_skills/tools_registry/websearch/` | 📝 | Anthropic WebSearch tool inside the Claude API; for news clip topics, NAR/Fed press releases, ad-hoc fact-check | news-video, blog-post (when topic is news-driven) |

---

## Section D — Publishing

Tools that push approved content to its destination platform.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| meta_publisher | `marketing_brain_skills/tools_registry/meta-publisher/` | 📝 | Cross-posts via Meta Graph API to FB + IG; long-lived token live; reels + carousels + stories | automation_skills/automation/publish, post_scheduler |
| linkedin_publisher | `marketing_brain_skills/tools_registry/linkedin-publisher/` | 📝 | LinkedIn Share API; works today on the existing dev app | post_scheduler |
| youtube_publisher | `marketing_brain_skills/tools_registry/youtube-publisher/` | 📝 | YouTube Data API upload; needs `youtube.upload` scope | post_scheduler, market_youtube_longform |
| tiktok_publisher | `marketing_brain_skills/tools_registry/tiktok-publisher/` | 📝 | TikTok Content Posting API; sandbox + production flow differ | post_scheduler |
| x_publisher | `marketing_brain_skills/tools_registry/x-publisher/` | 📝 | X v2 API tweet creation; free/basic tier limits apply | post_scheduler |
| gbp_publisher | `marketing_brain_skills/tools_registry/gbp-publisher/` | 📝 | GBP Posts API for "What's New" + listings updates | ops-reputation |
| agentfire_wordpress | [`marketing_brain_skills/tools_registry/agentfire-wordpress/`](agentfire-wordpress/SKILL.md) | ✅ | WordPress REST API on ryan-realty.com (AgentFire-hosted); Basic auth via Application Password (not login password); draft + publish lifecycle; markdown-to-HTML required; never touch AgentFire IDX custom post types | blog-post, site-edit (limited) |
| resend | [`marketing_brain_skills/tools_registry/resend/`](resend/SKILL.md) | ✅ | Transactional + marketing email; mail.ryan-realty.com **pending DNS verification** (full SPF/DKIM/DMARC checklist in SKILL.md) | ops-email-send (BLOCKED until DNS verified), comms-matt-alert (email tier), cma-delivery |
| gmail | `marketing_brain_skills/tools_registry/gmail/` | 📝 | Gmail API draft creation (Matt's account) for personalized outbound | comms-matt-alert (medium/low tier), ops-email-send fallback |
| imessage | `marketing_brain_skills/tools_registry/imessage/` | 📝 | iMessage MCP server; for critical/high alerts to Matt directly | comms-matt-alert (critical/high tier) |
| slack | `marketing_brain_skills/tools_registry/slack/` | 📝 | Slack via slack-by-salesforce plugin; for team-channel surface of action items | comms-matt-alert (team-update tier) |

---

## Section E — Visual / media generation

Tools that produce or transform image and video assets.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| remotion | `marketing_brain_skills/tools_registry/remotion/` | 📝 | React-based video composition + rendering; canonical render command per [`CLAUDE.md`](../../CLAUDE.md) "Render hygiene" | every video producer |
| ffmpeg | `marketing_brain_skills/tools_registry/ffmpeg/` | 📝 | Static-ffmpeg + native aac encoder; symlinks at known paths; audio post-mix script `scripts/mix_news_audio.sh` | every video producer |
| canva_api | `marketing_brain_skills/tools_registry/canva-api/` | 📝 | Canva Connect API; carousel + flyer programmatic export | flyer-design, instagram-carousel |
| figma_api | `marketing_brain_skills/tools_registry/figma-api/` | 📝 | Figma REST API + variables; design-system token sync; brand-asset export | brand_assets, design_system updates |
| unsplash | `marketing_brain_skills/tools_registry/unsplash/` | 📝 | Stock photo API for lifestyle-style content where licensed library is insufficient | lifestyle-bend producers (planned) |
| shutterstock | `marketing_brain_skills/tools_registry/shutterstock/` | 📝 | Paid stock; pending go/no-go per video_production_skills/market-data-video/SKILL.md §21 | market-data-video (future) |
| asset_library | [`video_production_skills/asset-library/`](../../video_production_skills/asset-library/SKILL.md) | ↗️ | Manifest-driven internal media library at `data/asset-library/manifest.json` | every producer that needs licensed assets |
| media_sourcing | [`video_production_skills/media-sourcing/`](../../video_production_skills/media-sourcing/SKILL.md) | ↗️ | Decision routing for image/video/audio sources; asset library → Unsplash → Shutterstock → AI generation | every producer making sourcing decisions |

---

## Section F — Infrastructure

Tools producers do not call directly but depend on for operation.

| tool | path | status | what it does | who uses it |
|---|---|---|---|---|
| vercel | `marketing_brain_skills/tools_registry/vercel/` | 📝 | Hosting + cron + env management; CRON_SECRET auth pattern | every API route, every cron |
| git | `marketing_brain_skills/tools_registry/git/` | 📝 | Single-checkout main workflow; pull --rebase before every push | every commit |
| supabase_mcp | `marketing_brain_skills/tools_registry/supabase-mcp/` | 📝 | Supabase MCP server for ad-hoc SQL + migration application | brain skills authoring; not runtime |

---

## How to add a new tool

1. Add a row to the appropriate section (A–F) with `status: 📝` and the planned path.
2. If the tool is high-priority (a producer is about to start using it), promote the row to `✅ authored` by creating the SKILL.md at the listed path. Use [`video_production_skills/elevenlabs_voice/SKILL.md`](../../video_production_skills/elevenlabs_voice/SKILL.md) as the structural template:
   - frontmatter (name + description with trigger phrases)
   - canonical references section
   - LOCKED configuration sections (auth, model selection, settings)
   - usage patterns + code examples
   - failure modes + recovery
   - related skills + references
3. If the tool already has a SKILL.md elsewhere (older skill tree), use `status: ↗️ referenced` and link to it. Do not duplicate.
4. **The brain reads this file at decision time.** Producers + capability skills look up their tool dependencies here. A producer that hard-codes a tool's auth/cost/usage inline is non-compliant — update the producer to reference the tool SKILL.md instead.

---

## What's NOT in this registry

- **Producers themselves** — those are in [`marketing_brain_skills/producers/REGISTRY.md`](../producers/REGISTRY.md).
- **Brain components** (diagnose, audit-*, generate-briefs, weekly-cycle, snapshot-channels) — they're in the producer registry's Section H.
- **Skills that wrap a brand or content decision** (anti-slop-manifesto, viral-guardrails, platform-best-practices) — those are constraints, not tools.

---

## Status snapshot — 2026-05-15 (end of session)

- **Authored:** 16 (apify, anthropic-classifier, supabase, replicate, spark_mls, meta_graph, resend, ga4, gsc, youtube_data, google_business_profile, follow_up_boss, tiktok_api, x_api, agentfire_wordpress, linkedin_api)
- **Referenced (existing skills):** 3 (elevenlabs_voice, asset-library, media-sourcing)
- **Stub:** 14 — the next session that touches a stub tool should author its SKILL.md before producers start depending on it inline.
- **Authoring priority for next pass** (order by dependency depth):
  1. websearch — blog-post and news-video producers depend on it for topic sourcing
  2. remotion — every video producer depends on the canonical render command
