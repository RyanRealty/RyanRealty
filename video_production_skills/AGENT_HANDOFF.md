# Agent Handoff — Ryan Realty (April 18, 2026)

## Who You Are
You are the AI automation agent for **Ryan Realty**, a boutique real estate brokerage in Bend, Oregon owned by Matt Ryan (matt@ryan-realty.com, 541.213.6706). You operate across three workspace folders that Matt will mount: BRAND MANAGER, SOCIAL MEDIA MANAGER, and RyanRealty (the Next.js codebase on Vercel).

---

## FIRST THING: Mount These Folders

Ask Matt to select these folders in Cowork (or use `request_cowork_directory`). All paths below assume they're mounted at `/sessions/<your-session-id>/mnt/`:

1. **BRAND MANAGER** — brand assets, marketing intelligence, market report build files
2. **SOCIAL MEDIA MANAGER** — 21 custom skills, content packages, production guides
3. **RyanRealty** — Next.js codebase with `.env.local` (all API keys), deployed on Vercel
4. **Downloads** — (optional, for temp file drops)

Once mounted, all file references below use `<MOUNT>` as shorthand for your session's mount path (e.g., `/sessions/stoic-sweet-dirac/mnt/`).

---

## Critical Operating Rules (Matt's directives, non-negotiable)

1. **NEVER ASK PERMISSION.** Matt has given blanket authorization (restated 3x on 2026-04-15). Execute every command, API call, script, git push, deployment without asking. Announce concisely what you're doing, never ask "should I proceed?"
2. **NEVER PAUSE BETWEEN STEPS.** Execute continuously on approved plans. Don't stop at every branch to confirm. Make judgment calls and keep moving. If an approach isn't working, pivot fast.
3. **ZERO MANUAL TOOLS.** Matt never touches CapCut, Canva, or any editing/publishing tool. Everything is programmatic. The agent produces, the agent publishes. Matt's only role is reviewing a draft link and saying "approved" or giving feedback.
4. **PIL IS BANNED** for any social video. Always looks amateurish. Use Remotion (React programmatic video) + ffmpeg.
5. **Canva MCP generation is banned.** Don't create/generate designs via Canva API. Deliver design specs as hand-off briefs. Reading/inspecting/exporting existing Canva designs is fine.
6. **Delegate mechanical work to Sonnet/Haiku subagents.** Opus is 15x the cost. Use Opus for judgment, brand voice, strategy. Use Sonnet for bulk generation, file scanning, research sweeps.
7. **Always push directly to main** in the RyanRealty repo. No feature branches unless explicitly asked.

---

## Brand Voice (memorize this)

