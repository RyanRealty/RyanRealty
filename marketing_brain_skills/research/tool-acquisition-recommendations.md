# Tool acquisition recommendations — Phase 9 deliverable

**Status:** Canonical
**Locked:** 2026-05-17
**Audience:** Matt + the brain (which factors cost vs impact when ranking actions).
**Source aggregation:** §11 of every authored producer, plus `tool-inventory.md` gaps, plus `env-manifest.md` ACTION REQUIRED, plus `phase-8-publishing-layer-audit.md`, plus `maps-api-enablement-log.md`.

## Tier-1: Free or near-free, immediate impact (do this week)

| Recommendation | Cost | Producers it unblocks | Impact ranking |
|---|---|---|---|
| Click Enable on the 5 Maps APIs still propagating after Phase 9 (Places New, Routes, Street View, Solar, Address Validation, Time Zone) | $0 (within free tier for normal volume) | map_route_video, school_district_overlay, walkability_overlay, neighborhood_tour, listing-tour-video, comparable_grid, site-neighborhood-page | HIGH. 7 producers blocked or degraded. Click-cost: 30 seconds per API. |
| Walk through `/api/tiktok/authorize/` OAuth flow once | $0 | tiktok-listing-tour, content_engine TikTok publishing | HIGH. TikTok is 1 of the top 4 surfaces in platform-bible.md for real-estate creator growth. Empty oauth_tokens row blocks all TikTok publishing. |
| Create Pinterest developer app + walk through OAuth | $0 | listing-tour-video Pinterest variant, neighborhood content | MEDIUM. Pinterest matters most for the seller-funnel inspiration phase. |
| Verify mail.ryan-realty.com domain in Resend dashboard | $0 | newsletter (Phase 10 smoke test), ops-email-send, comms-client-update, agent-coop-eflyer | HIGH. Phase 10 smoke test BLOCKS until this is done. |
| Set `RESEND_FROM`, `MARKETING_DIGEST_EMAIL`, `MARKETING_DASHBOARD_BASE_URL` in .env.local | $0 | newsletter, comms-matt-alert, ops-email-send | HIGH. Blocks Phase 10. |
| Generate WordPress App Password in AgentFire admin + set `WP_AGENTFIRE_USER` / `WP_AGENTFIRE_APP_PASSWORD` | $0 | blog-post, market-report-blog | HIGH. Blocks all blog producer publishing. Currently blog drafts pile up with no destination. |
| Confirm `CRON_SECRET` is 32+ chars random + set in Vercel project env | $0 | All 5 cron handlers added by Phase 8B + Phase 11.5 | HIGH. Cron handlers return 401 without it. |
| Set `ADMIN_DASHBOARD_TOKEN` (if Phase 10.5/10.6 UIs need fallback auth per pre-flight check) | $0 | /admin/producers, /admin/approval-queue | MEDIUM. Only required if Phase 10.5 pre-flight identified no existing auth pattern. |

## Tier-2: Under $25/month (recommend this quarter)

| Recommendation | Cost | Producers it unblocks | Impact ranking |
|---|---|---|---|
| xAI Grok API subscription (Grok 2 Vision + Grok Imagine) | ~$10-20/month at expected volume | meme_content, meme_lord, social_calendar, future image-generation producers | MEDIUM. Currently NO xAI key per env-manifest.md. Grok Imagine alternative to Midjourney for real-estate stylized image gen. |
| Apify paid tier (currently free with $5 starter credit, recommend $39/mo for actor reliability) | $39/month | competitor-recon, analyze-competitor, platform-trends, trend_trigger | MEDIUM. Free tier rate-limits scrapes; paid tier unblocks daily competitor recon. |
| Mapbox developer plan (50,000 free maps/month, paid above) | $0 starter, ~$10-20/mo when scaling | walkability_overlay isochrone, site-neighborhood-page, listing-tour-video drone overlays | LOW. Google Maps already enabled covers most needs. Mapbox is fallback + isochrone API specifically. |

## Tier-3: $25-100/month (recommend if growth justifies)

| Recommendation | Cost | Producers it unblocks | Impact ranking |
|---|---|---|---|
| Refill fal.ai balance (~$50 to start) | $50 starter + usage | depth_parallax, depthflow_pipeline, AI image gen at scale | MEDIUM. fal.ai balance is dry per tool-inventory.md §G. Replicate is the alternative path for the same models. |
| Virtual staging API subscription (e.g. ApplyDesign or Virtual Staging AI) | ~$50-99/mo for unlimited | virtual_staging producer | HIGH for the $750K+ listing tier. Replicate per-image cost is ~$0.50-$2; SaaS unlimited at $50-99/mo wins past 50 images/month. |
| Synthesia tier upgrade (currently no key) | $30/mo Starter | avatar_market_update, news_video (avatar path) | LOW. Avatar producers are a small fraction of the content mix. The brand-first rule (per CLAUDE.md) discourages broker face-on-camera anyway. Defer unless we explicitly want avatar content. |

