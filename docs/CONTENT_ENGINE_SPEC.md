# Ryan Realty Content Engine — Spec

**Status:** Draft v1 · authored 2026-07-03 · owner: Matt (see §11 Governance)
**Scope:** the on-site local-content library for ryan-realty.com — events, parks, races, festivals, points of interest, housing news, and evergreen housing topics across Central Oregon, structured for classic SEO *and* AI answer engines.
**Companion docs:** [`docs/plans/HANDOFF-content-engine.md`](plans/HANDOFF-content-engine.md) (origin brief), [`docs/plans/HANDOFF-newsletter.md`](plans/HANDOFF-newsletter.md) (the newsletter is a *curator over this library*), [`docs/DEVELOPMENT_PROCESS.md`](DEVELOPMENT_PROCESS.md) (THE LOOP — this engine runs inside it).

> **One-line thesis:** the moat is not the page count. It is that **every page carries live MLS data + a real broker point of view that no templated competitor can fake.** Volume without that is scaled-content abuse and demotes the whole site. This spec exists to make the first true and the second impossible.

---

## 0. Non-negotiables (inherited, not restated)

Every page this engine produces obeys, in priority order:

1. **§0 Data Accuracy** (CLAUDE.md) — every stat/date/figure traces to a named live source (Supabase, MLS, or a linked primary source), pulled fresh, with a one-line verification trace. **No fabricated event dates, no remembered numbers.** A page ships with fewer facts rather than one wrong one.
2. **Draft-First, Commit-Last** — pages render to a draft/preview, Matt sees them, then they commit. Never a firehose to `main`.
3. **Brand voice** (`marketing_brain_skills/brand-voice/VOICE.md`, gated by `ci:brand-voice`) — the Five Laws; banned-word/punctuation regex; show-don't-tell.
4. **Fair housing** — neighborhood/school content describes *places and data*, never *who should live there*. No steering language, no demographic targeting. This is a compliance line, gate-enforced (§8).
5. **Authoritative sources only** — boundaries/POI/venue facts come from GIS + official agency pages (City of Bend GIS, Deschutes DIAL, Oregon State Parks, Visit Bend *as a fact source, not a copy source* — see §7 Legal).
6. **Existing design system** — navy/cream editorial ("brutalist"), Amboqia + Geist, `@/components/ui/`. No new visual register. Match the mockups.

If this spec ever contradicts one of the above, the above wins.

---

## 1. Audit — where we stand today (take stock)

Full inventory delegated to three Explore passes on 2026-07-03. Corrected counts:

### What already exists and works
| Type | Route | Source | Count | Dates | Sitemap | Schema (via `lib/site/json-ld.ts`) |
|---|---|---|---|---|---|---|
| Blog (news + evergreen) | `/blog`, `/blog/[slug]` | Supabase `blog_posts` | dynamic | ✅ `published_at`,`updated_at` | ✅ | `article` + `breadcrumb` |
| Guides | `/guides`, `/guides/[slug]` | Supabase `guides` (+ live-stats fallback) | ~12+ | ✅ | ✅ | `webPage`/`article` + `breadcrumb` |
| Schools | `/schools`, `/schools/[slug]` | static `data/co-schools.ts` | **55** | ❌ | **❌ MISSING** | `place`(School) + `breadcrumb` |
| Parks / POI | `/parks`, `/parks/[slug]` | static `data/co-parks.ts` | **20** | ❌ | **❌ MISSING** | `place`(Park) + `breadcrumb` |
| Cities | `/cities`, `/cities/[slug]`, `/cities/[slug]/[nbh]` | Supabase `cities` + live listings | ~11–24 | ❌ | ✅ | `place`+`dataset`+`faqPage`+`breadcrumb` |
| Communities | `/communities`, `/communities/[slug]` | `data/resort-communities.json` | **20 (only 14 in sitemap)** | ❌ | ⚠️ partial | `place`+`dataset`+`faqPage` |
| Subdivisions | `/subdivisions/[slug]` | GIS + registry + MLS | dynamic | ❌ | ✅ | `place` |
| ZIP | `/zip/[zip]` | listings scan | 8 canonical | ❌ | ✅ | `place`+`dataset` |
| Area guides | `/area-guides` | cities+communities index | hub only | — | ✅ | `webPage` |
| Tools | `/tools/*` | `app_config` / client | 3 | — | ✅ | `WebApplication` |
| **Events** | **`/central-oregon/events/*`** | **— none —** | **0** | — | — | **none — THE GAP** |