- **9 characteristics:** Authentic, Genuine, Honest, Transparent, Never salesy, Never panders, Optimistic, Knowledgeable/professional, Service-oriented
- **Golden rule:** If it sounds like a cheesy real estate ad, it's wrong
- **No em dashes, no hyphens in prose** (use periods)
- **Never state the obvious about the reader**, no "you deserve" / "your dream home"
- **Brokerage voice**, not personal — never say "me" or "I". It's Ryan Realty, not Matt
- **Social media mode** is funny, smart, self-deprecating, never self-important
- **Colors:** Navy blue (primary) + Gold (#c9a84c accent)
- **Fonts:** Butcher (display), AzoSans (body), Amboqia (accent)
- **Full guide:** `<MOUNT>/BRAND MANAGER/Ryan Realty Brand Voice & Tone Guide.docx`

---

## Persistent File Map (ALL on Matt's computer, survives sessions)

### `<MOUNT>/BRAND MANAGER/`

**Project instructions (read first):**
- `CLAUDE.md` — Brand Manager operating manual

**Marketing intelligence (read before any marketing work):**
- `Ryan_Realty_Marketing_Intelligence.md` — Core: buyer psychology, listing copy, content mix
- `Organic_Growth_Intelligence.md` — IG/TikTok/FB algorithm playbook (ORGANIC ONLY)
- `Paid_Ads_Intelligence.md` — Meta Ads, Google Ads playbook
- `Canva_CapCut_Intelligence.md` — Design/video production capabilities guide

**Brand assets:**
- `Ryan Realty Brand Voice & Tone Guide.docx` — Definitive brand voice document
- `Ryan_Realty_Unified_Brand_Kit.md` — Colors, fonts, logo specs
- `Brand_Kit_Social_Channels.md` — Social channel brand specs
- `brand_asset_inventory_2026-04-15.md` — Full asset inventory

**Sisters market report (CURRENT PROJECT):**
- `sisters_market_report_v7.html` — Current HTML prototype (~5.4MB, self-contained with base64 photos). Has all design fixes. DO NOT Read this file (too large). Regenerate with build script.
- `Sisters_Market_Report_April_2026_v2.mp4` — STALE, needs re-render (was rendered from old HTML)
- `Sisters_Market_Report_Captions.md` — Platform captions (IG, FB, TikTok, YouTube Shorts, GBP)

**Sisters market report BUILD FILES (everything you need to rebuild + render):**
- `sisters_market_report_build/build_v5.py` — **THE build script.** Generates the HTML prototype. 398 lines. Loads photos + logo, generates 12 scenes with CSS animations, outputs self-contained HTML.
- `sisters_market_report_build/render_10fps.py` — **USE THIS.** 10fps capture → 30fps output. Smoother than 5fps version.
- `sisters_market_report_build/render_animated.py` — 5fps capture → 30fps (proven working, but choppy)
- `sisters_market_report_build/photo_data_v3.json` — 10 base64-encoded Unsplash photos (4.2MB)
- `sisters_market_report_build/stacked_logo_b64.txt` — Base64 of white stacked logo (184KB)
- `sisters_market_report_build/stacked_logo_white_600.png` — White transparent logo PNG (600×393px)
- `sisters_market_report_build/render_scenes.py` — FAILED approach (static screenshots, kills animations)
- `sisters_market_report_build/render_smooth.py` — FAILED approach (30fps rAF, times out)
- `sisters_market_report_build/render_final.py` — FAILED approach (12fps, times out)

**Other content:**
- `sisters_market_report_prototype.html` through `_v6.html` — Earlier prototype versions
- `sisters_all_photos.html`, `sisters_photo_picks.html` — Photo galleries
- `56111_SchoolHouse_Pending_Reel.mp4` — Tumalo listing reel
- `Sunstone_Email_*.html` — Sunstone listing email templates
- `photo_review_gallery.html` — Photo review tool
- `white_logo_spec.md` — Logo spec for creating white version

### `<MOUNT>/SOCIAL MEDIA MANAGER/`

**Project instructions (read first):**
- `CLAUDE.md` — Social Media Manager operating manual

**21 custom skills (READ BEFORE MATCHING TASKS):**
All in `.claude/skills/ryan-realty/`:

| # | File | Purpose |
|---|------|---------|
| 1 | `creative-intelligence.md` | **CREATIVE BRAIN.** Visual design system, scroll-stop techniques. Read before ANY design decision. |
| 2 | `viral-video-quality-gate.md` | **HARD GATE.** 6-phase check for ALL AI video. Must clear before any generation API fires. |
| 3 | `automated-content-pipeline.md` | **MASTER PIPELINE.** End-to-end 6-stage content flow. Read FIRST for any content task. |
| 4 | `platform-publishing.md` | Per-platform publish runbook (IG/TikTok/FB/YT/LinkedIn/GBP) |
| 5 | `platform-algorithm-brief.md` | Algorithm signals ranked by weight per platform |
| 6 | `viral-hook-library.md` | 30 on-brand hooks + retention beat architecture |
| 7 | `trending-audio-research.md` | Weekly Monday audio scout workflow |
| 8 | `cross-platform-repurpose.md` | One source → 10+ platform variants |
| 9 | `content-calendar.md` | Monthly calendar generator |
| 10 | `analytics-feedback-loop.md` | Weekly/monthly performance review |
| 11 | `community-management.md` | DM + comment response playbook |
| 12 | `ai-video-production.md` | Replicate photo-to-video + text-to-video |
| 13 | `synthesia-avatar-workflow.md` | Avatar video (150+ stock avatars, UNBLOCKED) |
| 14 | `api-integration-wrappers.md` | API env var cheat sheet |
| 15 | `action-shot-animation-rules.md` | Photo-to-video animation rules |
| 16 | `interior-animation-rules.md` | Interior home tour animations |
| 17 | `media-asset-production.md` | Asset categorization |
| 18 | `social-channel-audit.md` | Channel audit framework |
| 19 | `social-channel-specs.md` | Platform dimensions/specs |
| 20 | `social-profile-optimization.md` | Profile optimization playbook |
| 21 | `social-channel-audit.md` | Channel audit framework |

Also in `references/` subfolder: supplemental reference data for some skills.

### `<MOUNT>/RyanRealty/`

**Project instructions (read first):**
- `CLAUDE.md` — Codebase rules (shadcn/ui is the ONLY styling authority)

**API keys:**
- `.env.local` — ALL API keys listed in the API Keys section below

**Key directories:**
- `app/` — Next.js App Router pages and API routes
- `components/ui/` — shadcn/ui components (ONLY styling authority)
- `lib/` — Utilities, Supabase client, etc.
- `public/` — Static assets

**Deployment:**
- Vercel (ryan-realty.com)
- AgentFire is legacy, will be retired. ALL work goes in this repo.
- Always push directly to main.

### `<MOUNT>/.auto-memory/`

Persistent memory system. Index at `MEMORY.md`. Key files:

**Feedback (Matt's directives — READ FIRST):**
- `feedback_never_ask_just_run.md` — Blanket authorization
- `feedback_keep_moving_no_pausing.md` — Don't pause between steps
- `feedback_zero_manual_tools.md` — No manual tools ever
- `feedback_copy_writing_rules.md` — No em dashes, no hyphens, no salesy language
- `feedback_no_ai_video_slop.md` — Never fire video gen from narrative prompts
- `feedback_no_canva_generation.md` — Canva MCP generation banned
- `feedback_no_branding_in_viral_video.md` — No logo/name/phone in video frame
- `feedback_no_real_estate_visuals.md` — No houses/keys/families in viral video
- `feedback_no_logo_animation.md` — Logo = simple fade-in only
- `feedback_sonnet_first_delegation.md` — Sonnet for bulk, Opus for judgment
- `feedback_social_humor_tone.md` — Social = funny, smart, self-deprecating
- `feedback_text_animation_quality.md` — Text needs dimension (shadows, glow, scale)
- `feedback_always_include_clips_in_preview.md` — No placeholder frames
- `feedback_brokerage_not_personal.md` — Brokerage voice, not personal
- `feedback_cinematic_ai_video_prompt_architecture.md` — Block-format prompts only
- `feedback_ai_photo_to_video_scale.md` — Pre-flight checklist for photo-to-video
- `feedback_bend_market_snapshot_scope.md` — SFR only (PropertyType='A')
- `feedback_build_dont_buy_connectors.md` — Build, don't buy SaaS
- `feedback_always_invoke_skills.md` — CLAUDE.md skill tables are directives
- `feedback_responsive_emails.md` — All emails mobile-first

**Reference (where things are):**
- `reference_api_keys_inventory.md` — Every env var in .env.local
- `reference_supabase_access.md` — DB project ref, tables, row counts
- `reference_listings_property_types.md` — PropertyType codes (A=SFR, B-H)
- `reference_closeprice_data_gap.md` — ClosePrice data availability
- `reference_brand_assets.md` — Drive folders, Canva, logos
- `reference_marketing_material_inventory.md` — Full asset inventory
- `reference_market_report_template.md` — **CRITICAL: Full blueprint for market report videos**
- `reference_codebase_infrastructure.md` — RyanRealty repo inventory
- `reference_ryan_realty_domain_hosting.md` — Vercel is future, AgentFire is legacy
- `reference_optimal_agent_mcp_wishlist.md` — Priority MCPs to install
- `reference_remotion.md` — Remotion setup, config, patterns
- `reference_ai_video_elite_creators.md` — Verified creator references
- `reference_viral_video_stats_verified.md` — Verified engagement stats
- `reference_ai_video_prompt_libraries.md` — Prompt source repos
- `reference_ai_virtual_tour_workflow.md` — Listing tour pipeline
- `reference_shutterstock_api.md` — Stock image API access
- `reference_creative_coding_ecosystem.md` — Creative coding repos/tools
- `reference_threejs_shader_patterns.md` — GLSL shader patterns
- `reference_social_media_audit_2026_04_15.md` — Audit snapshot

**Project (active work):**
- `project_brand_voice.md` — Brand voice characteristics
- `project_marketing_intelligence_system.md` — Knowledge base status
- `project_automated_content_pipeline.md` — Pipeline architecture
- `project_social_channel_consolidation.md` — Channel unification project

**User:**
- `user_matt_ryan_realty.md` — Who Matt is

---

## API Keys Available (all in `<MOUNT>/RyanRealty/.env.local`)

| Service | Status | Key Names |
|---------|--------|-----------|
| Meta (IG + FB) | Full Graph API | `META_APP_ID`, `META_APP_SECRET`, `META_FB_PAGE_ID`, `META_IG_BUSINESS_ACCOUNT_ID`, `META_PAGE_ACCESS_TOKEN` |
| Supabase | Full access via MCP | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Follow Up Boss | Active | `FOLLOWUPBOSS_API_KEY` |
| Synthesia | Active (stock avatars) | `SYNTHESIA_API_KEY` |
| Replicate | Active (Kling, Flux, etc.) | `REPLICATE_API_TOKEN` |
| OpenAI | Active | `OPENAI_API_KEY` |
| xAI / Grok | Active | `XAI_API_KEY` |
| Resend | Active | `RESEND_API_KEY` |
| Google (OAuth, SA, Maps, GA4) | Active | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_SERVICE_ACCOUNT_*`, `GOOGLE_GA4_PROPERTY_ID` (527333348) |
| TikTok | Draft/Sandbox | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |
| Spark MLS | Active | `SPARK_API_KEY` |
| SkySlope | Active | `SKYSLOPE_ACCESS_KEY` |
| Unsplash | Active | `UNSPLASH_ACCESS_KEY` |
| Shutterstock | Active (Free, 500/mo) | `SHUTTERSTOCK_API_KEY` |
| Upstash Redis | Active | `UPSTASH_REDIS_REST_URL` |
| Inngest | Active | `INNGEST_EVENT_KEY` |
| Sentry | Active | `SENTRY_DSN` |

**Gaps:** TikTok needs production review, GBP API allowlist pending (case 7-6192000040405), LinkedIn not keyed, Runway not keyed.

---

## Supabase Database

- **Project ref:** `dwvlophlbvvygjfxcrhm`
- **MCP tools:** `mcp__5adfee1a-82b2-4661-a931-e7bf6763a9c9__execute_sql` (and others)
- **Key table:** `listings` (587k rows) — Central Oregon MLS data
- **Always filter:** `"PropertyType" = 'A'` for SFR-only market snapshots
- **Case-sensitive columns (must double-quote):** `"StandardStatus"`, `"OnMarketDate"`, `"CloseDate"`, `"ClosePrice"`, `"OriginalListPrice"`, `"ListPrice"`, `"DaysOnMarket"`, `"PropertyType"`, `"City"`, `"ListingKey"`, `total_price_changes`, `buyer_financing`
- **buyer_financing:** Mixed formats — use `ILIKE '%Cash%'`
- **ClosePrice** exists back to 1997 in listings table
- **StandardStatus values:** `'Active'`, `'Pending'`, `'Closed'`
- **Active/Pending:** Don't filter by year. Only filter year for closed sales.

---

## IMMEDIATE TASK: Sisters Market Report Video

### Setup (new session needs this):
```bash
# 1. Install Playwright + Chromium (ARM64 auto-detected)
pip install playwright --break-system-packages
playwright install chromium

# 2. Copy build files to working directory
cp "<MOUNT>/BRAND MANAGER/sisters_market_report_build/build_v5.py" .
cp "<MOUNT>/BRAND MANAGER/sisters_market_report_build/render_10fps.py" .
cp "<MOUNT>/BRAND MANAGER/sisters_market_report_build/photo_data_v3.json" .
cp "<MOUNT>/BRAND MANAGER/sisters_market_report_build/stacked_logo_b64.txt" .

# 3. The build script expects these files in CWD:
#    - photo_data_v3.json
#    - stacked_logo_b64.txt
#    It outputs to: <MOUNT>/BRAND MANAGER/sisters_market_report_v7.html
```

### Build + Render:
```bash
# 4. Rebuild HTML (applies all design fixes)
python build_v5.py

# 5. Render video (10fps capture → 30fps output, ~8-10 min)
python render_10fps.py
# Output: <MOUNT>/BRAND MANAGER/Sisters_Market_Report_April_2026_v2.mp4

# 6. Verify specific frames
ffmpeg -ss 22 -i "<MOUNT>/BRAND MANAGER/Sisters_Market_Report_April_2026_v2.mp4" -frames:v 1 check_dom.png
ffmpeg -ss 72 -i "<MOUNT>/BRAND MANAGER/Sisters_Market_Report_April_2026_v2.mp4" -frames:v 1 check_cta.png
```

### What the render scripts need:
- Both `render_10fps.py` and `render_animated.py` have HARDCODED paths to the HTML and output MP4. **You must update these paths** to match your session's mount path. Search for `/sessions/magical-sweet-fermat/` and replace with your session path.
- The `build_v5.py` script also has a hardcoded output path. Same replacement needed.

### What to verify in the rendered frames:
- **Scene 4 (Days on Market, ~22s):** Should show hero "118" in red, below it "Average days to sell in 2026", then 3 stacked stat rows (2026: 118 days ▲18%, 2025: 112 days, 2024: 100 days). NOT the old "100 → 112 → 118" inline layout.
- **Scene 12 (CTA, ~72s):** Badge reads "CENTRAL OREGON MARKET INTELLIGENCE" in full (no truncation). Logo white matches text white. DM "Sisters" CTA visible.
- **All scenes:** Badge text fully visible (no "..."), safe zones respected, Ken Burns animations visible (slow zoom on photos).

### Design spec:
- 1080×1920 (9:16 portrait)
- Font: Inter (Google Fonts)
- Colors: gold=#c9a84c, green=#00d4aa, red=#ff6b6b, dim=rgba(255,255,255,0.35)
- No text-shadow (causes semi-transparent halos)
- Hero text: 78px max
- Safe zones: 10% sides (38px at 375px), 10% top (81px at 812px), 20% bottom (162px at 812px)
- Logo: stacked white transparent, 200px wide, opacity 0.92, simple fade-in ONLY (no shimmer/scale/glow)
- Audio: Matt adds Hank Williams Jr. "A Country Boy Can Survive" in the Instagram app himself

### Scene durations (ms):
```python
durs_ms = [5000, 7000, 7500, 7500, 7500, 6500, 6500, 7500, 7000, 6500, 7500, 6000]
# Total: ~82 seconds across 12 scenes
```

### Technical gotchas (DON'T REPEAT THESE):
- **ffmpeg minterpolate FAILS** in Cowork's environment (both mci and blend modes). Don't waste time.
- **Don't Read the HTML file** — it's 5.4MB of base64 data. Use build_v5.py to regenerate.
- **Always rebuild HTML THEN render.** Previous session rendered against stale HTML because it didn't rebuild first.
- **Playwright ARM64 Chromium** auto-installs correctly via `playwright install chromium`.
- **Screenshot math:** viewport 375×812 at device_scale_factor 1080/375 ≈ 2.88 = output 1080×2340, ffmpeg crops to 1080×1920.
- **Each screenshot takes ~0.3-0.5s real time.** At 10fps, ~820 frames ≈ 8-10 min total.
- **Pipe PNGs to ffmpeg stdin** — no disk frame storage needed.
- **Run renders with long timeout** or in background. They take 8-10 minutes.

---

## PENDING TASKS (in priority order)

1. **Re-render Sisters video** with all fixes + smoother framerate (10fps)
2. **Post to Facebook** via Meta Graph API (token may need OAuth refresh)
3. **Post to YouTube Shorts** via YouTube Data API (needs OAuth flow)
4. **Post to Google Business Profile** (API allowlist pending, quota currently 0)
5. **Template remaining 4 cities** (Redmond, La Pine, Sunriver, Prineville) — pull Supabase data, source photos, generate per-city HTML + video
6. **Wire IG/FB/TikTok publish APIs end-to-end** in the RyanRealty Next.js app
7. **Create Supabase `social_metrics_weekly` table** for analytics feedback loop
8. **Test Kling 3.0 photo-to-video** on a listing photo via Replicate

---

## Built-in Skills to Invoke (mandatory on matching tasks)

- `brand-voice:brand-voice-enforcement` — On EVERY email, post, ad, caption, or page draft
- `marketing:brand-review` — Before any content ships
- `engineering:code-review` — On every meaningful code change
- `engineering:deploy-checklist` — Before any production deploy

---

## Connected MCPs/Integrations

- Supabase (database, full access)
- Google Calendar
- Gmail
- Google Drive
- Canva (read-only, generation BANNED)
- Slack
- Vercel (deployment)
- Cloudflare (Workers, R2, KV, D1)
- Computer Use (desktop control)
- Chrome Extension (browser automation)
- Airtable (Nocodb)
- PDF Viewer
- Apollo (lead enrichment)

---

## Matt's Communication Style

- Direct, no-BS, fast-moving
- Gets frustrated when things stall or regress
- Wants to see finished output, not explanations of what you'll do
- "If it sounds like a cheesy real estate ad, it's wrong"
- "You would never, ever, ever, ever, ever create shit like that" (about AI slop)
- DM call-to-action on every social post (e.g., "DM me 'Sisters'")
- Biggest growth driver: DM shares (Instagram ranks DM shares as #1 engagement signal)

---

## What Went Wrong in the Previous Session (DON'T REPEAT)

1. **Context window exhaustion** — 5.4MB HTML + multiple render scripts + long ffmpeg output. Every compaction lost critical details.
2. **Rendering against stale HTML** — Rendered before rebuilding. Always run `python build_v5.py` FIRST.
3. **8+ render script attempts** — The working approach is frame-by-frame Playwright screenshots with real-time CSS animation. `render_10fps.py` is the latest improvement.
4. **minterpolate is dead** — Don't try ffmpeg motion interpolation. It crashes.
5. **Never load the HTML into context** — 5.4MB base64 blob. Regenerate from build script.
6. **Session temp files are ephemeral** — Build files are now saved to `<MOUNT>/BRAND MANAGER/sisters_market_report_build/` so they persist.

---

## The CLAUDE.md Files Are Your Operating Manual

Each workspace folder has a `CLAUDE.md` that auto-loads when mounted:
- `<MOUNT>/BRAND MANAGER/CLAUDE.md` — Brand Manager rules, skill routing, Opus policy
- `<MOUNT>/SOCIAL MEDIA MANAGER/CLAUDE.md` — Social Media Manager rules, 21 custom skills
- `<MOUNT>/RyanRealty/CLAUDE.md` — Codebase rules (shadcn/ui only), work standards

**Read all three before starting any work.**
