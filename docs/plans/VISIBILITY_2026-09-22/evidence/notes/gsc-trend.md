# gsc-trend reader: why ryan-realty.com keeps "slipping" in search

Reader finished 2026-09-23 from probe outputs in this folder (probe1..probe13 by the interrupted run, probe14..probe20 added in this pass). Read-only on the repo. No MCP tools. Database reads through `SCRATCH/lib/sb.mjs` only. GSC reads through the Search Console API with the repo's service account (`webmasters.readonly`, property `https://ryan-realty.com/`, siteOwner, probe11 line 1).

`git status --short` shows staged changes in `.claude/settings.json`, `app/api/web-vitals/route.ts`, `components/GTMHead.tsx`, `components/WebVitalsReporter.tsx`, `lib/analytics/gtm-bootstrap.ts` and others. This reader did not make them; another session is editing those files now. Nothing here touched the tree.

## 0. Answer in one paragraph

Overall organic clicks are not falling. The last 4 complete weeks (2026-08-24..09-20) had 523 clicks, the best 4-week block on record. Impressions are falling fast: 2,239/day on 09-07, 996/day on 09-20. The money pages are losing rank. Community pages dropped 3 to 14 positions on their own-name queries since early July. City and "homes for sale" target queries never ranked (p26 to p42, 0 clicks). `/homes-for-sale/bend` had 0 impressions from 09-06 to 09-21. The homepage sits at p45 for "ryan realty". The loop cannot see any of this. Its only GSC signal (`target_query_benchmark`) is 100% a rank tracker's quoted queries. Its GSC store keeps only the top 25 pages or queries per day, about 5% of impressions. Its Learn step writes `actual_delta = 0` when a path does not match a full URL. GA4 has not attributed organic sessions since mid-July. RUM has been swamped since 09-13 by 404 renders of dead `/_next/image` URLs. So the loop reports "gsc: ok" and "Ranking is not the served class" while ranking slips.

## 1. Site-wide trend (GSC API, all pages, web search)

Source: probe8 (`searchanalytics.query` dimensions=[date], site `https://ryan-realty.com/`, 2026-03-23..2026-09-19) and probe15/probe18 for 09-20.

| week | clicks | impressions | CTR% | pos |
|---|---|---|---|---|
| 05-25 | 20 | 3,348 | 0.60 | 11.8 |
| 06-01 | 86 | 7,279 | 1.18 | 16.0 |
| 06-22 | 141 | 10,345 | 1.36 | 13.3 |
| 07-13 | 127 | 8,668 | 1.47 | 14.0 |
| 07-20 | 118 | 8,101 | 1.46 | 14.2 |
| 07-27 | 91 | 7,969 | 1.14 | 17.9 |
| 08-10 | 71 | 8,328 | 0.85 | 17.6 |
| 08-24 | 151 | 12,785 | 1.18 | 18.1 |
| 08-31 | 119 | 13,328 | 0.89 | 14.9 |
| 09-07 | 115 | 12,489 | 0.92 | 13.7 |
| 09-14 (6d, API) | 123 | 8,543 | 1.44 | 11.4 |
| 09-14 + 09-20 (probe15/probe18: 15c/996i) | 138 | 9,539 | 1.45 | - |

4-week blocks: 06-29..07-26 = 480c/36,879i. 07-27..08-23 = 337c/31,715i, pos 17.5 (probe2 site_signal account rows, which match the API weekly figures). 08-24..09-20 = 151+119+115+138 = 523c, 12,785+13,328+12,489+9,539 = 48,141i.

Daily (probe18, type=web): 08-31..09-12 = 222c/24,267i over 13 days (1,867 impr/day, 17.1 clicks/day). 09-13..09-20 = 150c/11,089i over 8 days (1,386 impr/day, 18.75 clicks/day). Daily impressions fell every day or two: 2,239 (09-07), 1,832 (09-08), 1,703 (09-10), 1,447 (09-12), 1,639 (09-15), 1,323 (09-17), 1,144 (09-19), 996 (09-20, may still be provisional).

The average position "improves" (13.7 to 11.4) because low-ranked impressions are dropping out. It is a mix effect, not a gain.

## 2. Inflections and what shipped at the same time (a lead, not a verdict)

Commit times come from `git log -1 --format='%ad %cd'`. Deploy times were not verified.

