# Market-report → homeowner conversion audit — 2026-07-15

**The question Matt asked:** *If I'm a homeowner in a city, neighborhood, resort, or master-planned community and I get a market report for that area — will it convert me into someone who trusts this is the best brokerage to list my home? Does the message even make me want to click? Am I tracking everyone I sent these to? Can I see where they went and whether they converted? What do analytics and Search Console say about improving?*

**Method:** live `next dev` off `main` @ `c9250f24`, driven as a recipient (mobile-first — SMS and email links open on phones). GA4 Data API pull (property `527333348`, 2026-04-17 → 2026-07-15), Search Console API pull (`https://ryan-realty.com/`), live Supabase evidence queries, full code trace of both send paths, and 16 captured journey screenshots in [assets/](assets/) (prefix `mr-`; capture panels are untracked by folder convention — regenerate any of them with `node scripts/_mr-audit-capture-2026-07-15.mjs` against a running dev server). Every figure below carries its source.

---

## The four answers, straight

### 1 · "Will the report convert me into listing with Ryan Realty?" — Not yet, and the main reason is not design. It is that almost nobody receives one, and the person who does is dropped onto a buyer page.

The machinery is genuinely good. The subscription email (see [assets/mr-email-mobile-full.png](assets/mr-email-mobile-full.png)) is the strongest artifact in the funnel: brand masthead, personal greeting, a verified one-story headline ("Bend home prices are holding steady year over year"), every stat with month-over-month context and a "what this means for you" line, a live inventory chart, one clear CTA, and a "reply if you want a pricing read on a specific home" soft ask. The CMA/expired-audit document ([assets/mr-cma-mobile-01-top.png](assets/mr-cma-mobile-01-top.png)) is trust-building at a level competitors don't touch: "Prepared for [owner]", value range up front, methodology, county/FEMA/wildfire intelligence, Oregon-compliant disclosures.

But the conversion chain breaks in four places:

1. **Audience ≈ zero.** 3 market-report subscriptions exist, total, ever (8 sends, 6 opens, 2 clicks — `email_events` where `send_type='market-report'`). 144 expired listings detected, **0 outreach SMS ever sent** (`expired_listings.outreach_sms_sent_at` all null). The best-instrumented funnel on the site has effectively never been fed.
2. **The email's destination is a buyer page.** "SEE THE FULL BEND REPORT →" lands on `/cities/bend`, whose hero is "BEND HOMES FOR SALE" with a buyer search bar ([assets/mr-cities-bend-mobile-01-hero.png](assets/mr-cities-bend-mobile-01-hero.png)). A seller was promised a report and got a storefront.
3. **The seller ask is unreachable.** On `/cities/bend` the "What's your home worth?" block sits at y≈19,832 of 23,066 px on mobile — the 24th screen ([assets/mr-cities-bend-mobile-03-kbsell-24-screens-deep.png](assets/mr-cities-bend-mobile-03-kbsell-24-screens-deep.png)). On `/communities/tetherow`: y≈25,938 of 29,707 — the 32nd screen. The excellent "THE MARKET, ON RECORD" section (screen 3, [assets/mr-cities-bend-mobile-02-market.png](assets/mr-cities-bend-mobile-02-market.png)) never asks the one question a homeowner reading it is already asking themselves.
4. **The interruption layer fired on report readers.** Until today's fix, an outreach recipient got the "Get the most out of Ryan Realty" OAuth modal (buyer copy: "Save searches and get new listing alerts") stacked over the cookie banner on their second pageview ([assets/mr-cities-bend-mobile-05-modal-second-pageview.png](assets/mr-cities-bend-mobile-05-modal-second-pageview.png)) — a login wall over a known, already-identified contact mid-read. **Fixed this session** (see "Fixed today").

The CMA document has its own conversion hole: **18 pages that end in disclaimers with no ask**. Zero `tel:`/`sms:`/`mailto:` links in the whole document (verified by grep of the served HTML); the phone number is plain text; there is no "book the listing consult" block ([assets/mr-cma-mobile-03-end.png](assets/mr-cma-mobile-03-end.png)).

### 2 · "Does the report I get sent engage me enough to click?" — The email body earns the click. The subject line didn't, and the weekly report page burns the trust the email builds.

