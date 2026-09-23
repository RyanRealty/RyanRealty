# tracking — long-form notes (2026-09-22, HEAD 83a459c)

Read-only audit of analytics + social measurement. Evidence files in this folder:
`scoreboard-probe.txt` (npx tsx scripts/company-scoreboard-probe.ts), `db-reads.json` + `db-reads.mjs`
(helper reads, aggregated in JS), `ga4-daily-series.txt`, `home.html` (curl, Chrome UA), `img.out`
(curl of a missing /_next/image URL), `live-tags.txt` (Playwright attempt — blocked by proxy).
`git status --short` was empty before and after.

## 0. Docs read

- docs/ANALYTICS_LEAD_TRACKING.md (227 lines): identity = rr_session_id (localStorage) + crm_people.id; five identify paths; GA4 property 527333348 / G-ST40W4WM6T; §4.1 claims **18** conversion events.
- docs/TRACKING_POLICY.md (136): Consent Mode v2 denied-by-default, tags always load (changed 2026-09-01 because load-suppression "made all non-consenting traffic invisible to GA4 since 2026-08-18"); 99.5% of visitors never answer the banner; campaign params + referrer stored at essential tier (Matt 2026-08-26); backlog #3 = no persisted per-lead consent record.
- docs/GTM_ANALYTICS_SETUP.md (65): env-driven GA4/GTM; dataLayer event list.
- docs/plans/SOCIAL_MEASUREMENT/GOAL.md (122): five systems wrote fabricated zeros; fixed 2026-08-26; consent ceiling is Matt's policy.
- lib/data/loop/silent-zero.ts (216): pure classifier; KNOWN_DORMANT (youtube:*, x:*, tiktok:*, gbp:* three metrics, instagram:saved, meta_page:*), RETIRED_METRICS.

## 1. site_signal freshness per source/scope (SQL aggregate, 2026-09-22)

`select source, scope, max(date), min(date), count(*), count(distinct surface), count(distinct metric) from site_signal group by 1,2`

| source | scope | latest | rows | note |
|---|---|---|---|---|
| fub_api_v1 | account/campaign/source | 2026-06-23 / 06-23 / 06-19 | 904+264+60 | FUB decommissioned 2026-06-24; rows still in the view |
| ga4_data_api | account | 2026-09-21 | 1,804 | live |
| ga4_data_api | campaign | 2026-09-21 | 123 | lead_event:* |
| ga4_data_api | channel | **2026-09-07** | 36 | rows written only when GA4 reports a social session (route writes `d.socialChannels` only) — dormant, not dead |
| ga4_data_api | event | 2026-09-21 | 1,551 | 51 event names |
| ga4_data_api | lp / page / source | 2026-09-21 | 144 / 2,532 / 1,938 | live |
| gbp_performance_api_v1 | account | 2026-09-19 | 1,669 | 10-day re-pull window (route const GBP_REPORTING_LAG_DAYS=10) |
| gsc_search_analytics_api | account / campaign / page | 2026-09-20 / 09-19 / 09-19 | 872 / 20,780 / 20,820 | top-25 per day |
| meta_ads_insights_api | account / campaign | **2026-06-19** | 144 / 200 | still in fan-out; writes nothing (no rows since 06-19; reason UNVERIFIED — child routes do not log to sync_logs) |
| meta_graph_v25 | account / post | 2026-09-21 | 476 / 9,598 | live since 08-25 fix |
| rum | page | 2026-09-22 | **771,723** | 36,567 distinct surfaces (raw paths) |
| tiktok_business_api_v2 | account / video | 2026-09-21 / **05-12** | 820 / 712 | video scope = videos published in last 30 days (route :226-231); none since May → dormant |
| x_api_v2 | account / post | 2026-09-21 / **08-16** | 1,692 / 5,579 | post scope = top 10 tweets last 30 days; no tweets since 08-16 → dormant |
| youtube_analytics_api_v2 | account / video | 2026-09-21 | 2,544 / 2,690 | live (dormant channel) |

Cron: `snapshot-channels` daily 12:20 UTC (vercel.json:262) fans out to ga4, gsc, meta-ads, meta-page, x, tiktok, gbp, youtube (route PLATFORMS). sync_logs rows (row read): 200 / records_returned 8 every day 09-08..09-22; 207 with error `x` on 09-06 and 09-07 (before the 12:00→12:20 stagger). Only the roll-up logs; children do not, so "ran OK, wrote 0 rows" is invisible.
Token heartbeat 2026-09-22 12:00: meta/youtube/x/gbp/tiktok 200; linkedin/threads/pinterest 204 (no token). Probe: linkedin `needs-reauth` (expired 2026-07-09, no refresh token), threads/pinterest/nextdoor `empty`, others valid/auto-refresh.

