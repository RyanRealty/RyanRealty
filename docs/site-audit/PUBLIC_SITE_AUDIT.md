# Public website audit + remediation — every page production-grade

> /goal (Matt 2026-06-26): every public page — every feature, link, button, statistic — works
> and nothing is broken; every page is SEO-optimized + indexable; every page is CRM-tracked
> (page view) and property pages emit a property-view event. Bar = production-grade, verified on
> the real browser path, fixed, committed, reviewed.

## The 5 audit dimensions (every page scored on each)
- **A. Functional** — every link/button/form/interactive traces to a real handler; navigation
  resolves (no dead `#`/404); forms submit to the right action; no client crash / error boundary.
- **B. Statistics (§0)** — every number traces to a real source (Supabase/cache/MLS/named
  primary). No hardcoded, placeholder, stale, or fabricated stats. MoS verdict matches the number.
- **C. SEO** — `metadata` (title, description, canonical, OG, twitter), JSON-LD where relevant,
  one semantic H1, image alt text, descriptive links.
- **D. Indexability** — not unintentionally `noindex`; correct canonical; present in sitemap;
  content server-rendered/crawlable (not hidden behind client-only fetch).
- **E. CRM tracking** — page-view tracked (visitor_sessions/visitor_events); listing/property
  pages emit a property-view event tied to the session.

## SAFETY (heightened — public pages have lead-capture + outbound)
- Preview browser is authed as matt → form submits fire REAL writes + outbound (lead → FUB +
  seller workflow, contact email, newsletter signup, CMA/valuation request). Do NOT submit real
  lead/contact/valuation forms. Verify wiring in CODE; at most use a clearly-disposable ZZTEST
  value and clean it up. Never trigger a real outbound to a real person.
- §0: verify stats against the source; never trust the rendered number.
- AGENTS: read-only audit (+ safe navigation/read interactions only). NO git, NO baseline/snapshot
  edits. Write findings to `docs/site-audit/qa/<cluster>.md`; return a short summary. Orchestrator
  commits + fixes shared/cross-cutting files.

## Clusters (Phase A — parallel audit)
- INFRA: cross-cutting — CRM visitor tracking (how page/property views are captured), SEO infra
  (metadata helper, sitemap.ts, robots.ts, JSON-LD helpers), GA/analytics, middleware. Establishes
  the STANDARD + the cross-cutting gaps the orchestrator fixes centrally.
- PUB-1 Core marketing: /, /about, /team(+[slug]), /contact, /reviews, /our-homes, /join,
  /resources, /faq, /videos, /pulse, /feed, /activity, /compare
- PUB-2 Search + listings: /search(+[...slug]), /listing/[listingKey](+by-address/by-key),
  /open-houses(+[city]), /price-drops(+[city]), /motivated-sellers(+[city]), /our-homes
- PUB-3 Market data (§0-heavy): /housing-market(+[...slug]/central-oregon/explore/reports...),
  /reports(+[slug]/[geoName]/explore/sales...), /cities(+[slug]+[neighborhoodSlug]),
  /communities(+[slug]), /subdivisions/[slug], /zip/[zip], /schools(+[slug]), /parks(+[slug]),
  /area-guides, /cities, /housing-market