**Reusable infrastructure (build on these, do not reinvent):**
- **Schema:** `lib/site/json-ld.ts` → `buildJsonLd(input)`; renderer `components/site/MetadataBlock.tsx`. Union today: `realEstateListing | breadcrumb | webPage | faqPage | place | dataset | article`. **No `event` type yet — adding it is task 1 of the events build.**
- **Verified-registry pattern:** `data/co-parks.ts` / `data/co-schools.ts` — typed array, every row carries `sourceUrl`, boundaries from official FeatureServers. This is the §0-compliant, fair-housing-safe pattern new *entity* types should copy.
- **Geo→listings join:** `lib/data/parks/getParkDetail.ts` (centroid → bounding-box → live active SFR homes + median). This is how every place page gets its "live MLS data" moat layer.
- **Sitemap:** `app/sitemap.ts` — monolithic, `revalidate:3600`, uses `listing_tile_mv` to avoid the 589K-row scan.
- **AI discovery:** `app/llms.txt/route.ts` (dynamic, hourly), `app/robots.ts` (AI crawlers explicitly allowed).
- **Nav + reachability gate:** `lib/site-nav.ts` + `scripts/check-nav-reachability.mjs` (every route must be reachable from nav).

### Optimize-what-exists backlog (evidence-based, from the audit — do these alongside new build)
1. **Add schools (55) + parks (20) to `app/sitemap.ts`.** 75 live, indexable pages are invisible to crawlers today. Highest-ROI quick win. → gate: extend `check-nav-reachability`/a new `check-sitemap-coverage` so a routed static-registry type can never again be omitted.
2. **Add the 6 registry communities missing from `RESORT_COMMUNITY_SLUGS`** to the sitemap curated list (reconcile `resort-communities.json` ↔ sitemap).
3. **Add IndexNow** (`app/api/indexnow` + ping-on-publish). Bing/Yandex crawl-boost; near-free. No programmatic indexing exists today.
4. **Add a `lastVerified` date to static registries** (parks/schools/events) and surface it as `dateModified` in schema — honest freshness signal for the entity pages that currently emit none.
5. **Add listicle/ranking hubs** (§4) — the audit's entity pages are detail pages; the most-cited AI page type is the ranked list, which the library has zero of.

---

## 2. Taxonomy + entity/cannibalization map

### 2.1 The type tree (category hub → spoke)
```
Central Oregon (regional context, cross-links)
├── Events            /central-oregon/events            [NEW — build first]
│     ├── festivals, races/SportsEvent, markets, community, arts, seasonal
│     └── /central-oregon/events/[slug]
├── Parks / POI       /parks                            [exists — optimize]
├── Schools           /schools                          [exists — optimize]
├── Neighborhood &    /cities, /communities,            [exists]
│   place pages         /subdivisions, /zip
├── Guides            /guides   (how-to / evergreen housing)   [exists]
├── Blog              /blog     (housing news + evergreen)     [exists]
└── Ranking hubs      /best-of/[topic]  or  /guides/best-*     [NEW — listicle layer, §4]
```

### 2.2 One entity, one canonical owner (the anti-cannibalization rule)
Two pages must never compete for the same query. Assign each **intent** a single owning type:

| Query intent | Canonical owner | NOT |
|---|---|---|
| "homes for sale in {place}" | `/cities/[slug]`, `/communities/[slug]`, `/zip/[zip]` | events, parks |
| "{neighborhood} market / prices / DOM" | `/cities/[slug]/[nbh]` | guides, blog |
| "how do I {buy/sell/finance} …" | `/guides/[slug]` | blog |
| "{event name} {year} Bend" | `/central-oregon/events/[slug]` | blog, guides |
| "things to do in Bend {season}" | ranking hub `/best-of/*` (list) | a prose blog post |
| "{park} / {school}" (the place itself) | `/parks/[slug]`, `/schools/[slug]` | cities |
| timely housing news (rates, policy, a specific sale) | `/blog/[slug]` | guides |

