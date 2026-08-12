# Process: read-content — Read content (blog · FAQ · resources annex)

## 0. Meta

- Status: **deepened**
- Cadence: **continuous** (visitor-driven, 24/7; no crons touch this process — grep of
  vercel.json for blog/faq this run returned nothing)
- Verdict: **PROPOSAL — KEEP.** This is the prose leg of the trust engine: the
  market-knowledge pillar answers with numbers, this process answers with words, and it is
  the surface purpose-built for organic + AI-answer-engine entry (per-question FAQ pages,
  Blog+ItemList JSON-LD, paginated sitemap emission). The defects are wiring defects
  (standalone FAQ pages invisible to the sitemap, a duplicate uncached reader path, a
  vestigial dynamic-render pin), not existence defects. `/resources` is kept inside as an
  annex with an explicit P5 question attached: it is a 6-tile router with no readable
  content of its own, and the IA may dissolve it. This is a proposal for the P3 package,
  not a lock.
- Last evidence pass: **2026-08-11** (every file:line below opened this run)

## 1. Purpose

(a) A visitor with a plain-language Central Oregon real-estate question — how selling
works, what listing costs, which neighborhoods we know, what changed in the market this
month — reads a direct, attributed answer without giving up anything first. (b) The
machine outcome is a next exploration step toward becoming a client — a community or
city page visited, a market report opened, a valuation started, or a conversation begun —
and serving (a) produces it because every piece carries structural exits offered after
the answer (geo cross-link bands into community inventory, app/blog/[slug]/page.tsx:264-285;
contact + market-report CTAs, app/faq/page.tsx:112-127; the valuation CTA,
app/resources/page.tsx:190-195), never as a gate in front of it.

## 2. Inception (what starts it)

Trigger: an information question in words rather than numbers ("what does it cost to
list", "do you work with first-time buyers", "what happened in the Bend market this
month"). Preconditions: none — every surface is public and anonymous; consent gates
tracking only, never reading.

Entry channels, with evidence:

1. **Organic / AI-answer-engine search.** The sitemap emits /blog (app/sitemap.ts:99),
   /resources (:149), /faq (:150), and every published post URL paginated live from
   `blog_posts` (app/sitemap.ts:524-537). The blog index emits Blog + ItemList JSON-LD so
   AI engines can enumerate and cite posts without scraping the grid
   (app/blog/page.tsx:122-140); each post emits Article + Breadcrumb JSON-LD
   (app/blog/[slug]/page.tsx:145-155,163-175). The FAQ hub emits FAQPage JSON-LD for
   featured snippets and Gemini Ask Maps (app/faq/page.tsx:77-89), and each question has
   a standalone /faq/[slug] page built expressly so a single answer can rank and be cited
   on its own URL with its own H1 and single-question FAQPage JSON-LD
   (app/faq/[slug]/page.tsx:5-17,87-97). Social crawlers get pre-rendered
   Supabase-storage OG card images served directly because some crawlers (notably X) do
   not reliably fetch the dynamic /api/og endpoint (app/blog/[slug]/page.tsx:98-105).
2. **Internal links.** The nav "Market" group lists Blog and guides / FAQ / Resources
   (lib/site-nav.ts:140-142), repeated in the menu directory (:228-230) and both footer
   variants (:303-304,364-365). The market-knowledge surfaces feed readers in: the
   housing-market hub, catch-all, and central-oregon pages each render 3 recent posts via
   getRecentBlogPosts (app/housing-market/page.tsx:148;
   app/housing-market/[...slug]/page.tsx:374-375;
   app/housing-market/central-oregon/page.tsx:231). Inside the family, the hub accordion
   links every answer to its standalone page (app/faq/FaqAccordion.tsx:38-43).
3. **Direct / social share-back.** ShareButton sits on the blog index and at the top and
   bottom of every post with distinct track contexts (app/blog/page.tsx:205-211;
   app/blog/[slug]/page.tsx:223-229,309-315), building per-platform share URLs
   (components/ShareButton.tsx:33-56).
4. **Legacy redirects.** /guides and /guides/:slug 308 into /blog — "editorial lives on
   /blog" (next.config.ts:218-220); the sitemap deliberately emits no guides family
   (app/sitemap.ts:539).

**Entry hole (verified this run):** /faq/[slug] pages are NOT in the sitemap (only /faq
at app/sitemap.ts:150; grep of app/sitemap.ts for faq-slug emission returned only that
line) and have ZERO inbound links outside the faq family itself (grep of app, components,
lib for `/faq/` links this run returned none outside app/faq/) — pages built to rank
standalone are discoverable only through the hub's accordion links.

## 3. Actors

- **Visitor segments:** the FAQ's own category set names them — Buying (4 questions:
  first-timers, investors/second-home, relocations, new construction), Selling (3:
  cost-to-list, timeline, expired-listing owners), Neighborhoods (2), Working with us (2)
  (app/faq/data.ts:26-31,33-115). Blog categories add relocators, investors, and
  first-time buyers as named editorial audiences (app/actions/blog.ts:58-72). AI answer
  engines are an explicit proxy reader — the /faq/[slug] route and the ItemList emission
  exist for machine citation (app/faq/[slug]/page.tsx:5-13; app/blog/page.tsx:129-131).
  Device split: ✗ a GA4 device pull for these routes was NOT run this session — recorded
  as a gap, not asserted; the program's binding decision is mobile-first, 390 is truth
  (decisions.md).
