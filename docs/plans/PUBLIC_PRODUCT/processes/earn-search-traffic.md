# Process: earn-search-traffic — Earn search traffic (crawler discovery, indexing, AI citation)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (crawlers fetch on their own schedule, any hour) with an hourly
  machine heartbeat (the `warm-sitemaps` cron, `0 * * * *`, and the 3600s ISR window on
  every discovery surface)
- Verdict (**PROPOSAL, not a lock — P3 decides**): **KEEP** — this is the machine process
  that feeds the `organic search` and `AI citation` inception channel of every visitor
  process; its inception (a crawler fetching /robots.txt, /sitemap.xml, /llms.txt) and its
  completion (a URL counted as indexed per class in GSC, then a human landing) are shared
  with no other process. Nothing merges into it and it merges into nothing: it has no pages
  of its own, only machine surfaces, and killing it would not remove code — it would remove
  the site's only free, compounding acquisition channel. Keep standalone as a SYSTEM
  process.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

A person searching Google/Bing or asking an AI assistant (ChatGPT, Perplexity, Claude,
AI Overviews) about Central Oregon real estate finds a Ryan Realty page in the results —
or cited in the answer — because the machinery kept every public URL discoverable, honest
about freshness, and machine-readable. The machine outcome is the **inception of every
other visitor process**: this process advances no client-step itself, it fills the top of
all of them — by serving crawlers a complete, fast, truthful map (a), search engines and
AI engines send humans to the exact page that answers their question, which is where
`find-a-home`, `evaluate-a-place`, `explore-market-knowledge`, `get-home-value`, and
`read-content` actually begin at zero marginal cost.

## 2. Inception (what starts it)

Trigger: a search-engine or AI crawler fetches one of the three discovery surfaces. There
is no human at inception; the entry channel this process FEEDS is organic search + AI
citation for humans.

Entry surfaces (all bypass the middleware bot screen — the matcher excludes `robots.txt`,
`sitemap.xml`, and every dotted path such as `/sitemaps/core.xml` and `/llms.txt`,
`middleware.ts:587-590`):

- **`/robots.txt`** — `app/robots.ts:16-52`: allow-all for the full crawler roster
  (Googlebot, Bingbot, plus the AI answer/training roster GPTBot, OAI-SearchBot,
  ChatGPT-User, PerplexityBot, ClaudeBot/Claude-SearchBot, Applebot, CCBot, Bytespider —
  `:29-49`), disallow `/admin/`, `/dashboard/`, `/account/`, `/api/`, `/auth/`,
  `/mockup-preview/`, `/dev/` with a longer-Allow carve-out for `/api/og` so social
  scrapers can render share cards (`:22-26`), and the sitemap pointer
  `${baseUrl}/sitemap.xml` (`:51`).
- **`/sitemap.xml`** — claimed by a `beforeFiles` rewrite to `/sitemaps/index.xml`
  (`next.config.ts:288-290`; it MUST stay beforeFiles or the metadata-route monolith
  wins again). The index route emits a `<sitemapindex>` over the five per-class children
  with no data work at all (`app/sitemaps/index.xml/route.ts:39-68`, `revalidate 3600`
  `:37`).
- **`/sitemaps/{core|geo|listings|matrix|content}.xml`** — the five class children
  (`app/sitemaps/[cls]/route.ts:59-91`, `revalidate 3600` `:29`, `maxDuration 300` `:36`,
  deliberately not prerendered `:51`).
- **`/llms.txt`** — the AI-crawler map (`app/llms.txt/route.ts:23-159`, `revalidate 3600`
  `:11`), pulling from the same cached DAL the pages render from.

Machine-side pre-inception: the hourly `warm-sitemaps` cron (`vercel.json:244-247`,
`0 * * * *`) calls `getClassRows()` for all five classes inside ONE invocation
(`app/api/cron/warm-sitemaps/route.ts:56-71`), so one ~147s universe build plus four
in-memory filters fills every per-class cache and the crawler's first request is a cache
hit (the header documents the measured failure this fixed: sequential HTTP warming 504'd
three of five classes at 300s — `:14-27`).

Preconditions: `NEXT_PUBLIC_SITE_URL` resolves to the production host —
`getCanonicalSiteUrl()` never returns localhost (`lib/share-metadata.ts:13-18`), and the
index and its children share one host (`app/sitemaps/index.xml/route.ts:40-43`).

