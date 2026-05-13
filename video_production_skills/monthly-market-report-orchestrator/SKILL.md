---
name: monthly-market-report-orchestrator
description: Orchestrates the full monthly Ryan Realty market-report content engine — pulls the data, produces 4 deliverables in parallel (short-form video for 8 platforms, YouTube long-form video, SEO blog post on AgentFire WordPress, Facebook lead-gen ad), shows Matt drafts for review, and publishes everything on his "go" sign-off. Use this skill whenever Matt says "create a market report", "run the monthly market report", "make me a market report for [city/neighborhood/region]", "do the May market report", or any other phrasing that requests a market-data deliverable. Use this skill BEFORE invoking market-data-video, blog-post, youtube-long-form-market-report, or facebook-lead-gen-ad directly — those are sub-skills the orchestrator routes to. The orchestrator is also the right entry point for "rerun the market report with corrected data" and "do the same report for a different city."
---

# Monthly Market Report Orchestrator — Ryan Realty

## Required references — load these BEFORE producing any content

Two canonical rule layers are non-negotiable inheritance for every Ryan Realty piece. CLAUDE.md "Skill self-binding (2026-05-13)" makes this mandatory.

1. **[`design_system/ryan-realty/SKILL.md`](../../design_system/ryan-realty/SKILL.md)** — visual brand spec. Colors (navy `#102742`, cream `#faf8f4`, sand `#e8e2d4`), three type families (Amboqia Boriango display, Geist sans body/UI, Azo Sans Medium accent), heritage + modern register, mascot Jax, voice rules, banned vocab, the asset cheat sheet, the broker headshots (transparent PNGs).

2. **[`social_media_skills/platform-best-practices/SKILL.md`](../../social_media_skills/platform-best-practices/SKILL.md)** — 2026 platform rule layer. The cross-platform decision matrix (logo when, agent face when, aspect, length, hook, captions, posting cadence) + the Ryan Realty application matrix (per-surface decisions). Synthesized from research on 30+ top real estate creators.

A piece of content that ships without consulting BOTH of these is non-compliant.

---

**Scope:** Single entry point for Ryan Realty's monthly market-report content engine. One trigger from Matt produces 4 deliverables, surfaces them for review, and publishes all of them on his "go" approval.

**Status:** Locked 2026-05-07. The 4-deliverable contract was set by Matt directly. This skill owns the routing; sub-skills own the production.

---

## 1. The trigger contract

Matt says one of: `"create a market report"`, `"run the monthly market report"`, `"make me a market report for X"`, `"do the May market report"`, `"market report for Bend"`, etc.

**Required clarification (always ask, never assume):**

> "Got it — what scope? (neighborhood / subdivision / city / multiple cities / region) + what time period? (default = previous full calendar month)"

Reasons we always prompt:
- Scope changes the data pull (neighborhood = `boundaries` + `neighborhood_subdivisions` lookup; city = `City` filter; region = Central Oregon multi-city; subdivision = `SubdivisionName`).
- Scope changes which sub-skills get the data (a neighborhood report routes to `neighborhood-overview` for the short-form, not `market-data-video`).
- Defaulting to "all six cities" produces 6 reports when Matt only wanted Bend — wasted compute, wasted ElevenLabs tokens, wasted Shutterstock licenses.

**Permitted scope values:**

| Scope | Geo type | Sub-skill route (short-form) |
|---|---|---|
| `neighborhood` | `boundaries.geo_type='neighborhood'` | `neighborhood-overview` |
| `subdivision` | `listings.SubdivisionName` | `neighborhood-overview` (subdivision mode) |
| `city` | `listings.City` | `market-data-video` |
| `multiple cities` | array of `City` values | `market-data-video` × N |
| `region` | `is_central_oregon_city()` predicate | `market-data-video` (regional variant) |

**Period defaults:**
- If unspecified → previous full calendar month (e.g. ask in May → April 1–30 window)
- Matt can say "April 2026", "last month", "Q1 2026", "YTD" — parse and confirm before pulling