- **Automated actors: none on the read side.** No cron touches blog or FAQ (grep of
  vercel.json this run). The supply side — a human publishing through saveBlogPost with
  its admin gate, brand-voice hard-fail, audit log, and revalidatePath
  (app/actions/blog.ts:261-320) — belongs to the marketing/machine plane (CLAUDE.md §9
  blog-publish path), not to this visitor process.
- **Accountable for completion:** the machine end-to-end. No broker touch is required for
  the informed-read done-state; a broker becomes accountable only after an exit lands in
  contact-a-broker or get-home-value.

## 4. Systems of record

| Artifact | SoR | Evidence |
|---|---|---|
| Blog editorial | `public.blog_posts` — status is free text, measured 2026-08-08: published 55, archived_stats_unverified 28, draft 3, pending_pilot_review 1 | app/actions/blog.ts:48-53; read path lib/data/blog/getPublishedBlogPosts.ts:74-86 |
| Author attribution | `public.brokers` joined by author_broker_id | lib/data/blog/getPublishedBlogPosts.ts:89-98; lib/data/blog/getBlogPostBySlug.ts:73-86 |
| FAQ content | the static in-repo array `app/faq/data.ts` — kept inside app/ ON PURPOSE so the brand-voice gate scans it | app/faq/data.ts:9-16,33-115 |
| Blog hero images | resolveBlogHeroImage forces a verified local photo, never a remote/stock/dead URL | lib/data/blog/getPublishedBlogPosts.ts:107; getBlogPostBySlug.ts:91 |
| Geo cross-link registry | `data/resort-communities.json` via the deterministic matcher | lib/blog-geo-links.ts:17,34-36 |
| Engagement observable | `visitor_sessions` / `visitor_events` via POST /api/visitors/track, insert-only first-touch, dual-sunk with GA4 | app/api/visitors/track/route.ts:365-371,403-405; components/site/kb/KbSectionTracker.client.tsx:7-27 |

Explicitly NOT a SoR: the duplicate public readers in app/actions/blog.ts:74-204
(uncached, error-swallowing re-implementations of the four DAL functions — the public
pages import the DAL versions from `@/lib/data`, and only getBlogCategories comes from
the action file, app/blog/page.tsx:21-22); the hardcoded 13-item CATEGORIES list is
presentation config, not data truth (app/actions/blog.ts:58-72); "popularity" — no
per-post popularity signal exists anywhere; getPopularBlogSlugs is recency-ordered and
says so (lib/data/blog/getPopularBlogSlugs.ts:2-5,28).