## 3. Actors

- **Visitor segment: none at inception.** The direct "visitor" is a crawler acting as
  proxy for future human searchers of every segment (buyer/seller/owner/dreamer/investor).
  The humans this process delivers arrive as the §2 inception of the RECEIVING process;
  their device reality belongs to those specs. No GA4 device split was pulled this
  session for organic entries (named gap, §11).
- **Automated actors (this process IS its actors):**
  - The crawler roster enumerated in `app/robots.ts:29-49`, plus social scrapers via
    `/api/og` (`:22-25`).
  - `warm-sitemaps` cron, hourly (`vercel.json:244-247`).
  - ISR revalidation on every discovery surface (3600s) and on the pages crawlers fetch —
    72 `page.tsx` files export `revalidate` (repo grep this run; e.g. homepage
    `revalidate = 60`, `app/page.tsx:45`).
  - The middleware bot screen as a NEGATIVE actor it must not collide with: verified good
    crawlers bypass everything (`GOOD_BOT_RE` `middleware.ts:154-155`, checked first at
    `:214-215`); HTTP-library UAs (curl, wget, python-requests, axios, ...) are 403'd
    (`:174-175`, `:220-221`); discovery surfaces are excluded from the middleware entirely
    by the matcher (`:587-590`).
  - `marketing-snapshot-gsc` ingests daily GSC clicks/impressions into
    `marketing_channel_daily` via the `snapshot-channels` fan-out
    (`app/api/cron/marketing-snapshot-gsc/route.ts:1-23`).
- **Accountable for completion:** nobody in-repo — completion (indexed per class in GSC)
  is observed in an external console. The per-class split exists precisely to make that
  observation attributable (`lib/data/sitemap/classify.ts:5-9`), but the only in-repo
  reader of indexing health is a hand-run diagnostic (`scripts/_gsc-index-check.mjs:1-20`).
  That accountability hole is this process's biggest defect (§10, §11).

## 4. Systems of record

| Artifact | SoR |
|---|---|
| The URL universe (every public URL worth indexing) | `buildAllUrls()` in `app/sitemap.ts:85-562` — the single builder both the sitemap children and the warmer consume; sourced from the DAL + curated registries (resort registry `:34,342-349`; neighborhoods table `:408-423`; `listing_tile_mv` actives `:451-500`; blog/report tables `:525-553`; static registries for events/venues/golf/trails/schools/parks `:168-220`) |
| Per-class URL rows (what a crawler is actually served) | `unstable_cache` entries keyed `sitemap-class-urls-v2` + class arg, 3600s (`lib/sitemap-class-rows.ts:58-72`), fed by a 600s in-process universe memo (`:45-50`) |
| Class membership | `classifySitemapUrl()` — pure, total function over `SITEMAP_CLASSES` (`lib/data/sitemap/classify.ts:16-57`); union of children === the universe (documented measured 10,689 = 10,689, `app/sitemaps/index.xml/route.ts:15-21`) |
| Crawl permissions | `app/robots.ts` (gated by `ci:ai-crawler-access`, `scripts/check-ai-crawler-access.mjs:1-18`) |
| The AI-crawler content map | `app/llms.txt/route.ts` — same DAL sources as the sitemap; subdivision parity with the sitemap pinned by `lib/data/subdivisions/subdivision-index.test.ts` (`app/llms.txt/route.ts:29-32`) |
| Site identity for attribution | Organization/RealEstateAgent + WebSite JSON-LD (`components/JsonLd.tsx:55-104`), broker roster live from `public.brokers` via `getBrokers()` (`:57`), rendered once in the root layout (`app/layout.tsx:18,141-143`) |
| Per-listing structured data | Product + Offer + Place JSON-LD (`components/listing/ListingJsonLd.tsx:34-80`) |
| Canonical URLs | `pageMetadata()` stamps `alternates.canonical` from `getCanonicalSiteUrl()` + path (`lib/site/page-metadata.ts:83-97`); listing canonicals are the PUBLIC pretty URL built with the same `listingDetailPath` helper the sitemap uses so they cannot disagree (`app/listing/[listingKey]/page.tsx:139-161`) |
| Indexed state (completion) | **Google Search Console — external SoR.** Not mirrored in any table; daily clicks/impressions land in `marketing_channel_daily` (`app/api/cron/marketing-snapshot-gsc/route.ts:4-6`) but per-class indexed counts do not |

