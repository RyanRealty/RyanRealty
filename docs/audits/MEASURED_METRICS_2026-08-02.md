# Measured metrics — closing audit item 21

**Companion to** [`WEBSITE_AUDIT_2026-08-02.md`](WEBSITE_AUDIT_2026-08-02.md), which had to label
indexation, traffic, backlinks, and Core Web Vitals **"Not measured"** because the cloud container
held no Google credentials. This session had them.

**Access used:** `viewer@ryanrealty.iam.gserviceaccount.com`, direct (no domain-wide delegation
needed). Search Console permission level `siteOwner` on `https://ryan-realty.com/`. GA4 property
`527333348`.

**Windows.** Search Console `2026-07-03 .. 2026-07-30` (28 days, ending 3 days back because GSC
data lags), prior period `2026-06-05 .. 2026-07-02`. GA4 last 28 complete days ending
`2026-08-01`. Fetched `2026-08-02`.

---

## 1. What the audit concluded, and what the data says

The audit was careful and mostly right. Three of its conclusions change once real data is
available, and one of them changes the priority order of the whole roadmap.

### 1.1 The sitemap P0 is a real defect. Its stated impact is not.

The audit wrote that the sitemap failure means "every listing detail page and every search-matrix
page is absent from the XML submitted to Google," and the handoff called merging that fix "what
makes listing pages discoverable."

**Google's own record disagrees.** Search Console reports every child sitemap successfully
downloaded, with real URL counts and zero errors:

| Child | URLs Google has | Errors | Last downloaded |
|---|---|---|---|
| `core.xml` | 159 | 0 | 2026-08-02 |
| `geo.xml` | 2,566 | 0 | 2026-08-01 |
| `listings.xml` | **7,660** | 0 | **2026-08-01** |
| `matrix.xml` | 266 | 0 | 2026-07-29 |
| `content.xml` | 56 | 0 | 2026-07-29 |
| `/sitemap.xml` (index) | 10,707 | 0 | 2026-08-02 |

Listing URLs are not missing from Google's discovery. They were submitted the day before the
audit ran.

**The defect is still real, and it got worse, not better.** Re-probing production with a browser
User-Agent and 120s of patience:

```
core.xml      http=200  ttfb=0.41s  total=115.49s  bytes=17836   (159 <loc>)
geo.xml       http=000                    120s     bytes=0
content.xml   http=000                    120s     bytes=0
listings.xml  http=000                    120s     bytes=0
matrix.xml    http=000                    120s     bytes=0
```

`core.xml` — the cheapest child — now takes **115 seconds**. `geo.xml`, which the audit observed
serving 2,566 URLs, now returns nothing. Four of five children are dead to any normal client.

**Correct reading:** Googlebot's crawl budget tolerates a two-minute sitemap; a browser, a
monitoring check, Bing, and every AI crawler with a shorter timeout do not. The fix on this branch
is worth shipping on reliability grounds, and it is *not* the thing standing between the site and
non-brand traffic. Priority: still P0, no longer the top of the funnel.

### 1.2 "Zero non-brand discoverability" is the wrong diagnosis

The audit ran four hand-picked high-intent queries, found Ryan Realty in none, and scored LLM/AI
discoverability **2.5/10** with "0 appearances." That measurement is accurate and its
generalisation is not.

Search Console, same period:

| | Value | Prior 28d |
|---|---|---|
| Clicks | **467** | 405 |
| Impressions | **35,451** | 35,644 |
| CTR | **1.32%** | 1.14% |
| Average position | **14.5** | 14.4 |

The site was served in search results **35,451 times in 28 days**. It is not invisible. It ranks
for **1,776 distinct queries** that Google will name, of which **1,769 are non-brand**.

The real problem is *where* it ranks. Distribution across the 9,523 impressions GSC attributes to
named queries:

| Position bucket | Queries | Impressions | Share of impressions |
|---|---|---|---|
| 1–3 | 150 | 379 | 4.0% |
| 4–10 | 264 | 1,204 | 12.6% |
| 11–20 | 264 | 2,007 | 21.1% |
| **21–50** | **908** | **5,294** | **55.6%** |
| 51+ | 190 | 639 | 6.7% |

**83.4% of named-query impressions sit at position 11 or worse.** Only 16.6% reach page one.
Non-brand converts at **15 clicks from 9,483 impressions — 0.16%**, which is what page-two
ranking looks like.

> **Coverage caveat, stated because it matters.** The 1,776-query breakdown covers 9,523
> impressions, **27% of the 35,451 total**. Google withholds rare queries for privacy, so 73% of
> impressions cannot be attributed to a named query. The distribution above describes the named
> subset, not the whole. It should not be restated as "the site's ranking distribution."

**Correct reading:** this is not an absence problem, it is a page-two problem. That is a materially
better position to start from than the audit implies, and it points at the same remedy (items
9–11) for a different reason: the site already has topical reach and needs the authority to move
it up, not initial visibility.

### 1.3 Brand demand is close to zero, which the audit read as a strength

The audit noted brand queries "do resolve" and treated the entity as known. Measured, the
unqualified brand term is thin:

```
"ryan realty"  (USA)  impressions=23  clicks=3  CTR=13.0%  avg position=38.3
```

**23 impressions in 28 days.** The 13% CTR alongside position 38.3 is not a contradiction: GSC
averages the best position per impression, so a handful of top-position impressions (which earned
the clicks) sit beside many deep ones. "Ryan Realty" is a generic name with other US businesses
using it, so a poor average on the unqualified term is expected and is **not** a defect to chase.