## 5. End-to-end path (inception → completion)

1. **Arrive** · visitor · lands via a §2 channel · input: query/click/share link ·
   output: request to one of the §10 routes · system touch: render mode differs by
   family — /blog and /blog/[slug] are pinned DYNAMIC by session + identity-bridge reads
   kept solely to pin the rendering mode (their FUB consumer was deleted,
   app/blog/page.tsx:108-117; app/blog/[slug]/page.tsx:130-137); /faq is fully static
   SSG (force-dynamic removed 2026-08-03, app/faq/page.tsx:26-31); /faq/[slug] is SSG
   with dynamicParams=false (app/faq/[slug]/page.tsx:61-65); /resources is static ·
   failure: unknown post slug → notFound (app/blog/[slug]/page.tsx:138); unknown FAQ
   slug → 404 by dynamicParams=false · device: any, 390 first.
2. **Server assembles content** · machine · getPublishedBlogPosts (category+limit+offset
   in the cache key, 600s blog window, throws on Supabase error so the resilient cache
   never stores a blank page — lib/data/blog/getPublishedBlogPosts.ts:85-86,122-129),
   getPopularBlogSlugs, getBlogPostBySlug (maybeSingle; null only on a genuine miss —
   getBlogPostBySlug.ts:57-65), getRelatedBlogPosts (same-category first, backfill —
   lib/data/blog/getRelatedBlogPosts.ts:29-60), getFaqGroupedByCategory
   (app/faq/data.ts:140-142) · failure: no-poison throws per above · device: n/a.
3. **Answer renders above the fold** · machine → visitor · post: category link, H1,
   byline with brokerage fallback so no piece is unattributed
   (app/blog/[slug]/page.tsx:200-216), read time computed from the full body not the
   excerpt (lib/data/blog/getPublishedBlogPosts.ts:111-114), prose body at 65ch measure
   (app/blog/[slug]/page.tsx:249-257) · FAQ answer page: question as H1 + the full
   answer as the first paragraph, zero interaction (app/faq/[slug]/page.tsx:120-132) ·
   FAQ hub: category TOC with counts then Radix accordions whose answers stay mounted so
   crawler-visible text and the JSON-LD agree (app/faq/page.tsx:131-183;
   app/faq/FaqAccordion.tsx:14-22) · failure: empty article body renders "This article
   is being updated," never a blank (app/blog/[slug]/page.tsx:258-262) · device: any.
4. **Consumption recorded** · machine · KbSectionTracker fires `section_view` the first
   time each section crosses 55% visibility plus 25/50/75/100 scroll-depth milestones,
   dual-sunk to GA4 AND POST /api/visitors/track via sendBeacon with the full URL (a
   bare path was silently dropped site-wide until audited) — pageType stamps: blog
   (app/blog/page.tsx:144), blog_post (app/blog/[slug]/page.tsx:162), faq
   (app/faq/page.tsx:87), faq_answer (app/faq/[slug]/page.tsx:102), info
   (app/resources/page.tsx:107) (components/site/kb/KbSectionTracker.client.tsx:7-27,38-78)
   · server side: consent enforced fail-closed (declined/missing → rejected), GPC
   opt-out drops the event and records a durable suppression for identified visitors
   (app/api/visitors/track/route.ts:250-258,270-303), then visitor_sessions insert-only
   first-touch + visitor_events insert (:360-371,403-405) · failure: tracking is
   best-effort and swallowed — it must never break the page
   (KbSectionTracker.client.tsx:6-27) · device: any.
5. **Deepen laterally (optional, repeatable)** · visitor · category pills filter the
   index (app/blog/page.tsx:190-204), pagination (:323-348), recent-posts rail
   (:351-374), related posts on the article (app/blog/[slug]/page.tsx:368-417), related
   questions + back-to-hub on the answer page (app/faq/[slug]/page.tsx:150-206) ·
   failure: an empty category renders the honest "No posts in this category yet" with a
   route back to all posts (app/blog/page.tsx:312-320) · device: any.
