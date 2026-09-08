/**
 * Seed the site queue mechanism — public-ux backlog for the public site.
 * (2026-09-07 conversion research, artifact 525cdcda.) Idempotent: upserts on
 * version_gap and never clobbers an existing node's state.
 *
 * This table is the only site backlog. Sessions pull the oldest open node
 * (npx tsx scripts/loop-brief.ts); they do not re-audit.
 *
 *   npx tsx scripts/seed-site-queue.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { assertWorkNodeDraft } from '../lib/data/loop/work-node'

config({ path: '.env.local' })

/**
 * Round two (2026-09-08) adds two optional fields. `dependsOn` names other seeds
 * by version_gap and is resolved to ids after the upsert. `blockedReason` seeds
 * a node that is blocked on a decision only Matt can make, with the question in
 * one line, so `loop status` lists it under "waiting on Matt" from the moment it
 * exists instead of a lane discovering the question mid-build. Both apply only
 * to rows this run INSERTS; an existing node's state is never touched.
 */
type Seed = {
  versionGap: string
  domain: string
  title: string
  objective: string
  output: string
  accept: string
  dependsOn?: readonly string[]
  blockedReason?: string
}

const SEEDS: readonly Seed[] = [
  {
    versionGap: 'SITE-00',
    domain: 'public-ux',
    title: 'Site queue mechanism: boot serves the site node, site commits name their node, audits append not replace',
    objective:
      "Install the four-part mechanism from the 2026-09-07 conversion research (artifact 525cdcda): seed script, loop-brief site-first rule with stale auto-release, commit-msg node-trailer gate on app/** and components/site/**, process-canon arm for new audit docs. Matt 2026-09-07: seed the queue and build item 1.",
    output: 'scripts/seed-site-queue.ts, scripts/check-site-node.mjs (G72), loop-brief.ts edits, check-process-canon.mjs arm, docs rows, break-tests',
    accept:
      'npx tsx scripts/loop-brief.ts prints a public-ux node as NODE 1 when app/** or components/site/** changed in the last 14 days; a commit touching app/** without a Node: trailer is refused by the commit-msg hook; a new docs/plans/**/*AUDIT*.md without a Nodes: line fails ci:process-canon; all break-tests green.',
  },
  {
    versionGap: 'SITE-01',
    domain: 'public-ux',
    title: 'Resort community pages: address field in the first screen, verdict + pace answer, valuation request (win)',
    objective:
      "On app/communities/[slug] first (Search Console 2026-09-07: /communities/* carries 4,516 impressions, /cities/bend/* carries 17), then the Bend neighborhood route. An address field in the first viewport. On submit, with no contact ask, render the place's dated buyer/seller verdict (months of supply), days to pending, cash share, and the count of comparable closes the CMA engine finds for the address. NO dollar figure on the page (Matt 2026-09-07). Then one step: email required, phone optional, creating a cmas row with the place-page CmaOrigin, a crm_people row, sequence enrollment, and a same-minute system confirmation email (Matt 2026-09-07: system confirmation, not a broker send) carrying the verdict, comp count, and a /book link. Every figure carries a §0 source line. Copy per marketing_brain_skills/brand-voice/VOICE.md (2026-09-07 version).",
    output: 'V3PlaceValue primitive on the community route, a server action, the place-page CmaOrigin, GA4 event + rr_vid stitching, screenshots at 1440 and 375, a separate-agent taste review in parity.json',
    accept:
      '28 days after ship: public.cmas rows with request_source place-page > 0 (baseline 0) stitched to /communities/* sessions by rr_vid; Search Console clicks on the shipped community URLs do not fall versus the prior 28 days; every rendered figure has a source line.',
  },
  {
    versionGap: 'SITE-02',
    domain: 'public-ux',
    title: '/sell: show the sourced answer between the address and the contact step',
    objective:
      'Today the address step advances straight to email (required), phone, and timeline with nothing shown. Insert the neighborhood/city verdict, days to pending, and comp count between the address and the contact step; keep email required, phone optional (Matt 2026-09-07). No dollar figure on the page.',
    output: 'SellValueForm answer step + action changes',
    accept:
      'Over 28 days at least 30 percent of /sell address submits (GA4 event on form id=get-value) end in a cmas row with a non-null email, and each row shows a first broker touch in crm_timeline within one business day. Baseline pulled from GA4 and cmas before ship.',
  },
  {
    versionGap: 'SITE-03',
    domain: 'public-ux',
    title: 'Place hero button: live count + verdict, linking to the filtered search',
    objective:
      "Beside the place H1 a filled button reading the live active count and verdict, e.g. '673 homes for sale · 3.9 months · seller's market · 23 days to pending · read Sep 7', linking to the pre-filtered /homes-for-sale. City page first, then neighborhoods and communities. Figures from market_stats_cache with a trace.",
    output: 'One primitive used by the three place templates',
    accept:
      'GA4 click-through from place-page hero to /homes-for-sale/* per rr_vid rises versus the 28 days before ship; at least 10 percent of those searches end in a saved_searches row joined by rr_vid.',
  },
  {
    versionGap: 'SITE-04',
    domain: 'public-ux',
    title: "Place alerts: first callout after the intro, sticky repeat past the map, a real 30-day count as the promise, price-drop alert beside it",
    objective:
      "Move the email-only alerts form to the first callout after the place intro, repeat it as a sticky strip once the visitor scrolls past the map, and state the real promise: 'N new listings in Bend in the last 30 days. One email per listing' where N is the cache count. Add a price-drop alert with the last-30-day cut count.",
    output: 'V3 alerts strip primitive on city, neighborhood, community templates',
    accept:
      'Alert rows created from place-page paths per 100 place-page sessions at least double the 28-day pre-ship baseline; price-drop rows reported beside new-listing rows; unsubscribe rate in the first 30 days reported.',
  },
  {
    versionGap: 'SITE-05',
    domain: 'public-ux',
    title: "Sticky 'Value my home' control on /sell and place pages once the hero scrolls away",
    objective: "Desktop bottom-left pill, mobile bottom bar, labeled with the live place verdict, reusing the listing page's mobile CTA primitive.",
    output: 'Sticky control primitive + wiring',
    accept:
      "At least 15 percent of /sell valuation submits carry GA4 source='sticky' within 28 days, with no drop in total /sell submits versus the prior 28 days.",
  },
  {
    versionGap: 'SITE-06',
    domain: 'public-ux',
    title: 'Listing instrument gets an ending: base rate line, price-drop alert, tour slot, email-me-this-payment',
    objective:
      "Under the price-cut line on the listing page (app/listing/by-key, served at /homes-for-sale/listing/[key]): 'In Bend, X percent of homes that closed in the last 12 months took a cut; median cut Y percent; median Z days to pending', re-pulled per city with a trace. Then 'Tell me if this price drops' (email only), 'Tour' to a /book slot, and 'Email me this payment' under the mortgage calculator.",
    output: 'Listing page additions + alert/tour actions',
    accept:
      'Price-drop alert rows from listing pages reach at least 1 per 100 listing sessions over 28 days; tour requests plus calculator emails per 100 sessions exceed the pre-ship baseline; crm_people rows carry the listingKey; every new figure has a trace.',
  },
  {
    versionGap: 'SITE-07',
    domain: 'public-ux',
    title: 'Place-page payment calculator pre-filled with the place median and local financing mix, ending in a search at that ceiling',
    objective: "Rate editable, defaults from market_stats_cache (median list, cash share), result pinned, ending in 'See homes under $X in {place}'.",
    output: 'Calculator primitive on city and neighborhood templates',
    accept:
      'GA4 calculator_used on place pages > 0 and click-through from its result link to /homes-for-sale/* per rr_vid; both reported at 28 days against a zero baseline.',
  },
  {
    versionGap: 'SITE-08',
    domain: 'public-ux',
    title: 'Cited Q&A with FAQPage schema on neighborhood, community, subdivision pages',
    objective:
      'Five to eight pairs, one sourced dated number per answer (verdict, days to pending, sale-to-list, cash share), FAQPage JSON-LD from the same DAL call as the page body, last answer linking to the SITE-01 field.',
    output: 'V3Answers on the three templates + JSON-LD',
    accept:
      'Re-run the 16 non-brand AI answer queries: Ryan Realty named on more than 0; Search Console non-brand CTR on the shipped page set above the 0.14 percent baseline over 28 days, page list attached.',
  },
  {
    versionGap: 'SITE-09',
    domain: 'public-ux',
    title: 'Response clock on every site submit: system confirmation within a minute, broker SMS, five-minute untouched flag',
    objective:
      "Matt 2026-09-07: a same-minute confirmation to a visitor who just submitted their own request is a system confirmation, not a broker send, and the sequence the submit enrolls them in is approved. Acknowledgment carries the verdict, comp count, and a /book link; broker SMS with the CMA link the same minute; CRM timer flags any valuation, tour, or alert with no human touch after five minutes.",
    output: 'CRM send-path changes + timer + admin flag',
    accept:
      'Median time from row creation to first human touch in crm_timeline under five minutes during 8am to 8pm; no row older than 24 hours without a touch; measured over 28 days.',
  },
  {
    versionGap: 'SITE-10',
    domain: 'public-ux',
    title: 'Ask the selling timeframe after the answer, on /sell and the SITE-01 field; route the near-term lane to /book',
    objective:
      'The /sell timeline question exists (ready now / next 3 to 6 / exploring); ask it after the on-page answer, add it to the SITE-01 flow, route to CMA lane and CRM sequence, and give the near-term lane a booking prompt.',
    output: 'Form step + routing',
    accept:
      'At least 80 percent of valuation requests carry a timeframe; the near-term lane shows a booking or call in crm_timeline within 24 hours at a higher rate than the other lanes, over 28 days.',
  },
  {
    versionGap: 'SITE-11',
    domain: 'public-ux',
    title: 'Proof beside the ask: reviews, MLS-sourced record, per-listing outcome table, named broker cards on place pages',
    objective:
      "Matt 2026-09-07: named broker cards with headshots, Oregon license numbers, tel, text, and /book on place pages (same card as home and listing). Under the /sell form and on place pages: '5.0 from 25 verified Google reviews' with quotes, the MLS-sourced closed-sales line re-pulled, and a per-listing outcome table (sale-to-list and days to pending per Ryan Realty closing beside the Bend detached median for the same window, count stated, no percentage headline).",
    output: 'Proof block primitive + broker card wiring',
    accept:
      'tel:, sms:, and /book?agent= clicks attributed to place pages and /sell by rr_vid exceed zero in week one and grow month over month; every figure ships with a per-row trace or is cut.',
  },
  {
    versionGap: 'SITE-12',
    domain: 'public-ux',
    title: 'Homepage: live counts under the hero search, Sell tab renders the real address field without JS',
    objective:
      "Move the 'Central Oregon right now' strip out of the Homes dropdown to sit under the hero search with its read time; server-render the Sell tab with the same address field as /sell.",
    output: 'Homepage hero changes',
    accept:
      'Hero search submits per homepage session rise versus the prior 28 days; cmas rows with a home origin appear within 28 days; the Sell form markup is present in a curl of / with no JS; no figure ships without a trace.',
  },
  {
    versionGap: 'SITE-M1',
    domain: 'public-ux',
    title: 'Homepage brokers section on phones: open compact, faces + names + links in one screen',
    objective:
      "From the 2026-08-27 mobile audit, parked as Matt's call, answered 2026-09-07: FIX. On a phone the brokers section opens on one broker's headshot filling the viewport before names and links appear. Open the three cards compact with faces, names, license numbers, and tel/text/book links in one screen at 390px. (The other two parked items, the compare-map 429 and the 42-row /cities link wall, were KILLED by Matt the same day and are not nodes.)",
    output: 'Broker section change + 390px screenshot',
    accept:
      'At 390px the first screen of the brokers section shows all three faces, names, and at least one contact link each; screenshot attached as evidence.',
  },

  // ── Round two (2026-09-08). Source: Search Console 2026-06-08..2026-09-05 pulled by
  // scripts/_gsc-by-class.mjs (129,817 impressions, 1,368 clicks, 1.05% CTR), four
  // investigation lenses and twenty-two adversarial verifications (workflow
  // wf_71474111-a25, transcripts in the session's subagents/workflows dir), every
  // code fact re-read and every live claim re-curled with a browser UA on 2026-09-08.
  // Every traffic-causation claim was refuted against this site's own query data;
  // what remains is correctness on a licensed broker's public site, consolidation,
  // and two policy calls that are Matt's. Items do not claim a click they cannot prove.
  {
    versionGap: 'SITE-20',
    domain: 'public-ux',
    title: 'Closed listings publish the list price in the snippet, the share card, the JSON-LD, the hero caption and the map card (§0): one status-aware price publisher',
    objective:
      "Verified live 2026-09-08 on /listing/220219603 (55550 Heidi Court, Bend; DAL: Closed, list $1,250,000, close $1,100,000): generateMetadata at app/listing/[listingKey]/page.tsx:114-162 has no status branch, so <meta name=description>, og:description and the RealEstateListing JSON-LD description (app/listing/[listingKey]/listing-json-ld.ts:127, via wholePropertyPrice off listing.listPrice) all carry $1,250,000; the title carries only the address; and because buildOffer (lib/site/json-ld.ts) correctly drops the Offer for Closed rows, the emitted node has no availability at all, so nothing machine-readable says the home sold. Two in-page figures follow the same unbranched value: the on-media hero caption (page.tsx:444 → components/site/listing-detail/ListingHero.tsx:399) and the map card (page.tsx:499). What is NOT wrong: the page's own headline price already resolves from closePrice (PriceCtaStrip.tsx:154-157) beside a Closed pill, so a visitor sees the right number first; the SERP, the share preview and the structured data do not. Scale, measured 2026-09-08 through the DAL (getListingTiles status:'all'): of the 2,922 Closed MLS numbers Google has impressions for, 1,282 of the 1,708 comparable rows have ListPrice != ClosePrice. Same shape on 220221350, 220223377, 220222253. Fix: add publishListingPublishedPrice({status, listPrice, closePrice, propertyType}) in lib/listing/ and route generateMetadata, publishedSaleAsk (page.tsx:186-188), wholePropertyPrice and the JSON-LD description through it; prefix the status word in the description and the title for off-market rows; emit availability on the RealEstateListing node itself (https://schema.org/SoldOut for Closed, OutOfStock for Expired/Canceled/Withdrawn) so dropping the Offer does not drop the fact. Extend scripts/check-publish-listing-ask.mjs, which pins the current call shapes and passes today; do not replace it. State the cost as §0 exposure on index,follow pages, not as traffic: Closed URLs are already excluded from the sitemap (lib/data/sitemap/getListingSitemapRows.ts:64) and are residual index. The robots tag is not this item; indexing policy is SITE-32.",
    output:
      'lib/listing/publish-listing-published-price.ts with a unit test; generateMetadata, the hero caption, the map card and listing-json-ld routed through it; RealEstateListing availability; scripts/check-publish-listing-ask.mjs extended',
    accept:
      "curl with a browser UA https://ryan-realty.com/listing/220219603: the meta description contains $1,100,000, not $1,250,000, and a sold or closed word; og:description likewise; the hero overlay and the map card print $1,100,000; the RealEstateListing node carries availability https://schema.org/SoldOut, its description does not open with $1,250,000, and it still has no offers node. The same assertions on 220221350, 220223377, 220222253. An Active listing resolved at run time (never a pinned MLS number, statuses change) still emits offers with InStock and its list price. Unit test: {status:'Closed', listPrice:1250000, closePrice:1100000} returns 1100000. The extended gate fails when the status branch is removed. Then the separate evaluator's score for the listing page class, in ui_kits/listing-detail/parity.json tasteReview, rises above its previous mark from the same instrument.",
  },
  {
    versionGap: 'SITE-21',
    domain: 'public-ux',
    title: 'An off-market listing page shows the sold facts and a saved-search ask, not a mortgage on the old price and a tour of a home that sold (§0, MASTER_SPEC §4.9)',
    objective:
      "Verified live 2026-09-08: on Closed 220219603 the header reads $1,100,000 / Closed Sep 2026 (PriceCtaStrip.tsx:154 swaps to closePrice) while <div id=payment> (app/listing/[listingKey]/page.tsx:545-557) computes principal and interest on the $1,250,000 list price, ListingAskInstrument (page.tsx:418, 561) prints 'This home's price sits 32.0% over the Bend median list · $1,250,000 this price', the JSON-LD (listing-json-ld.ts:128,161) ships offers.price = list price, and the Tour / Call / Text ask plus the mobile broker bar render unchanged. Same shape on Closed 220215680 and Expired 220169791. Two contradictory prices for one home on a public page, and an ask the broker cannot fulfil. docs/MASTER_SPEC.md §4.9 already specifies the 'no longer available' state with the last-known facts, three or four similar ACTIVE listings and a saved-search CTA; nothing implements it, and components/site/listing-detail/ListingUnavailable.tsx:5-8 falsely claims a sold key is refused (lib/data/listings/getListingDetail.ts:438-454 refuses only IDX opt-outs and Coming Soon). Fix: add an OFF-MARKET predicate (Closed, Expired, Canceled, Withdrawn) to lib/listing-status-public.ts. Never gate on PUBLIC_ACTIVE_STATUSES: it excludes Pending, which is still marketable for backup offers and a live lead source. For off-market rows: feed the calculator the close price or omit it, withhold the ask instrument, replace Tour/Call/Text in BOTH PriceCtaStrip and ListingMobileContactBar.client.tsx (which builds tel:/sms: client-side, so a server-only grep passes while a phone visitor still gets the row) with the sold facts (close price, close date, sale-to-list) and the saved-search CTA, give ListingSimilarStrip (page.tsx:584-590) the prominence, and set offers.price/availability to match (SITE-20's publisher). Correct the false comment in ListingUnavailable.tsx. ci:mockup-parity checks imports only (check-mockup-parity.mjs:104-107), so conditional rendering keeps the gate green. These clicks are worth keeping: off-market listing URLs earned roughly 324-577 clicks over 90 days at a CTR that straddles or beats Active; this item routes them into the CMA and saved-search funnel instead of a dead end.",
    output:
      'OFF-MARKET predicate in lib/listing-status-public.ts; status branches in page.tsx, PriceCtaStrip, ListingMobileContactBar and the JSON-LD; the no-longer-available block; scripts/check-offmarket-listing-cta.mjs wired into ci:gates',
    accept:
      "Resolve subjects by status at run time (query one Closed, one Expired, one Pending, one Active; never hardcode MLS numbers). For each off-market subject the served HTML contains no 'Principal and interest', no 'this price' ask string, and no tel: or sms: in either the server HTML or the ListingMobileContactBar flight payload, and it does contain the close price, the close date, at least three links to Active listings in the same city and a saved-search CTA. For the Pending and the Active subject all of those controls are still present. scripts/check-offmarket-listing-cta.mjs is in ci:gates and fails when any branch is removed. Then the separate evaluator's score for the listing page class rises above its previous mark from the same instrument.",
    dependsOn: ['SITE-20'],
  },
  {
    versionGap: 'SITE-22',
    domain: 'public-ux',
    title: 'One canonical per listing: the by-address route stops self-canonicalling, and every internal link builder derives the path from the same fields the canonical does',
    objective:
      "app/listing/by-address/[...slug]/page.tsx:80-84 overrides the correct canonical that app/listing/[listingKey]/page.tsx:139-153 computes from the listing's own boundary fields, and self-canonicals to whatever path was requested; :26-30 resolves the listing from the MLS tail alone. Verified live 2026-09-08 on 220226356 at four paths including an invented /portland/ one: all 200, index,follow, each declaring itself canonical. The duplicates in Search Console are the site's own output, not crawler-minted: every top pair is either a retired canonical shape (/outside-boundaries/... before the 2026-08-27 sentinel fix in lib/slug.ts:203-210; /jacksonville/na/... before the N/A filter) or a live mismatch, because ~15 internal builders call listingDetailPath with {city, subdivision} while listingCanonicalPath passes {boundaryCity, boundaryNeighborhood, subdivision} (app/_v3/home-field-items.ts:147-152, app/sell/_v3/sell-listings.ts:45-50, app/search/[...slug]/SearchPageJsonLd.tsx:136-152), and lib/kb/place-sections.ts:238 (buildActivityItems) and :192 (buildOpenHouseItems) pass no listNumber, subdivisionName or boundaryNeighborhood so listingDetailPath falls back to the 26-digit ListingKey (885 URLs, 3,348 impressions). Size (GSC 2026-06-08..2026-09-05 grouped by MLS id): 2,330 of 9,571 listing ids appear at more than one URL, 4,923 URLs, 21,547 impressions, 44.2% of listing-class impressions; 2,077 at two URLs, 243 at three, 10 at four. The demonstrated harm is index fragmentation, not clicks: multi-URL ids run 1.32% CTR at weighted position 13.5 against 1.55% and 11.8 for single-URL ids. Do not claim a rank change on any place page from this. Fix, in order: (a) delete by-address :80-84 so generateMetadata returns base unchanged; commit b58edad4 added that block on 2026-06-01 and in the same commit taught [listingKey]/page.tsx to build the public canonical via listingDetailPath, which made the override redundant that day. Do NOT call redirect or permanentRedirect from this page body: app/listing/by-address/[...slug]/loading.tsx and app/loading.tsx flush the shell before any throw, the file records the blank-200 consequence at :62-64, and app/listing/by-key/[listingKey]/route.ts had to become a route handler to escape it. (b) one shared helper so hrefs and the canonical are built from the same fields, adopted by the ~15 builders and by place-sections.ts:238 and :192 (add ListNumber and NeighborhoodName to the ActivityRow type at :109; SubdivisionName is already declared). Add explicit fixture assertions for the 'outside-boundaries' and 'na' segments (generation is already gated at lib/slug.test.ts:90 and the sitemap's 7,506 listing URLs contain zero of either, so a sample of live URLs can never hit one and would stay green for the wrong reason).",
    output:
      'by-address override deleted; lib/slug listing-path helper adopted by every builder; ActivityRow carries ListNumber and NeighborhoodName; a check-*.mjs beside check-canonical-integrity asserting canonical equals the sitemap loc for the same listing and that by-address builds no canonical from slug and calls no redirect',
    accept:
      "Quantify first and record the baseline on this node: group the GSC page rows by trailing MLS id and report ids with more than one path and their impressions (2,330 / 21,547 at seed time). Then for three listings chosen at query time (one with a boundary neighborhood, one without, one with subdivision N/A), compute the canonical from the DB via the shared builder, curl each known GSC variant with a browser UA, and assert every response carries <link rel=canonical> EQUAL to that computed path (an unavailable-listing response with no canonical fails, never passes), and that the canonical path itself returns 200 self-canonical. curl /cities/bend and assert grep -oE 'href=\"/homes-for-sale/[^\"]*-[0-9]{20,}\"' returns zero (eight today). The new gate is in ci:gates and fails when the override is restored or a builder drops a field.",
  },
  {
    versionGap: 'SITE-23',
    domain: 'public-ux',
    title: "Brasada Ranch, a registry resort community, sits under the boundary classifier's 'outside every polygon' sentinel: fix the polygon coverage, not the URL cosmetics",
    objective:
      "The 'outside-boundaries' segment is the boundary classifier's SENTINEL for a home outside every polygon (app/listing/[listingKey]/listing-json-ld.ts:88-91: 'it is not a place and never a URL segment'; lib/slug.ts:202-207 stopped emitting it 2026-08-27, gated by lib/slug.test.ts:90). It still fires for Brasada Ranch, a resort community in data/resort-communities.json with its own /communities page: GSC 2026-06-08..2026-09-05 shows 45 listing pages / 1,043 impressions / 0 clicks under /homes-for-sale/outside-boundaries/brasada-ranch/..., alongside 220220863 indexed at BOTH /powell-butte/brasada-ranch/... and /outside-boundaries/brasada-ranch/... and 220219020 only under the sentinel, all carrying city Powell Butte. A registry community whose homes classify as outside every polygon is a coverage gap in the boundary set or the classifier, and every figure the place page publishes from a polygon read inherits it. Establish which: does `boundaries` hold a polygon for Brasada Ranch (broad count first, then the exact key, per the absence rule), does the classifier consult it, and where do the 45 homes' points fall against it. Fix the coverage. Note the documented trap in memory reference_neighborhood_sold_attribution_broken: check polygon quality before any count sourced from it is published.",
    output:
      'The Brasada Ranch polygon present and consulted; the classifier assigning those homes to Powell Butte / Brasada Ranch; a test pinning one known Brasada address to its community; the finding appended to this node with the before and after counts',
    accept:
      'A broad query shows the polygon exists and a point-in-polygon test on three known Brasada Ranch listing coordinates returns brasada-ranch; listingDetailPath for those rows produces /homes-for-sale/powell-butte/brasada-ranch/... with no sentinel; a re-run of the GSC page pull after the next recrawl window shows the sentinel URL count for Brasada Ranch falling from 45 and the community URLs holding their impressions; the sitemap still carries zero /outside-boundaries/ locs.',
  },
  {
    versionGap: 'SITE-24',
    domain: 'public-ux',
    title: 'Plat closed-sale counts are a text join at resort grain, so every sub-plat of a resort scores zero and can never clear the index floor: attribute closes by polygon',
    objective:
      "18 of the top 25 /subdivisions pages by impressions serve noindex,nofollow, 1,438 impressions, 34% of the class's 4,187 (GSC 2026-06-08..2026-09-05), and Google is dropping them as it recrawls: golf-homes-at-tetherow is already 'Excluded by noindex tag' (crawled 2026-09-05) while ridge-at-broken-top, tennis-tracts-at-broken-top and courtyard-garages-at-broken-top are still indexed only on pre-gate crawls (2026-07-22, 2026-06-05, 2026-06-01). The demand is real: 'golf homes at tetherow' and the Broken Top sub-plats draw 150-270 impressions each. The gate is app/subdivisions/[slug]/page.tsx:256,266 `noindex: indexableEntry == null` against getIndexableSubdivisions (GIS polygon AND >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES = 10, lib/data/subdivisions/subdivision-index.ts:36). The threshold is not the variable. `boundaries` (3,223 rows, geo_type='subdivision') is at recorded-plat grain from Deschutes County GIS; the closed-sale count is a text join on MLS SubdivisionName, which is at resort grain ('Broken Top' 448 closed, 'Tetherow' 586, 'Black Butte Ranch' 132, in listing_tile_mv AND in raw listings). No sale is ever recorded under 'Tennis Tracts at Broken Top', so every sub-plat scores zero against any nonzero floor forever. Verified 2026-09-08 with a broad ilike second query shape per the absence rule. Fix: attribute closed sales to a plat by point-in-polygon (listing_boundary_xref_mv already does this for actives) or map each plat polygon to its containing MLS subdivision, then apply the existing floor to the rolled-up count. Check polygon quality first (memory reference_neighborhood_sold_attribution_broken: broken-top's polygon measures 17.96 sq mi against Bend's 35.45); for indexability the count is only a gate input, not a published figure, which makes it a safer first use than months of supply. subdivision-index.test.ts:31 pins the floor at 10; leave the floor, change the join. getIndexableSubdivisions is cached 6h and geo.xml revalidates hourly, so bust both before asserting.",
    output:
      'A polygon-attributed lifetime closed count feeding getIndexableSubdivisions; the DAL function and its test; the six named plats indexable; the geo sitemap carrying them',
    accept:
      'For each of golf-homes-at-tetherow, ridge-at-broken-top, tennis-tracts-at-broken-top, courtyard-garages-at-broken-top, golf-tracts-at-broken-top and rock-ridge-cabin-sites-of-black-butte-ranch, getIndexableSubdivisions returns a nonzero rolled-up closed count and the live page serves index, follow; /sitemaps/geo.xml after a cache bust includes golf-homes-at-tetherow and ridge-at-broken-top; /subdivisions/outcrop still serves index, follow; the closed count printed on any plat page carries its §0 trace naming the polygon join. Then the separate evaluator\'s score for the subdivision page class rises above its previous mark from the same instrument.',
  },
  {
    versionGap: 'SITE-25',
    domain: 'public-ux',
    title: 'Title and description budget: cleanTitle accounts for the layout suffix and the dangling &, registry pages stop naming the region twice and lead with their own blurb, plat titles keep their place name',
    objective:
      "Three verified metadata defects with one owner, lib/site/page-metadata.ts. (1) MAX_TITLE=60 at :20 truncates at :73-80 and app/layout.tsx:46 THEN appends the 31-character ' | Ryan Realty — Central Oregon', so long plat names lose the phrase people search: /subdivisions/rock-ridge-cabin-sites-of-black-butte-ranch ships 'Homes for Sale in Rock Ridge Cabin Sites of Black Butte | ...' (Ranch cut), river-ridge-two-condominiums-at-mt-bachelor-village-stage-b loses 'Bachelor Village', eight more end on a bare 'Central'. The dangling-token regex at :78 covers |·—–- but not & or +, so hayden-homes-amphitheater ships '... Live Music & | Ryan Realty — Central Oregon'. scripts/check-content-metadata.mjs bounds registry names to 48 chars but never counts the suffix and does not cover parks. (2) Every detail page in four registry families renders 'Central Oregon' twice in the title before the layout adds it a third time (/parks/smith-rock is live at 75 chars), and the description is a per-family fill-in-the-blank whose only variable is the entity name (sawyer-park and big-sky-park are byte-identical apart from the name) with a 24-char brokerage tail that pushes several past shareDescription's 155-char cap into '…'. Each registry's per-entity blurb reaches the Place JSON-LD and the on-page prose but never generateMetadata (app/parks/[slug]/page.tsx:68-74, app/central-oregon/trails/[slug]/page.tsx:73-79, app/central-oregon/events/[slug]/page.tsx:73-79, app/central-oregon/venues/[slug]/page.tsx:68-77; blurbs in data/co-parks.ts, co-trails.ts, co-events.ts, co-venues.ts). (3) app/subdivisions/[slug]/page.tsx:257 resolves the city only from the indexable set, so a noindexed plat titles itself '| Central Oregon' instead of its real city. Fix: make the 60-char budget account for the suffix (emit title: { absolute } from pageMetadata, or budget ~30 for suffixed pages); cover & and + in the dangling regex; drop the category label and the brand tail from all four registry templates and lead the description with the blurb's first sentence, budgeting the full 155 (7 of 20 venues overflow the naive first-sentence-plus-address formula); keep generateMetadata registry-only (the page contract and scripts/check-prerender-db-safety.mjs bar a DAL call there; an event's nextConfirmedDate is registry data and may be used); resolve the plat's city from the boundary read; teach check-content-metadata to count the suffix and to cover parks. Also change :128 so noindex no longer forces nofollow (`noindex, follow` by default, an explicit nofollow flag for the paid-arrival /lp pages that want it): ~580 rendered noindex pages each carry ~200 internal links Google is told to drop, and pageMetadata currently cannot express {index:false, follow:true} at all, which SITE-32 will need. No traffic forecast attaches to any of this: this site's venues family ships the same shape at position 1.8-4.4 and converts at 0.05%, so the SERP line is not the binding constraint on these queries.",
    output:
      'page-metadata.ts title budget, & and + handling, and a follow-preserving noindex; the four registry templates; the plat city resolution; check-content-metadata counting the suffix and covering parks; unit tests over CO_VENUES, CO_PARKS, CO_TRAILS, CO_EVENTS',
    accept:
      "Unit tests: every generated description across all four registries is <= 155 chars, contains no '…', and is distinct from every sibling's; cleanTitle('X | Central Oregon Live Music & Shows') never yields a title ending in & or +. Live, with a browser UA, sibling pairs inside one family (/parks/sawyer-park and /parks/big-sky-park, one trail pair, one event pair): each <title> contains 'Central Oregon' exactly once; each description is <= 155 with no trailing '…', contains neither 'a local Central Oregon brokerage' nor the category label, and contains the first eight words of that entity's registry blurb. /subdivisions/rock-ridge-cabin-sites-of-black-butte-ranch's title contains 'Black Butte Ranch'; river-ridge-two-condominiums-at-mt-bachelor-village-stage-b contains 'Mt Bachelor Village'; courtyard-garages-at-broken-top's title does not end a phrase on the bare word 'Central' and names Bend. /subdivisions/ridge-at-broken-top and /communities/prineville-oll serve 'noindex, follow'; /subdivisions/outcrop and /cities/bend still serve 'index, follow'. ci:content-metadata fails on a registry name that overflows once the suffix is counted.",
  },
  {
    versionGap: 'SITE-26',
    domain: 'public-ux',
    title: 'Housing-market and report pages: the brand appended once, the figures the page already computes in the snippet, no ISO dates, JSON-LD pointing at a real route, unknown geo noindexed before the shell flushes',
    objective:
      "Four verified defects on one route family. (a) app/reports/sales/[city]/[period]/page.tsx:111-139 and app/housing-market/reports/archive/[city]/page.tsx:81-96 hand-build Metadata instead of calling pageMetadata(), so cleanTitle never strips their baked '| Ryan Realty' and the layout appends the suffix on top: live titles 'La Pine: Last Year's Sales | Ryan Realty | Ryan Realty — Central Oregon' and 'Bend home sales archive | Ryan Realty | Ryan Realty — Central Oregon'. Both descriptions are number-free while the pages compute closed count, median price and median DOM (sales page :153-170). (b) The sales page's JSON-LD points off-route: :196 builds canonicalLiveUrl at /housing-market/reports/sales/... and feeds the BreadcrumbList last item (:245) and the Dataset url (:255); no such route exists. There is exactly ONE <link rel=canonical> and it is correct, so this is malformed structured data, not a canonical conflict; fix by deleting canonicalLiveUrl and using the :121 canonical in both spots. Do not scope a new route or redirect into this. Note app/actions/market-reports.ts:338 getMarketReportDataForLocation is NOT cached (only _getSalesReportCardsDataCached at :445 is), so a metadata read adds a round trip unless wrapped. (c) app/housing-market/[...slug]/page.tsx:103-105 ships a constant description that overflows MAX_DESC=155 for every geo name (Bend 157, Redmond 160, Caldera Springs 168) and truncates to '...from Oregon Data…'; the title is bare 'Bend housing market'. The KPIs sit at :165-179 (hud.active, hud.medianList, mosText, verdict). Rewrite under 155 with the §0 trace and hold the verdict wording to check-market-formula's thresholds. Snippet hygiene only: query-level GSC shows 93.4% of this class's named-query impressions at position 11 or worse and 77% concentrated on /housing-market/bend at 19-45, so do not attribute the class's 0.30% CTR to the description. (d) The same generateMetadata (:94-115) validates nothing: resolveGeo (_v3/geo-constants.ts:88-117) only title-cases the segment, and the real guard at :175 throws notFound() after the shell and <head> have flushed, so 24 REAL out-of-market town slugs (grants-pass, medford, salem, ashland, mcminnville, brookings and 18 more; 203 impressions, 0 clicks) are indexed as hollow 200 shells with index,follow and no <main>. Apply the sibling pattern at app/oregon/[city]/page.tsx:141-152 (resolve against the cache the body reads; noindex when nothing resolves), or 308 those slugs to /oregon/<slug>, which exists to serve them honestly. Do NOT set dynamicParams=false: CORE_CITY_SLUGS is a presentation list, not a registry (geo-constants.ts:9-12), and madras, culver, powell-butte, camp-sherman and every two-segment community URL render legitimately outside it. (e) app/housing-market/reports/[slug]/page.tsx:49,61,83 print raw ISO dates in the description ('2026-08-30 to 2026-09-05') under a 97-char title; format through lib/format/date and shorten the title. Gate (§6, since cleanTitle exists precisely to prevent (a) and two routes still bypass it): no app/**/page.tsx assigns a document-level title string literal containing 'Ryan Realty' unless via title: { absolute }; OG and Twitter title fields are exempt.",
    output:
      'Both report families through pageMetadata with figures in the snippet; canonicalLiveUrl deleted; the housing-market description and title rewritten from the cached KPIs; unknown-geo noindex or hop in generateMetadata; report dates formatted; scripts/check-title-brand-once.mjs in ci:gates',
    accept:
      "With a browser UA: /reports/sales/la-pine/last-year and /housing-market/reports/archive/bend each have a <title> containing exactly one 'Ryan Realty' and a description containing at least one digit; the sales response body contains zero occurrences of '/housing-market/reports/sales'. /housing-market/bend and /housing-market/redmond: the description does not end in '…' and its months-of-supply figure equals the Dataset JSON-LD 'Months of Supply' value on the same page (drop any 'contains two digits' clause; the broken string already passes it). For slug in {zzz-not-a-place, grants-pass, medford, salem}, /housing-market/<slug> returns 404, or noindex, or a 3xx to /oregon/<slug>; for slug in {bend, madras, culver, bend/northwest-crossing, bend/tetherow} it returns 200 index,follow with no NEXT_HTTP_ERROR_FALLBACK;404 in the body. /housing-market/reports/weekly-2026-08-30's description matches no /\\d{4}-\\d{2}-\\d{2}/ and its title is under 65 chars including the suffix. The new gate is in ci:gates and fails on a baked brand.",
  },
  {
    versionGap: 'SITE-27',
    domain: 'public-ux',
    title: 'Out-of-market cities under a Central Oregon title: /open-houses/[city] and /homes-for-sale/[city] hop to /oregon in middleware; the open-houses hub carries its count and an empty city goes noindex',
    objective:
      "Verified live 2026-09-08: /open-houses/grants-pass returns 200, index,follow, self-canonical, titled 'Open Houses in Grants Pass, Oregon | Ryan Realty — Central Oregon', and lists five real Grants Pass open houses with a $540,000 median, because lib/data/open-houses/getUpcomingOpenHouses.ts drops the SERVICE_AREA_CITIES allowlist whenever a city is passed. app/open-houses/[city]/page.tsx:54 sets dynamicParams=true and the only rejection at :65/:98 is a missing city name. middleware.ts:293-311 has the CENTRAL_OREGON_CITY_SLUGS guard for /cities (308 to /oregon/<slug> and back) and nothing for /open-houses; /homes-for-sale/grants-pass returns 200 with the identical hole; /price-drops already 404s. Out-of-area is 325 of the class's 633 impressions (51%): grants-pass 161, ashland 96, central-point 40, brookings 19 and four more. Brand and canon hygiene, not a traffic loss: the class earned 2 clicks in 90 days and the out-of-area pages outrank the in-market ones (grants-pass 11.7, ashland 11.0 vs bend 18.5), so removing them recovers nothing; say so on the node. Fix in middleware, not the page: notFound() on this route returns HTTP 200 + noindex in production (three junk slugs verified, cache MISS) because it streams under app/loading.tsx. Add an /open-houses/<slug> and /homes-for-sale/<slug> rule beside the /cities pair. Do NOT set dynamicParams=false: OH_CITY_SLUGS is the 10-slug seed and would 404 in-market pages carrying impressions today (metolius 19, paulina 6, post 5, ashwood 4, brothers 4, crooked-river-ranch 3, black-butte-ranch 2, camp-sherman 2, tumalo 1). Separately, app/open-houses/page.tsx:71-77 returns a constant description with no count on a page that computes count and dates from getUpcomingOpenHouses over the today-plus-six-days window (:107-127, revalidate 60): make the metadata read the same window and write the count and the dates in; in app/open-houses/[city]/page.tsx:64-77 return noindex when the city count is 0 (verified today on /open-houses/culver and /open-houses/prineville, which promise 'Times, addresses, and prices' over 'Nothing on the calendar'). Gate: every route family that reads getCityFromSlug either tests CENTRAL_OREGON_CITY_SLUGS or has a middleware rule, so the next such route cannot ship unguarded.",
    output:
      'Two middleware rules; open-houses hub metadata from the live window; empty-city noindex; scripts/check-city-route-guard.mjs in ci:gates',
    accept:
      "curl -o /dev/null -w '%{http_code} %{redirect_url}' with a browser UA: /open-houses/grants-pass, /open-houses/medford and /homes-for-sale/grants-pass each return 308 to https://ryan-realty.com/oregon/<slug> (404 is not achievable on this route and is not a pass); /open-houses/bend and /open-houses/metolius still return 200 with index, follow. /open-houses's description begins with a digit; a city with no open houses in the window (check /open-houses/culver at run time) returns noindex while /open-houses/bend stays index, follow. The gate is in ci:gates and fails when a getCityFromSlug route has neither the test nor the rule.",
  },
  {
    versionGap: 'SITE-28',
    domain: 'public-ux',
    title: "Compound community slugs publish MLS abbreviations as place names ('Oll Homes for Sale', 'PleasVH'): render the recorded plat's real name or refuse the page",
    objective:
      "Verified live 2026-09-08: /communities/prineville-oll → title 'Oll Homes for Sale | Prineville, OR | ...', H1 'Oll homes for sale', 1,086 words, HTTP 200; madras-parkpl 'ParkPL Homes for Sale'; prineville-pleasvh 'PleasVH'. A §0 defect reaching the public under a licensed broker's name. It is NOT a search-traffic defect and NOT a routing defect, and both were refuted: the 365 compound URLs average position 19.82 against the class's 19.82 (removing all of them moves the average 0.17), their median position is 10.0, 255 of 365 rank in the top 20, they produce 22 of the class's 43 clicks at 1.22% CTR against 0.20% for the 19 canonical pages, they have been noindex,nofollow since commit 95672822 (2026-08-27), middleware.ts:268-276 isInvalidGeoSlug already hard-404s slugs that are neither city-prefixed nor registry, and :469-477 resolvePreRenderHop already 308s compound slugs naming a registered community. A blanket 404 would delete pages ranking at position 1.0 (/communities/la-pine-ponderosa-park-phase-1, /communities/redmond-odin-crest-estate). community-metadata.ts:117-123 records why a DB lookup at the edge failed before (a degraded cache read as absence 404-ed /communities/tetherow itself); every pre-render resolver is contractually pure and synchronous (lib/routing/pre-render-hops.ts, ci:streamed-redirect). So: fix the NAME, leave the ROUTE. At render time resolve the display name for a compound slug against the recorded-plat set in `boundaries` and render the plat's real name in the title, H1 and body; where no real name resolves, refuse that page rather than titling it with an MLS abbreviation. app/communities/[slug]/_v3/community-metadata.ts:139 and :153 hold the title and description templates.",
    output:
      'A plat-name resolver for compound slugs used by community-metadata.ts and the page H1; a refusal path for unresolvable names; a test over the known abbreviation slugs',
    accept:
      "/communities/prineville-oll, /communities/madras-parkpl and /communities/prineville-pleasvh no longer emit an H1 or <title> containing 'Oll', 'ParkPL' or 'PleasVH' as a place name: either the resolved plat name renders or the page refuses. /communities/redmond-odin-crest-estate and /communities/la-pine-ponderosa-park-phase-1 still return 200 with a real name. /communities/tetherow and /communities/brasada-ranch still return 200 index,follow. The robots tag on compound slugs is unchanged by this item. Then the separate evaluator's score for the community page class rises above its previous mark from the same instrument.",
  },
  {
    versionGap: 'SITE-29',
    domain: 'public-ux',
    title: "Place pages and the blog become cacheable: PlaceSplitView's session read leaves the server render, and the blog drops two awaits whose results it throws away",
    objective:
      "Every place page is fully dynamic. app/subdivisions/[slug]/page.tsx:190-202 records why: 'PlaceSplitView reads the visitor's session (cookies) on every place page, so no place page can complete a STATIC render. The sibling routes (/cities, /communities) survive only by accident: their generateStaticParams returns real slugs, the build-time prerender trips the cookies() bailout, and Next silently reclassifies them fully dynamic.' So the `revalidate = 60` at app/communities/[slug]/page.tsx:147 and app/cities/[slug]/page.tsx:161 is inert. Measured live 2026-09-08 with a browser UA: /communities/sunriver returns cache-control private, no-cache, no-store, x-vercel-cache MISS, 1,552,354 bytes, 2.611s total; /cities/bend 2,510,239 bytes, 1.839s; /team, which is prerendered, returns public, s-maxage=300, stale-while-revalidate=3600, x-nextjs-prerender 1, HIT, 0.220s. 1,151 dynamic place URLs are re-rendered from origin on every fetch. The blog has the same disease for a sillier reason: app/blog/[slug]/page.tsx:128-132 and app/blog/page.tsx:88-94 await getSession() and getPersonIdFromCookie() in a Promise.all and discard both results; both read cookies (app/actions/identity-bridge.ts:200, lib/supabase/server.ts:2-4); nothing under either page consumes them (ShareButton and V3SectionTracker are client components); measured cost ~100ms TTFB per request on the site's highest-impression class. State the cost as latency and origin render, not search traffic: no evidence links CDN status to crawl or rank here, and the data underneath is already cached via makeResilientCached. Fix: move PlaceSplitView's session read behind a client or Suspense boundary in components/search/PlaceSplitView.tsx so the server render no longer touches cookies, at which point the declared revalidate takes effect and app/subdivisions/[slug]/page.tsx:203 `dynamic = 'force-dynamic'` can become a revalidate; delete the two unused awaits from both blog files. Do NOT add generateStaticParams to the blog: the root layout exports revalidate = 60 which the segments inherit, and scripts/check-ssg-budget.mjs documents that build-time fan-out on DB-chained routes cost 11.2 of 14 build minutes (blog posts chain getBlogRelatedHomes → getCityListings and getDetachedMarket). Optionally `export const revalidate = 300` on each blog page; note the live months-of-supply guard at [slug]/page.tsx:171-208 then runs at most every 300s, inside its intent. scripts/static-params-baseline.json lists app/blog/[slug]/page.tsx: satisfy ci:static-params with the `// @no-static-params` opt-out comment and a one-line reason, not a prerender fan-out. Do the page-weight work (2.5 MB) separately; it is a different problem.",
    output:
      'PlaceSplitView server render free of cookies; subdivisions route on revalidate; the two blog awaits deleted with the opt-out comment; ci:static-params and ci:ssg-budget green',
    accept:
      "This test runs against production only (x-vercel-cache is a CDN header): after deploy, curl -sI with a browser UA twice on each of https://ryan-realty.com/communities/sunriver, /cities/bend, /blog and /blog/sunriver-year-round-living-vs-vacation; the second response carries cache-control containing public and s-maxage and x-vercel-cache: HIT; /communities/sunriver still renders the H1 'Sunriver homes for sale' and at least 8 <h2; the blog post still renders its H1 and at least 8 <h2 (a floor, not exactly 11: three of today's H2s are chrome that varies by post). npm run ci:static-params and npm run ci:ssg-budget pass. The taste receipts on the touched page classes are re-captured and must not fall (same shotsHash expected; nothing visual changes).",
  },
  {
    versionGap: 'SITE-30',
    domain: 'public-ux',
    title: 'Crawlable links into the place tree: atlas regions rendered as real anchors, and community pages linking the guides that name them',
    objective:
      "Two verified gaps, no rank claim attached to either. (1) app/cities/[slug]/page.tsx:343 builds atlas regions with href /subdivisions/<slug>, but the served HTML of /cities/bend contains zero <a href=\"/subdivisions/...\"> (the only 22 occurrences of the string are storage image URLs); /communities/tetherow contains 47 occurrences of which 46 are escaped JSON in the RSC payload and exactly 1 is a real anchor; /communities/brasada-ranch contains zero. The same pages carry 42-45 crawlable community links, all sitewide chrome. A link that exists only in a hydration payload is not a link; the 511 sitemapped plat pages have essentially no contextual inbound links. Render the region list as real anchors in the server HTML alongside the interactive map, a visually quiet list beneath or inside the atlas section on /cities/[slug] and /communities/[slug]; the data is already computed server-side. (2) Community pages render no link to any individual blog post, verified live on sunriver, broken-top, brasada-ranch, northwest-crossing, tetherow and caldera-springs: the amenity blog_slug path (app/communities/[slug]/page.tsx:335-341 → _v3/place-knowledge.ts:182-186) is dark on every community page, while /cities/bend carries three via skippableRail(getRecentBlogPosts) at :275 feeding the guides Ledger at :842-850, and the reverse direction already works (lib/blog-geo-links.ts matchGeoLinksForPost renders two links to /communities/sunriver from its post). Two hard constraints from verification: id=\"guides\" is already taken on community pages by the area-guide video ledger (page.tsx:893-900, live on broken-top and brasada-ranch), so use a distinct section id; and getRecentBlogPosts scans only a 24-post recency window, so reverse matching needs a DAL function returning every published post. Add the new section to design_system/ryan-realty/ui_kits/community/parity.json requiredComponents so ci:mockup-parity holds it. The accept test is a render check; the community page's position on head commercial terms is expected not to move and must not be claimed.",
    output:
      'Server-rendered atlas anchor list on city and community templates; a DAL function returning all published posts; a guides section on community pages with its own id; parity.json entry',
    accept:
      "With a browser UA: /cities/bend has at least 20 <a [^>]*href=\"/subdivisions/ anchors (zero today); /communities/tetherow at least 5 (one today); /communities/brasada-ranch more than 0. /communities/sunriver contains href=\"/blog/sunriver-year-round-living-vs-vacation\"; /communities/broken-top contains /blog/broken-top-bend-golf-community; /communities/brasada-ranch contains /blog/brasada-ranch-central-oregon; the new section's id is not 'guides' and the page has no duplicate ids. npm run ci:gates passes with the parity entry. Then the separate evaluator's score for the city and community page classes rises above the previous mark from the same instrument.",
  },
  {
    versionGap: 'SITE-31',
    domain: 'public-ux',
    title: 'Eleven registry communities have no guide: publish one each with a title that states a number or a decision, and rewrite the four keyword-stacked titles',
    objective:
      "The four claim-titled community guides carry 8,205 impressions from four posts (2,051 per post) against a median community page of 2 (GSC 2026-06-08..2026-09-05): 'Sunriver Year-Round Living: What It Costs in 2026' 3,828 at position 6.9, 'Eagle Crest in Redmond: Resort Homes From $385K (2026)' 1,672 at 8.9, 'Vacation Rental Rules in Bend and Deschutes County' 1,612 at 9.0, 'Kids in Bend: Parks, Schools, Child Care, and Seasons' 721 at 5.4. Keyword-stacked titles on the same template, same word band and H2 count take 20-194: 'Broken Top Bend Oregon Golf Community Guide' 194, 'Brasada Ranch Resort Community Powell Butte Oregon' 102, 'Black Butte Ranch Near Sisters Oregon Community Guide' 29, 'Living in NW Crossing Bend's Walkable Neighborhood' 20. Content depth and schema are not the separator (the community pages already carry more of both); the winners' H2s are single sub-questions a buyer types ('SROA fees and costs', 'Winter access', 'Rental income potential'). Of the 19 communities in data/resort-communities.json, 11 have no guide: pronghorn, awbrey-glen, crosswater, widgi-creek, vandevert-ranch, three-rivers, mt-bachelor-village, inn-of-the-7th-mountain, rivers-edge, mountain-high, crooked-river-ranch. Publish one guide per community through the existing blog path (Supabase blog_posts rendered by app/blog/[slug]/page.tsx, one slug per seed file, memory reference_blog_publish_path): a title that states a number or a decision, never '<Name> <City> Oregon Community Guide'; 9-12 H2s each a single sub-question (fees, seasons, rental rules, full-time vs second home, what it costs); 1,600-2,400 words; a <h2>Questions</h2> block with <h3>/<p> pairs so lib/blog/publish-blog-faq.ts emits FAQPage from the visible text; at least two links to the community page. Rewrite the four keyword-stacked titles in place. Every figure carries its §0 source line (HOA fees, prices, days to pending from the DAL or a named primary document; never recalled). Copy per marketing_brain_skills/brand-voice/VOICE.md. This is 11 posts of real writing and one lane can run it as a sequence; do not touch content depth on the community pages, which is already ahead. No per-post impression forecast is claimed; the measurement is the 28-day GSC read on the eleven new URLs against a zero baseline.",
    output:
      'Eleven blog_posts rows with seed files; four title rewrites; each post live at /blog/<slug> with FAQPage JSON-LD and community links',
    accept:
      "For each of the eleven: /blog/<slug> returns 200 with index, follow; the <title> contains a number or a comparison and not the string 'Community Guide'; at least 9 <h2 tags; at least 2 href=\"/communities/<slug>\"; \"@type\":\"FAQPage\" in the JSON-LD; every figure in the body traces to a source line on this node. /blog/brasada-ranch-central-oregon's <title> no longer reads 'Brasada Ranch Resort Community Powell Butte Oregon', likewise the other three. 28 days after the last post ships: a GSC page pull lists all eleven URLs with impressions above zero, figures attached. Then the separate evaluator's score for the blog page class rises above its previous mark from the same instrument.",
  },
  {
    versionGap: 'SITE-32',
    domain: 'public-ux',
    title: 'Off-market listing index policy: two written policies contradict each other and neither is implemented; one ruling, one implementation, one gate',
    objective:
      "MATT RULED 2026-09-08 (asked, answered): keep off-market listing URLs INDEXED with the honest state. MASTER_SPEC:1942 wins; data-architecture-plan:1095's noindex recommendation is the losing text and is to be deleted. Closed detail pages showing ClosePrice are NOT treated as a VOW-only sold surface under ODS A.4 for indexing. The gate pins index,follow on off-market rows; SITE-21 is what those URLs serve. No code path in the listing route emits noindex for any status except Coming Soon: app/listing/[listingKey]/page.tsx:160-165 calls pageMetadata() without noindex, lib/site/page-metadata.ts:128 defaults to index, follow, lib/listing-status-public.ts:75-77 makes every other status publicly displayable. Confirmed live: an Expired listing at /homes-for-sale/outside-boundaries/9184-evans-cr-220169791 returns 200 index,follow self-canonical. Measured by crossing the GSC page report against the DAL (2026-06-08..2026-09-05): 14,508 listing-detail URLs, 11,629 unique MLS, 56,650 impressions, 807 clicks; off-market is 6,611 URLs and 26,123 impressions (46%): Closed 3,207/12,125, Pending 1,431/6,105, Expired 790/3,226, Canceled 748/2,860, Withdrawn 435/1,807. These are residual index: the sitemap is Active/AUC only (getListingSitemapRows.ts:64,83). Two policies exist in writing. docs/MASTER_SPEC.md:1693 and :1942: 'Do not return HTTP 404 for sold listings — return HTTP 200 with this state. Google will continue to index the URL as a relevant similar-homes landing page' (keep indexed). docs/plans/data-architecture-plan.md:1095: keep the page, add noindex, availability SoldOut, sold price and date, related actives, optionally 410 after 12 months (noindex). Neither is implemented and no gate exists. The verifier's numbers argue for care: off-market URLs earn a CTR that straddles or beats Active, roughly 324-577 clicks per 90 days, 24-42% of all site organic clicks, and an address query has no Active substitute, so a noindex deletes those clicks rather than redistributing them. SITE-21 makes those landings honest regardless of the ruling. A second, separate question sits under it: G54 pins ODS §5-4 A.4 as 'SOLD data is VOW-only, no indexable public sold surface may exist' (scripts/check-ods-compliance.mjs:18-20) but checks only search presets and statusFilter variants; a Closed detail page publicly showing ClosePrice at index,follow may be inside that rule. If it is, the noindex is a compliance requirement, applies to Closed only (not Expired/Canceled/Withdrawn/Pending), belongs in G54 rather than a new gate, and must be {index:false, follow:true}, which pageMetadata cannot emit until SITE-25 lands. Implementation notes for whichever ruling: the two chokepoints are page.tsx:160-165 and app/listing/by-address/[...slug]/page.tsx:73-84, whose canonical-drop branch at :77 recognises only the OBJECT robots form; delete the losing doc text rather than leaving both; write the winner into CLAUDE.md or the owning skill; correct ListingUnavailable.tsx:5-8.",
    output:
      "Matt's ruling written into canon; the losing policy text deleted; the noindex branch (or its explicit absence) at both chokepoints; scripts/check-listing-offmarket-noindex.mjs in ci:gates, or the G54 extension if the ODS reading holds",
    accept:
      "grep docs/MASTER_SPEC.md and docs/plans/data-architecture-plan.md for 'sold listing' and find exactly one surviving policy statement, matching shipped behaviour. If noindex: curl three off-market subjects resolved by status at run time (one Closed, one Expired, one Pending) and assert each returns noindex with follow preserved and the canonical still present, and an Active subject returns index, follow; the gate fails when the branch is removed from either route file. If keep-indexed: the gate asserts index,follow on off-market rows and SITE-21's honest state is what those URLs serve. ListingUnavailable.tsx:5-8 no longer claims a sold key is refused. A GSC-vs-DAL cross 60 days after ship is attached to this node with the before and after off-market impression and click counts.",
    dependsOn: ['SITE-20', 'SITE-22', 'SITE-25'],
  },
  {
    versionGap: 'SITE-33',
    domain: 'public-ux',
    title: 'Out-of-market listing pages: 56% of the listings sitemap is Southern Oregon inventory rendered identically to Bend; does the referral tier extend to per-listing pages',
    objective:
      "MATT RULED 2026-09-08 (asked, answered): the listing tier gets the honesty block and noindex WITH follow preserved; the page still serves; every inventory link on the /oregon referral pages keeps resolving; /oregon/[city] stays indexed per W12.4. Needs SITE-25's follow-preserving noindex in pageMetadata first. Measured live 2026-09-08 against https://ryan-realty.com/sitemaps/listings.xml: 4,190 of 7,506 listing URLs (56%) are for cities outside CENTRAL_OREGON_CITY_SLUGS (Medford 730, Klamath Falls 635, Grants Pass 541, Ashland 275, Chiloquin 184, Eagle Point 165, Central Point 149). lib/data/sitemap/getListingSitemapRows.ts pages listing_tile_mv on standard_status only with no city predicate, and lib/data/listings/getListingDetail.ts:416-461 refuses only IDX opt-out and Coming Soon. This is NOT a leak and must not be filed as a missing filter: lib/out-of-area-cities.ts and app/oregon/[city]/page.tsx are a shipped referral-capture tier for exactly these cities (indexable at >= 5 actives, top 100, widened by Matt's directive 2026-07-22 W12.4), that page links to these listing detail pages via listingDetailPath (app/oregon/[city]/page.tsx:269), and lib/data/listings/service-area.ts is applied to tile and feed reads on purpose. Refusing out-of-area rows in fetchByColumn would turn every inventory link on the Medford and Grants Pass referral pages into ListingUnavailable. The real asymmetry is one level down: the CITY tier has an honesty block ('Outside our Central Oregon market') and a noindex policy; the LISTING tier beneath it has neither, so a Rogue River listing renders identically to a Bend one under the '| Ryan Realty — Central Oregon' suffix with no signal that this is not our market. Also on this question: /oregon/[city] itself, 55 pages, 1,187 impressions, 1 click at position 33.8, whose description tells the searcher the city is outside our market by design. Dropped claims: entity dilution and crawl budget (no measurement; the /cities and /communities CTR classes are different URL classes). Once ruled: implement at the listing tier (an honesty block and, if chosen, noindex with follow, or an active-count threshold matching the city tier's), keep the referral pages' links working, and add the assertion to the existing service-area test rather than a new gate.",
    output:
      "Matt's ruling on the listing tier written into lib/data/listings/service-area.ts's header and the owning doc; the listing-tier honesty block and robots policy; the /oregon index policy confirmed or changed; the service-area test extended",
    dependsOn: ['SITE-25'],
    accept:
      'With a browser UA: an out-of-area listing detail page resolved at run time (city in {medford, grants-pass, klamath-falls}) renders the honesty block and the ruled robots directive; /oregon/medford still returns 200 and every inventory link on it resolves to a rendering listing page; a Bend listing renders in full with index, follow; the service-area test fails when the listing-tier branch is removed. The sitemap count for out-of-area listing URLs before and after is recorded on this node.',
  },
]

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const sb = createClient(url, key)

  for (const seed of SEEDS) assertWorkNodeDraft(seed)

  const rows = SEEDS.map((s) => ({
    version_gap: s.versionGap,
    domain: s.domain,
    title: s.title,
    objective: s.objective,
    output: s.output,
    accept: s.accept,
  }))

  const { data, error } = await sb
    .from('loop_work_nodes')
    .upsert(rows, { onConflict: 'version_gap', ignoreDuplicates: true })
    .select('id,version_gap')
  if (error) {
    console.error('seed failed:', error.message)
    process.exit(1)
  }
  console.log(`inserted ${data?.length ?? 0} new nodes (existing nodes untouched)`)

  // Print every row's id + version_gap, including pre-existing ones ignoreDuplicates
  // skipped on this call — the caller needs the full id table either way.
  const { data: allRows, error: readErr } = await sb
    .from('loop_work_nodes')
    .select('id,version_gap,state,owner_session')
    .in(
      'version_gap',
      SEEDS.map((s) => s.versionGap),
    )
  if (readErr) {
    console.error('post-seed read failed:', readErr.message)
    process.exit(1)
  }
  const byGap = new Map((allRows ?? []).map((r) => [String(r.version_gap), String(r.id)]))
  const rowByGap = new Map(
    (allRows ?? []).map((r) => [String(r.version_gap), r as { state: string; owner_session: string | null }]),
  )

  // Round-two fields, applied ONLY to rows this run inserted (ignoreDuplicates
  // returns exactly those), so an existing node's depends_on and state survive.
  const inserted = new Set((data ?? []).map((r) => String(r.version_gap)))
  for (const s of SEEDS) {
    if (!inserted.has(s.versionGap)) continue
    if (s.dependsOn?.length) {
      const ids = s.dependsOn.map((g) => byGap.get(g)).filter((x): x is string => Boolean(x))
      if (ids.length !== s.dependsOn.length) {
        console.error(`${s.versionGap}: a dependsOn gap has no node yet (${s.dependsOn.join(', ')})`)
        process.exit(1)
      }
      const { error: depErr } = await sb.from('loop_work_nodes').update({ depends_on: ids }).eq('version_gap', s.versionGap)
      if (depErr) {
        console.error(`${s.versionGap}: depends_on write failed: ${depErr.message}`)
        process.exit(1)
      }
    }
  }

  // A seed that carries a blockedReason is a decision only Matt can make. The
  // work-node transition table (lib/data/loop/work-node.ts) refuses open -> blocked
  // directly, so the node passes through in_progress under a marker owner and is
  // released into blocked with the question in one line. This also repairs a node
  // from an earlier run that is still open and unowned, so re-running the seed is
  // the fix path; once Matt rules, the seed's blockedReason comes out with the ruling.
  for (const s of SEEDS) {
    if (!s.blockedReason) continue
    const row = rowByGap.get(s.versionGap)
    if (!row || row.state !== 'open' || row.owner_session) continue
    const now = new Date().toISOString()
    const { data: took, error: takeErr } = await sb
      .from('loop_work_nodes')
      .update({ state: 'in_progress', owner_session: 'seed-block', heartbeat_at: now, updated_at: now })
      .eq('version_gap', s.versionGap)
      .eq('state', 'open')
      .select('version_gap')
    if (takeErr || !took?.length) {
      console.error(`${s.versionGap}: could not take the node to block it${takeErr ? `: ${takeErr.message}` : ''}`)
      process.exit(1)
    }
    const { error: blockErr } = await sb
      .from('loop_work_nodes')
      .update({ state: 'blocked', blocked_reason: s.blockedReason, owner_session: null, updated_at: now })
      .eq('version_gap', s.versionGap)
      .eq('state', 'in_progress')
      .eq('owner_session', 'seed-block')
    if (blockErr) {
      console.error(`${s.versionGap}: block write failed: ${blockErr.message}`)
      process.exit(1)
    }
    row.state = 'blocked'
  }

  console.log('')
  console.log('version_gap  id           state')
  for (const s of SEEDS) {
    const state = rowByGap.get(s.versionGap)?.state ?? ''
    console.log(`${s.versionGap.padEnd(12)} ${byGap.get(s.versionGap) ?? 'MISSING'} ${state}`)
  }

  // stat-source-ok: operational node count printed to the operator at seed time, never published
  const { count } = await sb.from('loop_work_nodes').select('id', { count: 'exact', head: true })
  console.log(`\nwork graph total nodes: ${count}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
