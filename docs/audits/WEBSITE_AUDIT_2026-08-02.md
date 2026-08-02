# ryan-realty.com — independent website audit

**Observation window:** 2026-08-02, 14:30–16:10 UTC. All live figures were captured inside that
window. The site serves live MLS data and changes continuously, so any number below is a
point-in-time reading.

**Method.** Live HTTP against the production origin (browser user-agent; raw HTML inspected
directly, not through a rendering proxy), plus read access to the application source in this
repository. The source access matters: it turns "the title looks wrong" into a file and line
number. Where a metric could not be measured directly, it is labeled a proxy and the proxy is
named.

**Tool limits, stated up front.** No Google Search Console, no Google Analytics, no paid SEO
platform (Ahrefs/Semrush), no lab Lighthouse run, no CrUX field data. So: indexed-page counts,
real backlink profiles, actual Core Web Vitals, bounce, and dwell are **not measured**. Where
those would normally answer a question, the report says so rather than substituting a guess.

Three premises in the audit brief were tested and found incorrect. They are corrected in §1
because they would otherwise misdirect the whole remediation plan.

---

## 1. Executive summary

The brief anticipated a thin, client-rendered brochure site with inconsistent contact details.
That is not what is deployed. **The engineering baseline here is stronger than every Bend
competitor benchmarked in §6** — server-rendered, fast, comprehensively schema'd, and with an
explicitly AI-crawler-friendly `robots.txt`.

The problem is not the building. It is that almost nobody is walking past it.

### Three brief premises, corrected

| Brief premise | Finding | Evidence |
|---|---|---|
| "Homepage and many pages appear heavily client-side rendered" | **False.** Fully server-rendered. Live market numbers are present in raw HTML with no JS execution. | `curl` of `/` returns `1,843`, `$740,000`, `95.2` in the byte stream; 506 KB of server HTML |
| Site has `/buyers/`, `/seller-plans/`, `/about-us/`, `/guides/`, `/explore/`, `/join-us/` | **Stale.** These are legacy URLs from the prior site. Most 301 correctly to current routes. `/buyers/` is the one genuine 404. | §2 redirect table |
| "Phone/address variations already observed" | **Not reproduced.** NAP is consistent across all 20 pages audited. | §5 NAP row |

### Scores

| Category | Score | Basis |
|---|---|---|
| Technical foundation (rendering, speed, markup) | **8.5 / 10** | SSR, TTFB 0.24–0.64s, 2 JSON-LD blocks/page, clean canonicalization |
| Crawl & indexation plumbing | **3.5 / 10** | 3 of 5 sitemaps never respond; duplicate broker URLs |
| On-page SEO hygiene | **6 / 10** | Every page has title/description/canonical/one H1, but titles overrun and descriptions truncate mid-word |
| Content depth & topical authority | **5 / 10** | Excellent structured market data; only 12 blog posts; no long-form neighborhood editorial |
| Data accuracy & transparency | **9.5 / 10** | Methodology published inline; figures reconcile to the canon formula and to third-party market reporting |
| Conversion & UX | **7.5 / 10** | Clear CTAs, low form friction, strong social proof |
| Accessibility | **7.5 / 10** | `lang`, skip links, single H1, all images have `alt`, no unlabeled buttons |
| Off-page authority | **3 / 10** (proxy) | Brand queries resolve; non-brand queries return nothing |
| **LLM / AI discoverability** | **2.5 / 10** | **0 appearances across 4 high-intent non-brand queries** |
| **Overall** | **5.5 / 10** | A high-quality site with a distribution problem |

### The five things that matter

1. **Three of five sitemaps are dead.** `listings.xml`, `matrix.xml`, and `content.xml` return
   *nothing* — HTTP 000, zero bytes, after 100 seconds. Reproduced across four attempts.
   This is the single highest-impact defect on the site.
2. **Zero non-brand discoverability.** Four high-intent queries, zero appearances. Competitors
   with objectively worse websites occupy every slot.