Explicitly NOT a SoR: the rendered XML/text responses (cache artifacts of the universe);
`scripts/seo-gsc-sitemap-submit.mjs` (submits Yoast/WordPress-era URLs that do not exist
on this site — `:17-21` — and is wired to no npm script, repo grep this run);
`app/api/revalidate/route.ts` (Inngest-era hook restricted to `/sitemap.xml` — `:1-24` —
while `inngest` is absent from package.json dependencies, verified this run, and
`/sitemap.xml` is now a rewrite target that does no data work); the `app/sitemap.ts`
default export (deliberately unreachable fallback behind the beforeFiles rewrite —
documented do-not-delete, `app/sitemap.ts:60-64`).

## 5. End-to-end path (inception → completion)

1. **Pre-warm** · `warm-sitemaps` cron · builds all five per-class caches in one
   invocation (one universe build + four in-memory filters), returns
   `{warmed, failed, results}` and **500s on any failed class** so a dead sitemap shows
   red instead of silent success · cron auth header · five fresh `unstable_cache` entries
   for the hour · `app/api/cron/warm-sitemaps/route.ts:40-71,85-87`;
   `lib/sitemap-class-rows.ts:58-72` · failure mode: a failed warm leaves the next real
   request to pay the ~147s build (documented measurements `:14-27`) · machine.
2. **Robots fetch** · crawler · GET `/robots.txt` · — · allow/disallow rules + the
   sitemap pointer · `app/robots.ts:16-52`; bypasses middleware via the matcher
   (`middleware.ts:587-590`) · failure mode: an edit dropping a bot or Disallowing `/` is
   exactly what `ci:ai-crawler-access` fails the commit on
   (`scripts/check-ai-crawler-access.mjs:12-18`) · machine.
3. **Sitemap index fetch** · crawler · GET `/sitemap.xml` → beforeFiles rewrite →
   `<sitemapindex>` listing the five children on one canonical host, lastmod = real
   generation time (an honest bound on the children's own 3600s regeneration — the §0
   note is in the code) · — · five child URLs ·
   `next.config.ts:288-290`; `app/sitemaps/index.xml/route.ts:39-68` (lastmod honesty
   `:46-48`) · failure mode: the rewrite moving out of beforeFiles resurfaces the
   10,689-URL monolith — pinned by `ci:sitemap-resolvable` · machine.
4. **Class child fetch** · crawler · GET `/sitemaps/{cls}.xml` · class slug · a
   `<urlset>` of `[path, lastmod]` rows from the per-class cache; unknown class → 404 ·
   `app/sitemaps/[cls]/route.ts:59-91` · failure mode: cold cache pays the universe
   build under a 300s ceiling (`:36`) — the warmer exists to make this the exception ·
   machine.
5. **Universe build (when cold)** · server · `buildAllUrls()` fans out over the DAL:
   static + registry families, cities and presets, communities from the curated resort
   registry, subdivision browse pairs (lifetime floor ≥ 3, `app/sitemap.ts:42,374-386`),
   plat detail pages, neighborhoods (recording the allow-set), matrix combos, out-of-area
   cities, brokers, active listings from `listing_tile_mv` (never a raw `listings` scan
   for listing URLs — `:451-456`), zips, blog, reports · DB reads · the URL universe,
   passed through `filterRogueCityUrls` (`:559-561`) · `app/sitemap.ts:85-562` · failure
   mode: any dynamic-section error is caught and the sitemap degrades to static pages
   only (`:554-557`) — thinner, never fabricated · machine.
6. **AI-map fetch** · AI crawler · GET `/llms.txt` · — · Markdown map: listings hubs,
   price drops, market data, full geo index (same three sources as the sitemap so the
   two maps cannot disagree — `app/llms.txt/route.ts:70-73`), subdivisions via the shared
   line builder (`:93-95`), events/venues/golf/trails, guides, blog, tools · DAL reads,
   all resilient-cached to `[]` (`:21,37`) · failure mode: a DAL failure empties a
   section, curated pillars still serve · machine.