## Tier-4: Over $100/month (only if business case is clear)

| Recommendation | Cost | Producers it unblocks | Impact ranking |
|---|---|---|---|
| Paid Google Maps quota for high-volume aerial view + 3D Tiles | Variable, ~$100-300/mo for our scale | google_maps_flyover, aerial-style listing intros, site-neighborhood-page 3D embeds | LOW-MEDIUM. The free tier ($200/month credit) covers normal listing volume. Only upgrade if we hit the credit ceiling. |
| Replicate increased tier (currently pay-as-you-go) | Variable | Kling v2.1 Master, Veo 3, Hailuo 02, Seedance 1 Pro, Wan 2.5 i2v, Luma Ray 2 | DEFER. Cost-per-call already documented in tool-inventory.md §E. Per-call requires Matt approval per CLAUDE.md guardrail §2.7. Tier upgrade only makes sense if Matt approves a sustained AI-video cadence. |
| Veo 3 dedicated access via Google AI Studio (vs Replicate proxy) | TBD, currently waitlisted | Premium listing intros | DEFER. Replicate access works for now. |
| Apollo paid tier | ~$49-149/mo | New: agent-to-agent referral outreach producer | LOW. Not in current 50-producer roster. If Matt expands into agent recruitment, this becomes Tier-3. |

## Capability gaps (no purchase needed — engineering work)

| Recommendation | Effort | Producers it unblocks |
|---|---|---|
| Backfill `public/v5_library/*.mp4` + `public/list-kits/*` into the asset library manifest | ~4-6 hours engineering | repurpose_engine, clip_compilation, sold-deal-summary, all "best-of" compilations |
| Update Python generators in `scripts/build_list_kit_*.py` to auto-register every render | ~2 hours engineering | All list-kit driven producers |
| Update Remotion render scripts in `listing_video_v4/` to call `register()` after successful out/ render | ~2 hours engineering | All video producers |
| Wire seller-lead attribution cron (read FUB lead-source attribution, update `content_performance.north_star_attributed_seller_leads`) | ~6-8 hours engineering | Brain's priority_score (the north_star_impact factor goes from estimated to actual) |
| Implement the LinkedIn + GBP `fetchPostMetrics()` stubs Phase 8B left as TODO | ~3-4 hours engineering per platform | performance ingestion crons for LinkedIn + GBP |
| Grant `viewer@ryanrealty` service account `roles/serviceusage.serviceUsageAdmin` | 1 click in IAM console (Matt) | Autonomous future API enables (brain can enable APIs it discovers it needs without Matt's manual intervention) |
| Build LinkedIn image-post path (P0 from publish audit) | ~3-4 hours engineering | LinkedIn image carousels, LinkedIn document carousels |
| Migrate X media upload from v1.1 to v2 (P0 from publish audit) | ~4-6 hours engineering | X video posts |
| Wire IG carousel `status_code=FINISHED` polling (P0 from publish audit) | ~2-3 hours engineering | instagram-carousel, list-kit IG fanout |

## Aggregated priority ranking for Matt

If you only do three things this week:

1. **Verify Resend domain + set the 4 missing env vars + walk through TikTok and Pinterest OAuth.** Total time: 25-40 min. Unblocks the Phase 10 smoke test plus TikTok + Pinterest + blog publishing.
2. **Click Enable on the 5 Maps APIs that are still propagating** (re-verify they actually took, sometimes the click doesn't register through the loading-screen redirect). Total time: 5 min. Unblocks 7 producers.
3. **Generate the WordPress App Password** for AgentFire and set `WP_AGENTFIRE_USER` + `WP_AGENTFIRE_APP_PASSWORD`. Total time: 5 min. Unblocks both blog producers.

Combined Tier-1 effort: under one hour. Combined unblock: 13 producers, the Phase 10 smoke test, three publish destinations.

## What the brain factors

The brain's `priority_score` includes a `tool_availability_factor` (1.0 if all required tools are live, 0.5 if a producer's primary tool is in Tier-2 or below). Producers blocked by Tier-1 items above are silently skipped from the brain's candidate list each cycle (they generate `tool_blocked` log rows instead of `pending` action rows). Once Tier-1 items are resolved, the brain re-introduces those producers to the candidate pool on its next cycle.

## Related references

- `marketing_brain_skills/research/tool-inventory.md` (full tool stack + gaps section)
- `marketing_brain_skills/research/env-manifest.md` (34 ACTION REQUIRED items)
- `marketing_brain_skills/research/phase-8-publishing-layer-audit.md` (17 publish bugs)
- `marketing_brain_skills/research/maps-api-enablement-log.md` (Maps API status)
- `marketing_brain_skills/research/reuse-query-patterns.md` (asset library backfill spec)