6. **Exit into the graph (one of six)** · visitor ·
   (a) place: the "On the market now" geo band cross-links a post to at most 2 community
   pages matched deterministically on slug/title/tags, longest label first
   (app/blog/[slug]/page.tsx:264-285; lib/blog-geo-links.ts:50-68) → evaluate-a-place;
   the /resources Area-guides tile (app/resources/page.tsx:52-55) → evaluate-a-place;
   (b) market: "Latest market report" CTAs on FAQ hub + answer pages
   (app/faq/page.tsx:118-125; app/faq/[slug]/page.tsx:138-144) and the reports/hub/
   activity tiles on /resources (:40-50,66-70) → explore-market-knowledge;
   (c) valuation: HomeValuationCta → /sell/valuation, firing trackHomeValuationCta with
   the persisted LP/UTM context so an ad-arrived visitor still attributes after
   navigating (app/resources/page.tsx:190-195; components/HomeValuationCta.tsx:16-47)
   → get-home-value;
   (d) conversation: "Talk to us" + the missed-question contact CTA
   (app/faq/page.tsx:112-117,186-203), the author byline and bio linking /team/<slug>
   (app/blog/[slug]/page.tsx:204-216,345-359) → contact-a-broker;
   (e) inventory: "Search listings" on /resources (:136-143) and the /compare +
   appreciation tiles (:56-65) → find-a-home / run-the-numbers;
   (f) distribution: ShareButton share/copy fires trackEvent('share')
   (components/ShareButton.tsx:21-22; app/blog/[slug]/page.tsx:309-315) ·
   failure: none of these is a form — no capture happens ON these surfaces; every
   conversion is a hand-off, so a broken exit link is the failure mode (§12 check 9) ·
   device: any.

Happy path reaches §7 completion (a) at step 4 and (b) at step 6.

## 6. Decision points

- **Publish gate (the only writer branch that matters here):** a post renders publicly
  only with status='published' AND a non-null published_at
  (lib/data/blog/getPublishedBlogPosts.ts:77-78; getBlogPostBySlug.ts:60-62) — the 32
  non-published rows (including 28 archived_stats_unverified, parked under §0 until
  their stats verify) stay dark. Publishing hard-fails the brand-voice check before the
  row is written, with an advisory Orwell-rules review alongside
  (app/actions/blog.ts:269-281); the action is admin-gated in-body and audit-logged
  (:261-262,308-316).
- **Voice canon on FAQ:** the content array lives in app/ specifically so
  check-brand-voice.mjs scans it; moving it to lib/ would silently drop gate coverage
  (app/faq/data.ts:9-16).
- **Index/noindex:** filtered or paginated blog index views can carry
  robots noindex via shouldNoIndexBlogIndex while the canonical stays /blog
  (app/blog/page.tsx:76,83-84).
- **OG card branch:** Supabase-storage heroes are served directly to social crawlers;
  other posts fall back to the dynamic /api/og card (app/blog/[slug]/page.tsx:98-105).