7. **Page fetch** · crawler · GET an emitted URL · URL from a sitemap/llms.txt/an
   internal link · an ISR-cached page carrying `alternates.canonical` (self-referential,
   built by the same path helper the sitemap used) + JSON-LD (site-wide Organization +
   WebSite from the root layout; Product/Offer/Place on listing pages) + a robots meta
   that is `index, follow` unless the page opted out ·
   `lib/site/page-metadata.ts:83-113`; `app/listing/[listingKey]/page.tsx:139-168`;
   `components/JsonLd.tsx:55-118`; `components/listing/ListingJsonLd.tsx:34-80`;
   good-bot bypass `middleware.ts:214-215` · failure mode: a slow/erroring page reads as
   crawl failure in GSC; ISR keeps the served copy warm (72 pages export `revalidate`,
   grep this run) · machine.
8. **Index** · search/AI engine · processes the fetch; Google attributes the URL to its
   class sitemap and counts it in GSC per class (the explicit purpose of the split —
   `lib/data/sitemap/classify.ts:5-9`) · crawled page · indexed URL (or a
   crawled-not-indexed verdict) · external system · failure mode: **the dominant real
   state** — 10,744 submitted / 60 indexed at the documented 2026-07-28 audit (`:5-9`);
   emission works, indexation is the bottleneck · machine (external).
9. **Human landing (hand-off = completion)** · a person · clicks the SERP result or the
   AI answer's citation · their question · a session starting on the exact page that
   answers it — the §2 inception of `find-a-home` / `evaluate-a-place` /
   `explore-market-knowledge` / `read-content` / `get-home-value` · GA4 records the
   organic session (daily GSC clicks/impressions ingested by
   `app/api/cron/marketing-snapshot-gsc/route.ts:1-23`) · failure mode: ranking without
   clicking — impressions with no CTR — which only the receiving pages' titles/content
   fix · any device.

## 6. Decision points

- **Class assignment** (`lib/data/sitemap/classify.ts:23-57`): a total function — blog →
  content; listing-tail URLs → listings; `/homes-for-sale` depth decides core vs geo vs
  matrix; evergreen geography → geo; final branch returns core, so every URL lands in
  exactly one class and the index cannot lose one.
- **Emit vs withhold (indexability policy, decided at build time):** sort-only presets
  never emitted (duplicate content + page-level noindex — `app/sitemap.ts:320-325`);
  noindex LPs deliberately absent (`:144-147`); `{city}/{preset}` combos with a VERIFIED
  zero count skipped, unknown states fail OPEN (`:327-336`); subdivision browse pairs
  need lifetime ≥ 3 listings (`:42,374-379`); plat detail pages need a GIS polygon +
  lifetime sold floor (`:388-404`); out-of-area cities throttled to the indexable top set
  (`:430-434`); `/cities/{a}/{b}` only from the neighborhoods table, everything else
  filtered by the rogue-URL backstop (`:406-423,559-561`).
- **No public Coming Soon** (compliance): the listings class is built from
  `PUBLIC_ACTIVE_STATUSES` / `PUBLIC_ACTIVE_OR_PREDICATE` only — a pre-marketing listing
  is never submitted to Google (`app/sitemap.ts:8-10,468`).
- **Good bot vs bad bot** (`middleware.ts:206-227`): verified crawlers bypass first
  (`:214-215`); empty-UA and HTTP-library UAs 403 (`:217-221`); geo block last (`:223-225`);
  discovery surfaces never reach the screen at all (matcher, `:587-590`). SEO safety is
  ordering: the allowlist is checked before every block.
- **JSON-LD suppression on focused shells** (`components/layout/HideOnLP.tsx:26-37`):
  `/lp/*`, `/admin`, `/sign/*`, `/concept/*` drop the Organization JSON-LD (with the
  documented trade-off that the markup still ships in the RSC payload and unmounts on
  hydration — `:17-20`). Indexable LPs in the sitemap therefore present different markup
  to JS-rendering vs non-JS fetchers (§10 defect 5).
- **Canonical honesty:** listing canonical = the public pretty URL, same helper as the
  sitemap, because pointing it at the raw-key route split the indexing signal
  (`app/listing/[listingKey]/page.tsx:139-143`); the canonical host never emits localhost
  (`lib/share-metadata.ts:13-18`).