- The email is data-rich and honest, and its 6-opens / 2-clicks (tiny n) at least show opens happen. But the subject was hardcoded **"Bend market update"** — the one line that decides the open never carried a number or story, while the renderer already computes a verified headline. **Fixed this session:** the subject now carries the story ("Bend home prices are down 1.2% from a year ago").
- The standalone weekly report page undoes the credibility: an **AI-generated banner with garbled chart text** — "Ratas Rales", "Caade Sales", "Housig Inventorr", "Marketd Sales" — on a page whose entire job is numeric credibility ([assets/mr-weekly-report-mobile-02-ai-banner.png](assets/mr-weekly-report-mobile-02-ai-banner.png)). This violates the ANTI_SLOP manifesto on its face. The body is a raw closed-price dump with no narrative.
- The weekly report generator is **stale**: newest report is `weekly-2026-06-28` (period ending Jul 4). The Saturday cron (`0 14 * * 6`, `/api/cron/market-report`) produced nothing on Jul 11 — a homeowner clicking "market reports" today finds an 11-day-old "weekly."
- The breadcrumb/nav collision on the report page (title printed over the wordmark) — **fixed this session** across all five no-hero article pages.

### 3 · "Am I tracking everyone I sent these to?" — Yes on the email path, yes-with-a-gap on the SMS path, and GA4 sees almost none of it.

What exists (and is genuinely strong):

- **Email sends:** every market-report email is per-recipient instrumented — open pixel (`/api/track/e/open`), signed click tokens (`/api/track/e/click`), `?agent=/_pid/_fuid` identity params, per-send `email_events` rows (sent/delivered/opened/clicked, keyed `market-report:<runId>:<personId>`), suppression + CAN-SPAM. Working: 8 sent / 6 open / 2 click events recorded.
- **SMS sends:** `instrumentSmsLinks` short-links every URL through `/r/<code>`; clicks land in `crm_timeline` as `sms_click` per person. (Unexercised: 0 sends so far.)
- **On-site:** first-party `visitor_sessions`/`visitor_events` graph with first-touch UTM, engagement scoring, identity stitching, and a hot-lead escalation cron. The CMA/BPO raw-HTML docs inject `rr-doc-tracker.js`, which logs the visit and stitches `?_pid=` to the contact.

The gaps:

- **The SMS→CMA link carries no `_pid`.** The expired-outreach action builds `SITE_URL/cma/<slug>` bare, so the short-link click is logged but the *web session* on the CMA is never stitched to the person (`rr-doc-tracker.js` only identifies when `_pid`/`_fuid` is present). One-line fix: append `?_pid=<crm_person_id>` to the CMA URL before instrumenting.
- **GA4 is blind to the outreach funnel.** No `utm_*` on outreach links → clicks land as `direct/(none)`; the raw-HTML CMA pages fire no GA4 at all (only the first-party tracker). GA4 shows zero rows for `/cma/*` in 90 days while the first-party graph holds 13 events. Not fatal (first-party is the system of record) but it means GA4 dashboards understate everything about outreach.
- **Dev-only note:** on localhost the doc-tracker beacons 403 (origin allowlist) — expected, production origins pass.

### 4 · "Can I see where they went and if they converted?" — The journey view exists (`/admin/visitors/[sessionId]`, person timeline on `/admin/crm/[id]`). The conversion record was lying about its source — fixed today.

- Every identified session's page-by-page trail is visible at `/admin/visitors/live` and `/admin/visitors/[sessionId]`; per-person engagement (opens, clicks, `sms_click`) shows on the CRM person timeline.
- But the valuation form — the funnel's conversion — recorded `source_url: '/home-valuation'` **hardcoded** for every lead, and `KbSell` dropped the originating page on hand-off. A lead from the Tetherow report page and a lead from a Facebook LP looked identical. **Fixed this session:** `KbSell` passes `from=<pathname>`, and `submitValuationRequest` records the true originating surface (same-host validated) in both the lead row and the FUB event.

### 5 · What GA4 + Search Console say (window: Apr 17 – Jul 15, 2026)

**GA4 (property 527333348):**

