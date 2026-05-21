# Master Channel Integration Plan — Ryan Realty 2026-05-21

**Status:** Research dossier. No execution authority. Matt approves before any code change, OAuth flow, or admin mutation.

**Author:** Marketing-brain research subagent.
**Date pulled:** 2026-05-21.
**Sources consulted:** 22 (15 internal, 7 external). See "Source ledger" at the bottom.

---

## Executive summary

Ryan Realty has the **infrastructure** of a unified marketing analytics fabric but is operating it as **nine disconnected pipes**. GA4 sees the site. Meta Graph sees the page and the IG account. Six other channels write to one Supabase table. Nobody has tied them together at the **attribution layer**, which is where the money question lives: did the click on the Facebook ad become the lead in Follow Up Boss, and what did that lead pay (source: `docs/MARKETING_LEAD_FLOW.md` §11).

Live audit surfaced four facts Matt has not been told. (1) A **second, dormant Meta ad account** named "Ryan Realty LLC" (`act_599206346213887`) with **$45,863 historical spend** is still attached to the business — current account `act_1178780510184911` has only spent $4,710 over 354 days. (2) **Two "Dead Pixel" pixels** are still firing on the business — one as recently as 2026-05-20 (source: live Meta Graph API). (3) **GBP and TikTok crons stopped writing data on 2026-05-12 and 2026-05-13** (source: live Supabase). (4) A **second abandoned Facebook Page** (`112687715079745`) with 4 followers is published in parallel to the active `RyanRealtyBend` page (99 followers). All four are fixable in under a day and unblock real attribution work.