- **§0 honesty in freshness:** index lastmod is a real generation timestamp
  (`app/sitemaps/index.xml/route.ts:46-48`); event/venue/trail lastmod is the verified
  registry date, never `now()` (`app/sitemap.ts:166-183,194-201`).
- **Voice canon / brand:** n/a on the XML/txt surfaces themselves — but every page a
  crawler is sent to carries the same gated copy humans see (the `ci:gates` chain,
  `package.json:230`); nothing crawler-only is written.

## 7. Completion

Done-when (observable): an emitted URL is **counted as indexed in Google Search Console
under its class sitemap** — per-class attribution is the stated purpose of the split
(`lib/data/sitemap/classify.ts:5-9`) — and, downstream, organic/AI-cited sessions land on
it (visible as GSC clicks, ingested daily into `marketing_channel_daily` —
`app/api/cron/marketing-snapshot-gsc/route.ts:4-6`).

Artifacts at completion: the GSC per-class indexed count (external); the daily
clicks/impressions rows; the served, cache-warm discovery surfaces.

Terminal states per URL:

- **(a) Indexed** — counted under its class; eligible for SERP + AI citation.
- **(b) Crawled / discovered, not indexed** — the dominant documented state (60 of
  10,744 at the 2026-07-28 audit, `lib/data/sitemap/classify.ts:5-9`); the class split
  exists to make this state attributable and prunable.
- **(c) Withheld by policy** — never emitted (noindex LPs, sort presets, below-floor
  subdivisions, Coming Soon) or emitted-then-filtered (rogue backstop). Correct behavior,
  not failure.
- **(d) Deindexed / lost** — a formerly indexed URL cut without a 301 (program law: cut
  routes get 301s, constitution Mechanical gates).

## 8. Time & performance