- PUB-4 Landing pages + tools + sell/buy: /lp/* (8), /tools/* (3), /sell(+intent/valuation),
  /buy(+intent), /marketing/request
- PUB-5 Account/dashboard/auth: /account/*, /dashboard/*, /login, /signup, /forgot-password,
  /auth-error, /alerts/unsubscribe, /newsletter/unsubscribe, /sign/[token], /cma-drafts/[id]
- PUB-6 Content + legal: /blog(+[slug]), /guides(+[slug]), /privacy, /terms, /cookies, /dmca,
  /fair-housing, /accessibility, /data-deletion, /offline, /dev/components

## Defect log (synthesized). Site is fundamentally solid — stats DAL-sourced, no fabrication.
### CRITICAL — the Matt-named requirements
- **CR1 Property-view tracking BROKEN:** `components/VisitTracker.tsx:53` categorizePage only fires `listing_view` for `/listing/[key]`, but the canonical URL is `/homes-for-sale/{city}/{street}-{mls}` → fires generic page_view. Property views are NOT recorded. + `listing_view` events carry no listing metadata (mls/price/beds null). [CENTRAL]
- **CR2 LP pages emit zero Supabase tracking:** VisitTrackerWithSession sits inside `<HideOnLP>` (app/layout.tsx:143). /lp/* conversions can't tie to session. [CENTRAL]
- **CR3 No client-side route-change tracking:** App Router SPA nav doesn't re-fire the tracker. [CENTRAL]
- **CR4 /account/* all missing noindex:** private user pages are indexable (only robots.txt guards). Add robots noindex to account layout. [FIX-4]
### SEO
- **SEO1 /listing/[listingKey] has ZERO JSON-LD** — highest-value page, no RealEstateListing/breadcrumb. Data already fetched. [FIX-1]
- SEO2 blog/[slug] Article JSON-LD: INFRA said missing, PUB-6 said present — VERIFY + add if missing. [FIX-4]
- SEO3 /reports/explore + /housing-market/explore no JSON-LD; neighborhood FAQBlock missing includeJsonLd. [FIX-1 note / lower]
### Indexability (sitemap ↔ noindex contradictions)
- Remove from sitemap (they're noindex): /compare, /lp/fsbo, /lp/buyer-listing-alerts. [CENTRAL]
- Add to sitemap (indexable, absent): /faq, /pulse, /feed, /sell/{for-sale-by-owner,expired-listings,inherited-home}, /buy/{first-time-home-buyer,relocation,investment}, /lp/central-oregon-golf, /cookies, /data-deletion. [CENTRAL]
### Functional
- F1 /our-homes shows ALL MLS (no brokerage filter) — §0 misrepresentation ("our homes"). [FIX-2]
- F2 6 pages no search-view tracking: open-houses(x2), price-drops(x2), motivated-sellers(x2). [FIX-2]
- F3 price-drops/motivated-sellers card hrefs use /listing/${key} (301) not canonical listingDetailPath(). [FIX-2]
- F4 /feed zero page tracking (add KbSectionTracker). [FIX-2]
- F5 auth-error "Try again" → /?next= instead of /login?next=. [FIX-4]
- F6 account/layout hardcoded ?next=/account/buying-preferences (wrong post-login dest). [FIX-4]
- F7 /lp/seller-home-value JSON-LD image uses nonexistent seller.ryan-realty.com → ${siteUrl}. [FIX-3]
- F8 /dmca fallback email ryanrealty.com → ryan-realty.com. [FIX-4]
- F9 /dev/components exposed unauthenticated in prod (noindex only) → gate/remove. [CENTRAL]
- F10 /marketing/request zero CRM tracking. [FIX-3]
- F11 blog grid read-time always "2 min" (estimateReadTime(null)); popular-posts titles from slug not DB title. [FIX-4]
- F12 /guides no page-view tracking. [FIX-4]
- F13 legal OG blocks (/terms,/fair-housing,/dmca,/accessibility) omit title/description; guides index relative OG image. [FIX-4]
### §0 / labeling (low, mostly clean)
- saleToList scaling guard ambiguity (city/community) — confirm DB unit. ZIP DOM label (active vs closed). /reports/[slug] frozen HTML stats no per-stat freshness. GreatSchools/sample numbers undated. [track; low]
### Tools (CLEAN math) / lead forms (CLEAN wiring) / auth (PASS) — verified, no fix needed.

## Fix partition (disjoint; agents NO git; orchestrator commits; browser-verify)
- CENTRAL (me): VisitTracker.tsx + app/layout.tsx (CR1/2/3 tracking) ; app/sitemap.ts (indexability add/remove) ; app/dev/components gate (F9) ; robots.ts if needed.
- FIX-1: app/listing/** — RealEstateListing+breadcrumb JSON-LD (SEO1), explore-page JSON-LD (SEO3), verify 3 always-null blocks.
- FIX-2: app/our-homes, app/price-drops/**, app/motivated-sellers/**, app/open-houses/**, app/feed — brokerage filter, canonical hrefs, search/feed tracking.
- FIX-3: app/lp/seller-home-value, app/marketing/request, app/tools/**, app/sell/[intent], app/buy/[intent] — JSON-LD domain, tracking, app_config calc defaults, phone constant, intent metadata.
- FIX-4: app/account/layout.tsx (noindex+next), app/auth-error, app/blog/**, app/guides/**, app/dmca, app/terms, app/fair-housing, app/accessibility — CR4, F5/6/8/11/12/13, SEO2 verify.

## Log
- 2026-06-26: goal set; 112 public page files enumerated. Dispatching INFRA recon + 6 cluster audits.