The right sequence is: clean up the orphaned Meta assets first (one hour, zero risk), then finish the in-flight GA4 admin configuration (Key events, custom dimensions, audiences — already in progress per task #16), then layer cross-domain measurement onto the WordPress + Vercel split (because both sites already fire into the same `G-ST40W4WM6T`), then wire the remaining OAuth-empty platforms (TikTok, Pinterest, Threads, Nextdoor) so the brain has a complete cross-channel surface. The dashboard layer follows once data is flowing, not before.

---

## Section 1 — Channel inventory (live state, verified 2026-05-21)

This table is the ground truth, pulled fresh from the Meta Graph API and Supabase this session. Status flags reflect actual API responses, not docs.

| Channel | Connected? | Auth state | Brain data freshness | Notes |
|---|---|---|---|---|
| **Meta Facebook Page** (`RyanRealtyBend`, ID `138563319329985`, 99 followers) | Yes — primary | Long-lived Page token, full publishing scopes (source: live Graph API) | `meta_page` channel, 96 days, last write `2026-05-19` | Working. (source: live Supabase `marketing_channel_daily`) |
| **Meta Facebook Page** (`Ryan Realty`, ID `112687715079745`, 4 followers, no username) | Yes — orphaned | Same token covers both pages (business-owned) | Not ingested | **Decision needed.** Likely delete or merge into primary. (source: live Graph API `/me/owned_pages`) |
| **Meta Instagram Business** (`@ryanrealtybend`, 1,231 followers, 605 posts) | Yes | Same Page token | `instagram` channel, 96 days, last write `2026-05-19` | Working. Bio website pointing at `ryan-realty.com`. (source: live Graph API `/{ig_id}`) |
| **Meta Ad Account A** (`act_1178780510184911`, active, USD, $4,710 lifetime, 354 days old) | Yes — currently used | Token has `ads_read` | `meta_ads` channel, 1 day, last write `2026-05-19` (cron only recently turned on) | Active. 3 campaigns all `PAUSED` at campaign level, but the **seller adset is `status:ACTIVE`** under a paused parent — that's why it accrued $47 over the last 7 days (source: live Graph API `/insights`, `/adsets`). |
| **Meta Ad Account B** (`act_599206346213887`, status 101 = closed/disabled, USD, $45,863 historical spend) | Yes — dormant | Same token | Not ingested | **Surprise.** This is the older account Matt apparently ran most of his spend through. Status 101 = closed. The brain has never seen this data. (source: live Graph API `/me/owned_ad_accounts`) |
| **Meta Pixel** (`1546878946032105`, name "ryan-realty.com") | Yes — primary | Pixel + CAPI both live | n/a (pixel data flows to Meta Ads Manager, not to brain) | Working. Last fired `2026-05-20T16:01:30-0700`. (source: live Graph API `/{pixel_id}`) |
| **Meta Pixel** (`1234764517869771`, "Dead Pixel") | Yes — abandoned | n/a | n/a | Last fired `2025-09-04`. Should be archived. |
| **Meta Pixel** (`590593947302147`, "Dead Pixel") | Yes — abandoned | n/a | n/a | **Still fired `2026-05-20T13:28:16-0700`.** Means a page somewhere is double-tracking. Find and remove. (source: live Graph API `/{business}/owned_pixels`) |
| **Google Analytics 4** (property `527333348`, measurement ID `G-ST40W4WM6T`) | Yes | Service account `viewer@ryanrealty.iam.gserviceaccount.com` (Viewer scope) | `ga4` channel, 96 days, 7 scopes, last write `2026-05-19` | Working. (source: `marketing_brain_skills/tools_registry/ga4/SKILL.md`) |
| **Google Search Console** (URL-prefix property `https://ryan-realty.com/`) | Yes | Same service account | `gsc` channel, 96 days, 3 scopes, **17,960 rows** | Working — the biggest, freshest channel. (source: live Supabase) |
| **Google Business Profile** (location ID stored in `GOOGLE_BUSINESS_PROFILE_LOCATION_ID`) | Yes | OAuth refresh-token in `public.google_business_profile_auth`, last updated `2026-05-20 20:59 UTC` | `gbp` channel, **stale — last write `2026-05-13`** | **Broken.** Token refreshes succeeded yesterday but the daily cron stopped writing 8 days ago. (source: live Supabase) |
| **Google Ads** | **Not connected** | n/a | n/a | The strategic gap. Linking GA4 to Google Ads is the single highest-leverage move for cross-channel reporting. (source: `support.google.com/google-ads/answer/2375435`, fetched 2026-05-21) |
| **YouTube Data + Analytics** (channel via `youtube_auth`) | Yes | OAuth refresh-token, last update `2026-05-20 06:30 UTC` | `youtube` channel, 96 days, 2 scopes | Working. Per the registry, Data API v3 + Analytics API v2 both wired. (source: `marketing_brain_skills/tools_registry/youtube-data/SKILL.md`) |
| **LinkedIn** (`linkedin_auth`) | Yes | OAuth, last update `2026-05-10 02:26 UTC` | Empty in `marketing_channel_daily` per pre-2026-05-13 audit — but the auth row is recent | Publishing works today; **org-analytics scope blocked** by Share-on-LinkedIn vs Community-Management mutual exclusion. (source: `marketing_brain_skills/tools_registry/linkedin-api/SKILL.md`) |
| **TikTok** (`tiktok_auth`) | **Empty (0 rows)** | OAuth never completed for production. Sandbox token in env file. | `tiktok` channel, 89 days of data, **last write `2026-05-12` — stale 9 days** | Cron writes data without the auth row? Means it was using an env-var token that has now expired. (source: live Supabase + `app/api/cron/marketing-snapshot-tiktok/route.ts` comment block) |
| **X (Twitter)** (`x_auth`) | Yes | OAuth, last update `2026-05-20 06:30 UTC` | `x` channel, 4,272 rows, last `2026-05-19` | Working. (source: live Supabase) |
| **Pinterest** (`pinterest_auth`) | **Empty (0 rows)** | Never OAuthed | Not ingested | Greenfield. (source: live Supabase) |
| **Threads** (`threads_auth`) | **Empty (0 rows)** | Never OAuthed | Not ingested | Greenfield. (source: live Supabase) |
| **Nextdoor** (`nextdoor_auth`) | **Empty (0 rows)** | Never OAuthed | Not ingested | Greenfield. (source: live Supabase) |
| **Follow Up Boss CRM** | Yes | Basic-auth API key in env | `fub` channel, 95 days, 3 scopes | Working. (source: `marketing_brain_skills/tools_registry/follow-up-boss/SKILL.md`) |

---

## Section 2 — Which Meta business + ad account Matt should standardize on

Live audit established the facts. The decision-question is now narrow.

**Business:** `733664948512665` — "Ryan Realty LLC". Verified not_verified, created `2023-06-02`. This is the only Business Manager (BM) account. There is no second BM to migrate to. (source: live Graph API `/me/businesses`-equivalent via owned_pages)

**Ad accounts:** Two are attached to this BM.

- **`act_1178780510184911`** — `account_status: 1` (active). 354 days old. $4,710 lifetime spend. Current target of the brain's `marketing-snapshot-meta-ads` cron. Three campaigns exist, all paused at the campaign level. One adset (`120242751742750698`, "Seller Ad Set — Bend 25mi — Lead Form (existing creative)") is `status:ACTIVE` under its paused parent and that's what spent $47 in the last 7 days, generating 55 link clicks and 1 messaging conversation. (source: live Graph API `/insights` and `/adsets`)
- **`act_599206346213887`** — `account_status: 101` (closed/disabled). Lifetime spend `$45,863`. Named "Ryan Realty LLC". This is presumably an older operating account that was wound down. No way to reactivate without contacting Meta Business support. (source: live Graph API `/owned_ad_accounts`)

**Pages:** Two owned pages.

- **`138563319329985`** — "Ryan Realty Bend", username `RyanRealtyBend`, 99 followers, `is_published: true`. Primary.
- **`112687715079745`** — "Ryan Realty", no username, 4 followers, `is_published: true`. Orphaned. (source: live Graph API)

**Pixels:** Three owned.

- **`1546878946032105`** — "ryan-realty.com". Primary. Last fired `2026-05-20T16:01:30-0700`.
- **`590593947302147`** — "Dead Pixel". **Still actively firing** — last fire `2026-05-20T13:28:16-0700`. This is the surprise. A page on either WordPress or Vercel is still loading this pixel ID. The CAPI events that fire to it dilute attribution.
- **`1234764517869771`** — "Dead Pixel". Quiet since `2025-09-04`. Safe to remove. (source: live Graph API `/owned_pixels`)

**Recommendation (no execution this turn):**

1. Keep `act_1178780510184911` as the canonical ad account. Spend the next budget cycle there, not the dormant one.
2. Archive `act_599206346213887` cleanly in Business Manager (Meta retains historical spend in reports either way).
3. Unpublish or delete the orphaned `Ryan Realty` page `112687715079745` after confirming no listings or content live there.
4. **Find what's still firing the `590593947302147` "Dead Pixel"** and remove it. Grep both the Vercel codebase and the AgentFire WordPress theme for that ID before unpinning anything in Meta.
5. Archive the third pixel `1234764517869771` — last fire 8+ months ago.

---

## Section 3 — Integration matrix (channel → where data goes → why)

Every row reflects either current code or recommended state. Status column flags which.

| Channel | Pixel/SDK fires to | Cron writes to | GA4 sees it? | Status |
|---|---|---|---|---|
| FB Page organic | Meta Graph (read) | `marketing_channel_daily.channel='meta_page'` | Indirectly — referral traffic from `facebook.com` lands as `sessionSource='facebook'` (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md`) | Live |
| IG Business organic | Meta Graph (read) | `marketing_channel_daily.channel='instagram'` | Same — `sessionSource='instagram.com'` | Live |
| Meta Ads (paid) | Meta Ads Insights API | `marketing_channel_daily.channel='meta_ads'` | Yes — every paid click must carry UTM (`utm_source=facebook&utm_medium=paid_social&utm_campaign=<campaign-id>`) per the LP convention (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Standard URL convention") | Cron just turned on; only 1 day of data |
| Meta Pixel (browser) + CAPI (server) | Meta Ads Manager (write) | n/a — pixel data does not flow to Supabase, it flows to Meta for ad optimization | n/a | Live. Dedup via `event_id` matched across pixel + CAPI (source: `docs/MARKETING_LEAD_FLOW.md` §10) |
| Meta Lead Ads (native form) | Webhook → `app/api/meta/lead-webhook/route.ts` → FUB People + Note | n/a | Indirectly via FUB events | Live (source: `docs/MARKETING_LEAD_FLOW.md` §3) |
| GA4 site analytics | `window.gtag` + `lib/tracking.ts` | `marketing_channel_daily.channel='ga4'` (7 scopes) | n/a — this IS GA4 | Live |
| GSC organic search | Service-account read | `marketing_channel_daily.channel='gsc'` | GA4 → GSC link in Admin (verify in `Admin → Product links → Search Console`) makes search-impression data visible inside GA4 reports (source: developers.google.com/analytics, fetched 2026-05-21) | Live |
| GBP location | Business Profile Performance API v1 | `marketing_channel_daily.channel='gbp'` | Indirectly — `call_clicks`, `website_clicks` land as direct/referral in GA4 | **Stale — last write 2026-05-13** |
| Google Ads (paid SERP) | gclid auto-tagging | **Not ingested today** | Yes if (a) Google Ads → GA4 link in `Admin → Product links → Google Ads` and (b) auto-tagging on at the Google Ads account (source: support.google.com/google-ads/answer/2375435, fetched 2026-05-21) | **Greenfield — not connected** |
| YouTube channel | YouTube Data + Analytics APIs | `marketing_channel_daily.channel='youtube'` (2 scopes) | YouTube traffic to site appears as `sessionSource='youtube.com'` | Live |
| LinkedIn organic | LinkedIn Marketing API (publishing live, analytics blocked) | Empty — auth row exists but ingestor doesn't write | LinkedIn referral as `sessionSource='linkedin.com'` | Auth live, analytics blocked (source: `marketing_brain_skills/tools_registry/linkedin-api/SKILL.md`) |
| TikTok organic | TikTok Open Platform v2 | `marketing_channel_daily.channel='tiktok'` (2 scopes) | TikTok referral as `sessionSource='tiktok.com'` | **Stale — last write 2026-05-12** |
| X (Twitter) organic | X v2 API | `marketing_channel_daily.channel='x'` (2 scopes, 4,272 rows) | Indirectly | Live |
| Pinterest | n/a | n/a | n/a | **Greenfield — not connected** |
| Threads | Meta Graph (Threads endpoint, scope still pending) | n/a | n/a | **Greenfield — not connected** |
| Nextdoor Business | Nextdoor Business Share API | n/a | n/a | **Greenfield — not connected** |
| Follow Up Boss CRM | FUB v1 API (server-side) | `marketing_channel_daily.channel='fub'` (3 scopes) | Per-conversion event fired to GA4 via `trackEvent('generate_lead', ...)` (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §Layer 1) | Live |

---

## Section 4 — Conversion attribution stitching plan

This is the question Matt actually cares about: **a Facebook ad click → land on `ryanrealty.vercel.app` → submit a Seller LP form → become a FUB person.** Does that journey stitch end to end in reporting today? Answer: partially. The gaps:

### Gap 1 — `gclid` from Google Ads is not captured anywhere

Google Ads is not linked. Until it is, organic-search and paid-search both appear in GA4 as `sessionSource='google'` with `sessionMedium='organic'` vs `'cpc'`. The cpc rows currently come from nowhere because nothing is running, but the second Matt launches a Google Search Ads campaign, the architecture must already have auto-tagging on (source: `support.google.com/google-ads/answer/2375435`, fetched 2026-05-21).

### Gap 2 — The WordPress + Vercel cross-domain hop drops session continuity unless configured

Both sites already fire to the same GA4 property (`G-ST40W4WM6T`). Confirmed by the 2026-05-21 query showing page paths like `/about-us/`, `/free-home-valuation/`, `/cost-of-living-bend-oregon/` (AgentFire WordPress) sitting next to `/pulse`, `/lp/seller-home-value`, `/admin/social` (Vercel Next.js) in the same `ga4.page` scope. **But** without cross-domain measurement configured in GA4 Admin → Data streams → Configure tag settings → Configure your domains, a user who clicks a Vercel CTA that bounces them to the WordPress homepage starts a **second session** with `sessionSource='ryanrealty.vercel.app'` referrer. That breaks attribution silently (source: `support.google.com/analytics/answer/10071811`, fetched 2026-05-21: "the cookies retain the same IDs as they are passed from one domain to another via a URL parameter `_gl`"). Both domains must list each other; both must use the same `G-` ID (they do).

### Gap 3 — Meta CAPI runs for `/contact` and `/home-valuation` but not for LP forms

Per `docs/MARKETING_LEAD_FLOW.md` §7 (lead landing pages) and §8 (page CTAs), the seller-LP form and other landing forms call `sendEvent` to FUB but **do not** fire `/api/meta-capi`. The pixel fires browser-side, but CAPI server-side fallback is missing, meaning leads from iOS / cookie-blocked users have no server-side attribution back to Meta. The pixel-only signal has been ~50% weaker than CAPI-paired since iOS 14.5 (source: Meta Conversions API docs, paraphrased from `docs/research/meta-graph.md` `developers.facebook.com/docs/marketing-api/conversions-api`).

### Gap 4 — UTM convention is documented but unenforced

The convention is locked: `utm_source=facebook&utm_medium=paid_social&utm_campaign=<kebab-slug-matching-marketing_brain_actions.id-substring>` (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Standard URL convention"). The seller-LP campaign that's actively running right now in `act_1178780510184911` — does it use this format? We don't know without checking the ad URL in Meta Business Manager. If not, the `seller-lead-attribution` cron (per `app/api/cron/seller-lead-attribution/route.ts` referenced in the ga4-instrumentation skill) cannot pair the FUB person back to a `marketing_brain_actions` row. That severs the loop between ad spend and lead value.

### Gap 5 — There is no Meta-Ads-spend → GA4 cost-data import

GA4 does not natively pull Meta Ads spend. Google Ads links into GA4 because both are Google; Meta does not. To see Meta spend alongside Meta-attributed sessions inside GA4, you either (a) UTM-tag religiously and let `sessionCampaignName` carry the spend joinkey, then join in the brain layer (current approach — works), or (b) use a third-party connector like Supermetrics, Funnel.io, or a custom GA4 Data Import (source: official Meta integration docs — Meta has no direct GA4 link, confirmed via search). The cheapest path for Ryan Realty is (a) plus expose cost in the brain dashboard.

### The recommended stitch (one diagram)

```
Meta Ad (act_1178780510184911)
  ?utm_source=facebook&utm_medium=paid_social&utm_campaign=seller-funnel-may-2026&utm_content=<adset-id>
   │
   ▼
ryanrealty.vercel.app/lp/seller-home-value?utm_source=facebook&...
   │ <LandingPageTracker lpVariant="seller-home-value"> writes utm_*
   │   into sessionStorage; fires view_landing_page event in GA4
   │
   ▼
User submits form → submitSellerLPForm() action
   │ fires:
   │   a) FUB sendEvent('Seller Inquiry') — writes person + utm_campaign as custom field
   │   b) POST /api/meta-capi with event_id=<uuid>, value=500
   │   c) fbq('track','Lead',{eventID:<uuid>}) browser-side
   │   d) trackEvent('generate_lead',{lp_variant,source,utm_campaign,...}) → GA4
   │
   ▼