| Fact | Number | So what |
|---|---|---|
| Site users / 90d | 566 users, ~4.5K pageviews | The constraint is traffic, not conversion polish. Every funnel improvement is cheap to verify at this volume. |
| Report-family engagement | `/cities/bend` 209 views · 98% engagement; Tetherow/Awbrey/Broken Top 88–100% | People who reach these pages read them. The content works. |
| Report-family key events | **0 key events on virtually every cities/communities/housing-market page** | High engagement, zero conversion — consistent with the seller ask being 24+ screens deep. |
| Key events that do fire | `form_start` 150 · `valuation_requested` 44 · `generate_lead` 37 · `contact_agent` 46 | Conversions happen on LPs (`/lp/seller-home-value`: 53 key events) — where the form is the page. |
| Outreach attribution | No `sms`/outreach source rows; `direct/(none)` = 371 sessions | Outreach traffic is invisible to GA4 (see gap above). |
| Paid social | meta/paid_social 61 sessions at **39% engagement** vs 65–76% for organic/direct | Paid clicks bounce at ~2× the rate of organic — LP/audience mismatch worth a look. |

**Search Console (`https://ryan-realty.com/`):**

| Fact | Numbers | So what |
|---|---|---|
| Blog earns the demand | `sunriver-year-round-living` 1,462 impr; `vacation-rental-rules` 1,140 impr @ 0.3% CTR; `eagle-crest-affordable-resort` 851 | Content ranks. The CTR on these (0.3–1.7%) is a title/meta problem, not a ranking problem. |
| **"tetherow homes for sale" — 228 impressions, position 13.3, 0 clicks** | The single striking-distance query | `/communities/tetherow` is one push (internal links, title, fresher content) from page 1 on a listing-intent term. |
| Same class | "black butte ranch homes for sale" 141 impr @ pos 26; "broken top homes for sale" 81 impr split across TWO community pages (pos ~25) | Community pages rank pages 2–3 with self-cannibalization (parks-at-broken-top vs highlands-at-broken-top). |
| `/cities/bend` ranks 36–55 for "bend buildable lots" (67 impr), "bend gated community homes" (57), "bend resort homes for sale" (56) | Wrong page for the query | These deserve dedicated hub pages (gated / golf / resort / land) — the demand is measured, not guessed. |
| Legacy WP URL still ranks | `/bend-oregon-market-report-may-2026/` 1,514 impr @ pos 8.5, **0.4% CTR** | A two-month-old report is the site's most-seen market page in Google. Redirect it to the live report hub. |
| Brand | "ryan realty" pos 29.4 (106 impr) | Mostly out-of-region homonyms, but worth watching. |

---

## What was fixed today (all browser-verified, gates green)

| # | Fix | Files | Verified |
|---|---|---|---|
| 1 | **Email subject carries the verified story** ("Bend home prices are down 1.2% from a year ago" instead of the static "Bend market update"); falls back to the plain framing when the headline engine has no story | [lib/crm/market-report-email.ts](../../lib/crm/market-report-email.ts) | 34/34 unit tests pass, incl. 3 new subject cases |
| 2 | **Outreach recipients never see the sign-in modal.** `?agent=`/`?_pid=`/`?_fuid=` arrivals set the 24h dismissal — a known contact is never login-walled mid-report | [components/SignInPrompt.tsx](../../components/SignInPrompt.tsx) | Live: attributed landing writes dismissal; second pageview shows no dialog |
| 3 | **Seller-lead source truth.** `KbSell` passes `from=<pathname>`; the valuation action records the real originating page (same-host validated) in the lead row + FUB event instead of the hardcoded constant | [components/site/kb/KbSell.client.tsx](../../components/site/kb/KbSell.client.tsx), [app/home-valuation/actions.ts](../../app/home-valuation/actions.ts) | tsc + gates; path validated same-host, falls back safely |
| 4 | **No-hero pages no longer collide with the fixed nav.** New `belowNav` breadcrumb variant + clearance CSS + long-crumb wrapping; solid nav on the reports surfaces | [KbBreadcrumb.tsx](../../components/site/kb/KbBreadcrumb.tsx), [kb.css](../../components/site/kb/kb.css), reports/blog/guides pages | Live: blog + weekly report crumb clears nav (68px > 50px), title wraps |
| 5 | **Weekly report dates humanized** ("Jun 28, 2026 to Jul 4, 2026" not "2026-06-28 to 2026-07-04"); removed the triplicate date line | [app/reports/[slug]/page.tsx](../../app/reports/%5Bslug%5D/page.tsx) | Live screenshot |
| 6 | Gate-chain restoration: `ci:gates` was red at HEAD (design-tokens, listing-key-lookup, hydration line-drift, console-kit, producer dash, email-send line-drift, css-layers line-drift, file-size). All green now — fixes + sanctioned re-baselines only, zero new violations | various `scripts/*` baselines, EmailBodyEditor ds-Buttons, 3 `@canonical-key` annotations | `npm run ci:gates` exits 0 |