**SFR-default rule (locked 2026-05-07):** every data pull filters `PropertyType = 'A'`. Do not blend property types in headline numbers. To override (rare), Matt must explicitly say "include condos" or "all property types." Canonical reference: `market-data-video/SKILL.md` §22.

---

## 2. The 4 deliverables

Each scoped market report produces these in parallel. The deliverables are independent — failure of one does not block the others — but all four must complete (or visibly fail) before review.

### Deliverable 1: Short-form video (8 platforms)

**Format:** 1080×1920 portrait, 30–60s, Remotion-rendered. Multi-color line chart for price beat, gauge for MoS, narrative-only VO with Victoria, locked caption sync, 9 beats including price-segment histogram and top-neighborhoods leaderboard. Photos pulled from asset library → Shutterstock → Unsplash priority.

**Sub-skill:** `video_production_skills/market-data-video/SKILL.md` for city/region scope. `video_production_skills/neighborhood-overview/SKILL.md` for neighborhood/subdivision scope.

**Platform fan-out** (via `video_production_skills/publisher/SKILL.md`):
- IG Reels
- TikTok
- Facebook Reels
- LinkedIn
- X (Twitter)
- Threads
- YouTube Shorts
- Google Business Profile

Each platform gets a tuned caption (different lengths, different hashtags, different CTAs) but the same MP4.

### Deliverable 2: YouTube long-form video

**Format:** 1920×1080 landscape, 8–12 minutes, deep narrative arc using all 40+ cache columns. Same data + same visuals expanded into chapters with timestamps, mid-roll FAQs, agent commentary. AI disclosure banner if any AI imagery is used.

**Sub-skill:** `video_production_skills/youtube-long-form-market-report/SKILL.md`.

### Deliverable 3: SEO-optimized blog post (AgentFire WordPress)

**Format:** 800–1,500 word long-form market analysis post on `ryan-realty.com` (AgentFire WordPress, NOT Vercel). Locked SEO spec: title tag <60 chars / meta description 150–160 chars / Open Graph / Article + Place + RealEstateAgent JSON-LD / VideoObject schema for the embedded YouTube long-form / canonical URL `/market-report/<city>/<YYYY-MM>` / internal links to neighborhood guides + previous month's report / external citations to Census/NAHB/ORMLS/Spark / image alt text on every chart screenshot / H1 = page title, H2 = each beat heading.

**Sub-skill:** `social_media_skills/blog-post/SKILL.md`.

**Publish destination:** AgentFire WordPress at `ryan-realty.com` via WP REST API. The Vercel app at `ryanrealty.vercel.app` is the dashboard, NOT the blog (this distinction is canonical per `AGENT_HANDOFF.md`).

### Deliverable 4: Facebook lead-gen ad

**Format:** Paid placement with FB native lead form. Different copy and audience targeting from the organic IG Reel. The market report itself is the lead magnet — "Get the full Bend market report including median price, neighborhood breakdown, and $/sqft trends." Form pre-fills with FB profile data (name/email/phone). Auto-routes to FUB (Follow-Up Boss) for nurture.

**Sub-skill:** `social_media_skills/facebook-lead-gen-ad/SKILL.md`.