## 2. GA4 — the property is mostly server-mirrored hits (the core finding)

Code: `app/api/visitors/track/route.ts:486-565` — since 2026-08-10 (commit 416911b31) every first-party `page_view`/`listing_view`/`intent_declared`/`welcome_back`/`email_opt`/`sms_opt` event is mirrored into GA4 via Measurement Protocol (`lib/ga4-measurement-protocol.ts`) unless consent is analytics/all AND a `_ga` cookie exists. client_id = derived from rr_session_id; `engagement_time_msec: 100`; a custom `session_id` param (UUID). No `first_visit`, no `session_start`, no campaign/referrer attribution (only `page_referrer` string).

Data (site_signal ga4_data_api, last 14 days, SQL aggregates):
- `page_view` event_count **28,804**; `session_start` **370**; `first_visit` **262**; `user_engagement` 510.
- account `sessions` **8,743**; `new_users` 262.
- source/medium sessions: **(not set) 8,593**, (direct)/(none) 188, email-click 47+2, crm/doc 33, (data not available) 16, chatgpt.com 9+1, gbp/organic 2, accounts.google.com 3, cma/document 2, **google / organic 1**.
- lead_source lead_events: (not set) 156 of 161.
- Daily (ga4-daily-series.txt): bounce_rate 1.0 and engagement_rate 0 on 08-19..08-31 and 09-13, 09-18..09-21; new_users 0 on 08-19..08-31 and 09-18..09-21; avg_session_duration 571–7,592 s (an rr_session_id lives for the browser's life, so an MP "session" spans days).

Interpretation: GA4 `sessions` ≈ distinct rr_session_ids per day (MP), not gtag sessions. Every derived GA4 metric (engagement, bounce, new users, source/medium, channel grouping, lead source) is not human truth; organic attribution inside GA4 is impossible (1 organic session in 14 days vs 136 google-referred first-party sessions in 7 days).

Browser stream outage windows (session_start/first_visit absent): **2026-08-19 → 08-31** (13 days; matches the documented GTM load-suppression bug fixed 2026-09-01) and **2026-09-18 → 09-21** (session_start=1 on 09-18, absent after; ongoing). Commits touching the tag stack: f1e2a90f9 (2026-09-17: GTMHead.tsx, GoogleAnalytics.tsx, PageViewTracker.tsx, VisitTracker.tsx, track route — broker user-property IIFE injected before the GTM bootstrap), 5d8a0f874 (09-18, app/layout.tsx), 22b53b94a + 3da4313bc (09-19, app/layout.tsx). Correlation only. Live check: curl of / with Chrome UA (status 200, 535,618 bytes) contains `GTM-WV6R4NZ5` ×3 and `consent', 'default'` ×1, no `gtag/js?id=G-` (expected: GA4 config lives in the GTM container, outside the repo). Playwright fire test **blocked** (`net::ERR_TOO_MANY_RETRIES` through the sandbox proxy) — whether GTM's GA4 tag fires today is UNVERIFIED. The GA4 ingestor pulls yesterday only (`parseDateRange` default, lib/marketing-brain/snapshot.ts:136) with no settle window (GSC has one, :156-168), so an early pull is never corrected.

Conversion definitions disagree: docs §4.1 = 18 events; `scripts/ga4-admin.mjs:78-86` CONVERSION_EVENTS = 7; `app/actions/ga4-report.ts:6-16` LEAD_EVENT_NAMES = 9 (drives `total_lead_events`, `lead_event_rate`). `generate_lead` 135/14d is fired server-side by `lib/lead-tracking.ts` (fireLeadGenerated) — 149 GA4 "generate_lead"-class events vs `form_submit` 6 and `person_identified` 49; crm_timeline `lead_created` 153/14d.

GA4 events firing on the site (grep, 80 files): client `trackEvent` taxonomy in lib/tracking.ts (60+ names: view_listing, search, save_listing, generate_lead, nav_interact, section_view, address_submit, calculator_used, …); page_view stamping in components/PageViewTracker.tsx (first-paint page_view is GTM's); server MP fires in lib/lead-tracking.ts, lib/cma-request.ts:510, app/actions/identity-bridge.ts:90 (person_identified), app/api/meta/lead-webhook/route.ts:686, app/communities/[slug]/_v3/place-value-actions.ts:337, app/lp/seller-home-value/actions.ts:727, and the track-route mirror. `ai_assistant_sessions` (account + per engine) is written daily (0–2/day) — the AEO signal exists.

## 3. Consent and what share is measurable

Wiring (verified in code): `components/GoogleAnalytics.tsx` — consent defaults denied (beforeInteractive), `wait_for_update:500`, url_passthrough, ads_data_redaction; `hasGA4 = GA4_ID && !GTM_ID` so with GTM present only the consent block runs here; `components/CookieConsentBanner.tsx` — cookie `ryan_realty_cookie_consent`, `autoGrantConsentForAdTraffic` for fbclid/gclid/utm arrivals (Matt 2026-06-02); `components/VisitTracker.tsx:79-109` — no banner answer ⇒ `essential` (session_id, page_url, referrer, campaign params; geo/UA/listing meta stripped server-side); explicit decline ⇒ no writes; GPC honored server-side (`isGpcOptOut`, track route :39).

First-party 7-day pull (db-reads.json §B, 8,766 visitor_sessions rows, aggregated in JS): `user_agent` present on **218 (2.5%)** — UA is stored only above essential tier, so ~97.5% of sessions are essential-tier; utm_medium: none 8,600 (98.1%), organic 146 (1.7%), email 7, referral 1; utm_source: direct 8,600, google 136, chatgpt.com 8, crm 6, gbp 4, duckduckgo 3, yahoo 1, x 1; any referrer 155; fbclid/gclid 0; identified 90 (form_submit 74, rr_vid_carryover 10, email_click_pid 5, google 1); identified with organic medium **1**. Landing classes: homes-for-sale 4,845, contact 1,162, subdivisions 701, communities 261, open-houses 222, blog 219, cities 200, home 159.
GA4 side: 370 gtag `session_start` vs 8,743 GA4 "sessions" in 14 days ⇒ the browser GA4 stream is at most ~4% of traffic. RUM is NOT consent-gated (WebVitalsReporter sends for everyone) — so RUM ≈ all page loads, GA4-gtag ≈ ≤4%.
Caveat: 98% "direct/no referrer" is implausibly high for humans; the track endpoint has no bot filter (grep: none in route/VisitTracker), middleware GOOD_BOT_RE lets JS-rendering crawlers through and excludes /_next/image from screening (matcher :656), and UA is stripped at essential tier, so bots cannot be separated in first-party data. Share is UNVERIFIED.

## 4. RUM

`components/WebVitalsReporter.tsx` (59 lines, mounted in app/layout.tsx:162): next/web-vitals → sendBeacon `/api/web-vitals` (stores metric,value,rating,path,navigation_type,device) + gtag event. No sampling, no bot filter, no path normalization. `site_signal` view (migration 20260610210000) unions `web_vitals` as source='rum', scope='page', surface=path.
14-day shape (SQL): metrics cls 50,845 rows / fcp 83,705 / fid 3,216 / **inp 1,394** / lcp 45,365 / ttfb 75,842; max fcp 912,536 ms, max inp 430,784 (no clamping). Surface families: `/_next/*` = 37,639 fcp / 37,239 ttfb / 24,457 cls / **20,306 lcp** rows; top LCP surfaces: `/_next/image` 20,306, `/contact` 2,077, `/` 909, `/cities/bend` 714, `/communities/tetherow` 521, `/homes-for-sale` 500.
Cause: `curl -A Chrome "https://ryan-realty.com/_next/image?url=%2Fimages%2Fdoes-not-exist-zz.jpg&w=640&q=75"` → **404, 142,610 bytes, text/html** = the app's not-found page with the root layout (WebVitalsReporter + VisitTracker mount). Raw web_vitals rows for path `/_next/image`: navigation_type `navigate`, device desktop, 8 rows in 5 s on 09-22 19:45. visitor_events (7d) 12 page_views with page_title "Page not found" on URLs like `/_next/image?url=https://cdn.resize.sparkplatform.com/…&w=3840` and `/_next/image?dpl=…&url=/images/communities/broken-top.jpg&w=3840`; GA4 page scope `/_next/image` 34 views / 11 users on 09-16. No in-repo anchor links to /_next/image (grep) — origin of the navigations UNVERIFIED (likely crawlers or direct opens).
Route-class p75 last 14 days (regex classes, SQL): city LCP 4,400 ms (n=839, TTFB p75 658), community 3,176 (781), home 3,664 (909), content 3,885 (1,104), search 6,785 (13,016; TTFB 640), subdivision 4,712 (1,232; **TTFB p75 3,042**), neighborhood **17,097** (1,168; TTFB p75 1,163), place-type 4,560 (223; TTFB 1,331), zip 10,306 (399), listing 1,353 (340), other 9,100 (25,282 — mostly /_next/image). INP rows per class 2–523 → INP p75 per route is not statistically usable; FID (deprecated) still stored.

## 5. GSC / GBP

`app/actions/search-console-report.ts:71-91`: account totals (rowLimit 1), `dimensions:['query'] rowLimit 25`, `dimensions:['page'] rowLimit 25` — per day, by impressions. No page×query, device, country, searchType, no startRow pagination. `target_query_benchmark` (migration 20260610230500) LEFT JOINs target_queries to those top-25 rows with `ilike '%q%'`; comment admits absence ≠ zero. Probe: 153 benchmark rows in 28 d. URL Inspection exists only in `scripts/_gsc-index-check.mjs` (manual); sitemap submit manual (`seo-gsc-sitemap-submit.mjs`). No Bing Webmaster / IndexNow code (only docs/CONTENT_ENGINE_SPEC.md mentions it). GBP: performance metrics daily with 10-day lag window; reviews not ingested by any cron (route TODO; `ingest-gbp-reviews.mjs` manual); `gbp-health-check` daily.

## 6. Social

Probe `social.tokens`: tiktok valid, youtube/x/gbp auto-refresh, linkedin needs-reauth (parked), threads/pinterest/nextdoor empty. Feeds: meta_graph_v25 account+post live (17 metrics); youtube live-dormant; x account live, post dormant; tiktok account live, video dormant; meta_ads dead since 06-19 (no spend? UNVERIFIED). Does social flow into prioritization? `scripts/loop-brief.ts:330-372` reads `marketing_channel_daily` only to run the silent-zero guard keyed `channel×metric` (all scopes collapsed); `scripts/seed-site-queue.ts` header: "never reads taste-table.json. A person pastes after review. Not auto-seed" — nodes are hand-written; GA4/GSC appear only inside node prose. Nothing from site_signal, GA4, GSC, RUM or social feeds prioritization automatically. GOAL.md: social sends "a fraction of a percent" of traffic; ga4 channel scope shows 1–4 social sessions on the days it has rows.

## 7. Email / SMS / follow-up measurement

email_events latest 2026-09-22 19:37 (sent/delivered; listing-alert sends, contact confirmation). Probe: emailEvents7d 3,559, opens 105, clicks 16. crm_timeline 14d (1,788 rows via helper): email_out 289 (gmail 124, app 91, sequence 74), email_in 58 (gmail), email_open 177, email_click 192, call 6 + voicemail 2 (twilio), sms_out 5, sms_in 1 (twilio), lead_created 153, system 636 (broker-alert 337, response-clock 146, auto-enroll 77, sequence 76), stage_change 91.
Speed-to-lead: `crm-response-clock` cron (*/5) + lib/crm/response-clock*.ts define a human touch and write flags to `crm_people.custom.response_clock` and crm_timeline dedupe rows. Latest 15 flagged people (all source ryan-realty.com, stage Nurture, created 09-20..09-22): 15/15 flag5mAt, 11/15 flag24hAt (no human touch within 24 h). No stored median/percentile, no marketing_channel_daily/site_signal metric, no scoreboard line.
SMS consent: no *consent* table in the schema snapshot; crm_people has only `phones` jsonb; `crm_phone_dnc_checks` + weekly `dnc-scrub` exist. TRACKING_POLICY backlog #3 (versioned consent record) still open.

## 8. Scoreboard / loop ingest

`docs/plans/COMPANY_SCOREBOARD.md` "Week of 2026-08-15" (5 weeks stale; "overwrite weekly"). Probe today: crm 23,001 people (Nurture 20,401, Lead 203, Sphere 2,338), created 7d 95; ledger 20 rows, 8 open windows, 7 expired-unlearned; gsc benchmark rows 153; identityMap 378 (244 → CRM); visitorEvents7d 11,582; join visits 47/conv 4 (7d).

## 9. Minimal truthful weekly scoreboard (proposal)

SEEN: GSC clicks/impressions/position by page class from a full page×query pull (settled day, paginated); indexed-vs-sitemap count (URL Inspection sample or Index Coverage export); AI referral sessions from first-party referrer classification (not GA4); GBP search impressions + website clicks + review count; RUM LCP/INP p75 per page class, bot- and /_next-filtered, n shown.
CONVERT: first-party sessions by channel (bot-filtered), identified people by channel, leads created by channel (organic/gbp/direct/email/social/paid), speed-to-lead p50/p90 + unanswered-24h count, sequence replies, email open/click rate.
DELETE/PARK as loop inputs: GA4 account metrics (sessions/bounce/engagement/new users) while the MP mirror exists; fub_api_v1 rows; meta_ads (until spend); tiktok video / x post (dormant); linkedin/threads/pinterest/nextdoor (no token).

## UNVERIFIED / blocked
- Whether GTM's GA4 tag fires today for a consented browser (proxy blocked Playwright); whether GA4_API_SECRET is set (inferred from 28,804 MP page_views — MCP tools disallowed mid-task).
- Why meta_ads stopped 2026-06-19 (no per-child log; likely no spend).
- What navigates browsers to /_next/image documents (bots vs humans).
- Bot share of first-party "direct" sessions (UA stripped, no filter).