3. **Broker pages are duplicated 5+ ways**, each self-canonicalizing — traced to one line.
4. **An em dash ships in every page title**, violating the brand canon, because the gate meant
   to catch it never checks punctuation.
5. **The data layer is genuinely excellent** and is the strongest available lever for #2.

---

## 2. Site inventory and link map

### Scale

- **281 `page.tsx` route files**; ~130 unique public route patterns after excluding
  `/api`, `/admin`, `/dashboard`, `/account`.
- **Sitemap index** (`/sitemap.xml`, 705 B) declares five children.

| Child sitemap | URLs | Status |
|---|---|---|
| `core.xml` | **159** | Serves |
| `geo.xml` | **2,566** | Serves |
| `content.xml` | ~30 | **Intermittent** — failed twice, served once (7,321 B) |
| `listings.xml` | unknown | **Never served** in testing |
| `matrix.xml` | unknown | **Never served** in testing |

`geo.xml` composition: 1,814 `/homes-for-sale/*`, 502 `/subdivisions/*`, 116
`/central-oregon/*`, 59 `/oregon/*`, 56 `/schools/*`, 19 `/parks/*`.

`/blog` is **absent from `core.xml`** — blog content is routed to the unreliable `content.xml`.

### Legacy redirect map (verified)

| Legacy URL | Final | Status |
|---|---|---|
| `/featured-properties/` | `/our-homes` | 200 |
| `/properties/` | `/homes-for-sale` | 200 |
| `/explore/` | `/communities` | 200 |
| `/about-us/` | `/about` | 200 |
| `/matt-ryan/` | `/team/matt-ryan` | 200 |
| `/sellers/` | `/sell` | 200 |
| `/seller-plans/` | `/sell#marketing-plan` | 200 |
| `/join-us/` | `/join` | 200 |
| `/guides/` | `/blog` | 200 |
| **`/buyers/`** | — | **404** |
| **`/sitemap/`** | `/` | 200 — **soft-404 pattern**, see §4 |

`https://www.` and `http://` both canonicalize to `https://ryan-realty.com`. Correct.

### Link integrity

- **978 unique internal links** harvested across the 20 audited pages. Dense internal linking.
- **40-link random sample: 40/40 returned HTTP 200.** No broken internal links found.
- **External outbound links: one editorial link site-wide** (`oldmilldistrict.com`). Everything
  else is analytics, Supabase, or own-brand social. See §7 — this suppresses a signal LLMs use.

---

## 3. Page-by-page objectives and performance

All 20 pages: HTTP 200, server-rendered, canonical present, meta description present, **exactly
one H1**, 2 JSON-LD blocks, no accidental `noindex`.

| Page | Objective | Assessment |
|---|---|---|
| `/` | Orient + route to search/valuation | **Strong.** Leads with six live town stats. Shows rather than claims. 6,854 words rendered |
| `/buy` | Buyer lead capture | **Strong.** `FAQPage` + `BreadcrumbList`. Title 73 chars (truncates) |
| `/sell` | Seller lead capture | **Strongest commercial page.** 9,370 words, 14 H2s, 131 `aria-label`s. Description truncates mid-word at "Request a fr" |
| `/housing-market` | Topical authority hub | **High potential, under-exploited.** Carries `Dataset` + `Place` schema — the correct choice. This is the LLM-citation asset |
| `/housing-market/bend` | City market data | **Best page on the site for citation.** Publishes formula and thresholds inline |
| `/reviews` | Trust | 24 `Review` objects, count matches markup. But rating is self-serving (§4) and title duplicates the brand |
| `/team`, `/team/[slug]` | Trust, attribution | Content good; **URL layer duplicated 5+ ways** (§4) |
| `/faq` | Informational capture | Correct `FAQPage`. Good LLM-extractable shape |
| `/blog` | Topical authority | **Weakest strategic surface.** 12 posts, 9 of which are monthly market reports |
| `/contact` | Conversion | Lean (2,281 words). `ContactPage` schema |
| `/communities`, `/cities` | Geo hubs | 491 KB / 218 KB. Good internal-link equity distribution |
| `/homes-for-sale` | Search entry | **996 KB HTML** — heaviest page. See §5 |
| `/luxury-homes-bend` | High-value segment | Well-targeted; thin at 2,943 words for the competitiveness of the term |
| `/sell/valuation` | Primary lead magnet | Low friction. Good |