### A. Week 06-01: gain
Clicks 20 to 86, impressions 3,348 to 7,279 (probe8). Listing detail (/homes-for-sale/*) goes from 0 to 28c/1,530i that week (probe8 class table). Same day: `d79b0d8d9` 2026-06-01 19:08 -0700 "sitemap lists individual listings". Also `be1adb633`/`f544b3926` 06-04, where listing links use the full city/neighborhood/subdivision canonical.

### B. Weeks 07-27..08-23: the only sustained click drop
337c vs 480c in the prior 4 weeks (-30%). Position 13.9 to 17.5. By class (probe8, probe11):
- homes-for-sale detail clicks 58 (07-20) to 36 / 30 / 31 / 34. Central Oregon detail 32c to 16c / 11c / 12c / 13c.
- subdivision position 16.4 (07-20), 22.9 (07-27), 21.6, 24.6, 28.3 (08-17), 33.9 (08-24).
- community impressions 1,201 (07-06) to 430 (08-03). `/communities/brasada-ranch` impressions 472 (07-06), 346, 92 (07-20), 21 (07-27), 22, 19, then 147 (08-17) and 487 (08-24).
- homepage position 22.2 (07-20), 26.0 (07-27), 29.0 (08-24).

Commits in or just before the window:
- `96f76ca14` 07-22 Wave D "search + index layer: one-search merge ... subdivision light-up, search matrix, site index"
- `bff8c6077` 07-23 "noindex + sitemap-omit zero-inventory {city}/{preset} combos"
- `843687984` 07-28 22:09 "per-class child sitemaps + luxury redirect retarget"
- `250044022` 07-28 "retarget geography legacy redirects to canonical community pages"
- `124348def` 07-30 07:31 "sitemap children off the build critical path — every deploy was ERROR"
- `aa56d308d` 08-02 "the sitemap P0 fix never worked — its TTL expired before the build finished"
- `996ece96a` 08-02 "warm the sitemaps in-process, and name the cause three passes have missed"
- `0dbf2f1cc` 08-03 "the sitemap's second RPC call site, and 18% of paginated rows silently dropped"

The Brasada community impression collapse starts in the 07-20 week. That is before the sitemap commits, and it lines up with 07-22/07-23 (Wave D, zero-inventory noindex). Unverified which one.

### C. Week 08-24: jump
Impressions 8,542 to 12,785. Pages with 1 or more impressions went 2,433 to 4,083. Listing detail pages 1,315 to 2,840, with "other" (non-Central-Oregon city slug) detail 742 to 1,979 (probe11 footprint table). `/homes-for-sale/outside-boundaries/*` 294i to 3,631i. Nearby commits: `91279f296` 08-19 "keep listing sitemap dal off the data barrel", `bd6a924ac` 08-20 "move every public page-body redirect above the streamed shell", `1ac0f4ca7` 08-24 "drop Upstash from middleware so production can deploy". The last one implies production deploys were blocked before 08-24 (not verified).

### D. From 09-07/09-08: impressions slide
Week 09-14 (6 days, probe8/probe11) vs week 09-07:
- S. Oregon city-slug listing detail 2,393i to 1,405i. `/outside-boundaries/` detail 1,250i to 678i. The `outside-boundaries` sentinel also holds Central Oregon rural homes and Brasada Ranch (SITE-23 in loop-brief), so it is not "out of market".
- Central Oregon city-slug detail 4,296i to 2,544i, while its clicks held at 37c to 39c.
- community 723i to 383i. central-oregon 396i to 172i. city 413i to 279i. oregon/[city] 96i to 16i. Locksley single listing 587i to 372i.
- gains: subdivision 293i to 536i, clicks 4 to 21, position 20.6 to 11.1. Blog flat at 1,035i to 1,002i, position 10.1 to 7.5.

Commits: `ec52e2026` 09-08 16:39 SITE-27 "out-of-market city slugs hop in middleware". `446d95677` 09-08 SITE-25 title budget, "noindex stops meaning nofollow". `469a58106` 09-09 04:03Z SITE-22 "one canonical per listing, and one builder every href is made from". `11cfbe523` 09-09 06:44 -0700 SITE-33 "out-of-area homes say so, leave the index, and leave the sitemap". `8dc9b5505` 09-09 SITE-29 "place pages and the blog become static shells that revalidate". `a36411b00`/`ef29eef86` 09-13 ISR TTLs raised. `9794e028d` 09-13 "kill Vercel Image Optimization site-wide" (next.config.ts line 139 `unoptimized: true`). `a80e52e84` 09-16 "keyset-paged listings sitemap". `ffcc52e80` 09-17 19:23 -0700 "use {place} homes for sale on place and search h1s". `5d8a0f874` 09-18 "raise place and home ISR to 900s".

### E. After 09-17 (the title/H1 collision other readers verified)
Daily GSC, probe15: `/cities/{slug}` (depth-1 regex) averaged 58 impr/day on 09-14..09-16 and 31.7/day on 09-18..09-20 (-45%). `/homes-for-sale/{city}` went 22.7/day to 7.3/day (-68%). Site-wide went 1,601 to 1,138/day (-29%). Only 3 days after the change, and 09-20 may be provisional. This is an early signal consistent with the collision, not proof.

## 3. Money pages and target queries

### Rank-tracker (quoted) series, impression-weighted position by week (probe4, site_signal campaign)
| query | 06-29 | 07-13 | 07-27 | 08-24 | 09-07 | 09-14 |
|---|---|---|---|---|---|---|
| "tetherow homes for sale" | 12.8 | 16.4 | 24.2 | 22.1 | 24.6 | 17.6 |
| "black butte ranch homes for sale" | 15.6 | 15.6 | 21.0 | 22.5 | 18.6 | 20.2 |
| "black butte ranch real estate" | 18.2 | 20.5 | 33.9 | 28.4 | 26.5 | 28.3 |
| "broken top real estate" | 12.8 | 15.7 | 17.5 | 23.2 | 21.6 | out of top 25 |
| "broken top homes for sale" | 10.9 | 15.3 | 15.2 | 17.4 | 14.3 | 13.0 |
| "brasada ranch homes for sale" | 9.0 | 10.0 | 10.1 | 10.5 | 12.5 | 10.7 |
| "brasada ranch real estate agent" | 1.6 | 1.6 | 1.0 | 1.0 | 1.1 | 1.0 |

### Which page ranks (probe15, GSC API dimensions=[page], query contains X)
| query contains | page | 06-29..07-19 | 08-31..09-20 |
|---|---|---|---|
| tetherow | /communities/tetherow | 259i p40.2 | 136i p47.1 |
| tetherow | /blog/tetherow-resort-living-real-estate | (not in top 6) | 154i p15.7 |
| black butte ranch | /communities/black-butte-ranch | 441i p33.9 | 239i p38.5 |
| broken top | /communities/broken-top | 231i p21.0 | 133i p23.7 |
| brasada ranch | /communities/brasada-ranch | 1,213i p21.6 | 671i p35.8 |
| bend oregon realtor | / | 13i p34.8 | 21i p36.6 |
| bend oregon realtor | /cities/bend | 3i p63.0 | 6i p62.3 |
| homes for sale bend | /cities/bend | 5i p46.8 | 1i p34.0 |
| ryan realty | / | 8i p45.1 | 20i p45.3 |
| ryan realty | /?utm_source=gbp... | 4i p3.5 (1c) | 1i p3.0 |
| sunriver homes | /cities/sunriver | 8i p50.6 | 36i p37.9 |

The same tracked names are split across many pages. "black butte ranch" hit 11 pages in the late window, including `/homes-for-sale/black-butte-ranch?propertySubTypes=Condominium` at p54.8 and `/housing-market/black-butte-ranch` at p86.5. "brasada ranch" hit 65 pages, most of them listing detail variants. "tetherow" hit /communities/tetherow, /blog/tetherow..., /subdivisions/golf-homes-at-tetherow, /communities, and earlier /explore/bend/tetherow/ and /lp/tetherow.

`/homes-for-sale/bend` (the target_url for "homes for sale bend oregon" and "bend or homes for sale") had 0 queries and 0 impressions in both 09-06..09-16 and 09-17..09-21 (probe15, page equals filter). `/cities/bend` had 70i in 09-06..09-16, 0 clicks.

Unquoted target queries, then (06-01..06-28) vs now (08-23..09-19), probe8: bend oregon realtor 20i p19.2 to 27i p37.1. sisters oregon homes for sale p27.9 to p42.4. redmond oregon homes for sale p30.5 to p35.5. sunriver homes for sale 12i p39.5 to 96i p40.2. brasada ranch homes for sale p21.5 to p26.7. ryan realty 3c/39i p40.0 to 0c/44i p40.7. Every one of the 23 target queries had 0 clicks in both windows.

### Pages that lost clicks (probe8, 06-01..06-28 vs 08-23..09-19)
- `/`: 17c/874i p24.3 to 4c/371i p31.2. Weekly exact-URL position (probe11): p25 (07-06), p33 (07-27), p41 (08-24), p29 (09-07), p20 (09-14). Homepage title commits: `bd557d2ea` 08-10 "exact-match homepage Layer A H1 and title" (position worsened after it) and `63eac48c0` 09-07 "keyword homepage title" (position recovered after it). Correlation only.
- `/blog/sunriver-year-round-living-vs-vacation`: 14c/800i p6.9 to 7c/937i p6.8. Same position, half the CTR.
- `/blog/hoa-guide-central-oregon`: 4c/235i to 0c/58i.
- 4 listing pages with 3 or more clicks then have 0 impressions now (sold/expired, expected).

## 4. The loop's measurement is blind to all of the above

1. **Benchmark is synthetic.** `target_query_benchmark` (supabase/migrations/20260610230500_target_query_benchmark.sql line 37) strips `"` and `[` from `site_signal` query surfaces and matches with `ilike '%query%'`. Probe13: all 153 benchmark rows in the last 28 days are backed only by quoted/bracketed queries. 0 rows come from a plain query, and there are 0 clicks. Probe10: the quoted queries appear about 3 impressions/day, every day, for 85 to 111 days (for example `query:"tetherow homes for sale"` 2026-05-23..09-19, 111 days, 395 impressions). That is a rank-tracking bot, not demand. The scoreboard marks gsc `status: 'ok'` whenever the count read does not error (lib/data/loop/signals.ts lines 463-467; scoreboard-probe: `"gsc": {"status":"ok","rows28d":153}`). The brief prints "gsc: ok 153 target_query_benchmark rows / 28d" and "GSC GAPS: 0 eligible SITE-* nodes. Ranking is not the served class." (loop-brief lines 31-32).
2. **Store is top-25/day.** app/api/cron/marketing-snapshot-gsc/route.ts line 62 ("Query-scope: top 25 queries by impressions") and line 99 ("Page-scope: top 25 pages by impressions"). In 08-24..09-20 the page-scope rows hold 2,721 impressions (probe3 TOTAL). The API has 55,187 impressions for 08-23..09-19 (probe8), so the loop sees about 4.9%. Page-class impression trends cannot be computed from `site_signal`.
3. **Learn writes a false zero.** scripts/loop-learn-close-windows.ts `pageSeries()` filters `.in('surface', surfaces)` (line 66) with the ledger surface as a path (`/blog/...`). The GSC writer stores full URLs (`https://ryan-realty.com/blog/...`). Probe19: 0 rows by path vs 28 rows by full URL in the 06-10..07-08 window. On no data the script sets `actualDelta = 0` and verdict `inconclusive` (line 186). Openness is `actual_delta == null` (signals.ts line 422), so the window counts as closed. Probe7: 8 of 12 rows with an actual_delta hold 0 and are inconclusive (5 seo_title_rewrite, jsonld_brand_entity_pages, content_new_market_report, legacy_redirect_retarget). Real outcome for the Sunriver title rewrite (baseline CTR 3.4%): weekly sums 07-13..08-09 = 20c/1,327i = 1.51% (probe11), and 08-23..09-19 = 7c/937i = 0.75% (probe8). That is a loss the ledger recorded as "0 / inconclusive". hoa-guide (baseline 3.6%): 0c/60i in 07-13..08-09.
4. **Nothing new is measured.** Probe7: `site_improvement_ledger` holds 20 rows. One has shipped_at in 2026-09 (SITE-09 response-clock, no actual_delta). Loop-brief line 92: "406 of 474 shipped commits in the last 14 days have NO node and NO ledger row". The titles, canonicals, redirects, index policy, sitemap and ISR changes above shipped with no predicted delta and no GSC readback. Site nodes say "blocked on measurement" and re-open 2026-10-05..11-08 against GA4 (dead, section 5) and Search Console clicks by page (not stored beyond top 25).
5. **Mitigation exists but is inert.** `8a2c71e` 09-22 added scripts/seed-gsc-ranking-queue.ts. It pulls the full GSC API (rowLimit 25000, dimensions query and query+page) and mints SITE nodes from position/CTR rules. It is dry-run by default, runs only when the queue is empty, and looks at one window with no before/after or class trend.

## 5. GA4 cannot measure organic

Source: site_signal source=ga4_data_api (probe5 weekly, probe10 source rows, probe14 daily).
- google/organic sessions per week: 32 (06-29), 23 (07-06), 3 (07-13), 4 (07-20), none reported 07-27..08-03, then 3, -, -, 5, -, 1. GSC clicks in those weeks: 111, 124, 127, 118, 91... So GA4 has attributed at most 5 organic sessions per week since 07-13. Mid-July cause: UNVERIFIED. Candidates are `9a000a31b` 07-10 "three silent kill-switches on the visitor + engagement pipeline" and `875049de3` 07-10.
- `416911b31` 2026-08-10 07:34 -0700 "mirror first-party page views into GA4 via MP" (app/api/visitors/track/route.ts, lib/ga4-measurement-protocol.ts). Sessions went 33 (week 08-03) to 4,237 (week 08-10), of which `(not set)` = 4,211. On 09-19, 699 of 699 sessions were `(not set)`. Engagement rate is 0.000 to 0.009 per week since then.
- Browser events (session_start, first_visit, user_engagement, scroll_depth, section_view, LCP, scroll) vanish on **2026-08-19** and stay gone through 08-31. Only page_view (the MP mirror) continues. This follows `1224b1f31` "stop dual GA4 tags" and `a732b9948` "restore GTM consent gate required by tracking-policy", both committed 2026-08-18 ~15:05 -0700. They partly return on 09-01 after `340fb066d` 09-01 15:57 "GA4 measures all traffic again — GTM on Consent Mode v2". scroll_depth, section_view and LCP never come back. They vanish again on 09-18 (session_start 10 on 09-17, 1 on 09-18, none after), after `f1e2a90f9` 09-17. So the browser stream was dead 08-19..08-31 as well as since 09-18. The ledger's `conversion_overlay_discipline` "loss" (-0.0247 engagement, measured 08-15) is also suspect, since engagement_rate was already being diluted.

## 6. RUM

Source: `web_vitals` table (probe9, probe12, probe17). site_signal source=rum also exists (772,662 rows, probe1).
- Rows with `path='/_next/image'`: 0 every day 09-06..09-12. Then 5,864 (09-13), 25,511 (09-14, 69.2% of all rows), 23,736, 22,431, 9,565, 1,533, 1,378, 1,510, 9,797 (09-21, 61.6%). Sample rows are FCP/TTFB from `device: desktop`. Starts the day of `9794e028d` "kill Vercel Image Optimization site-wide". Each request for a dead image URL renders the HTML 404 page, which mounts the vitals reporter. Whoever is fetching those URLs runs JS (headless/crawler renderer likely; UA not stored, UNVERIFIED). 7-day LCP p75 on those rows is 9,876 ms (probe9).
- 7d 09-14..09-20 LCP rows: desktop 26,874 vs mobile 1,120. Rows are flat across UTC hours (1,000 to 1,450 per hour), a bot signature (probe9).
- Mobile-only LCP p75, 08-24..09-20 (n=2,954, p75 3,492 ms; probe12): city 5,068 (n=258), neighborhood 9,924 (n=99), place-type 7,220 (n=22), housing-market 5,240 (n=140), subdivision 4,624 (n=73), community 4,176 (n=207), listing 3,200 (n=680), home 3,456 (n=413), blog 1,854 (n=25). The ranking classes sit in "poor" (>4 s) on mobile, even before bot filtering. June baseline (probe9, mixed devices, 06-08..06-14): city 2,532, home 1,533, listing 2,308. Mobile INP p75 136 ms, CLS p75 0.001 (fine).
- Image search (probe18, type=image): 191 impr/day on 08-31..09-12, 128/day on 09-13..09-21, 85 to 92/day on 09-17..09-19. Only 4 image clicks in 13 days before, so the business impact is small.

## 7. Listing URL churn

Probe16 (from gsc-api-pages.json: probe8's pages "then" 06-01..06-28 and "now" 08-23..09-19; listing key parsed from the URL tail):
- then: 3,983 distinct listing keys, 262 (6.6%) under more than one URL, holding 1,784 of 13,485 detail impressions.
- now: 7,329 keys, **1,234 (16.8%) under more than one URL**, holding **11,694 of 31,942 detail impressions (36.6%)** and 132 of 376 detail clicks. 690 of them have an `/outside-boundaries/` variant.
- Live (probe20, Chrome UA): variants answer **200 with a canonical**, not a 301. `/homes-for-sale/outside-boundaries/brasada-ranch/brasada-ranch-220220863` returns 200 with canonical `/homes-for-sale/powell-butte/brasada-ranch/brasada-ranch-220220863`. The Locksley listing Google shows as `/homes-for-sale/bend/1522-locksley-220226356` (1,657i) now canonicalizes to `/homes-for-sale/bend/mountain-view/providence/1522-locksley-220226356`. The Lazy River West listing seen in GSC as `/homes-for-sale/bend/lazy-river-west/...` and `/homes-for-sale/outside-boundaries/three-rivers/lazy-river-west/...` now canonicalizes to a third URL, `/homes-for-sale/bend/three-rivers/lazy-river-west/...`. Two variant URLs timed out at 40 s on first request, then served in 0.82 s and 3.60 s on retry (cold render).
- The canonical embeds city/neighborhood/subdivision (lib/slug.ts `listingDetailPath` line 180, `listingCanonicalHref` line 329; lib/data/listings/getListingCanonicalPathFields.ts). Every geo reclassification (SITE-22 09-09 builder, SITE-23 Brasada sentinel, SITE-27, SITE-33, place-page subdivision changes) mints a new canonical URL, and Google treats it as a new page.

## 8. Non-market and non-transactional impressions in the headline

- Week 08-24..09-07 detail impressions from S. Oregon city slugs: 1,336 / 1,789 / 2,393, plus outside-boundaries 3,631 / 2,763 / 1,250 (probe11). S. Oregon listing clicks 21 + 23 + 33 = 77 of 385 site clicks in 08-24..09-13 (20%).
- One query, "apartments near northeast locksley drive bend or", brought 1,652 impressions at p6.4 with 0 clicks to one listing (probe8). Weekly: 695 / 585 / 372 (probe11).
- So the 08-31 "peak" was partly pages the business does not want (per SITE-27/SITE-33) and one non-transactional query. Reading site-wide impressions as the ranking health metric misreads intended pruning as a slip, and hides the real slip on Central Oregon money pages.

## 9. Data-quality notes on site_signal GSC

- Account rows show 0 impressions on 2026-05-12..05-19 and 05-21, with 05-20 and 05-22 missing (probe2). The API has real data: week 05-11 = 24c/3,142i vs site_signal 4c/601i (probe8 vs probe2). The cron's rolling re-pull is days 9..2 ago (route.ts lines 166-167), so these May zeros are permanent until backfilled with `?startDate=&endDate=`.
- 2026-09-20 is 0 in site_signal (probe2) and 996 impressions in the API (probe18). It is inside the rolling window, so it self-corrects, but any "current week" read from site_signal is understated. Probe2's "impressions -36% vs peak" is really -28% (9,539 vs 13,328) once 09-20 is counted.

## 10. Blog-to-community 301 without a measurement

`136088a` 2026-09-22 301s `/blog/tetherow-resort-living-real-estate` onto `/communities/tetherow` (data/legacy-redirects.json, next.config.ts). In 08-31..09-20 the blog ranked p15.7 on tetherow queries (154i) and the community page p47.1 (136i). Over 08-23..09-19 the blog had 3c/807i at p9.6 (probe8). No ledger row covers it (loop-brief ship reconciliation). A 301 usually passes most signals, but the loop will not know if it worked.

## 11. Is the measurer alive?

- site_signal max dates: gsc_search_analytics_api 2026-09-20 (observed 2026-09-22T12:20Z). ga4_data_api 2026-09-21. rum 2026-09-22 (probe1). The crons run. What they write is the problem.
- Ledger: 20 rows. 8 open windows. 7 expired and unlearned (scoreboard-probe). Last measured_at 2026-09-08 (look-walk).
- Scoreboard gsc "ok" = row count of the synthetic view.

## Probe index
probe1 sources, probe2 account weekly (site_signal), probe3 page classes (site_signal top-25), probe4 target queries (site_signal campaign), probe5 GA4 weekly, probe6 RUM counts, probe7 ledger rows, probe8 GSC API site/class/pages/queries, probe9 RUM 7d, probe10 GA4 sources + quoted queries, probe11 GSC API series, probe12 mobile RUM, probe13 benchmark synthetic share, probe14 GA4 daily events, probe15 GSC query→page + city pages daily, probe16 listing URL churn, probe17 /_next/image RUM rows per day, probe18 GSC by search type, probe19 ledger surface mismatch, probe20 live listing variants. Git: gitlog-seo-full.txt, gitlog-nodes.txt, gitlog-all.txt, `git log -1` on each named SHA.