---

## Ranked: what hurts conversion most (P0 → P2, this funnel)

Tagged **u**nderstanding / **t**rust / **c**onversion. The honest count from this focused pass is 18 open items after today's six fixes; padding to a round number would bury the signal. The 2026-07-12 full-site register in [README.md](README.md) carries the site-wide backlog.

| # | Sev | hurts | Finding | Specific fix | Effort |
|---|:-:|:-:|---|---|:-:|
| 1 | P0 | c | **The funnel has no audience.** 3 subscribers ever; 144 expired owners detected, 0 first-touch SMS sent. Everything else on this list is moot at n≈0 | Ops, not code: start the expired sends (guards + CMA + tracking are already built and gated), and put the market-report opt-in in front of every seller-ish contact (CMA deliveries, valuation leads, closed clients, LP submissions) — a one-tap "monthly report for your neighborhood" enrollment | ops |
| 2 | P0 | c·u | **Seller emails land on buyer pages.** The email CTA promises "the full report"; `/cities|/communities` heroes sell buyer search | Give the email CTA a seller-framed destination: either a `?view=report` mode that reorders the geo page (market HUD first, valuation block second), or point it at `/housing-market/<geo>` styled as the report | med |
| 3 | P0 | c | **The valuation ask is 24–32 screens deep on geo pages** while "THE MARKET, ON RECORD" (screen 3) never asks anything | Add a one-line ask inside/after the market HUD: "What does this market mean for your home? Get your number →" linking to valuation with `from` attribution (now wired) | small |
| 4 | P0 | t | **AI-garbled banner on weekly reports** ("Ratas Rales", "Housig Inventorr") — fabricated-looking charts on a data-credibility page; ANTI_SLOP violation | Replace the generator's AI banner with the canonical hero crop or a real satori-rendered stat card (the email chart renderer already exists at `/api/email/market-chart`) | small |
| 5 | P1 | c | **The CMA ends with no ask and no tappable contact.** 18 pages, zero `tel:`/`mailto:` links, closes on disclaimers | Add a closing block to the CMA builder: broker card + `tel:` / `sms:` / "book the listing consultation" + "reply to the text that brought you here." (Builder is §0-locked — route through the CMA producer skill) | med |
| 6 | P1 | c·t | **Weekly report generation is stale** (newest period ended Jul 4; the Jul 11 Saturday cron produced nothing) | Check `/api/cron/market-report` run logs on Vercel for the Jul 11 firing; add a freshness alarm like the market-stat-consistency cron's | small |
| 7 | P1 | c | **SMS→CMA click never stitches the web session** (no `_pid` on the sent URL) | In `sendExpiredIntroAction`, build `docUrl` as `/cma/<slug>?_pid=<personId>` before `instrumentSmsLinks` | small |
| 8 | P1 | c | **Outreach is invisible in GA4** (no UTM on email/SMS links → `direct/(none)`) | Add `utm_source=crm&utm_medium=email|sms&utm_campaign=market-report|expired` in `attributeOutbound`/short-link targets; first-party params already survive | small |
| 9 | P1 | c | **"tetherow homes for sale" pos 13, 228 impr, 0 clicks** + Broken Top query split across two pages | Internal links from `/communities` + homepage to Tetherow with exact anchor; canonicalize one Broken Top page for the head term; refresh titles to lead with "Homes for Sale" | small |
| 10 | P1 | c | **Blog CTR 0.3–1.7% on 1,000+ impression posts**; the reports/`/cities` pages get impressions with no clicks | Rewrite titles/meta of the top-10 impression pages to carry a number + the year ("Sunriver year-round living: what it costs in 2026") | small |
| 11 | P1 | c | **Legacy WP market-report URL** (1,514 impr, pos 8.5) resolves stale content from the pre-cutover site | 301 `/bend-oregon-market-report-may-2026/` (and siblings in the GSC pull) to `/housing-market/reports` via legacy-redirects.json | small |
| 12 | P2 | c | **No dedicated pages for measured demand**: "bend buildable lots", "bend gated community homes", "bend golf course homes", "bend resort homes for sale" all rank `/cities/bend` at pos 36–55 | Ship 3–4 collection hubs (land/lots, gated, golf, resort) fed by existing DAL filters; link from the Bend page | med |
| 13 | P2 | c | Weekly report body is a raw price dump (a list of closed prices per city, no narrative, no per-city links) | Have the generator write one verdict line per city (same `meaningLine` logic as the email) and link each city block to its geo page | med |
| 14 | P2 | t | Report email `senderBroker` close card requires the subscription to carry a broker; 3 current subs may render without the human face | Default `senderBroker` to Matt when the subscription has none | small |
| 15 | P2 | c | Meta paid traffic engages at 39% vs 65–76% organic | Review ad→LP promise match; UTM-split ad sets to find which creative bounces | med |
| 16 | P2 | u | Two admin surfaces for the same funnel (`/admin/expired-outreach` and `/admin/expireds`) — with in-flight uncommitted edits on the former | Finish the consolidation the 4f218e9d commit started (this session left those files untouched) | — |
| 17 | P2 | c | `/cities/bend/awbrey-butte`-class neighborhood pages have the same buried-ask template as cities | Same fix as #3 — the market-HUD ask lands on all KB geo templates at once | — |
| 18 | P2 | t | GA4 double-counts event taxonomy (`city_view`+`view_city`, `community_view`+`view_community`, duplicate `scroll_depth`/`section_view` streams) | Pick one name per event; migrate before making decisions on event counts | small |