---

## 4. Full SEO and technical audit

### P0-1 — Three of five sitemaps never respond

Reproduced four times across ~40 minutes:

```
/sitemaps/listings.xml   http=000  ttfb=0.000000  bytes=0   (100s, 60s)
/sitemaps/matrix.xml     http=000  ttfb=0.000000  bytes=0   (100s, 60s)
/sitemaps/content.xml    http=000  ttfb=0.000000  bytes=0   → later 200, 7,321 B
```

`ttfb=0.000000` with `bytes=0` means **no response headers were ever sent** — the function died
before writing anything.

**Root cause**, from `app/sitemaps/[cls]/route.ts`: every child request calls `buildAllUrls()`
across the entire ~10.7K-URL universe and *then* filters to its class (lines 55–69). The
`listings` class alone is ~7.6K rows. No `maxDuration` is configured on the route, so it inherits
the platform default and is killed mid-build.

This is a **self-perpetuating failure**. The file's own comment says the fix was to move
generation out of the build and let it "render on first request and cache for an hour." But the
first request never completes, so `unstable_cache` is never written, so the next request is cold
too — forever. The build-time timeout was traded for a permanent runtime one.

**Impact:** every listing detail page and every search-matrix page is absent from the XML
submitted to Google. Discovery falls back entirely to internal linking.

> Note the comment's own assumption — "Google re-requests a slow sitemap." A sitemap that never
> sends a byte is not slow; it is unreachable. Retry does not help.

**Fix:** build per-class directly instead of building-all-then-filtering, set an explicit
`maxDuration`, and split `listings` into paginated children under the 50K/50MB limit. Warm via
cron rather than on user request.

### P0-2 — Broker pages duplicate across 5+ URLs, all self-canonicalizing

| URL | HTTP | Canonical |
|---|---|---|
| `/team/matthew-ryan` | 200 | `…/team/matthew-ryan` |
| `/team/matt-ryan` | 200 | `…/team/matt-ryan` |
| `/team/matt` | 200 | `…/team/matt` |
| `/team/rebecca-peterson` | 200 | `…/team/rebecca-peterson` |
| `/team/rebecca-ryser-peterson` | 200 | `…/team/rebecca-ryser-peterson` |
| `/team/paul`, `/team/paul-stevenson` | 200 | self |

`BROKER_SLUG_ALIASES` (`lib/data/brokers/getBrokers.ts:145`) maps 10 aliases onto 3 brokers.
Every alias renders a full 200 page that declares *itself* canonical.

**Root cause — one line.** `app/team/[slug]/page.tsx:77`:

```ts
const canonical = `${siteUrl}/team/${slug}`   // ← requested slug, not resolved
```

The same file already computes the resolved slug at line 262 (`normalizeAgentSlug`) and uses it
at line 296. `generateMetadata` simply doesn't use it.

This splits authority for the site's most important E-E-A-T pages. Google indexes
`/team/matt-ryan` while the sitemap advertises `/team/matthew-ryan`.

**Fix:** canonical to the resolved slug; 301 aliases to canonical.

### P1-1 — Em dash in every page title; the gate that should catch it doesn't

`app/layout.tsx:44`:

```ts
template: "%s | Ryan Realty — Central Oregon Real Estate",
```

CLAUDE.md §2 lists the em dash (U+2014) as a hard fail on all public-facing copy. It is present
in **20 of 20** page titles.