- **Geo-link narrowness:** matching is slug/title/tags only — never the body ("body
  mentions are too noisy and would over-link listicles"), capped at 2, longest label
  wins (lib/blog-geo-links.ts:11-16,50-60).
- **Consent + GPC (tracking only):** declined or missing consent → the event is rejected
  server-side even from a buggy client; a GPC signal drops the event entirely and
  records a durable channel='all' suppression when the session maps to a CRM person
  (app/api/visitors/track/route.ts:111-119,250-258,270-303).
- **§0 posture:** stat-bearing editorial is parked, not published
  (archived_stats_unverified, app/actions/blog.ts:48-53). Remaining exposure: FAQ
  answers state market claims as prose ("tends to go pending in two to four weeks,"
  app/faq/data.ts:60-64) with no trace mechanism — reviewer-enforced only (§10 defect 6).
- **No-public-Coming-Soon / ODS attribution:** n/a — no listing data renders on these
  surfaces; the cross-link bands carry copy only, inventory renders on the destination
  pages.

## 7. Completion

Done-when (observable), two terminal states:

- **(a) Informed read:** ≥1 `section_view` (and scroll-depth milestones) recorded to
  visitor_events + GA4 from a blog/faq/resources URL this session
  (components/site/kb/KbSectionTracker.client.tsx:38-70;
  app/api/visitors/track/route.ts:403-405). The question was answered; nothing was
  captured. A SUCCESS state — this process's job is trust and entry, not capture.
- **(b) Exit taken:** the visitor leaves into an adjacent process via a §5.6 door —
  community/city page, market report, /sell/valuation (trackHomeValuationCta fires with
  LP context, components/HomeValuationCta.tsx:45), /contact, /team/<slug>, listing
  search, or an external share (trackEvent('share')).

Artifacts at completion: visitor_events rows (always); optionally cta_click/share
events. **No artifact of capture exists in-process — by construction there is no form on
any of these five routes; every conversion is a hand-off.** Terminal failure states:
404 on an unknown slug (correct behavior); the "This article is being updated" empty-body
state (app/blog/[slug]/page.tsx:258-262).

## 8. Time & performance

- **Time-to-answer budget:** on the leaf pages the answer must need ZERO interaction —
  /faq/[slug] renders the full answer as the first paragraph under the H1
  (app/faq/[slug]/page.tsx:120-132); a blog post renders title, byline, and lede in the
  first viewport. The FAQ hub is one scroll + one tap (TOC → accordion). Anything
  requiring a search inside the page fails the budget.
- **Render reality:** the two static families are right: /faq + /faq/[slug] are SSG
  (app/faq/page.tsx:26-31; app/faq/[slug]/page.tsx:27-30,61-65), /resources static. The
  two blog routes — the family with the sitemap-emitted long tail — are pinned dynamic
  per-request by vestigial session reads (app/blog/page.tsx:108-117;
  app/blog/[slug]/page.tsx:130-137) on top of 600s DAL caches
  (lib/data/blog/getPublishedBlogPosts.ts:122-129): the highest-entry editorial surface
  pays the slowest render mode for a consumer that no longer exists.
- **What "slow" means and who sees it:** a first organic visitor on a cold blog post
  waits on a server render; the resilient cache prevents blank pages, not latency. FAQ
  entries never see this — CDN-cacheable by construction.
- **Core Web Vitals:** ✗ not measured this session — no timed device run was performed;
  per the verification contract that timing does not exist until measured. P8 litmus
  timing must include one blog post at 390.

## 9. Variants

Three content families share one arrive → answer → tracked-exit shape, one tracker, and
the same exit set — one process, no split:

- **Blog (DB-backed, dynamic):** editorial from blog_posts via the DAL, per-post URLs,
  Article JSON-LD, geo cross-links.
- **FAQ (code-backed, static):** 11 canonical Q&As in app/faq/data.ts, hub + one
  standalone page per question, FAQPage JSON-LD at both grains.
- **Resources (annex — router, not reading):** 6 link tiles + CollectionPage JSON-LD, no
  readable content of its own (app/resources/page.tsx:40-71,96-103); kept inside because
  it shares the shape and carries the HomeValuationCta hand-off — with the P5 question
  attached (§11).

Boundary corrections upheld from P1, re-verified this run:

- **/site-index → earn-search-traffic:** the W3.4 crawler internal-link-equity hub,
  auto-derived from live inventory, linked only from the footer legal row
  (app/site-index/page.tsx:2-19; lib/site-nav.ts:395). Not visitor content.
- **/videos → find-a-home:** a listing-browse surface reading listing_tile_mv via
  getListingTiles/getCityListings with inline players (app/videos/page.tsx:3,28-36).
- **/area-guides → evaluate-a-place:** the geo hub into /cities + /communities
  (app/area-guides/page.tsx:1-21; next.config.ts:218 "editorial lives on /blog. Keep
  /area-guides as the geo hub").
- **"Guides" as editorial no longer exists:** /guides + /guides/:slug 308 → /blog
  (next.config.ts:219-220); no guides family in the sitemap (app/sitemap.ts:539).

Entry-channel variants (organic, AI-citation, nav, market-page rail, share-back,
redirect) share the same pages and path — no split.

## 10. Current implementation map

Routes today (all five wear the KB register):

| Route | Render | Data | Register |
|---|---|---|---|
| /blog | dynamic (vestigial pin) | getPublishedBlogPosts + getPopularBlogSlugs (DAL) + hardcoded categories | KB (app/blog/page.tsx:30-35,143) |
| /blog/[slug] | dynamic (vestigial pin) | getBlogPostBySlug + getRelatedBlogPosts (DAL) + blog-geo-links | KB (app/blog/[slug]/page.tsx:28-32,159) |
| /faq | SSG | app/faq/data.ts (static array) | KB + shadcn Accordion (app/faq/page.tsx:40-49; FaqAccordion.tsx:4-9) |
| /faq/[slug] | SSG, dynamicParams=false | app/faq/data.ts | KB (app/faq/[slug]/page.tsx:36-44) |
| /resources | static | hardcoded tile array | KB + shadcn/primitives inside HomeValuationCta (app/resources/page.tsx:27-34; components/HomeValuationCta.tsx:4-7) |

Actions/API: six DAL readers under lib/data/blog/ (getPublishedBlogPosts,
getBlogPostBySlug, getRelatedBlogPosts, getPopularBlogSlugs, getRecentBlogPosts,
getBlogPostsBySlugs — ls this run); admin CRUD + voice gate in app/actions/blog.ts;
POST /api/visitors/track for telemetry. Crons: none.

Known defects / parallel paths that should die:

1. **Standalone FAQ pages are invisible to discovery.** /faq/[slug] exists so a single
   answer can rank on its own (app/faq/[slug]/page.tsx:5-13), yet the sitemap emits only
   /faq (app/sitemap.ts:150) and no surface outside app/faq/ links any slug page (grep
   this run). The route's entire purpose is undercut by its wiring.
2. **Duplicate public reader path.** app/actions/blog.ts:74-204 re-implements the four
   public readers uncached and error-swallowing (`if (error) return { posts: [], total:
   0 }` at :93 — the exact confident-empty-state §0 defect the DAL versions were built
   to prevent). The public pages import the DAL; only getBlogCategories comes from the
   action file (app/blog/page.tsx:21-22). One path must die.
3. **Categories are fiction-capable.** The 13-item list is hardcoded
   (app/actions/blog.ts:58-72), not derived from published rows — a pill can render for
   a category holding zero posts and land on the empty state (app/blog/page.tsx:312-320).
4. **No popularity signal despite the data existing.** The sidebar is recency-ordered
   (lib/data/blog/getPopularBlogSlugs.ts:2-5) while per-URL section_view/scroll rows
   accumulate in visitor_events — engagement is recorded but never read back into
   ranking. The UI label was fixed to "Recent posts" (app/blog/page.tsx:358); the
   function name still claims Popular.
5. **Vestigial dynamic pin on the blog family.** getSession + getPersonIdFromCookie are
   kept only to pin rendering mode; the FUB mirror they fed was deleted
   (app/blog/page.tsx:108-110; app/blog/[slug]/page.tsx:130-132). Per-request renders on
   the long-tail entry family for nothing.
6. **FAQ market claims have no §0 trace mechanism.** "two to four weeks" pending
   timelines and price-band claims are prose in a static array
   (app/faq/data.ts:60-64), reviewer-enforced only — nothing re-verifies them as the
   market moves.
7. **Analytics asymmetry (known, not a bug):** the GA4 Measurement Protocol mirror
   covers page_view/listing_view only (app/api/visitors/track/route.ts:423), so for
   consent-denied/ad-blocked readers, section-level granularity exists only first-party.
8. **/resources oddities:** register mixing (KB shell + shadcn Button + primitives H2
   via HomeValuationCta, components/HomeValuationCta.tsx:4-7) and the process's only
   third-party AdSense slot (app/resources/page.tsx:186-188) — an odd fit with the
   "lead-generation machine that never acts like it" north star. P3/P5 call.

## 11. Target shape (process-level, not pixels)

**Should this exist? Yes — KEEP.** The pillar answers questions with numbers; this
process answers them with words, earns the organic and AI-citation entries, and passes
the authority to converting nodes. It is also the only surface where the brokerage's
judgment is readable at length — the trust engine's voice.

**Ideal shape (derived from the job, not from today's routes):** one editorial family in
the exploration graph where every piece — post or answer — is a citable leaf with three
properties: (1) the answer above the fold, zero interaction; (2) structural doors into
the graph generated from the piece's own subject (the geo cross-link mechanism
generalized beyond the 2-cap community registry to cities, neighborhoods, and market
nodes — today a post about Redmond passes no authority anywhere); (3) full standalone
citability — its own URL, single-purpose JSON-LD, AND presence in the sitemap (closing
defect 1). The FAQ and the blog are one job at two lengths — short canonical answers and
long-form pieces — and P5 should treat them as one family, not two menus. The resources
annex dissolves into IA unless P5 gives it a job the nav directory
(lib/site-nav.ts:140-146) is not already doing — a router page whose six links are doors
other destinations own is nav, not content. Step counts: entry → answer 0 clicks on
leaves; answer → next node 1 click. Blog rendering goes static/ISR per-post once the
vestigial session pins are removed (defect 5). Naming/grouping/URLs are P5 questions
under amnesia — with the carve-out that /blog/* posts carry earned search equity, so P5
pulls GSC evidence per URL before any cut/rename, and cuts get 301s (the /guides
precedent, next.config.ts:218-220).

**Data gaps blocking correctness:**
- ✗ Per-piece engagement rollup (visitor_events by page_url) is recorded but not
  readable by any ranking or "most useful" surface — an honest popularity signal cannot
  exist until a reader exists.
- ✗ No GA4/GSC per-route traffic or device pull this session (needed for the P5
  resources decision and any cut/rename).
- ✗ No mechanism re-verifies FAQ market claims against the live caches (defect 6) — a
  §0 exposure that a data-backed answer component would close.

**Destination implication:** no standalone destination. read-content pages live as
citable leaves inside the knowledge family of the P5 IA (alongside
explore-market-knowledge, which owns the numbers; this process owns the words), with
the resources annex absorbed into IA/nav rather than kept as a page. P5 names the
family under amnesia.

**Dual objective this process stamps on its pages (for page-inventory.json):**
- `visitor_objective`: "Get a direct, attributed answer in plain language to a Central
  Oregon real-estate question — what things cost, how the process works, what we know
  about this market and its places."
- `machine_objective`: "Turn the earned trust into the next exploration step — a place
  page opened, a market report read, a valuation started, or a conversation begun —
  offered after the answer, never before it."
- `exits`: evaluate-a-place (geo cross-link bands → /communities/<slug>; area-guides),
  explore-market-knowledge (market-report CTAs; recent-posts reciprocity),
  get-home-value (HomeValuationCta → /sell/valuation with LP/UTM attribution),
  contact-a-broker (/contact CTAs; author byline → /team/<slug>), find-a-home (search
  listings; compare), external share.

## 12. Acceptance checks

Persist these; never delete. SQL column names must be confirmed against
docs/DATABASE_SCHEMA_SNAPSHOT.md before running (§7 — no schema discovery by query).

1. **Route liveness** (expect 200 everywhere):
   ```bash
   for p in /blog /faq /faq/bend-neighborhoods /faq/cost-to-list /resources; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://ryan-realty.com$p"; done
   # plus the newest post:
   # curl -s -o /dev/null -w "%{http_code}\n" "https://ryan-realty.com/blog/<newest published slug>"
   ```
2. **Redirect integrity (guides family stays dead):**
   ```bash
   curl -sI https://ryan-realty.com/guides | grep -i '^location:.*/blog'          # 308
   curl -sI https://ryan-realty.com/guides/any-slug | grep -i '^location:.*/blog/any-slug'
   ```
3. **Sitemap emission reconciles with the publish gate:**
   ```bash
   curl -s https://ryan-realty.com/sitemap.xml | grep -c '/blog/'   # must equal published count from check 4
   curl -s https://ryan-realty.com/sitemap.xml | grep -c '/faq<\|/faq</loc>'   # hub present
   curl -s https://ryan-realty.com/sitemap.xml | grep -c '/faq/'    # TRIPWIRE: 0 today (defect 1); after the fix this must equal the FAQ count (11 as of 2026-08-11)
   ```
4. **Publish gate (SQL, read-only):**
   `select status, count(*) from blog_posts group by status` — the published count must
   equal the sitemap /blog/ URL count; and a known non-published slug must 404:
   `curl -s -o /dev/null -w "%{http_code}\n" https://ryan-realty.com/blog/<archived slug>` → 404.
5. **Structured-data presence:**
   ```bash
   curl -s https://ryan-realty.com/blog | grep -c '"@type":"Blog"'                     # ≥1, with ItemList inside
   curl -s https://ryan-realty.com/faq | grep -c 'FAQPage'                             # ≥1
   curl -s https://ryan-realty.com/faq/cost-to-list | grep -c 'FAQPage'                # ≥1 (single-question)
   curl -s "https://ryan-realty.com/blog/<slug>" | grep -c 'application/ld+json'       # ≥2 (Article + Breadcrumb)
   ```
6. **Voice gates hold at both chokepoints:** `npm run ci:brand-voice` green (covers
   app/faq/data.ts because it lives under app/ — data.ts:9-14); and a saveBlogPost call
   with a banned term and status 'published' is refused before any row is written
   (app/actions/blog.ts:269-275).
7. **Telemetry proof (done-state a):** visitor_events contains `section_view` rows from
   the last 7 days whose page_url contains `/blog` and `/faq` — count > 0 per family. A
   zero after traffic means the tracker regressed (the exact silent-drop failure the
   full-URL fix addressed, KbSectionTracker.client.tsx:10-14).
8. **Geo cross-link fires and stays capped:** a post whose slug/title/tags name a
   registry community renders "On the market now" with ≤2 bands:
   `curl -s "https://ryan-realty.com/blog/<community-named slug>" | grep -c 'On the market now'` → 1–2;
   and `grep -n 'slice(0, max)' lib/blog-geo-links.ts` proves the cap.
9. **Exit integrity (no dead doors):** every exit href resolves 200 —
   /contact, /housing-market/reports, /sell/valuation, /area-guides, /compare,
   /tools/appreciation, /activity, /housing-market, and each rendered
   /communities/<slug> band target. A non-200 on any is a broken hand-off, the
   process's primary failure mode (§5.6).
10. **Cache no-poison:** with Supabase env absent locally, /blog must fail or fall back
    visibly, never serve a cached empty grid — the throw is the mechanism
    (lib/data/blog/getPublishedBlogPosts.ts:85-86; getBlogPostBySlug.ts:64).
11. **Duplicate-path tripwire (defect 2):**
    `grep -rn "from '@/app/actions/blog'" app components lib --include='*.tsx' --include='*.ts' | grep -v admin`
    — until the P5 decision lands, the only non-admin import must be getBlogCategories
    in app/blog/page.tsx. Any growth in this set is drift, not a decision.