The number that matters is 23. Nobody is searching for the brand. Brand-query health is not a
lever here; non-brand rank is.

---

## 2. The blog is the strongest organic asset, measured

The audit called `/blog` the "weakest strategic surface" (12 posts, 9 of them market reports) and
reasoned from competitor observation that long-form editorial was the gap. **Ryan Realty's own
Search Console data proves the point far more directly.**

Top pages by clicks:

| Page | Clicks | Impressions | Avg position |
|---|---|---|---|
| `/blog/sunriver-year-round-living-vs-vacation` | **21** | 1,336 | 6.6 |
| `/?utm_source=gbp…` (Google Business Profile) | 11 | 417 | 10.0 |
| `/` | 9 | 613 | 29.3 |
| `/blog/eagle-crest-affordable-resort-redmond` | 8 | 479 | 7.8 |
| `/homes-for-sale/bend/boonesborough/64561-joe-neil-22022544` | 8 | 30 | 4.7 |
| `/blog/raising-kids-bend-parents-guide` | 7 | 277 | 4.5 |
| `/blog/vacation-rental-rules-bend-deschutes` | 4 | 347 | 8.9 |

**7 of the top 20 pages are blog posts, and they hold the best positions on the site** (4.5–8.9,
versus 14.5 site-wide). The single best-performing URL is a long-form editorial piece about a named
community — exactly the shape audit item 11 proposes for the 14 Bend neighborhoods and 14 resort
communities.

This is the strongest evidence in either document for items 9–11, and it is evidence from Ryan
Realty's own traffic rather than from inference about competitors.

---

## 3. GA4 — traffic, and an unusually good engagement profile

| Metric | 28 days |
|---|---|
| Sessions | **256** |
| Total users | 201 |
| Page views | 1,380 |
| Engagement rate | **78.1%** |
| Bounce rate | 21.9% |
| Average session duration | **787s (13m 07s)** |

Channels: Organic Search 95 · Direct 87 · Unassigned 55 · Paid Social 13 · **AI Assistant 5** ·
Organic Social 1 · Organic Video 1.

Two things stand out.

**Engagement is exceptional and volume is tiny.** A 78.1% engagement rate with a 13-minute average
session is far above real-estate norms. People who arrive stay and read. Combined with §1.2, the
diagnosis is consistent and narrow: the product is good, distribution is the constraint. Nothing in
this data supports rebuilding anything.

**GA4 already attributes an `AI Assistant` channel — 5 sessions.** LLM referral is not zero, and it
is measurable. That gives items 9–11 a real baseline to be judged against instead of a proxy.

`/auth-error` (3 sessions) and `/login` (3) appearing as landing pages is worth a look; it is out
of scope here and not investigated.

---

## 4. The one metric still not measured

**Core Web Vitals field data.** Blocked twice, on two different paths:

- The CrUX API rejects the available key: `403 — Requests to this API chromeuxreport.googleapis.com
  … are blocked`. The key present in the environment is the Maps key, which does not have the CrUX
  API enabled.
- The PageSpeed Insights API returns `429 — Quota exceeded for quota metric 'Queries' … of service
  'pagespeedonline.googleapis.com'` on the shared anonymous quota, on four attempts across two form
  factors with a 45s backoff.

There is no Search Console API surface for the Core Web Vitals report, so this cannot be routed
around.

**One-step fix:** enable the *Chrome UX Report API* (and/or *PageSpeed Insights API*) on the
`ryanrealty` Google Cloud project and issue a key with it enabled. Both are free. Then
`scripts/` can pull p75 LCP/INP/CLS directly. Until then CWV stays a lab-only proxy, as the audit
had it.

---

## 5. Scorecard rows the audit could not fill

| Audit row | Was | Now measured |
|---|---|---|
| Indexation / sitemap health | "2 of 5 reliable" | 5 of 5 accepted by Google, 10,707 URLs submitted; 4 of 5 unreachable to normal clients |
| Traffic | Not measured | 256 sessions / 201 users / 28d |
| Bounce | Not measured | 21.9% (engagement 78.1%) |
| Dwell | Not measured | 787s average session |
| Non-brand SERP presence | "0 of 4 queries" | 1,769 non-brand queries, 9,483 impressions, 15 clicks, 83.4% at position 11+ |
| Search clicks / impressions | Not measured | 467 / 35,451, CTR 1.32%, avg position 14.5 |
| Core Web Vitals field data | Not measured | **Still not measured** — API not enabled (§4) |
| Backlink profile | Not measured | **Still not measured** — needs Ahrefs/Semrush, no access |

---

## 6. What this changes about the roadmap

1. **Ship the sitemap fix on reliability grounds, not discovery grounds.** A 115-second `core.xml`
   and four dead children is a real defect. It is not why non-brand traffic is low.
2. **Items 9–11 move from "highest available impact" (inferred) to "highest available impact"
   (measured).** The blog already outranks everything else the site publishes. More of it, aimed at
   the named neighborhoods and communities, is the one intervention this data actively supports.
3. **The goal metric is average position on non-brand queries, not appearance.** The site appears
   35,451 times a month. Moving the 908 queries in the 21–50 bucket up is the measurable objective,
   and Search Console can now report it every cycle.
4. **Enable the CrUX API** so the last proxy becomes measured.

## Reproducing

`scripts/measure-search-and-analytics.mjs` (added with this document) re-runs everything above and
prints the same tables. It needs `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL`,
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, and `GOOGLE_GA4_PROPERTY_ID` in the environment. It is
read-only.