**Why the gate missed it.** `scripts/brand-voice-vocabulary.cjs:23` defines and exports
`PUNCTUATION` (em dash, en dash). `scripts/check-brand-voice.mjs` imports the vocabulary — and
references `PUNCTUATION` **zero times**. It checks `BANNED_WORDS` and `BANNED_PATTERNS` only.

So CLAUDE.md §6 lists this rule as "gated," and it is not. The em-dash, en-dash, semicolon, and
dramatic-colon rules are unenforced across the entire codebase. `app/layout.tsx` is **not** in
the gate's exclusion list — it would be scanned if the check existed.

Per §6 ("if a guardrail keeps being violated, the answer is a new mechanical gate"), the fix is
to wire `PUNCTUATION` into the scanner, then fix the fallout.

Also 6 em dashes render in homepage body text.

### P1-2 — Meta descriptions truncate mid-word at exactly 155 characters

| Page | Len | Ends |
|---|---|---|
| `/sell` | 155 | `…Request a fr` |
| `/about` | 155 | `…The broker you ` |
| `/team` | 155 | `…from first cal` |
| `/join` | 155 | `…a written report every wee` |
| `/housing-market` | 155 | `…Updated ev` |

Verified in served HTML, not an extraction artifact. `/` (176) and `/faq` (154) are unaffected,
confirming a hard 155-char cut rather than authored copy. Truncate on a word boundary with an
ellipsis, or author to length.

### P1-3 — Titles overrun the SERP display limit

12 of 20 exceed 60 characters. The 42-character suffix `| Ryan Realty — Central Oregon Real
Estate` consumes most of the budget.

| Len | Title |
|---|---|
| 105 | `Central Oregon Real Estate Blog \| Market Insights and Guides \| Ryan Realty — Central Oregon Real Estate` |
| 103 | `Matt Ryan · Ryan Realty LLC — Central Oregon real estate \| Ryan Realty — Central Oregon Real Estate` |
| 100 | `Central Oregon Cities: Bend, Redmond, Sisters, Sunriver \| Ryan Realty — …` |
| 73 | `Client Reviews \| Ryan Realty \| Ryan Realty — Central Oregon Real Estate` |

Two distinct bugs beyond length: `/reviews` emits **"Ryan Realty | Ryan Realty"** (page title
already contains the brand, then the template appends it), and `/blog` contains "Central Oregon
Real Estate" **twice**. Shorten the suffix to `| Ryan Realty` and strip brand from page titles.

### P1-4 — Self-serving AggregateRating

`/reviews` attaches `AggregateRating` (5.0, 24 reviews) to the `RealEstateAgent` entity — the
business rating itself on its own site. Google's structured-data policy excludes self-serving
reviews for `LocalBusiness` subtypes from review rich results.

To be fair: this is **honestly implemented** — 24 `Review` objects are rendered and
`reviewCount` matches exactly. It is not deceptive. But it will not earn stars, and it carries
avoidable policy risk. Keep the `Review` markup; drop `AggregateRating` from the self-referential
entity and point to third-party profiles instead.

### P2 items

- **`/sitemap/` → `/`** (homepage). Google has it indexed as "Comprehensive Real Estate Website
  Sitemap." Redirecting an indexed page to the homepage is the classic soft-404 pattern. Point
  it at `/site-index`, which is the real equivalent.
- **`/buyers/` 404s** while `/sellers/` redirects. Asymmetric. Add the redirect to `/buy`.
- **Three `/lp/` sitemap entries carry trailing slashes** (`/lp/bend/`, `/lp/tetherow/`,
  `/lp/tetherow/heath/`) that the site 308-redirects. Sitemaps should list final URLs.
- **No `preconnect`** for `cdn.resize.sparkplatform.com`, which serves 9 image requests on the
  homepage. One line, measurable LCP benefit.

### Confirmed strengths

- **Rendering:** SSR throughout. This is the single biggest advantage over competitors and the
  precondition for AI crawlers, most of which do not execute JavaScript.