- **Time-to-answer budget (the crawler's question is "what URLs exist?"):** answered from
  cache. The index does no data work at all (`app/sitemaps/index.xml/route.ts:12-13`);
  children serve the hour's cached rows; the warmer guarantees first-request cache hits
  (`app/api/cron/warm-sitemaps/route.ts:10-12`). "Slow" = a cold class child paying the
  universe build — measured ~147s for one build, with three of five classes 504ing at
  300s when each paid its own (`:20-27`); the in-process warm plus the 600s universe memo
  (`lib/sitemap-class-rows.ts:43-50`) is the fix. Who sees slow: Googlebot on the first
  request after a failed warm — and a failed warm 500s the cron so it shows red
  (`app/api/cron/warm-sitemaps/route.ts:85-87`).
- **Freshness ladder (how stale a crawler's view can be):** universe memo 600s → per-class
  cache + all discovery surfaces 3600s → page ISR per route (homepage 60s,
  `app/page.tsx:45`; 72 pages export `revalidate`, grep this run). New content is in
  llms.txt and the sitemap within the hour it publishes (`app/llms.txt/route.ts:16-20`).
- **Build-path safety:** nothing sitemap-shaped prerenders — the universe builder is
  `force-dynamic` (`app/sitemap.ts:66-68`), the children are `dynamicParams = true` with
  the prerender history documented (`app/sitemaps/[cls]/route.ts:39-51`). The two
  production incidents this prevents (600s/1800s per-route build ceilings, deploys
  silently pinned) are recorded in the route headers.
- **Core Web Vitals for the crawled pages:** NOT measured this session — named gap. CWV
  budgets belong to each receiving page's own PDS; no number is claimed here (§0).

## 9. Variants

All variants share one loop — a machine fetches our URLs to present them to humans — and
share the same URL universe and honesty rules. Inception and consumption differ:

- **Classic search engines (Googlebot, Bingbot):** robots → sitemap index → class
  children → pages → GSC-counted index. The spine of this spec.
- **AI answer engines (OAI-SearchBot, PerplexityBot, Claude-SearchBot, Applebot, ...):**
  same robots allow (`app/robots.ts:29-42`), plus `/llms.txt` as a purpose-built map;
  completion is a citation in an answer rather than a SERP row. Guarded by
  `ci:ai-crawler-access` (G39).
- **Model-training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot, Bytespider):**
  deliberately allowed — "low cost, no downside for a visibility-seeking site"
  (`app/robots.ts:43-49`); no per-URL completion, the payoff is future-model familiarity.
- **Social share scrapers (facebookexternalhit, Twitterbot, Slackbot, ...):** fetch pages
  + `/api/og` for link-preview cards (`app/robots.ts:22-25`; allowlisted in
  `GOOD_BOT_RE`, `middleware.ts:154-155`); consumes the same `pageMetadata` OG output
  (`lib/site/page-metadata.ts:98-111`). Inception is a human pasting a link, not a
  crawl schedule — but the machinery served is identical.

No split warranted: one universe, one honesty policy, one allowlist. P3 should treat
llms.txt/robots/sitemaps/JSON-LD as organs of one process (the P1 confirmation stands).

## 10. Current implementation map

- **Routes/surfaces:** `app/robots.ts`; `app/sitemap.ts` (universe builder + unreachable
  fallback); `app/sitemaps/index.xml/route.ts`; `app/sitemaps/[cls]/route.ts`;
  `app/llms.txt/route.ts`; `app/api/cron/warm-sitemaps/route.ts`; JSON-LD in
  `app/layout.tsx:18,141-143` + `components/JsonLd.tsx` + per-listing
  `components/listing/ListingJsonLd.tsx`; canonical construction
  `lib/site/page-metadata.ts:83-97` + `app/listing/[listingKey]/page.tsx:139-161`.
- **Registers:** none — no human-facing UI. The JSON-LD and metadata components are
  register-neutral server components. (Design amnesia has nothing to inherit or discard
  here; the SHAPE of this process is URL policy, which P5 owns under the SEO carve-out.)
- **Libs:** `lib/data/sitemap/classify.ts` (pure classifier + its test per the route
  header, `app/sitemaps/index.xml/route.ts:21`); `lib/sitemap-class-rows.ts` (shared
  per-class cache, deliberately outside `lib/data/` — `:28-30`);
  `lib/sitemap-guard.ts` (rogue-cities backstop, `app/sitemap.ts:4,559-561`);
  `lib/share-metadata.ts:13-18` (canonical host).
- **Crons:** `warm-sitemaps` hourly (`vercel.json:244-247`); `marketing-snapshot-gsc`
  daily via the `snapshot-channels` fan-out (deliberately not in vercel.json — its own
  header line 1).
- **Mechanical gates wired into `ci:gates` (`package.json:230`, verified this run):**
  `ci:sitemap-resolvable` (every emitted URL family maps to a route file + the 2026-07-21
  drift invariants — `scripts/check-sitemap-resolvable.mjs:1-26`), `ci:ai-crawler-access`
  (robots roster + llms.txt existence — `scripts/check-ai-crawler-access.mjs:1-18`),
  `ci:seo-routes` (`package.json:24-25`), plus `ci:site-index-freshness`,
  `ci:ai-structured-data`, `ci:canonical-host`, `ci:canonical-integrity` in the same
  chain.
- **Known defects (evidence, this run):**
  1. **The feedback loop is open.** Per-class GSC indexed counts — the explicit purpose
     of the class split (`lib/data/sitemap/classify.ts:5-9`) — have no automated reader:
     `scripts/_gsc-index-check.mjs:1-20` is a hand-run diagnostic, and the daily ingest
     covers clicks/impressions only (`app/api/cron/marketing-snapshot-gsc/route.ts:4-6`).
     The 10,744-submitted/60-indexed number is a dated code comment (2026-07-28), not a
     monitored metric.
  2. **Stale one-shot:** `scripts/seo-gsc-sitemap-submit.mjs:17-21` submits Yoast-era
     sitemap URLs (`sitemap_index.xml`, `page-sitemap.xml`, `post-sitemap.xml`) that do
     not exist on the Next site; wired to no npm script (package.json grep this run).
     Delete candidate.
  3. **Legacy hook:** `app/api/revalidate/route.ts:1-24` is an Inngest-era on-demand
     revalidator restricted to `/sitemap.xml` — `inngest` is absent from package.json
     dependencies (verified this run) and `/sitemap.xml` is now a rewrite target that
     does no data work, so the route revalidates nothing useful. Delete candidate.
  4. **llms.txt Market Data block:** two adjacent lines both labeled "Market reports",
     one pointing at `/reports` (which 308s — `next.config.ts:229`) and one at
     `/housing-market` (the hub, not the reports index) before the real per-report lines
     (`app/llms.txt/route.ts:115-117`). Redundant label + redirect hop served to AI
     crawlers hourly.
  5. **LP structured-data ambiguity:** indexable LPs in the sitemap
     (`/lp/central-oregon-golf`, `/lp/bend/`, `/lp/tetherow/` —
     `app/sitemap.ts:129,140-142`) render inside `HideOnLP`, which unmounts the
     Organization JSON-LD on hydration while it still ships in the RSC payload
     (`components/layout/HideOnLP.tsx:17-20,26-37`) — a JS-rendering crawler
     (Googlebot) and a non-JS fetcher see different markup. Rendered behavior not
     browser-verified this session; flagged from the component's own documentation.
  6. **Heavy build inputs remain:** city and zip enumeration still paginate the raw
     `listings` table (`app/sitemap.ts:296-300,503-506`) inside the ~147s universe
     build; listing URLs already moved to `listing_tile_mv` (`:451-456`), the geo scans
     did not.
  7. **Health number staleness:** the only indexation baseline anywhere in the repo is
     the 2026-07-28 comment. No current per-class number exists on disk (gap, §11).
- **Duplicate/parallel paths that should die:** defects 2 and 3 above (both dead-era
  artifacts). The `app/sitemap.ts` default export is NOT one of them — it is the
  documented, deliberately unreachable Next-convention fallback (`app/sitemap.ts:60-64`).

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — it is the machine that makes the north star affordable.** The
site is "one lead-generation machine that never acts like it"; this process is how the
machine gets fed without ad spend. Every KEEP visitor process lists organic search as an
inception channel; this is the only process that produces that channel. The emission side
is genuinely strong after the 2026-07/08 fixes (class split, in-process warming, honest
lastmod, drift gates). The job's missing half, derived from the job and not from today's
code: **a closed loop from indexed-state back to emission policy.** Emitting 10,000+ URLs
is not the outcome; indexed URLs that humans land on is, and today the completion state is
read by hand.

Target shape (derived from the job):

- One URL universe as SoR (exists), with emission policy per class driven by measured
  per-class indexed counts — an automated GSC sitemaps/index reader writing a dated
  per-class snapshot the growth loop consumes, replacing the hand-run script. A number
  nobody reads is not a feedback loop.
- Prune-by-data: classes that never index shrink (the matrix class is the candidate the
  2026-07-28 comment already implicates: 88% of the monolith was `/homes-for-sale/*`
  permutations); classes that index grow depth. Pruning decisions are P5's, under the
  SEO carve-out — URLs with earned equity are data, cuts get 301s, GSC evidence per
  route before any rename.
- The AI surface (llms.txt + open robots + JSON-LD) stays a first-class peer of the
  Google surface, not an afterthought — it is the site's stated forward-looking strength
  (`scripts/check-ai-crawler-access.mjs:5-11`).
- Kill the two dead-era artifacts (§10 defects 2, 3); fix the llms.txt Market Data block
  (defect 4); resolve the LP JSON-LD ambiguity with a rendered-HTML check (defect 5).

**Destination implication: SYSTEM — no human destination, ever.** The machine surfaces
(`/robots.txt`, `/sitemap.xml`, `/sitemaps/*`, `/llms.txt`) take `destination: SYSTEM` in
page-inventory.json. This process stamps no page of its own; instead it stamps a
REQUIREMENT on every indexable page of every other process: carry a truthful canonical,
carry the structured data for your surface, be in your class sitemap, and answer the
question you rank for.

**Dual objective stamped on its pages (the machine surfaces):**

- `visitor_objective`: "Give any crawler — search, AI answer, or social — the complete,
  honest, always-fresh map of every public URL worth indexing, from cache, in one fetch."
- `machine_objective`: "Every emitted URL indexed (counted per class in GSC) and citable
  by AI engines, so organic search and AI answers continuously feed the inception of
  every visitor process at zero marginal cost."
- `exits`: the emitted URL universe itself — every indexable node of the exploration
  graph (for the crawler); the SERP result / AI citation → the receiving page (for the
  human the crawler represents).

**Data gaps blocking correctness:** none blocking emission — the chain (DAL → universe →
classes → cache → crawler → page → canonical/JSON-LD) is complete and gated. Named
measurement gaps: ✗ no current per-class GSC indexed counts on disk (only the 2026-07-28
comment); ✗ no automated indexed-count reader; ✗ CWV for organic entry routes not
measured this session; ✗ LP JSON-LD rendered-DOM behavior not browser-verified; ✗ no GA4
organic-session device split pulled this session.

## 12. Acceptance checks

Persist; never delete. Run against production (`ryan-realty.com`). The middleware 403s
HTTP-library UAs on PAGE routes (`middleware.ts:174-175,220-221`) — page-fetch checks
must send a browser UA (`-A 'Mozilla/5.0'`); the discovery surfaces (robots, sitemaps,
llms.txt) bypass the screen via the matcher and need no UA.

1. **Robots serves the roster + pointer:**
   `curl -s https://ryan-realty.com/robots.txt` contains `Sitemap: https://ryan-realty.com/sitemap.xml`,
   `User-Agent: GPTBot` and `User-Agent: PerplexityBot` each followed by `Allow: /`, and
   `Disallow: /admin/`.
2. **The rewrite serves the index:**
   `curl -s https://ryan-realty.com/sitemap.xml | grep -c '<sitemapindex'` → 1, and
   `grep -c '<loc>'` → 5 (one per class), every loc on `https://ryan-realty.com/sitemaps/`.
3. **Every class child serves and the union reconciles (§0):** for each of
   core/geo/listings/matrix/content, `curl -s https://ryan-realty.com/sitemaps/$cls.xml | grep -c '<url>'`
   → > 0 and HTTP 200; the five counts summed equal the universe size (the class function
   is total — `lib/data/sitemap/classify.ts:23-57`; unit-pinned by
   `lib/data/sitemap/classify.test.ts` per `app/sitemaps/index.xml/route.ts:21`).
4. **Warm cron is green:** `curl -s -H "Authorization: Bearer $CRON_SECRET" https://ryan-realty.com/api/cron/warm-sitemaps`
   → HTTP 200 with `"warmed": 5, "failed": 0` (a failed class turns this 500 —
   `app/api/cron/warm-sitemaps/route.ts:85-87`); registration pinned by
   `ci:cron-registered` (`vercel.json:244-247`).
5. **llms.txt serves a populated map:** `curl -s https://ryan-realty.com/llms.txt` →
   `text/plain`, contains `## Cities` with ≥ 1 `- ` line and `## Subdivisions`.
6. **Coming Soon never leaks (§0 + policy):** every `<loc>` in
   `/sitemaps/listings.xml` ends in an MLS-number tail, and spot-checked keys satisfy
   `SELECT standard_status FROM listing_tile_mv WHERE listing_key = :key` ∈
   `PUBLIC_ACTIVE_STATUSES` — zero `Coming Soon` rows (`app/sitemap.ts:8-10,468`).
7. **Canonical agrees with the sitemap:** pick any loc from listings.xml;
   `curl -sA 'Mozilla/5.0' <loc> | grep -o '<link rel="canonical"[^>]*'` → href equals the
   loc (same `listingDetailPath` on both sides —
   `app/listing/[listingKey]/page.tsx:139-143`).
8. **JSON-LD anchors render:** `curl -sA 'Mozilla/5.0' https://ryan-realty.com/ | grep -c 'application/ld+json'`
   ≥ 2 with `"@type":["RealEstateAgent","LocalBusiness"]` and `"@type":"WebSite"` present;
   a listing page additionally contains `"@type":"Product"`.
9. **Bot screen blocks scripts, never crawlers:** a page fetch with the default curl UA →
   403; the same URL with `-A 'Googlebot'` → 200 (`middleware.ts:154-155,174-175,214-221`);
   `/sitemap.xml` and `/llms.txt` → 200 even with the curl UA (matcher exclusion,
   `:587-590`).
10. **Static gates green:** `npm run ci:sitemap-resolvable && npm run ci:ai-crawler-access && npm run ci:seo-routes`
    — all exit 0.
11. **Completion is measured, not assumed:** pull per-class indexed counts from GSC
    (`scripts/_gsc-index-check.mjs` with the service account, or the GSC UI per child
    sitemap) and record `{class: submitted/indexed, date}` — the process's done-state.
    Any session claiming index health without this pull is claiming an unmeasured number
    (§0).
