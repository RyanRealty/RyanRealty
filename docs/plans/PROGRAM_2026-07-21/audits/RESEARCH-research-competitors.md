# What Bend competitors actually put on their Bend, Oregon pages — and what wins in 2026

**Research date:** 21 July 2026. SERP data pulled live via Google (Apify RAG Web Browser) on that date, US/desktop, unpersonalized. Portal pages (Zillow, Redfin, Realtor.com, Trulia) actively bot-block; where I could not render a page myself I say so explicitly and mark the claim as recalled rather than verified.

---

## 1. The actual SERP

### Query: "Bend Oregon real estate" (verified, 2026-07-21)

| Rank | URL | Page type |
|---|---|---|
| 1 | `zillow.com/bend-or/` | Portal city page |
| 2 | `redfin.com/city/1543/OR/Bend` | Portal city page |
| 3 | `bendrealestate.com/` (Greg Broderick, Stellar Realty NW) | **Single-agent site, homepage = city page** |
| 4 | `realtor.com/realestateandhomes-search/Bend_OR` | Portal city page |
| 5 | `trulia.com/OR/Bend/` | Portal city page |
| 6 | `cascadehasson.com/realestate/search/city/Bend/OR` | Brokerage (Sotheby's) IDX city page |

### Query: "homes for sale in Bend Oregon" (verified, 2026-07-21)

Ranks 1, 3, 4, 5 captured: Zillow (1), Realtor.com (3), Trulia (4), `bendrealestate.com` (5). Rank 2 did not render — almost certainly Redfin, based on the sibling query. Movoto and `bendpremierrealestate.com` also surfaced in the broader result set.

**Read:** the head term is a portal wall, with exactly **one** local site punching into the top 5 in both queries — `bendrealestate.com`, a solo broker on a Sierra Interactive platform (asset paths resolve to `sierrastatic.com` / `css.site-static.com`). Cascade Hasson is the only franchise brokerage on page one. No Bend brokerage other than Cascade Hasson appears. That is the head-term picture.

### The actual opening: neighborhood-level queries

Query: **"NorthWest Crossing Bend Oregon homes for sale"** (verified, 2026-07-21)

| Rank | URL | Note |
|---|---|---|
| 1 | `zillow.com/bend-or/in-northwest-crossing_att/` | Zillow *attribute* page — keyword-match facet, 93 homes |
| 2 | `redfin.com/neighborhood/548318/OR/Bend/Northwest-Crossing/single-story` | Redfin *facet* page (single-story sub-filter), 9 homes |
| 3 | `bendrealestate.com/northwest-crossing/` | **Local agent page** |
| 4 | `realtor.com/realestateandhomes-search/Northwest-Crossing_Bend_OR` | Portal neighborhood page, 23 homes |
| 5 | `cascadehasson.com/NorthWest-Crossing` | **Local brokerage page** |

Two things matter here.

First, **local sites hold 2 of the top 5 at neighborhood level versus 1 of 6 at city level.** The competitive gradient is steep and it favors specificity. Every step down the geographic ladder (city → quadrant → neighborhood → subdivision → street/HOA) drains portal advantage, because the portals' page for that entity is a generated facet, not a document about a place.

Second, note *what* Redfin ranked #2 with: a filter-combination URL (`/Northwest-Crossing/single-story`) surfacing **nine listings**. That is a programmatic facet page with essentially no prose. It ranks on domain authority and entity/inventory match, not content quality. A brokerage cannot copy that play — you don't have the authority to make thin facets rank — but it tells you the query space is wide open on the *content* axis, because the incumbent at #2 has none.

**Uncertain:** I did not verify local-pack / map-pack composition, AI Overview presence on these specific queries, or mobile SERPs. Real-estate AIO trigger rate is very low industry-wide (see §6), so I'd expect no AI Overview on transactional Bend queries, but I did not confirm it for these exact strings.

---

## 2. Portal city-page anatomy

All four portals block automated rendering (Redfin returns a "Human Verification" interstitial; Realtor.com and Trulia returned hard failures). What follows separates what I **verified from live SERP snippets and metadata on 2026-07-21** from what is **recalled from prior familiarity** and should be spot-checked in a browser before you build against it.

### Verified from live data (2026-07-21)

- **Zillow** `/bend-or/`: 1,485 homes for sale; meta emphasizes listing photos, sales history, filters.
- **Redfin** `/city/1543/OR/Bend`: 1,523 homes; **"Updated every 2 minutes"** freshness claim in the meta description; separate `/housing-market` child page exists at `redfin.com/city/1543/OR/Bend/housing-market`, plus a state-level `/state/Oregon/housing-market` parent — an explicit market-data hub hierarchy.
- **Realtor.com** `/realestateandhomes-search/Bend_OR`: 1,743 homes; **median listing price $769,000** surfaced directly in the meta description.
- **Trulia** `/OR/Bend/`: 1,481 homes, **97 new listings**, and a rendered **"Home Size / Home Value" table** — `1 bedroom (54 homes), $363,245` — i.e. a bedroom-count-segmented valuation module exposed to the SERP.
- **Redfin market signals in general search results:** median list price/sqft $391; median days on market 68; price/sqft down 2% YoY vs. July 2025; median list price $757K (July 2026).

Note the inventory spread across portals for the same city on the same day: **1,481 / 1,485 / 1,523 / 1,666 / 1,704 / 1,743.** A 262-unit spread (~18%) driven by differing property-type inclusion and refresh lag. That inconsistency is itself an exploitable content angle — a page that states its filter definition and refresh time explicitly is more trustworthy than any of them.

### Recalled module inventory (verify before building against)

**Redfin city page** — the most module-dense of the four:
1. Listing grid + map, filter rail, sort
2. Market summary block (median sale price, median $/sqft, sale-to-list, # sold, YoY deltas)
3. **Redfin Compete Score** (0–100 proprietary competitiveness index) — a named, ownable metric
4. Housing-market child page with multi-year charts, migration/relocation data ("where people moving to Bend come from")
5. **Climate risk** module — flood, fire, heat, wind, air quality, powered by First Street Foundation
6. **Schools** — GreatSchools ratings (confirmed as Redfin's school data provider)
7. **Walk Score / Transit Score / Bike Score** (confirmed: Redfin operates Walk Score; Walk Score and Transit Score are each weighted 3% in Redfin's Best Places to Live methodology)
8. Neighborhood list, ZIP list, nearby-cities list, "popular searches" facet link farm
9. Sold/recently-sold, open houses, new construction, price-band and property-type facets
10. FAQ block ("How many homes are for sale in Bend?", "What is the housing market like in Bend?")
11. Agent-attach CTA

**Zillow city page:** listing grid + map, Zestimate-driven market overview, Zillow Home Value Index, rental trends, sales activity, new construction, market forecast, schools, nearby neighborhoods/ZIPs/cities, saved-search and alert capture, and a large SEO footer link block. **Zillow removed climate-risk scores from listings** (Deeds.com) — so climate is currently a Redfin/Realtor.com differentiator, not a Zillow one. Zillow's attribute-page system (`/in-northwest-crossing_att/`) is a distinct, keyword-matched page type that ranked #1 above.

**Realtor.com city page:** listing grid, median list price + list-price-per-sqft, DOM, schools (with district boundary overlay), noise score, flood/fire risk, commute-time filter, neighborhood and ZIP breakouts, nearby cities, market-trends child page, and an FAQ block.

**Trulia:** the "local knowledge" layer is its historical differentiator — crime/safety heat maps, resident reviews, neighborhood "what locals say" sentiment, commute overlays — plus the bedroom-segmented value table verified above.

**The structural takeaway.** A portal city page is roughly **11–14 distinct modules**, of which only two (the listing grid and the market stats) come from the MLS. The other nine-to-twelve are *third-party data joins* — GreatSchools, Walk Score, First Street, Census, noise, commute — plus *internal-link surfaces* (neighborhoods, ZIPs, nearby cities, facets). The portals win the head term on domain authority, but the reason those pages *deserve* to rank is that they answer eight questions a listing grid doesn't.

---

## 3. What the local competitors actually ship

### `bendrealestate.com` — the one local site beating the portals (fully rendered, 2026-07-21)

This is the page to study, because it is the proof that a non-portal can hold a top-3 for "Bend Oregon real estate." Its homepage doubles as the city page. Full module inventory:

1. H1 "Bend Real Estate .com" + `$COUNT$` homes tagline (a **broken template token rendering literally** — visible on the live page)
2. Search bar (location/ZIP/address/MLS# + min/max price) and "Search Properties Near Me"
3. **Five saved-search carousels** — Latest Homes; <$1M; $1M–$2M; $2M–$4M; $4M–$20M — each with "View More Like This"
4. **Live stat strip, date-stamped "July 21, 2026":** `317 Listed · 100 Avg. DOM · $510.75 Avg. $/Sq.Ft. · $1,425,000 Med. List Price`
5. Gallery/List/Map view toggle, sort control, alert capture, 16 pages × ~20 listings, each card carrying **subdivision name** (Awbrey Butte, Discovery West, Tetherow, Pronghorn, Collier…) and **listing brokerage attribution**
6. **~700 words of first-person editorial** across six blocks: "Bend Oregon Real Estate", "Homes For Sale in Bend, OR", "About Bend", "Bend OR Real Estate Guidance", "Bend Real Estate Concierge Service", "Bend, OR Realtor"
7. **An 18-link internal-link block** — Awbrey Butte, 97701, 97702, 97703, Condos, Bend Oregon Real Estate, Brasada Ranch, Broken Top, Communities, Deschutes County, Golf Course Properties, Land & Lots, Luxury Homes, Mountain View, North Rim, Northwest Crossing, NW Bend Neighborhoods, Tetherow, + "View More"
8. "Local Market Activity" chart with a metric selector (Median Price / Avg $ per Sq. Ft. / Avg Days on Site, past 6 months)
9. Four dynamic tiles: Residential / New This Week / Price Reduced / Recently Sold
10. Broker identity block with **Oregon License #200304085 hyperlinked to oregon.gov/REA**, street address, direct mobile
11. Nav exposing quadrant hubs: NW / SW / NE / SE Bend neighborhood pages, plus Duplex, Townhomes, Land & Lots, Foreclosures, 1031 Exchange, Single-Story, River-View/Waterfront, Mountain-View

**Now the failures, because they are your opening:**

- **The chart is broken.** The "Local Market Activity" module renders **"No Chart Data"** on the live page. Their single unique-data module does not work.
- **The stat strip is mis-scoped.** `317 Listed / $1,425,000 Med. List Price` is scoped to the **$1M–$2M carousel**, not to Bend. Presented adjacent to an H1 reading "Bend, OR Homes For Sale," it reads as a Bend median — and it is roughly double the real figure (~$757–769K per Redfin/Realtor.com the same day). A visitor cannot tell. Under your §0 data-accuracy standard this is a fail, and it is the kind of thing a competitor page can quietly beat by simply labeling its filter.
- **`$COUNT$` renders as a literal token** in the hero.
- **No schools. No climate/wildfire risk. No walkability. No commute. No cost of living. No FAQ. No nearby cities. No property-tax or HOA data.** Zero of the eight third-party joins the portals carry.
- **No author byline, no publish or updated date, no schema evidence, no citations.** The license link to oregon.gov is the entire E-E-A-T footprint — genuinely good, and the single best idea on the page.
- Editorial is **first-person "I" throughout**, unverifiable ("28 years" in one paragraph, "29 years" two paragraphs later — an internal contradiction on the live page), and heavy on the exact adjective class your brand voice bans.
- Content is **evergreen-static**: nothing in the prose would change if Bend's market moved 20%.

### `cascadehasson.com/NorthWest-Crossing` (Sotheby's, rank 5 on the NWX query)

Meta indicates short editorial framing housing stock by architectural style ("bungalows, northwest craftsman and mid century modern") above an IDX grid. Franchise-template pattern: a paragraph, a grid, a form. I did not render this page (403).

### `codyfunkgroup.com/neighborhoods/coeur-d-alene` (Coeur d'Alene, Luxury Presence platform — fully rendered)

Included as the **control case for "template site"** — this is what most agent/brokerage geo pages actually look like:

- ~600 words of undifferentiated prose, structurally an AI-era blog post: intro → "Neighborhoods" → "School Districts and Individual Schools" → "Amenities" → "In conclusion, Coeur d'Alene is a city with something for everyone."
- A **Census overview module**: 55,558 population, median age 40.1, population density "High", average individual income $38,872 — attributed to U.S. Census Bureau, with a definition tooltip on density. That attribution-plus-definition pattern is the one genuinely good thing on the page.
- A listing grid dominated by **sold** comps sorted price-descending ($9.2M, $7.5M, $7.3M…) — impressive-looking, useless for a buyer.
- Two lead forms, a bio, a footer.
- No market stats, no DOM, no price trend, no FAQ, no dates, no per-neighborhood pages despite the prose naming six neighborhoods (Fort Grounds, Downtown, Sanders Beach, Hayden Lake, Dalton Gardens, Canfield) — **six named entities, zero internal links to them.** That is the single most common wasted opportunity in the category.

### What the good ones do that a template does not

Synthesizing the exemplars found for comparable resort markets (Bozeman Real Estate Group's neighborhood guides, Savage Real Estate Group, Ami Sayer, Smith & Co. in Bozeman; Cody Funk and DestinationLiving in Coeur d'Alene) against the templates:

1. **They name and bound the thing.** "Fort Grounds… roughly 110 homes, many over 100 years old" (DestinationLiving) is a sentence no template produces and no portal has. Specific counts, specific ages, specific boundaries.
2. **They organize by buyer intent, not by geography alone.** "Best areas to live in Bozeman," "family-friendly neighborhoods," "moving to Bozeman" — the query is the page, and the neighborhood is the answer.
3. **They cover subdivisions the portals treat as attributes.** Harvest Creek, Baxter Meadows, West Winds, Middle Creek each get a document. In Bend that maps to Discovery West, Tetherow, NorthWest Crossing, Awbrey Butte, Broken Top, Pronghorn, Brasada, North Rim, Woodside Ranch, Shevlin — plus the resort communities you already model in `data/resort-communities.json`.
4. **They interlink into a real hub-and-spoke** rather than leaving named places as plain text.
5. **They attribute data sources visibly** (Census, GreatSchools, district names) with definitions.
6. **They put a human with a license on the page.** `bendrealestate.com`'s oregon.gov license link is, honestly, the strongest E-E-A-T signal I found on any local page in this research — and it costs nothing to beat by doing it for three named brokers with headshots, bios, and transaction history.

**Caveat:** I evaluated the Bozeman/CDA exemplars primarily via search metadata and one full render. I did not audit their traffic, backlinks, or actual rankings. Treat them as design references, not proven winners.

---

## 4. What drives rankings for local real estate pages in 2026

Consolidated from Sierra Interactive, Luxury Presence, and the local-SEO practitioner literature surfaced in this research. Where the sources are vendor-published (most of them are), weight accordingly.

**Local ranking weights (practitioner consensus, not Google-published):** proximity to searcher ~55%, Google Business Profile signals ~32%, reviews ~16–20%, on-page ~19%. These are commonly-cited figures that overlap and do not sum meaningfully — treat as a rough ordering, not arithmetic. The durable point: **GBP and reviews outrank on-page for map-pack visibility**, while on-page and content depth drive organic blue links. You need both, and they are different games.

**Content depth thresholds (the numbers people actually build to):**
- Hub/pillar page ("Complete Guide to Bend Neighborhoods"): **3,000–5,000 words**
- Individual neighborhood guide: **1,500–2,500 words**, minimum 1,500
- Original first-person commentary within each: **200–300 words minimum**
- Answer blocks intended for AI extraction: **under 300 characters**
- Programmatic pages under **~150 words of genuinely unique content should be `noindex`** until they earn more

**Internal linking:** hub-and-spoke, **5–8 internal links per neighborhood page** — 1 to the hub, 2–3 to similar neighborhoods, 1–2 to comparison articles, 1–2 to school/district resources. Google evaluates topical authority across the connected cluster, not per-page. `codyfunkgroup` naming six neighborhoods with zero links is the exact anti-pattern.

**E-E-A-T for YMYL real estate.** Real estate content touching price, mortgage, or legal disclosure is YMYL. Required: real author bios with credentials and hands-on experience, a physical address and phone, a named responsible organization, cited reputable sources, and **current** stats and laws. Stale numbers are an active YMYL demerit, not merely a neutral. For Ryan Realty specifically: three licensed brokers, license numbers, headshots, real transaction history, and a verification trace under every stat is a stronger E-E-A-T stack than anything currently ranking in Bend.

**Schema:** LocalBusiness (agency NAP + coordinates), RealEstateListing, Place, FAQPage, Person (agent credentials + areaServed + knowsAbout + aggregateRating), BreadcrumbList. Only **6.4% of audited top-ranked agent websites** correctly implement Person + RealEstateAgent schema with relationships to Place and Review entities (FlyDragon, 500-site audit). That is a nearly-free differentiator.

**Freshness cadence:** quarterly minimum for MLS stats, school ratings, HOA/tax data, amenities. Redfin advertises **"updated every 2 minutes"** in its meta description — freshness is being used as a competitive claim on the SERP itself. If your market data is genuinely 10–15 minutes fresh (per your `market_pulse_live` cache), say so on the page with a timestamp. Nobody else in Bend does.

**Page experience:** Core Web Vitals still matter, and IDX grids are the usual offender — heavy client-side rendering, lazy-loaded photos, layout shift. `bendrealestate.com` ships photo placeholders (`loadingphoto_mid.gif`) into initial HTML, which is a LCP problem.

**Reported result for calibration:** a Newport Beach agent fixed 43 of 52 inconsistent local citations and ran a review-generation push; over 14 weeks moved from local-pack position 8 → 2, with GBP calls 8 → 19/month. Single-case vendor anecdote, but the mechanism (citation consistency + review velocity) is the most reliably-reported local-pack lever in the literature.

---

## 5. Programmatic SEO at scale — what works and how it fails

**What works.** The portals' entire model is programmatic: Redfin ranked #2 for a Bend neighborhood query with a *filter-combination* page carrying nine listings. Zillow ranked #1 with an attribute page. Programmatic geo/facet pages at scale absolutely rank — **when the domain has the authority to carry thin pages, and when each page maps to a real entity with real inventory.**

**The failure modes, specifically:**

1. **Near-duplicate content — the most common failure.** Pages structurally identical with one variable swapped. "For real estate specifically, location pages must offer unique value, not just swapped geo terms. When a multi-location brand mass-produces pages that look identical, index bloat and quality reassessment are predictable outcomes."
2. **Thin content becomes a domain-level signal.** "A single thin page is a manageable issue. Ten thousand thin pages is a domain-level signal." This is the asymmetry that matters: the downside is not that the thin pages fail to rank, it's that they drag the pages that *would* rank.
3. **Index bloat.** Auto-generated near-duplicate URLs — faceted filters, internal search results, endless calendar/pagination — swamp the index, drain crawl budget, and dilute link equity.
4. **Crawl budget starvation.** "If Googlebot reaches its crawl limit on soft 404s and parameter variations, your actual money pages get crawled less frequently or not at all." Slow server response, missing internal linking, and unoptimized sitemaps compound it.

**How the winners avoid it:**

- **The ~150-word rule as a hard gate.** Any generated page with under ~150 words of genuinely unique content ships `noindex` until it earns more. This is described in the literature as "the safety valve that prevents thin pages from dragging down the whole site's quality signals." For you this is a mechanical gate, not a guideline: fail the build if a geo page's unique-token count is below threshold.
- **Inventory gates.** No page for an entity with zero active listings and zero closed comps. Zillow's NWX page had 93 homes; Redfin's facet had 9. A Bend subdivision with 0 actives and 2 sales in 24 months should not be indexed as a search page — it can exist as a section of a parent page.
- **Genuinely unique data per page**, not rephrased boilerplate. This is where Ryan Realty has a structural advantage most competitors don't: you have 589K+ rows in `listings`, a 6-hour `market_stats_cache`, a 10–15 min `market_pulse_live`, `listing_history`, `boundaries`, and 14 resort communities + 14 Bend neighborhoods already modeled. Real per-entity medians, DOM, MoS, sale-to-list, absorption, and YoY are computable per page. That is the difference between programmatic-that-ranks and programmatic-that-poisons.
- **Tiering.** Tier 1 (city, quadrants, ~10 major neighborhoods): fully hand-written, 1,500–2,500 words, editorially maintained. Tier 2 (subdivisions with real inventory): templated skeleton + computed data + 200–300 words of genuine broker commentary each. Tier 3 (everything else): `noindex`, exists for internal navigation and user value only.
- **Crawl hygiene:** canonical discipline on filter permutations, `noindex` on internal search results and parameter variants, segmented XML sitemaps by tier so you can watch indexation rate per tier in Search Console, and no infinite pagination.

**The honest constraint:** you cannot out-programmatic Zillow. Their facets rank on authority you don't have. The play is a **bounded, high-quality set** — call it 60–120 indexed geo pages covering every Bend neighborhood, quadrant, ZIP, and resort community with real inventory — each of which is genuinely the best page on the internet about that place. Not 5,000.

---

## 6. AEO — getting cited by ChatGPT, Perplexity, and AI Overviews

**Start with the sizing, because it changes the priority.** Per Conductor's 2026 AEO/GEO Benchmarks Report (21.9M Google searches, 13,770 domains), **real estate triggers a Google AI Overview in just 4.48% of searches — the lowest of any tracked industry**, because real-estate queries are transactional and hyper-local. So AEO in real estate is a *positioning* investment, not this quarter's traffic driver.

**Citation rates differ by an order of magnitude across platforms:**

| Platform | Citation rate | Behavior |
|---|---|---|
| ChatGPT | **0.7%** of answers include a source URL (holds 87.4% of AI referral traffic) | Favors consensus sources; Wikipedia = 7.8% of its citations |
| Google AI Mode | 9.5% | ~54% overlap with traditional organic rankings |
| Perplexity | **13.8%** | Heavy on Reddit (46.7% of top citations) and real-time sources |
| Claude | — | ~30% more likely to cite bullet-pointed, structured pages |

A separate 2026 study of 34,234 AI responses found a **46× difference in brand citation rates** between ChatGPT (0.59%) and Perplexity (13.05%). Only **11% of domains are cited by both** ChatGPT and Perplexity (analysis of 680M citations). There is no single AEO strategy — there are per-platform strategies.

**Who currently gets cited in real estate:** listing platforms (Zillow, Redfin, RentCafe, Apartments.com) take **~60% of AI citations** in the category, **Zillow alone 21.3%**. Zillow, Realtor.com, Redfin, Trulia and Homes.com account for an estimated **61% of real-estate URLs in public LLM training datasets**. Only **8.4% of practicing U.S. agents** appear in AI responses to buyer queries, and **the top 1% of those capture 47% of all AI citation share.**

**Structural choices that raise citation rate** (strongest-evidence first):

1. **Third-party citations, not owned content.** Weighted **31%** in FlyDragon's model — the single largest factor. Listicles, local news, podcasts, PDF reports, Reddit, YouTube transcripts. Industry average is 7 active third-party citations; their client cohort averages 112. This is the uncomfortable finding: the highest-leverage AEO work happens off your own site.
2. **Entity + schema infrastructure — weighted 27%.** Person + RealEstateAgent schema with `jobTitle`, `worksFor`, `address`, `sameAs`, `areaServed`, `knowsAbout`, `aggregateRating`; consistent NAP across 22+ directories; a **Wikidata entry** with `sameAs` links (only 1.8% of agents have one); GBP with weekly updates and Q&A management. Only 6.4% implement the schema correctly.
3. **Answer-first content — weighted 14%.** Every asset opens with a **40–80 word direct answer**, uses buyer-question headings, embeds FAQPage schema, references named local entities, and includes **original data**. Keep extractable answer blocks **under 300 characters**.
4. **Reputation density — weighted 11%.** Reviews spread across **4+ platforms**, not concentrated on Google. 71% of buyers won't contact an agent without third-party validation; LLMs disproportionately weight third-party consensus.
5. **Multi-modal presence — weighted 9%.** YouTube with published transcripts, podcast appearances with searchable show notes, captioned images, PDF assets per service area. "Agents who exist only as text are invisible to roughly 35% of AI surfaces."
6. **Technical AI-readability — weighted 5%.** **17% of audited agent sites unintentionally block GPTBot, ClaudeBot, or PerplexityBot in robots.txt.** Check yours today; it's a five-minute fix and a total-invisibility failure if wrong.
7. **Freshness signals.** Perplexity cited content published within the last 30 days at an **82% rate**; visible year signals — "2026" in titles and headings — improve citation rates by **~30%**.

**Source-quality warning, stated plainly.** The most specific numbers in this section (the seven-pillar weights, the 8.4% agent citation share, the 3.8× lift, the lead-quality table showing AI leads closing at 9.6% vs. Zillow's 2.4%) come from **FlyDragon's "2026 State of AI SEO in Real Estate," a vendor-published report by an agency selling AI-SEO services to real estate agents.** Their proprietary dataset is not independently auditable. The externally-sourced figures they cite (Conductor's 4.5% AIO trigger rate, Seer's CTR study, Birdeye) are checkable and consistent with other sources; their own benchmarks should be treated as directional marketing material. The *directional* claims — portals dominate AI citations, schema adoption is near-zero, off-site citations matter more than on-site content, bot-blocking is a common accident — are corroborated across independent sources and I'd act on those. The specific multipliers I would not put in a business case.

---

## What this means for Ryan Realty — the short version

1. **Don't fight for "homes for sale in Bend Oregon" head-on.** Five of six slots are portals with authority you can't match this year. Compete for it indirectly by winning everything beneath it.
2. **The neighborhood/subdivision layer is winnable now** — local sites already hold 2 of 5 there, and the #2 result is a nine-listing filter page with no content. That is the beachhead.
3. **Your data layer is the moat nobody else in Bend has.** `bendrealestate.com`'s only unique-data module is *broken* and its headline stat is *mis-scoped by ~2×*. Cascade Hasson ships a paragraph and a grid. Nobody in Bend is publishing verified, sourced, timestamped, per-neighborhood market data. You already compute it.
4. **Build the third-party citation and entity layer in parallel** — schema, Wikidata, NAP across 22+ directories, reviews on 4+ platforms, robots.txt audit for AI crawlers. Weighted 27% + 31% + 11% in the only model anyone has published, and it's the part your competitors have not started.
5. **Gate the programmatic build mechanically** — ~150-word unique-content floor, inventory floor, tiered indexation, per-tier sitemaps. Otherwise the geo-page build becomes the thing that suppresses your good pages.

---

## Sources

SERP data: Google via Apify RAG Web Browser, 2026-07-21 (queries: "homes for sale in Bend Oregon", "Bend Oregon real estate", "NorthWest Crossing Bend Oregon homes for sale"). Full page renders: `bendrealestate.com`, `codyfunkgroup.com/neighborhoods/coeur-d-alene`, `goflydragon.com/state-of-ai-seo-in-real-estate`.

- https://www.zillow.com/bend-or/
- https://www.redfin.com/city/1543/OR/Bend
- https://www.redfin.com/city/1543/OR/Bend/housing-market
- https://www.redfin.com/neighborhood/548318/OR/Bend/Northwest-Crossing/single-story
- https://www.realtor.com/realestateandhomes-search/Bend_OR
- https://www.realtor.com/realestateandhomes-search/Northwest-Crossing_Bend_OR
- https://www.trulia.com/OR/Bend/
- https://www.bendrealestate.com/
- https://www.bendrealestate.com/northwest-crossing/
- https://www.cascadehasson.com/realestate/search/city/Bend/OR
- https://www.cascadehasson.com/NorthWest-Crossing
- https://www.bendpremierrealestate.com/
- https://www.movoto.com/bend-or/
- https://www.redfin.com/blog/best-places-to-live-methodology/
- https://www.redfin.com/how-walk-score-works
- https://www.redfin.com/guides/climate-change-housing-impact
- https://www.deeds.com/articles/zillow-removes-climate-risk-scores-from-home-listings/
- https://www.zillowgroup.com/developers/api/public-data/real-estate-metrics/
- https://contempothemes.com/ultimate-guide-real-estate-neighborhood-pages-rank-convert/
- https://www.sierrainteractive.com/insights/blog/real-estate-seo/
- https://www.sierrainteractive.com/insights/blog/real-estate-seo-geo-ai-search/
- https://www.luxurypresence.com/blogs/common-mistakes-in-real-estate-seo/
- https://www.dmrmedia.org/blog/local-seo-real-estate-agents
- https://rankfast.co/local-seo-for-real-estate-neighborhood-keyword-ranking/
- https://seojuice.io/glossary/seo/programmatic-seo/programmatic-index-bloat/
- https://www.blogseo.io/blog/programmatic-seo-quality-rules-avoid-thin-content
- https://discoveredlabs.com/blog/common-programmatic-seo-mistakes-that-kill-pipeline-and-how-to-fix-them
- https://www.airops.com/blog/hidden-dangers-of-programmatic-seo
- https://www.goflydragon.com/state-of-ai-seo-in-real-estate/ (vendor-published — see caveat in §6)
- https://www.ranketai.com/en/blog/deep-dive-platform-citation-strategy-2026-04-10
- https://discoveredlabs.com/blog/ai-citation-patterns-how-chatgpt-claude-and-perplexity-choose-sources
- https://www.leapd.ai/blog/ai-visibility/how-chatgpt-google-ai-overviews-and-perplexity-source-information-in-2026
- https://ailabsaudit.com/blog/en/perplexity-guide-maximize-citations
- https://bozemanrealestate.group/blog/bozemans-best-neighborhoods
- https://destinationliving.co/everything-guide-online/everything-guide-local-real-estate-market/
- https://bozemanmontanahome.com/bozeman-montana-neighborhood-guide/