**Why lead-gen, not boost:** the market report is top-of-funnel content. A Lead Generation ad converts the audience into FUB contacts at the moment of highest intent (they just watched a 30s market report, they're now thinking about Central Oregon real estate). Boosted posts grow reach but don't capture leads; pure traffic ads drive clicks but don't capture intent. Lead-gen is the right primitive for monthly reports — locked default.

---

## 3. Pipeline orchestration

```
TRIGGER ─────► CLARIFY SCOPE ─────► PULL DATA (cache-first, SFR=default)
                                            │
                                            ▼
                       ┌────────────────────┴──────────────────────┐
                       │ Generate 4 deliverables in parallel       │
                       │   1. short-form video (per platform)      │
                       │   2. YouTube long-form video               │
                       │   3. SEO blog post (WordPress draft)       │
                       │   4. Facebook lead-gen ad (draft)          │
                       └────────────────────┬──────────────────────┘
                                            ▼
                              ASSEMBLE REVIEW PACKAGE
                              (link to MP4s, blog draft URL, ad preview,
                               verification trace for every figure)
                                            │
                                            ▼
                                  PRESENT TO MATT
                                            │
                                            │  ◄── WAIT for "go" / "ship it" / "approved"
                                            ▼
                       ┌────────────────────┴──────────────────────┐
                       │ Publish in parallel                       │
                       │   1. short-form → 8 platforms via         │
                       │      publisher/SKILL.md                   │
                       │   2. YouTube long-form → YouTube API      │
                       │   3. blog draft → publish on WordPress    │
                       │   4. FB lead-gen ad → Meta Ads Manager    │
                       └────────────────────┬──────────────────────┘
                                            ▼
                                COMMIT MP4s + blog markdown
                                push to main, log in changelog
```

**Hard rule (Draft First per CLAUDE.md):** never publish, post, commit, or push until Matt has explicitly approved with "go", "ship it", "approved", "publish", "send", or equivalent affirmation. Silence is not approval. A successful render is not approval. Passing the verification trace is not approval.

---

## 4. Data pull — cache-first

The full data dictionary (every Supabase table the agent can read) lives in `market-data-video/SKILL.md` §22. **Always consult that section before designing the data pull** — there are 8 tables and ~220 columns total, and the right answer is usually already pre-computed in `market_stats_cache` or `market_pulse_live` rather than requiring a direct `listings` query.

For every figure that appears in any deliverable:

1. **Read `market_stats_cache`** for the geo × period × `period_type='monthly'`. The cache headline blends all property types — read `property_type_breakdown->>'A'` for SFR-only counts. For SFR-only median price, fall back to a direct `listings` query filtered by `PropertyType='A'` (the cache does not yet expose a per-property-type median column).

2. **Read `market_pulse_live`** for live inventory + absorption + listing-side stats (`active_count`, `pending_count`, `months_of_supply`, `pct_sold_over_asking`, etc.). This table is updated more frequently than the monthly cache.

3. **Direct query the `listings` table (~140 columns)** ONLY for stats the cache + pulse don't pre-compute:
   - Top neighborhoods leaderboard (no jsonb subdivision rollup)
   - Highest sale spotlight (need full row, not aggregate)
   - Multi-year history SFR-only medians (cache blends property types; use `pull-historical-windows.mjs`)
   - Per-listing details for spotlights (year_built, view_description, lot_size_acres, etc.)

4. **Read `listing_history`** for pre-2026 YoY comparisons, price-reduction frequency, status-change history.

5. **Read `boundaries` + `neighborhood_subdivisions`** for neighborhood scope resolution (which subdivisions belong to which neighborhood polygon).

6. **Read `app_config`** for runtime constants used in derived stats (mortgage rate, insurance rate, default tax rate — the cache uses these to compute `affordability_monthly_piti`).

7. **Verification trace** — every figure that appears on screen, on the blog, or in the ad must have a one-line trace entry: `"$699K median sale price — market_stats_cache row Bend monthly 2026-04-01, median_sale_price = 673860 (blended), property_type_breakdown.A = 192, SFR-filtered direct query median = 699000"`. No trace, no ship.

8. **Spark reconciliation** (per CLAUDE.md data-accuracy mandate) — when Spark and Supabase report different active inventory counts, surface the delta to Matt before render. Spark wins for active inventory + DOM; Supabase wins for closed sales once reconciled past the Spark cutover date.

---

## 5. Failure handling

| Failure | Action |
|---|---|
| Cache row missing for the geo × period | Trigger `compute_and_cache_period_stats()` to populate, retry |
| Direct query returns < 30 closed SFR sales | Halt; surface to Matt — sample is too thin to ship per `market-data-video/SKILL.md` §1 |
| ElevenLabs synth fails | Retry with exponential backoff; if still fails, halt and surface |
| One sub-deliverable fails (e.g. blog WP API errors) | Don't block the other 3; surface in review package as "FAILED — blog post: WP API 401, retry on go" |
| Spark/Supabase delta > 1% | Halt before render per CLAUDE.md hard pre-render gate |
| AI imagery used without disclosure | Block render per `ANTI_SLOP_MANIFESTO.md` |
| Banned word in caption / VO / blog / ad copy | Auto-replace from approved synonyms; if no synonym, halt |
| Photo repeats inside a render | Halt per `market-data-video/SKILL.md` §20 photo-diversity rule |

---

## 6. Review package format

When all 4 deliverables (or their visible failure markers) are ready, surface them to Matt in one message:

```
**Market report ready for review — {City} {Month} {Year}**

  📹 Short-form video
     Path: out/{slug}/render.mp4 ({size}, {duration}s, {beats} beats)
     Platform variants ready: IG Reels, TikTok, FB Reels, LinkedIn, X, Threads, YouTube Shorts, GBP

  🎥 YouTube long-form
     Path: out/{slug}/youtube-long.mp4 ({size}, {duration}min)

  📝 Blog post draft (AgentFire WordPress)
     Title: "{title}"
     Word count: {n}
     Preview URL: https://ryan-realty.com/?p={draft-id}&preview=true
     SEO score: {score}/100

  📢 Facebook lead-gen ad draft
     Headline: "{headline}"
     Audience: {targeting summary}
     Daily budget: ${amount}
     Form fields: name, email, phone

  📊 Verification trace: out/{slug}/citations.json ({n} figures traced)
  📈 Scorecard: out/{slug}/scorecard.json (viral score: {score}/100)

Reply "go" to publish all 4 deliverables in parallel.
```

Then stop. Do not commit. Do not publish. Wait for explicit approval.

---

## 7. Publish on "go"

When Matt says "go" / "ship it" / "approved" / "publish" / "send":

1. **Short-form video** → fan out to 8 platforms via `publisher/SKILL.md`. Each platform gets its tuned caption.
2. **YouTube long-form** → upload via YouTube Data API v3 with proper title/description/tags/timestamps. Set as Public on completion.
3. **Blog post** → publish the WP draft via the AgentFire WP REST API (toggle `status: 'draft'` → `'publish'`). Ping the sitemap.
4. **FB lead-gen ad** → create the campaign in Meta Ads Manager via Marketing API, attach the FB lead form, set the budget, launch.
5. **Commit** the rendered MP4s to `public/v5_library/`, the blog markdown to `content/blog/{slug}.md` (for archive), and push to `origin/main`.

If any step fails, complete the others and surface the failure with retry guidance (don't halt and roll everything back).

---

## 8. See also

- `video_production_skills/media-sourcing/SKILL.md` — **single decision skill for choosing image / video / audio sources** (asset library, Unsplash, Shutterstock, Pexels, Pixabay, Supabase listing photos, Vertex Imagen, Nano Banana, Grok Imagine, Replicate Kling/Veo/Hailuo/Seedance/Wan/Luma/LTX/Hunyuan, ElevenLabs SFX, Foley Control, depth_parallax, depthflow, earth_zoom, Google Photorealistic 3D Tiles). Cross-reference this for ANY media decision.
- `video_production_skills/market-data-video/SKILL.md` — short-form video sub-skill + canonical data dictionary in §22 (`market_stats_cache` 40 cols, `market_pulse_live` 29 cols, `listings` ~140 cols, `listing_history`, `boundaries`, `neighborhood_subdivisions`, `app_config`)
- `video_production_skills/neighborhood-overview/SKILL.md` — short-form video sub-skill (neighborhood + subdivision scope)
- `video_production_skills/youtube-long-form-market-report/SKILL.md` — long-form video sub-skill
- `social_media_skills/blog-post/SKILL.md` — SEO blog post sub-skill (AgentFire WordPress)
- `social_media_skills/facebook-lead-gen-ad/SKILL.md` — FB lead-gen ad sub-skill
- `video_production_skills/publisher/SKILL.md` — multi-platform video publishing
- `video_production_skills/elevenlabs_voice/SKILL.md` — canonical Victoria voice settings
- `video_production_skills/quality_gate/SKILL.md` — pre-publish QA
- `video_production_skills/ANTI_SLOP_MANIFESTO.md` — banned content rules (canonical)
- `video_production_skills/VIRAL_GUARDRAILS.md` — pre-publish virality scorecard
- `CLAUDE.md` — data accuracy mandate, draft-first rule, video build hard rules