**Enforcement:** before a new page/batch generates, run a keyword-overlap check against the existing library (title + H1 + primary target keyword). Overlap above threshold → the new page must either (a) target a distinct long-tail, (b) become a section of the existing page, or (c) be dropped. This is a generation-pipeline gate (§9), not a manual habit. First-pass entity map lives in `data/content-entity-map.json` (to be created); GSC query data (§10) refines it once we have 30 days of coverage.

### 2.3 Internal-linking IA (design before generating)
- **Every spoke breadcrumbs to its hub** (`BreadcrumbList` already standard via `MetadataBlock`).
- **Cross-links are typed and reciprocal:** event ↔ the park/venue it's at ↔ the neighborhood it's in ↔ nearby schools. An event in Drake Park links to `/parks/drake-park`; the park links back to upcoming events there. These links are *data-driven* (shared `geo_slug` / venue key), not hand-maintained.
- **Hubs rank; spokes convert.** Hub pages are ranked lists (§4) that funnel to detail pages carrying the MLS-data CTA.
- Reachability from `/` is gate-enforced (`check-nav-reachability.mjs`) — every new hub gets a nav entry in `lib/site-nav.ts`.

---

## 3. The moat layer — live data + broker POV on every page

This is the difference between "genuinely more useful than what exists" (Google's helpful-content bar) and scaled-content abuse. **Every** content page carries at least one of, ideally both:

- **A live MLS-data block** via the `getParkDetail`-style geo join: for a place/event, "N homes for sale within 1 mile · median $X · median DOM Y days" — pulled fresh, cached, honestly dated. No competitor calendar has this.
- **A first-hand broker POV block** — one short, specific, human paragraph a broker actually knows: where to park for the event, which end of the lake is quieter, what the school-boundary quirk is. Written, reviewed, in brand voice. Never AI-generic ("a vibrant community with something for everyone" fails the voice gate on sight).

A page with neither is not allowed to ship. This is the E-E-A-T differentiator and the anti-slop firewall.

---

## 4. Page templates per type (with schema)

Pattern for all: **data (registry or Supabase) + one template + `[slug]` + `MetadataBlock` schema.** Match the existing route files.

| Type | Primary schema `@type` | Template notes |
|---|---|---|
| Event | `Event` (+ `SportsEvent` for races, `Festival`, `MusicEvent` as subtype) | `startDate`/`endDate` (ISO-8601), `location`→`Place`+`PostalAddress`, `organizer`, `offers` only if verified, `eventStatus`, `eventAttendanceMode`. Add `EventInput` to `json-ld.ts`. |
| Ranking hub / "best of" | `ItemList` (+ `FAQPage`) | The listicle format — ordered `ItemListElement`, each linking a spoke. Most-cited AI page type. |
| Park / POI | `Place`/`TouristAttraction`/`Park` | exists — add `lastVerified`→`dateModified`; add "upcoming events here" cross-link block. |
| School | `EducationalOrganization` subtypes | exists — fair-housing-safe (data + boundaries only). |
| News | `Article`/`NewsArticle` | exists (blog). |
| Evergreen guide | `Article` + `FAQPage` | exists (guides). |
| Every page | `BreadcrumbList` | already standard. |

**Schema is for classic rich results, not the AEO lever.** Google's own guidance: schema is *not* required for AI citation. We add it for Google rich results + Dataset Search; we do not treat it as the thing that earns the citation. The thing that earns the citation is §3.

---

## 5. Data-sourcing + freshness pipeline

### 5.1 Sourcing by type
- **Events → static verified registry `data/co-events.ts`** (mirrors `co-parks.ts`). Each row = a *recurring anchor entity* (e.g. "Bend Summer Festival"), not a one-off instance. Fields include `recurrence` (human descriptor), `nextConfirmedDate`/`endDate` (ISO, **verified against the official event site** — traced in a `sourceUrl`), `venueSlug` (cross-link key), `category`, `geoSlug`, `blurb` (original write-up, brand voice), `lastVerified`. Rationale: matches the §0-compliant verified-registry pattern, avoids scraping Visit Bend's calendar (ToS/copyright — §7), and gives the newsletter a stable read surface. A Supabase `events` table can layer dated instances later without changing the page contract.
- **Parks/Schools** — already static registries; keep.
- **Cities/communities/zip/neighborhoods** — already live Supabase + MLS; keep.
- **Guides/blog** — already Supabase CMS; keep.

### 5.2 Freshness/expiry subsystem (core, not optional — freshness ≈ 3× AI citations)
- **`lastVerified` on every dated fact.** Surfaced as schema `dateModified`. Honest — never `now()`.
- **Seasonal refresh cron/checklist** — recurring events roll forward ~2–3 weeks ahead of each occurrence (re-verify the date against the source, bump `nextConfirmedDate` + `lastVerified`).
- **Past-event handling:** recurring → roll the date forward (page persists, keeps its link equity). One-off → mark `past`, keep the page as an archival record OR 301 to the hub if thin. Never leave a live page advertising a past date (§0 + trust).
- **IndexNow ping** on any publish/refresh so the fresh date is discovered within the hour.

---

## 6. Off-site entity / reputation track (the ~85% the on-site engine can't reach)

Research (directional, re-verify): ~85% of AI citations come from *off-site* mentions; on-site pages are necessary but not sufficient. Parallel, ongoing track — **owned by governance (§11), not the page pipeline:**
- Local directories + "best of Bend" roundups (get Ryan Realty and its pages cited).
- Review surfaces (Google Business Profile, Zillow — already tracked in memory).
- Wikidata / Google Knowledge Graph entity for "Ryan Realty" (brokerage entity resolution).
- Reddit/forum presence where it's genuinely helpful, never spammy.

This is a *reputation* workstream measured in earned mentions, tracked in the same measurement loop (§10). Flagged here so the spec is honest that on-site volume alone won't move AI citations.

---

## 7. Legal / rights

- **Event copy + photos are copyrighted; venue/Visit-Bend calendars carry ToS.** We do **not** scrape or republish. Every event write-up is **original** (brand voice), every image is **licensed or original** (asset library / iStock sub / original photography). Dates/times/locations are *facts* (not copyrightable) verified against the official source and cited.
- **Fair housing** — neighborhood/school/event content describes places and data, never desirability-for-a-group. No steering. Gate-enforced (§8).
- **§0** — no fabricated dates. If a date can't be verified against a primary source, the event ships without a hard date (recurrence descriptor only) or doesn't ship.

---

## 8. Mechanical gate suite — the SEO/AEO standard, enforced (not prose)

Derived from a 5-angle deep-research pass (2026-07-03, sources cited inline). **Every row is a build-time assertion, not advice.** We only encode practices that are (a) evidence-backed by a primary/credible source and (b) mechanically checkable. Myths and unverifiable folklore are listed in §8b and explicitly NOT gated. Priority = build order (P1 first). "Status" is as of 2026-07-03.

| # | Gate (`scripts/check-*.mjs`) | Mechanical assertion (fails the build) | Evidence | Pri | Status |
|---|---|---|---|---|---|
| G-AEO1 | `check-ai-crawler-access` | `robots.txt` has NO `Disallow` covering `/central-oregon/**` for **OAI-SearchBot, PerplexityBot, Google-Extended, ChatGPT-User, GPTBot**. (GPTBot=training ≠ OAI-SearchBot=citation — must allow the retrieval bots.) | The single cleanest, binary AEO factor. [amicited.com/blog/gptbot-vs-oai-searchbot], Perplexity respects robots.txt | P1 | exists — **extend to assert OAI-SearchBot by name** |
| G-DUP | `check-content-uniqueness` | Jaccard shingling similarity between any two sibling event/venue page bodies < 0.6; every page has a non-template original field (blurb) not near-identical to a sibling. | Scaled-content-abuse + doorway-page spam policies; the #1 existential risk for a templated generator. [developers.google.com/search/docs/essentials/spam-policies] | P1 | **new** |
| G-META | `check-page-metadata-uniqueness` | `<title>` unique site-wide + ≤ ~60 chars; meta description unique + 50–160 chars; exactly one `<h1>`, unique within a template family. | Title/desc uniqueness + pixel truncation. [developers.google.com/search/docs/appearance/title-link] (60-char is a proxy for the ~600px heuristic) | P1 | **new** |
| G-SCHEMA | `check-content-schema` | Every detail page emits a valid `BreadcrumbList` (≥2 `ListItem`, 1-indexed `position`+`name`, `item` on all but last) + its primary `@type`. **`Event`** needs `name`, valid ISO `startDate`, `location.name`, **`location.address.streetAddress`+`addressLocality`** (required for the Event rich result). | [developers.google.com/search/docs/appearance/structured-data/event], [/breadcrumb] | P1 | **new** (validate JSON-LD field presence, ajv/JS, no browser) |
| G-FRESH | `check-content-freshness` | No registry row has a `nextConfirmedDate` in the past. `dateModified`/`lastVerified` may only advance when the row's content hash changes (anti-fake-freshness). | Fake freshness backfires for AI citation + violates helpful-content policy. [developers.google.com/search/blog/2019/03/help-google-search-know-best-date-for] | P1 | **new** |
| G-SITEMAP | `check-sitemap-coverage` | Every routed content type with a static-param set (events, venues, parks, schools) appears in `app/sitemap.ts`; every sitemap URL is canonical. | Sitemap is the discovery backstop; 75 pages were missing. [developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap] | P2 | **new** |
| G-ORPHAN | `check-link-graph` | Zero orphan content pages (every page reachable from `/` via rendered internal `<a>`); click-depth ≤ 4. | Orphan/click-depth are real discovery signals; single link-graph crawl covers both. [SEJ: click depth; Screaming Frog: orphans] | P2 | **new** (extends `check-nav-reachability`) |
| G-XLINK | `check-cross-links` | Each event links its venue when one exists; each venue links ≥1 of its events; every spoke↔hub edge is reciprocal. | Cross-linking = discovery + no orphaning (not "topical authority"). [developers.google.com/search/docs/crawling-indexing/links-crawlable] | P2 | **partial** (venue→events shipped; add the gate) |
| G-ANSWER | `check-answer-structure` | Content **list/table renders in server HTML** (not JS-only); hub pages expose a real `<ul>/<ol>`; detail pages front-load a direct-answer block in the first ~150 words. | Listicles ≈ 63% of LLM citations; ~44% of citations from the first 30% of a page. [blog.mean.ceo AI-citation study] | P2 | **new** |
| G-IMG | `check-image-discipline` | Every `<img>` has non-empty `alt` (or explicit decorative) + `width`/`height`; the hero/LCP image is NOT `loading=lazy` (ideally `fetchpriority=high`); below-fold images ARE lazy. | LCP/CLS + Image SEO. [web.dev/articles/browser-level-image-lazy-loading], [developers.google.com/search/docs/appearance/google-images] | P3 | **new** |
| G-A11Y | `ci:kb-a11y-static` + axe `heading-order` | No skipped heading levels; no banned generic anchor text ("click here", "read more", "learn more") on content links. | Heading order (a11y, axe-core); descriptive anchors. [developers.google.com/search/docs/crawling-indexing/links-crawlable] | P3 | **exists — extend with anchor-text rule** |
| G-VOICE / G-FH | `ci:brand-voice` + `check-fair-housing` | Brand voice on `app/central-oregon/**` + registry blurbs; banned fair-housing steering-phrase regex. | Brand + fair-housing compliance. | P1 | brand-voice exists; **fair-housing new** |
| G-DAL | `ci:data-access` / DAL boundary | Content reads through `lib/data/{events,venues}/*`; pages import `@/lib/data`; no raw `.from()`. | Repo DAL doctrine (G1/G8). | — | exists — passing |

### 8b. Myths we explicitly do NOT gate (the research killed these — encoding them would codify folklore)

- **Minimum word count** (300/500/1000) — Mueller + Sullivan on record: "not a thing." A word-count gate would build the myth into CI. NOT gated.
- **Exactly one H1 for SEO** — Google doesn't care for ranking; we keep one H1 for **accessibility only** (G-A11Y), not as an SEO rule.
- **100-links-per-page cap** — dead pre-2008 rule. NOT gated (we only flag anomalous link counts vs. the template median).
- **"Topical authority" bonus** — Mueller: folklore rebrand of relevancy. We build hub/spoke for IA + discovery, not a ranking multiplier.
- **`llms.txt` as an AEO lever** — confirmed myth (Google: no; 97% zero-request rate). We keep the file (harmless, low cost) but do NOT gate on it or claim it lifts citation.
- **FAQPage for a rich result** — the FAQ rich result was **removed for all sites in 2026**. We keep FAQPage JSON-LD for validity only (G-SCHEMA checks it doesn't ship broken), NOT as a ranking/AEO lever.
- **Schema as an AI-citation driver** — best controlled evidence (Ahrefs, 1,885 pages) shows ~no effect. Schema stays for classic rich-result eligibility (Event/Breadcrumb), not oversold as an AEO lever.
- **Core Web Vitals as a dominant factor** — real but secondary. We gate LCP/CLS as hygiene via a Lighthouse budget, never as a ranking guarantee.

### 8c. Corrections this research forced on what we already shipped

1. **Event schema is missing `location.address.streetAddress`** — required for the Event rich result. Fixed for venue-hosted events (we have the venue address); events with no precise street stay Event-schema-valid but won't earn that specific rich result (honest).
2. **FAQPage schema** stays for validity but is no longer sold as a lever (rich result dead 2026).
3. **`llms.txt`** stays (we added events/venues) but is documented as not-a-lever.
4. **The moat is off-site too**: ~25%+ of ChatGPT citations come from Wikipedia + Reddit; on-site work is necessary, not sufficient (§6 off-site track stands, now evidence-backed). [prnewswire 5W study]

The rule from `feedback_gates_not_prose`: when a class of error recurs, the fix is a failing gate, not a paragraph here. The table above is the contract.

---

## 9. Generation + human-review pipeline

**Producer-freeze note (governance):** the marketing-brain *execution layer* is frozen (CLAUDE.md §Producer-layer freeze, G45). Building the events **route + template + registry** is **out of that freeze** — it is the website (durable spine), not a marketing-brain producer/cron. An **autonomous content-generation producer/cron stays design-only** until Matt lifts the freeze. So the pipeline below is **human-driven / agent-assisted**, not an autonomous producer:

1. **Propose a batch** (small — a reviewed batch, never a firehose): agent drafts N pages worth of registry rows + blurbs.
2. **Gate pass:** brand voice + fair-housing + §0 verification trace (every date/stat cited) + cannibalization check (§2.2).
3. **Contact sheet** (per `feedback_contact_sheet_required`): an HTML preview Matt opens in the browser — every new page rendered, every stat traced.
4. **Matt reviews → approves → commit + push** (draft-first). Only then does the batch land.
5. **Measure** (§10) → **prune** losers, double down on winners → next batch. This *is* THE LOOP.

**Quality bar per page (Google helpful-content, gate-adjacent):** unique, first-hand, genuinely more useful than the best page that already exists for the query. If it isn't, it doesn't ship. Batches are small and reviewed precisely because hundreds of thin templated pages can demote the *whole* already-ranking site (the existential risk in the handoff).

---

## 10. Measurement + pruning (= THE LOOP)

Per page, tracked over time:
- **GSC** — impressions, clicks, avg position, query set (feeds the §2 entity map; catches cannibalization empirically).
- **AI citations** — appearances in ChatGPT/Perplexity/Google AI Overviews for target queries (sampled).
- **Organic sessions** (GA4 — property `527333348`, per memory) + engagement.
- **Newsletter CTR** — the newsletter is the library's #1 internal distribution; per-link CTR ranks the library.
- **Off-site mentions** (§6) — earned-citation count.

Cadence: monthly review. **Winners** → expand the cluster. **Dead weight** (no impressions/clicks after a fair window) → consolidate or 301, never leave to rot. This closes the loop and is the governance heartbeat.

---

## 11. Governance

- **Owner:** Matt (principal broker — the POV and the license are his; final review is his).
- **Update cadence:** monthly measurement + pruning (§10); seasonal event roll-forward (§5.2); registry `lastVerified` re-checks.
- **Anti-rot rule:** a library with no owner and no cadence is dead in a year. The cadence above is the contract.
- **This doc is living** — when a rule proves out, it becomes a gate (§8) and this section shrinks.

---

## 11a. Content category map — what to build (the gap answer)

The existing library covers **housing + place**. The gap is the **lifestyle + relocation** half — the content that ranks for "things to do" and that buyers research before they ever search a listing.

| Bucket | Missing categories (Central-Oregon-specific) | Priority |
|---|---|---|
| **Recreation** | Trails (Phil's, Deschutes River, Shevlin) · Golf courses (Tetherow, Pronghorn, Brasada, Juniper, Eagle Crest) · Lakes & rivers (Cascade Lakes, Elk, Sparks, floating) · Skiing/snow (Mt Bachelor, sno-parks) · Climbing · Fishing · Camping · Scenic drives | Wave 1 (golf, trails) |
| **Food & drink** | Breweries (Bend Ale Trail) · Dining · Wineries/cideries/distilleries · Coffee · Farmers markets | Wave 1 (breweries) |
| **Relocation & practical** ⭐ | Moving to Bend · Cost of living · STR rules by city · Wildfire risk / defensible space / insurance · Property taxes by area · Commute & RDM airport · Climate/seasons · Healthcare · Internet/utilities | Wave 1 (highest buyer intent) |
| **Housing deepeners** | Land/acreage buying (well/septic/zoning) · New construction/builders · ADUs · 55+/active-adult · Property-type hubs (riverfront, golf-course, ranch, log, luxury, condo, view lot) · HOA · Vacation/investment | Wave 2 |
| **Ranking hubs (listicles)** ⭐ | Best neighborhoods for families/value/walkability · Best parks for dogs · Best golf communities · Best breweries | Wave 1 (recombines existing data; most-cited AI page type) |
| **Attractions/landmarks** | High Desert Museum · Lava Lands/Newberry · Pilot Butte · Old Mill District · Tower Theatre | Wave 2 |

Notes: `trails` hero key + `/lp/central-oregon-golf` already exist (half-scoped). Land-buying differentiator has documented data sources (memory `reference_bend_land_data_sources`). STR caps + wildfire/insurance are the two questions every CO buyer asks.

## 11b. Cross-cutting page-depth upgrades (apply to events, parks, and every new type)

1. **Map on every place/event page.** Reuse `components/site/NeighborhoodMap` (polygon + live home pins, already on /parks; Google Maps live). Park-venue events reuse the park polygon; other venues need a one-time **venue-pin mode** (the component currently returns null without a polygon).
2. **Per-entity hero — sourcing ladder (locked 2026-07-03).** A hero must be a *genuinely relevant* photo, never a loose geo-match (the geo-only `getSurfaceImage` picked a Tetherow sign for a Drake Park event — retired for events). Source in this order, and **render photographer credit on every hero** (recognition where required):
   1. Curated original / licensed asset-library photo tagged to the entity.
   2. **Wikimedia Commons** for a real photo of the actual venue/landmark (Drake Park, Old Mill) — CC-licensed, attribution rendered. Best when it exists.
   3. **Unsplash / Pexels** for a licensed, on-topic lifestyle photo (balloons, beer steins, orchestra) — attribution rendered.
   4. Licensed stock (iStock / Shutterstock — keys present) when the above miss.
   5. Fallback: the canonical Central Oregon lifestyle hero — never a mismatched landmark.
   Never scrape venue/event photos (§7). Reusable tooling: `scripts/_source-event-heroes.mjs` (queries the stock APIs) + `_download-event-heroes.mjs` (downloads picks + captures attribution to a credits module). Credits render from `data/event-hero-credits.ts`; files in `public/images/events/`.
3. **FAQ + `FAQPage` schema** on detail pages — the direct AEO lever.
4. **Dense reciprocal cross-links** — event ↔ park/venue ↔ nearby trails/breweries ↔ neighborhood ↔ schools (§2.3).
5. **Photo gallery** (licensed/original) + verifiable logistics/seasonal notes (§0).

## 12. Build order

1. **Events first** (newsletter blocker): `EventInput` in `json-ld.ts` → `data/co-events.ts` (verified seed) → `lib/data/events/*` DAL → `/central-oregon/events` hub (`ItemList`) + `/central-oregon/events/[slug]` (`Event`) → nav + sitemap wiring → verify render → draft to Matt.
2. **Sitemap fix** for parks/schools/communities (the 75-page gap) + `check-sitemap-coverage` gate.
3. **IndexNow.**
4. **Ranking hubs** (`/best-of/*` listicle layer).
5. **Fair-housing + freshness gates.**
6. Then iterate per THE LOOP.