FUB person tagged with utm_campaign='seller-funnel-may-2026'
   │ seller-lead-attribution cron reads utm_campaign, joins to
   │ marketing_brain_actions WHERE id ILIKE '%seller-funnel-may-2026%'
   │ writes back to person.attributedAction = <action-row-id>
   │
   ▼
Brain dashboard: cost (from meta_ads scope) ÷ attributed_leads (from fub scope)
   = real CPL per campaign
```

Today, steps (a), (c), (d) work. Step (b) and the cron-side join in step "FUB person tagged" do not — those are this plan's deliverables (sources: `docs/MARKETING_LEAD_FLOW.md` §§7, 11; `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Landing-page tracking convention").

---

## Section 5 — Recommended dashboard layout

When data is flowing cleanly, here is what Matt opens.

### Daily (5 minutes, every morning)

- `/admin/marketing-dashboard` (already exists per task #10): one screen showing yesterday vs prior-week-same-day for sessions, leads, FB ad spend, FB CPL. The brain's `marketing-daily-digest` cron at 14:00 UTC produces the email version (source: live Vercel cron list).

### Weekly (15 minutes, every Monday after 06:30 UTC ingest)

- The brain auto-generates a `marketing-optimization-report` action row (source: live cron schedule). Matt reads:
  - The 3-5 ranked recommendations (today's example, from `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`: "no active Meta campaign" was the top-ranked recommendation at score 65/100)
  - Which audience definitions to promote based on engagement
  - Which underperforming creative to retire
- The same data view inside GA4: **Funnel Exploration "Seller Funnel — LP visit → form → lead"** with breakdown dimension `lp_variant` (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Funnel Explorations"). Click each row → drill into source.

### Monthly (30 minutes, first Monday)

- YoY comparison: this-quarter vs same-quarter-last-year sessions, leads, listings closed.
- LinkedIn + YouTube + TikTok organic growth deltas (followers + best-performing post).
- Channel mix attribution: % of leads from Meta paid vs Meta organic vs Google organic vs Google paid (once Ads is linked) vs direct vs referral.

### Quarterly (1 hour, mid-quarter)

- Custom dimensions audit: are `lp_variant`, `source_detail`, `listing_key`, `broker_slug` populated > 80% on Key events? (Source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Custom dimensions" — a stale dimension that's `(not set)` on most rows is a bug, not data).
- Audience growth: are the three remarketing audiences (`Engaged sellers (no convert 30d)`, `Active buyers (3+ listings)`, `CMA downloaders`) growing? If yes, increase the remarketing budget allocation. If no, the on-site conversion paths need work.

---

## Section 6 — Execution order (highest leverage first)

Each row is sized as approximate effort, with the dependency that must be true before it can start.

| # | Action | Effort | Depends on | Source justification |
|---|---|---|---|---|
| 1 | Audit + clean Meta business assets: archive `act_599206346213887`, unpublish orphaned page `112687715079745`, archive dead pixels `1234764517869771` + `590593947302147` (after grep for the latter) | 30 min | Matt approval. Reversible. | Live Meta Graph audit this session |
| 2 | Finish the in-flight GA4 admin config (task #16): mark all 10 Key events, register 9 custom dimensions, define 3 audiences | 1 hour in `Admin → Events / Custom definitions / Audiences` | None | `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §Layer 2 |
| 3 | Configure GA4 cross-domain measurement to list `ryan-realty.com` AND `ryanrealty.vercel.app` AND any subdomains under one stream | 15 min in `Admin → Data streams → Configure tag settings → Configure your domains` | #2 (so the stream config is sane) | `support.google.com/analytics/answer/10071811`, fetched 2026-05-21 |
| 4 | Diagnose + restart the GBP and TikTok ingest crons (both stopped writing 2026-05-12/13) | 1-2 hours | None | Live Supabase audit + cron code review this session |
| 5 | Link Google Ads to GA4 in `Admin → Product links → Google Ads` AND enable auto-tagging in Google Ads (so `gclid` lands) — even before any Google Ads campaign runs, the link is free and seeds remarketing audience export | 20 min | Matt has Google Ads account access | `support.google.com/google-ads/answer/2375435`, fetched 2026-05-21 |
| 6 | Add Meta CAPI server-side firing to the seller-LP submit action AND the buyer-LP submit action AND the page-CTA action — currently only `/contact` and `/home-valuation` fire CAPI (Path B + C only) | 2-3 hours code + verify in Events Manager Test Events | None | `docs/MARKETING_LEAD_FLOW.md` §§7, 8, 12 |
| 7 | Extend the GA4 brain ingestor to pull `lp` scope, `event` scope, `page_event` composite, `audience` scope — these are documented as gaps | 3 hours | #2 (dimensions registered first) | `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` §"Scopes the brain SHOULD also ingest (gap)" |
| 8 | Wire LinkedIn analytics scope: decide Community Management vs Share-on-LinkedIn (current dev app supports only one) | 1 day (OAuth re-app possible) | Matt decision | `marketing_brain_skills/tools_registry/linkedin-api/SKILL.md` |
| 9 | TikTok OAuth: complete production OAuth so `tiktok_auth` row exists; cron auth becomes durable | 30 min in TikTok developer portal | None | Live Supabase + `app/api/cron/marketing-snapshot-tiktok/route.ts` |
| 10 | Pinterest + Threads + Nextdoor OAuth: stand up if and only if the channel is worth posting to (decision after Matt evaluates audience fit) | 1-2 hours per channel after Matt decision | Matt decision per channel | Live Supabase: all three auth tables are empty |

Priority bands (after Matt approval of the order):

- **Today (1-2 hours):** #1, #2, #3.
- **This week (4-6 hours):** #4, #5, #6.
- **Next week (1 day):** #7, #8.
- **Backlog (when relevant):** #9, #10.

---

## Section 7 — Risks, costs, what could go wrong

### Privacy / consent

- **Google Signals is currently off** by default per task #16 ("conversions + dimensions + Google Signals" still in progress). Enabling Google Signals turns on cross-device measurement and demographic reporting BUT requires a cookie-consent banner that explicitly opts the user in for advertising cookies (source: `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` mentions the `ryan_realty_cookie_consent` cookie gate). Ryan Realty already has the cookie banner. **Recommendation: Matt explicitly decides on Google Signals on/off — do not enable silently.** It has implications for both EU compliance (effectively none — Bend market is US) and Apple Intelligent Tracking Prevention behavior. The brain's audit-website skill currently does not require it.
- **Meta CAPI sends hashed PII (email, phone) to Meta servers.** This is allowed by Meta and standard for real estate (source: `marketing_brain_skills/tools_registry/meta-graph/SKILL.md` describes the `/api/meta-capi` route hashing PII). No additional disclosure beyond the existing privacy policy is required, but the privacy policy should mention CAPI by name (source: `docs/MARKETING_LEAD_FLOW.md` §10).

### Data sampling

- GA4 applies sampling to queries that touch more than 10M events in a window. Ryan Realty is nowhere near this threshold today (source: `marketing_brain_skills/tools_registry/ga4/SKILL.md` §"Cost model"). Future-state risk only.
- GSC has a 10,000 row-per-query limit on the Search Analytics API — already handled by the existing GSC ingestor (source: `marketing_brain_skills/tools_registry/REGISTRY.md` Section B `gsc` row).

### Meta CAPI vs Pixel attribution divergence

- Pixel sees ~50% of conversions in the iOS 14.5+ era. CAPI fills the gap. When both fire with matched `event_id`, Meta dedupes (source: `docs/MARKETING_LEAD_FLOW.md` §10). When only Pixel fires (today's LP form path) and Meta attributes from limited data, the **reported CPL inside Meta Ads Manager will look 1.5-2x higher than reality** — a real conversion attributed to "Direct" instead of the Meta campaign that drove it. Wiring CAPI to all lead paths (item #6 above) fixes this.

### Cron failures going unnoticed

- The GBP cron has been writing nothing since 2026-05-13. The TikTok cron since 2026-05-12. No alert fired. **The brain has a `token-heartbeat` cron at 12:00 UTC daily** (source: live `vercel.json` cron list) but it's not clear whether it pings on stale ingest rows. Recommendation: extend the heartbeat to assert "every channel had a row in the last 48 hours" and surface a `comms:alert` action row when not.

### Single point of failure on the Page token

- The long-lived Meta Page access token covers FB Page reads/writes, IG reads/writes, AND Ads reads. If it ever expires (which long-lived Page tokens do not unless password rotates), four channels go dark simultaneously (source: `marketing_brain_skills/tools_registry/meta-graph/SKILL.md` §Authentication).

### The "second Facebook page" risk

- The orphaned page `112687715079745` has 4 followers and "Ryan Realty" as the unverified name. If a lead Googles "Ryan Realty Facebook" and lands there, they see a dead page. This is a brand-trust gap, not just an attribution gap. Prioritize cleanup.

---

## Section 8 — Skill, cron, file deliverables when this is built

The brain architecture (per `CLAUDE.md` §"Marketing Brain Architecture") expects every change to land as a skill update + an action row + a code change. Below is what gets added or modified.

### New skill files

- None. Every existing skill already documents the contract — what's missing is execution. (source: `marketing_brain_skills/tools_registry/REGISTRY.md` — 16 of 33 authored, the relevant ones for this plan all done.)

### Modified skill files

- `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md` — flip the §"Migration checklist" boxes from `[ ]` to `[x]` for each of: Key events marked, custom dimensions registered, audiences defined, brain ingestor scopes extended, cross-domain stream configured.
- `marketing_brain_skills/tools_registry/meta-graph/SKILL.md` — add §"Asset cleanup runbook" capturing the dormant ad account + dead pixels archive + orphaned page unpublish, so the next session inherits the cleaned-up state.
- `marketing_brain_skills/tools_registry/gbp/SKILL.md` — update §"Failure modes" with the 2026-05-13 cron-stall pattern once root cause is known.
- `marketing_brain_skills/tools_registry/tiktok-api/SKILL.md` — same for the 2026-05-12 stall.

### New code

- Production OAuth callback for TikTok if/when the choice is made to use the production app (currently sandbox only) — `app/api/tiktok/authorize` route already exists per the env-file comment.
- LinkedIn dev-app re-architecture if Matt chooses Community Management scope over Share-on-LinkedIn (mutually exclusive — `marketing_brain_skills/tools_registry/linkedin-api/SKILL.md`).
- Meta CAPI fire in `app/actions/lead-landing.ts` (Path E) and `app/actions/lead-capture.ts` (Path D + F) — referenced in `docs/MARKETING_LEAD_FLOW.md` §§6-8 as missing.

### New crons

- `cross-channel-alert` (proposed): daily check that every channel in `marketing_channel_daily` had a row in the last 48h, fires `comms:alert` action row when not. Lightweight extension to `token-heartbeat`.

### New Supabase migrations

- None required. Schema is already in place.

### Action rows the brain auto-creates

Each item in §"Execution order" becomes one `marketing_brain_actions` row when this plan is approved. Format: `action_type='site:analytics_config'` for the GA4 admin changes, `action_type='ops:meta_cleanup'` for the asset archive, `action_type='site:code_change'` for the CAPI extensions.

---

## What Matt needs to decide

Before any of this can execute, Matt picks an answer on these. Five total.

1. **Archive the dormant ad account `act_599206346213887` ($45,863 lifetime, status 101 closed)?** Yes / No / Wait. (Live Meta Graph confirmed it exists. Doing nothing also fine — it's already disabled and no spend is attributable to it.)
2. **Find + remove the still-firing "Dead Pixel" `590593947302147`?** Yes / No. (Strongly recommended yes — every fire is splitting attribution from the real pixel.)
3. **Unpublish the orphaned Facebook Page `112687715079745` ("Ryan Realty", 4 followers, no username)?** Yes / No / Merge into `RyanRealtyBend`.
4. **Enable Google Signals in GA4?** Yes / No. (Trade-off: better cross-device tracking + demographic reporting vs longer cookie banner consent flow. Recommended No for v1 of this plan — keep the existing cookie banner simple, add Google Signals later if remarketing reach is a problem.)
5. **LinkedIn dev-app architecture:** keep Share-on-LinkedIn (current state — publishing works, org analytics blocked) OR re-architect for Community Management (publishing still works via different endpoint, org analytics unblocked)? (Source: `marketing_brain_skills/tools_registry/linkedin-api/SKILL.md` §"Auth — mutual exclusion".)

---

## Source ledger (22 sources, 15 internal + 7 external)

### Internal (read this session)

1. `marketing_brain_skills/tools_registry/REGISTRY.md`
2. `marketing_brain_skills/tools_registry/meta-graph/SKILL.md`
3. `marketing_brain_skills/tools_registry/ga4-instrumentation/SKILL.md`
4. `marketing_brain_skills/tools_registry/ga4/SKILL.md`
5. `social_media_skills/platform-best-practices/SKILL.md`
6. `docs/research/best-practices-cross-platform-branding.md`
7. `docs/MARKETING_LEAD_FLOW.md`
8. `docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md`
9. `app/api/cron/marketing-snapshot-meta-ads/route.ts` (top-of-file docblock)
10. `app/api/cron/marketing-snapshot-gbp/route.ts` (top-of-file docblock)
11. `app/api/cron/marketing-snapshot-tiktok/route.ts` (top-of-file docblock)
12. `app/api/cron/marketing-snapshot-ga4/route.ts` (rowsForDay layout)
13. `vercel.json` — full cron schedule for marketing/snapshot routes
14. Live Supabase `marketing_channel_daily` and 8 OAuth-token tables — queried this session via Supabase MCP
15. Live `.env.local` — verified env vars present for Meta, GA4, GSC, GBP, YouTube, X, LinkedIn, TikTok, Pinterest

### External (WebFetched this session)

16. `support.google.com/analytics/answer/10071811` — GA4 cross-domain measurement setup (fetched 2026-05-21)
17. `support.google.com/google-ads/answer/2375435` — Linking GA4 to Google Ads (fetched 2026-05-21)
18. `developers.google.com/analytics/devguides/collection/ga4/reference/events` — Recommended GA4 events (fetched 2026-05-21)
19. Meta Graph API live calls `/me/owned_pages`, `/me/owned_ad_accounts`, `/me/owned_pixels`, `/{ad_account}/campaigns`, `/{ad_account}/insights` (fetched 2026-05-21 via `v25.0`)
20. Meta Graph API live calls for primary Page, Page metadata, IG metadata (fetched 2026-05-21)
21. `followupboss.com/integrations` — confirmed no native GA4 link; Facebook Lead Ads is native; FUB Pixel is a separate product (fetched 2026-05-21)
22. `docs/research/meta-graph.md` — internal mirror of Meta CAPI architecture (cross-referenced for CAPI vs Pixel discussion)

Sources 4 (Google Ads GA4 link) and 16 (cross-domain measurement) are the two cornerstone external references. Source 19 (live Meta Graph audit) is the load-bearing surprise data — it's how every "what's actually connected" claim in this dossier is grounded.

---

**End of dossier. No execution authority. Matt approves before any action row, OAuth flow, or admin mutation.**