- **`robots.txt` is best-in-class for AI.** Explicitly allows `GPTBot`, `OAI-SearchBot`,
  `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `Claude-User`, `Claude-Web`, `PerplexityBot`,
  `Perplexity-User`, `Google-Extended`, `Applebot-Extended`, `CCBot`, `meta-externalagent`,
  `Amazonbot`, `Bytespider`, `YouBot`. **Nothing is blocking AI discovery at the crawl layer.**
- **Schema breadth:** `RealEstateAgent`, `WebSite`+`SearchAction`, `BreadcrumbList`, `FAQPage`,
  `Dataset`, `Place`, `CollectionPage`, `AboutPage`, `ContactPage`, `Blog`, `ItemList`, `Review`.
- **Security headers:** HSTS 63072000, CSP, `X-Frame-Options: DENY`, `nosniff`,
  `strict-origin-when-cross-origin`.

---

## 5. Metrics scorecard

| Metric | Result | How measured |
|---|---|---|
| TTFB (20 pages) | **0.25–0.64s**, median ~0.31s | Direct, `time_starttransfer` |
| Full response time | 0.42–0.73s | Direct |
| HTML weight | 128 KB–**996 KB** (`/homes-for-sale`); median ~190 KB | Direct |
| Rendering | Server-side, all pages | Raw HTML inspection |
| Core Web Vitals (LCP/INP/CLS) | **Not measured** | No CrUX/Lighthouse access |
| LCP readiness (proxy) | Good — `preload` on hero + 3 fonts, `fetchPriority="high"` | HTML inspection |
| CLS risk (proxy) | Low-moderate — 22 raw `<img>` vs 5 `next/image` | HTML inspection |
| Images with `alt` | **100%** (0 missing of 22) | Direct |
| Lazy loading | 17 of 22 images | Direct |
| Third-party origins | 3 (GTM, Facebook, Spark CDN) — **lean** | Direct |
| `preconnect` hints | **0** | Direct |
| Indexability | 0 unintended `noindex` across 20 pages | Direct |
| Canonical coverage | 20/20 | Direct |
| Title present | 20/20; **12 over 60 chars** | Direct |
| Description present | 20/20; **5+ truncate mid-word** | Direct |
| H1 discipline | Exactly 1 on every page | Direct |
| Structured data | 2 JSON-LD blocks/page, 12+ types | Direct |
| Internal links | 978 unique; **40/40 sample HTTP 200** | Direct |
| Outbound editorial links | **1** | Direct |
| Sitemap health | **2 of 5 reliable** | Direct, 4 attempts |
| NAP consistency | **Consistent** — 541.703.3095 primary; 115 NW Oregon Ave #2, Bend, OR 97703 | Direct, 20 pages |
| Accessibility | `lang="en"`, skip links, 22–131 `aria-label`, 0 unlabeled buttons | Direct |
| WCAG conformance | **Not measured** (no axe/contrast tooling) | — |
| Reviews | 24 rendered, 5.0 average | Direct |
| Content freshness | Blog current to Jul 18 2026; market data live | Direct |
| Blog volume | **12 posts** | Direct |
| Backlink profile | **Not measured** | No Ahrefs/Semrush |
| Traffic / bounce / dwell | **Not measured** | No GA4/GSC |
| **Non-brand SERP presence** | **0 of 4 queries** | Direct |

### Data accuracy (CLAUDE.md §0) — passes

I checked whether the published numbers survive scrutiny, since competitors were reporting
Bend months-of-supply of 3.2–3.4 while the homepage showed 5.9.

**No discrepancy.** The 5.9 figure is region-wide Central Oregon; `/housing-market/bend` shows
**3.7 months** for Bend proper — consistent with third-party reporting. Region-wide is higher
because La Pine, Prineville, and Madras absorb more slowly. Both verdicts match the canon
thresholds (≤4 seller's, 4–6 balanced): Bend 3.7 → "seller's market" ✓; Central Oregon 5.9 →
"balanced" ✓.

The Bend page states its methodology inline: *"Months of supply is active inventory divided by
the homes closed in the last 6 months, then divided by 6"* — matching the §0 formula exactly,
with source attribution to Oregon Data Share and Morgan Data Shuttle.

**This is the most citable asset on the site**, and §7 explains why it isn't being cited.

---

## 6. Competitor benchmark

Measured directly, 2026-08-02. "Visibility" = appearances across the four queries in §7.

| Domain | HTTP | TTFB | HTML | JSON-LD | Visibility |
|---|---|---|---|---|---|
| **ryan-realty.com** | 200 | **0.31s** | 494 KB | **2 blocks, 12+ types** | **0 / 4** |
| skjersaagroup.com | 200 | 2.39s | 101 KB | 1 | 2 / 4 |
| abrestate.com | 200 | 0.24s | **1,033 KB** | 1 | 1 / 4 |
| bendrelo.com | 200 | 2.00s | 270 KB | 1 | 1 / 4 |
| movetobend.com | 301 | 0.80s | — | — | 3 / 4 |
| bendpremierrealestate.com | 302 | 1.27s | — | — | 2 / 4 |
| enjoybendlife.com | 301 | 0.25s | — | — | 2 / 4 |
| bendpropertysource.com (Ladd) | 301 | 0.30s | — | — | 1 / 4 |
| gobend.com | 301 | 0.28s | — | — | 1 / 4 |

**The finding is stark: Ryan Realty has the best technical profile and the worst visibility.**
It is faster than 5 of 8, has more structured data than all of them, and appears in none of the
queries they appear in.

This decisively rules out technical quality as the cause. Sites 8× slower with a third of the
markup outrank it. The differentiator is **published editorial depth and citation footprint** —
competitors have years of long-form, named-neighborhood, regularly-updated blog content that
accumulated links and mentions.

**Where Ryan Realty already wins:** live per-city data with a published methodology, real
sale-to-list and days-to-pending figures, transparent seller plans, and 502 subdivision pages.
Competitors publish monthly prose summaries; this site publishes a queryable data layer.

---

## 7. LLM / AI discoverability

### The core question

> *If a user or another LLM asked an AI system "teach me about / recommend resources for Central
> Oregon real estate," would ryan-realty.com surface, be cited, or be recommended?*

**No. Not today.** With reasonable confidence, based on four grounded searches with zero
appearances.

### Evidence

| Query | Ryan Realty? | Who surfaced |
|---|---|---|
| "best resources to learn about Central Oregon real estate market Bend Oregon" | **Absent** | gocentraloregon, gobend, skjersaagroup, movetobend, abrestate, enjoybendlife, bendrelo |
| "Bend Oregon housing market 2026 median home price trends" | **Absent** | Houzeo, Movoto, Zillow, Redfin, Bend Source, bendpremierrealestate, movetobend |
| "trusted realtors Central Oregon best real estate agent Bend" | **Absent** | Yelp, Clever, FastExpert, EffectiveAgents, Coldwell Banker |
| "best neighborhoods in Bend Oregon for families…" | **Absent** | bendpremierrealestate, allthingsbend, gregpowellhomes, eliteoregonhomes, movingtobend, isellbendoregon, bernardrealestategroup |

Brand queries **do** resolve: `"Ryan Realty" Bend Oregon Matt Ryan` returns `/team/matt-ryan`,
`/about`, LinkedIn, and correct license/founding details. **The entity is known. The expertise
is not.**

The fourth query is the most instructive. Ryan Realty *has* neighborhood pages —
`/cities/bend/awbrey-butte`, `/communities/northwest-crossing`, 502 subdivision pages. It was
still beaten by individual agents on generic WordPress sites, because they published long-form
editorial *articles* naming those neighborhoods, and the data pages did not.

### Why — ranked by contribution

1. **No citation footprint.** LLM retrieval is grounded in search, which is authority-weighted.
   Brand-only resolution with zero non-brand presence is the signature of a site with little
   third-party linking. *(Proxy — no backlink tool access.)*
2. **Sitemap failure removes the largest URL classes** from submitted discovery (§4 P0-1).
3. **Thin editorial layer.** 12 posts, 9 of them monthly market reports. The queries that
   surface competitors are *explanatory*, and explanatory content is what gets quoted.
4. **Data is rendered, not extractable.** The market layer is the best asset, but it is presented
   as page furniture. `Dataset` schema on `/housing-market` is a good start and is not enough.
5. **Almost no outbound citations** (one, site-wide). Documents that cite sources are treated as
   more reference-like. This site cites nothing, so nothing cites it.
6. **Duplicate broker URLs** split the strongest E-E-A-T signal (§4 P0-2).

### What is already right

**The crawl layer is not the problem, and that is genuinely good news.** Every major AI crawler
is explicitly allowed. Content is server-rendered, so non-JS-executing crawlers get the full
text. Schema is broad. Methodology is published. Numbers are verifiable and traceable.

**This site is one distribution layer away from being highly citable.** Nothing structural needs
rebuilding.

### What would change the answer

The asset competitors cannot match is the **live, per-geography, methodology-published data
layer**. Nobody else in Bend publishes months-of-supply with the formula printed next to it. The
job is to make it quotable, dated, and linkable:

- **A stable, dated, citable statistical page per geography** — "Bend housing market, August
  2026" with a fixed URL, visible last-updated timestamp, the formula, and the source. LLMs
  preferentially quote pages that state period and method.
- **Answer-shaped H2s** matching real questions: "Is Bend a buyer's or seller's market in 2026?"
  — with the number in the first sentence beneath. This is the single highest-leverage content
  change.
- **Long-form neighborhood editorial** for the 14 Bend neighborhoods and 14 resort communities.
  This is the exact gap in query 4.
- **A machine-readable endpoint** (`/data/bend-market.json`) linked from the page.
- **Outbound citation** to OHCS, Census, BLS, FRED, ORMLS. Reciprocity is real.
- **Off-site authority**: local press (Bend Source, Central Oregon Daily quote market data
  regularly and are already ranking), plus Google Business, Zillow, and Yelp profiles.

---

## 8. Prioritized improvement roadmap

Ranked by expected impact per unit of effort. "LLM impact" = effect on citation probability.

### Quick wins (< 1 day; mostly one-liners)

| # | Action | Impact | LLM impact |
|---|---|---|---|
| 1 | **Fix the sitemap timeouts** — build per class, set `maxDuration`, paginate `listings`, warm by cron | **Critical** | **High** — restores discovery for the largest URL classes |
| 2 | **Canonical to resolved broker slug** (`app/team/[slug]/page.tsx:77`) + 301 aliases | High | **High** — consolidates E-E-A-T |
| 3 | **Wire `PUNCTUATION` into `check-brand-voice.mjs`**, then remove the em dash from `app/layout.tsx:44` | Medium | Low — but closes a canon gap and fixes every title |
| 4 | **Shorten the title suffix** to `\| Ryan Realty`; strip duplicate brand from `/reviews`; de-duplicate `/blog` | Medium | Medium — titles are what get quoted |
| 5 | **Fix 155-char description truncation** — cut on word boundary | Medium | Medium |
| 6 | `/buyers/` → `/buy`; `/sitemap/` → `/site-index`; strip trailing slashes from `/lp/` sitemap entries | Low-medium | Low |
| 7 | `preconnect` to `cdn.resize.sparkplatform.com` | Low-medium (LCP) | Low |
| 8 | Drop self-serving `AggregateRating`; keep `Review` | Low | Low — removes policy risk |

### Medium-term (2–6 weeks)

| # | Action | LLM impact |
|---|---|---|
| 9 | **Dated, citable market page per geography** with visible last-updated, formula, and source | **Highest available** |
| 10 | **Answer-shaped H2s** with the number in the first sentence | **Very high** |
| 11 | **Long-form neighborhood editorial** — 14 Bend neighborhoods, 14 resort communities | **Very high** |
| 12 | Machine-readable JSON endpoint per geography | High |
| 13 | Expand `Dataset` schema across all `/housing-market/*` | Medium-high |
| 14 | Add outbound citations to OHCS, Census, BLS, FRED, ORMLS | Medium-high |
| 15 | Convert `/faq` answers to standalone indexable pages | Medium |
| 16 | Reduce `/homes-for-sale` 996 KB payload | Medium (CWV) |

### Long-term (ongoing)

| # | Action | LLM impact |
|---|---|---|
| 17 | **Weekly market report as a press-citable artifact** pitched to Bend Source / Central Oregon Daily | **Highest long-term** — earns the links that drive grounded retrieval |
| 18 | Own "months of supply in Central Oregon" as a defined term | Very high |
| 19 | Third-party profile consistency (GBP, Zillow, Yelp) + review velocity | High |
| 20 | Publish an annual Central Oregon market review as a linkable reference | High |
| 21 | Instrument GSC + GA4 and measure indexed-per-class | Enabling |

### Sequencing

**Do #1 first, alone.** Everything downstream depends on Google being able to discover pages.
Then #2–#8 as a single hygiene commit. Then #9–#11, which is where the compounding is.

---

## 9. Appendix

### A. Verification traces (§0 format)

```
1,843 active homes — ryan-realty.com homepage, raw HTML, fetched 2026-08-02 ~14:44 UTC
$740,000 median list — homepage, raw HTML, same fetch
5.9 months supply, "balanced" — homepage; matches canon (4–6 = balanced)
3.7 months supply Bend, "seller's market" — /housing-market/bend, ~15:52 UTC; matches canon (≤4)
502 active Bend SFR / $755,000 median — /housing-market/bend, same fetch
24 reviews, 5.0 — /reviews JSON-LD; reviewCount matches 24 rendered Review objects
159 core.xml URLs / 2,566 geo.xml URLs — <loc> count, ~14:47 UTC
```

### B. Reproduction commands

```bash
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0"

# Sitemap failure (P0-1)
curl -sS -A "$UA" --max-time 100 -o /dev/null \
  -w 'http=%{http_code} ttfb=%{time_starttransfer} bytes=%{size_download}\n' \
  https://ryan-realty.com/sitemaps/listings.xml

# Broker duplication (P0-2)
for u in /team/matthew-ryan /team/matt-ryan /team/matt; do
  curl -sS -A "$UA" "https://ryan-realty.com$u" | grep -o 'rel="canonical" href="[^"]*"'
done

# Unenforced punctuation rule (P1-1)
grep -c PUNCTUATION scripts/check-brand-voice.mjs        # → 0
grep -n 'PUNCTUATION' scripts/brand-voice-vocabulary.cjs # → exported
```

### C. Source references

Code: `app/sitemaps/[cls]/route.ts` · `app/sitemap.ts` · `app/layout.tsx:44` ·
`app/team/[slug]/page.tsx:77,262` · `lib/data/brokers/getBrokers.ts:145` ·
`scripts/check-brand-voice.mjs` · `scripts/brand-voice-vocabulary.cjs:23`

Competitors observed: skjersaagroup.com · movetobend.com · bendpremierrealestate.com ·
enjoybendlife.com · bendpropertysource.com · gobend.com · abrestate.com · bendrelo.com ·
gocentraloregon.com · allthingsbend.org · isellbendoregon.com · bernardrealestategroup.com

### D. Not measured

Core Web Vitals field data · indexed-page counts · backlink profile · traffic, bounce, dwell ·
WCAG contrast conformance · GBP/Yelp/Zillow profile state · paid campaign performance.

Obtaining GSC + GA4 access would convert most of these from proxy to measured, and is the
prerequisite for measuring whether the roadmap worked.