**Quick wins still on the table for today-sized sessions** (beyond the 6 shipped): #3, #4, #6, #7, #8, #9, #10, #11, #14 — nine one-sitting items, each measurable within a week at current traffic.

---

## Verification traces (§0)

- **3 subscriptions / 8 sent / 6 open / 2 click / 3 recipients** — Supabase `crm_report_subscriptions` (count, `is_active`), `email_events` grouped by `event` where `send_type='market-report'`, 2026-07-15.
- **144 expired / 0 sent** — `expired_listings` count vs `outreach_sms_sent_at IS NOT NULL`, 2026-07-15.
- **0 short links / 0 sms_clicks** — `crm_short_links`, `crm_timeline WHERE kind='sms_click'`, 2026-07-15.
- **155 CMAs / 27 deliveries / 13 CMA visitor events / 0 GA4 CMA rows** — `cmas`, `cma_deliveries`, `visitor_events WHERE page_url LIKE '%/cma/%'`, GA4 `pagePath` report (0 matching rows), 2026-07-15.
- **GA4 figures** — Data API property 527333348, window 2026-04-17→2026-07-15: pagePath/screenPageViews/engagementRate/keyEvents; sessionSource/Medium; eventName×isKeyEvent. Raw pull archived in the session transcript.
- **GSC figures** — Search Analytics API, `https://ryan-realty.com/`, same window: query and page dimensions, plus page-contains filters for `housing-market`, `/cities/`, `/communities/`.
- **Bend email-preview figures** — `market_stats_cache` `city/bend` `rolling_365d` (median $725,000 · 483 active · 1,647 closed-12mo · DOM 25 · YoY 0.0%) + monthly series Nov-2025→Jun-2026; MoS = 483/(1647/12) = 3.5 → seller's (≤4 per §0 thresholds).
- **Page depths** — live DOM measurement: `/cities/bend` KbSell at y 19,832 / 23,066; `/communities/tetherow` at y 25,938 / 29,707 (390px viewport).
- **Weekly staleness** — `market_reports` max `period_end` = 2026-07-04; cron `0 14 * * 6` in vercel.json.
