/**
 * Seed the site queue mechanism — public-ux backlog for the public site.
 * (2026-09-07 conversion research, artifact 525cdcda.) Idempotent: upserts on
 * version_gap and never clobbers an existing node's state.
 *
 * This table is the only site backlog. Sessions pull the oldest open node
 * (npx tsx scripts/loop-brief.ts); they do not re-audit.
 *
 *   npx tsx scripts/seed-site-queue.ts
 *
 * Draft seeds for a new round come from `node scripts/taste-table.mjs --seed-draft`
 * (SITE-62). This file never reads taste-table.json. A person pastes after review.
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

  // ── Round three (2026-09-09): taste-sourced. Matt 2026-09-09: "how do we actually get a
  // better looking site through this process." Every public page class was screenshotted at
  // 1440x900 and 375x812 from a dev server on main (scripts/take-route-shots.mjs, first
  // viewport, scratch only) and scored by a SEPARATE evaluator on the instrument the receipts
  // already use (claude-sonnet-5, rubric v1-2026-09-08, three scorings, median), which named
  // every defect and the primitive it lives in. The table is in SITE_PAGES_E2E.md ("Taste table
  // 2026-09-08"). Nothing scored above 63. The defects cluster on a handful of primitives, so
  // the items below fix the PRIMITIVE and every page that uses it rises together (TASTE.md:
  // design the class, not the instance). The "table instrument" named in every accept test is
  // exactly that capture and that evaluator; the mark to beat is the class's median on it.
  {
    versionGap: 'SITE-40',
    domain: 'public-ux',
    title: 'V3Quiet: prose gets one measure instead of an empty column, link rows get a form, and a figure slot exists — six pages at the bottom of the taste table use it as their opening',
    objective:
      "Taste table 2026-09-08 (first-viewport shots, sonnet-5, v1-2026-09-08): the six lowest classes that open on V3Quiet — invest 25, compare 29, about 31, market-report 41, reviews 48, contact 49 — share the same named defects. (1) A prose-only Quiet item reserves a figure column that renders empty: on /invest roughly the right 45% of the 1120px content width is void beside each paragraph, 'an unfinished card, not restraint'. (2) Link rows as the design: /about's first screen is seven identical hairline rows (Principal broker, Call, Text, Email, Schedule, Client reviews, Contact); /reviews meets four identical arrow rows before a single star; /housing-market's chooser is five plain rows (Live market, By city, Explore, Sales weekly, Months of supply) with no number; the banned tell 'scrolling lists as the design' applied to a link menu. (3) No figure slot: the first Quiet item on /invest cannot carry the live count the page already fetches, so the fold has no number. (4) At 375 the rows consume the whole viewport with no cue that a face, a figure, or a map exists below. This is the primitive that makes a correct page read as a memo. Change the primitive, in components/site/v3/V3Quiet.tsx and its css: a prose-only item collapses to the 44rem single measure and never splits a column it has nothing to fill; an item can carry a figure (one number with its §0 trace and a plain sentence) in the slot that today sits empty; rows of links render as a form, not a ledger — grouped 2-up tap targets with a per-channel mark, or one dominant door plus lighter secondary links, never N identical hairline rows; on a narrow viewport the rows compress so the fold reaches a differentiator. Fix the primitive once; then confirm each of the six callers picks up the change without page-local overrides, and give /housing-market's five doors a live figure each (current MOS beside Months of supply, the newest week's date beside Sales weekly) from the reads the destinations already make. Grep for V3Quiet callers before starting; every caller is in scope for a visual check, not only the six.",
    output:
      'V3Quiet with a single-measure prose mode, a figure slot, and a door-row form; its css; the six callers rendering through it; the /housing-market chooser carrying live figures; shots and receipts for the six classes',
    accept:
      "On the table instrument (first-viewport 1440 and 375 shots via scripts/take-route-shots.mjs, claude-sonnet-5 evaluator, rubric v1-2026-09-08, three scorings, median), each of invest, compare, about, market-report, reviews and contact scores above its table mark (25, 29, 31, 41, 48, 49) and no evaluator names 'scrolling lists as the design' or 'walls of text' on any of them. Mechanical: a prose-only V3Quiet item renders a single column at the 44rem measure (assert the computed grid on a dev render has no empty second track); a Quiet door row renders no more than two visually identical siblings in sequence; /housing-market's chooser shows a digit beside at least three of its five doors, each with a source line. The parity.json receipts for the six routes are written per TASTE.md with comparedToPrior rose or rebaselined, never first.",
  },
  {
    versionGap: 'SITE-41',
    domain: 'public-ux',
    title: 'V3Instrument: the opening is a claim and a drawing, not a KPI grid — cap the headline figures, put the chart in the fold, name the disclosure, one marker rule',
    objective:
      "Taste table 2026-09-08: the market family opens on V3Instrument and the evaluators named the same defects on all of it. /housing-market/annual-review (31): the entire first viewport, desktop and phone, is sixteen flat number-plus-label tiles in a four-column grid with no chart, bar, sparkline or map anywhere; the region chart is wired as the `chart` prop and pushed off-screen by the tile count; at 375 the seventh row is cut mid-figure ('5,770' / '46.3%' clipped) with no signal that content continues. /oregon/medford (41): three numbers with plain labels and no sentence saying what they mean, nothing to hover, and no place mark of any kind, so the screen is indistinguishable from the ~360 other cities the template renders. /housing-market/bend (53) and /housing-market/central-oregon (63): the fold is eyebrow, heading, chart, source with no second form; the disclosure control reads 'ALL 42 FIGURES +' like a database row count; point markers render on the 2026 line only so the other two series look unfinished; at 375 the eyebrow, three-line headline and claim consume the viewport before a chart pixel appears; and the chart shows no sign it is interactive (no default tooltip, no toggle affordance on the legend chips). Change the primitive, components/site/v3/V3Instrument.tsx and app/housing-market/_v3/market-charts.ts: the headline row caps at three or four figures, each with a plain sentence beside it (TASTE.md: 'a number, a percentage, and jargon' is the banned KPI grid); the chart renders beside or above the figure row so the interactive object is inside the first viewport; a figure count past the cap goes behind a disclosure whose label says what it reveals, never a count; one stated marker rule across every series; a default-open tooltip on the most recent point and a visible toggle state on the legend chips; the mobile display scale tightened so a chart enters the first phone screen; and one place-anchoring mark per city on the oregon-city template (a locator mark or the newest listing's thumbnail), varying per city, not a one-off. Where the spec calls for it, the MOS two-bar drawing (docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md) is the second form in the fold. Every figure keeps its §0 trace and the verdict wording holds to check-market-formula.",
    output:
      'V3Instrument with a capped headline row, chart-first layout, a named disclosure, one marker rule, default tooltip and legend affordance; market-charts.ts; the oregon-city place mark; shots and receipts for annual-review, market-report-detail, market-report-region, oregon-city',
    accept:
      "On the table instrument, market-report-annual, market-report-detail, market-report-region and oregon-city each score above their table marks (31, 53, 63, 41) and no evaluator names 'KPI grids' on any of them. Mechanical: /housing-market/annual-review's first 900px at 1440 and first 812px at 375 contain a rendered chart element (assert an svg or canvas from market-charts inside the viewport box); the headline figure row renders at most four figures and each carries a sibling sentence; the disclosure control's text contains no bare integer; every series on the hero chart carries the same marker treatment; /oregon/medford and /oregon/salem render different place marks. Receipts per TASTE.md.",
  },
  {
    versionGap: 'SITE-42',
    domain: 'public-ux',
    title: 'V3SourceLine: a compact default (source and date) with the method behind a disclosure, held to the content measure, never at hero weight',
    objective:
      "Taste table 2026-09-08 named the §0 source line on four classes, and the finding is the same each time: the trace is right and the form is wrong. /price-drops (30): 'Source: live MLS through Ore...' is clipped by the left edge at 1440 and the right edge at 375, unreadable in both shots. /subdivisions/ridge-at-eagle-crest (59): the full trace sentence is printed as hero body copy at subhead weight directly under the headline. /housing-market/bend (53) and /central-oregon (63): one unbroken paragraph of small grey prose mixing the plain source with methodology asides ('leftover membership', 'sample-gated when published'), the least editorial text on the page and where the eye stops. §0 is absolute and the trace stays; TASTE.md is equally clear that the fix is form. Change the primitive, components/site/v3/V3SourceLine.tsx: the default render is one clause, source name and as-of date, at caption weight; the methodology sits behind a 'how we calculate this' disclosure that reveals the full trace in place; the element is constrained to the content column's measure and never positioned in a gutter; and a hero-mounted source line renders as a small chip beside the figure it supports, not as a sentence in the display register. Every caller keeps its full trace text; nothing is cut, only folded.",
    output:
      'V3SourceLine with a compact default, an in-place disclosure, measure constraint, and a hero chip variant; every caller audited; shots for price-drops, subdivision, market-report-detail, market-report-region',
    accept:
      "Mechanical, on a dev render at 1440 and 375: every V3SourceLine's bounding box sits inside the content column (no negative left or overflow right); the visible text before interaction is one clause containing a source name and a date; the disclosure, when opened, contains the complete trace string the caller passed; on /subdivisions/ridge-at-eagle-crest the source element's computed font-size is the caption size, not the body or subhead size. On the table instrument, price-drops, subdivision, market-report-detail and market-report-region each score above their table marks (30, 59, 53, 63), and no evaluator names the source line as the dullest section. §0 check: grep each route's rendered HTML for its trace string and find it present.",
  },
  {
    versionGap: 'SITE-43',
    domain: 'public-ux',
    title: 'The place opening: a drawing in the hero and a figure beside the alerts sentence, so the first screen of every city, neighborhood and community page is something a person can interrogate',
    objective:
      "Taste table 2026-09-08 on the three place classes: city 54, neighborhood 58, community 61. The defects are on two primitives every place page shares. PlaceAreaHero (components/place/PlaceAreaHero.tsx): a full-bleed photo with a left-aligned Amboqia headline and one sentence is the default hero shape of every portal, resort site and brokerage; on Tetherow the address-in/estimate-out card is 'the identical template Zillow, Redfin and HomeLight already run' and nothing above the fold rewards a hover, tap, scrub or toggle; neither fold figure on Bend ('3.9 months', '142 houses') carries an as-of date; at 375 the hero consumes half the viewport so the email field and button, the section's function, fall below the fold. V3AlertsStrip (components/site/v3/V3AlertsStrip.client.tsx, CityAlertsStrip): the second section on every place page is one sentence ('2 houses came on the market in Tetherow in the last 30 days') beside an email field, a newsletter widget standing in for a data section; the '15' numeral IS a door but shows nothing at rest; the mobile CTA is a hairline outline against confident serif type. Change the two primitives for the class: the hero carries the spec's interactive MOS mark, two bars (homes for sale vs a month of sales, docs/plans/PUBLIC_PRODUCT/DATA_GRAPHICS.md), hoverable for the raw counts, in the hero itself; the valuation card gets a thin inline count or spark of the place's own recent activity behind the eyebrow so the form is proof before the visitor types; every fold figure prints its as-of date in the source-line convention; the alerts sentence is paired with a figure, a compact recent-listings strip or the MOS two-bar, plus a property-type toggle that updates the count, with the email form as the secondary action beside it; the door numeral shows a quiet at-rest signal; the mobile hero band shrinks or the claim overlays the photo so the field lands in the first screen; the mobile CTA takes the site's primary action weight. Same primitive, same variant, every caller (TASTE.md: consistency is a taste rule). SITE-03 is in flight on the hero button and SITE-07's quality pass is on the neighborhood template; this item waits for SITE-03 and coordinates with the SITE-07 pass through the node, never by editing the same section twice.",
    output:
      'PlaceAreaHero with the MOS drawing, the activity spark, as-of dates and the mobile height; V3AlertsStrip with a paired figure, a type toggle, the at-rest door signal and the CTA weight; shots and receipts for city, neighborhood, community',
    accept:
      "On the table instrument, city, neighborhood and community each score above their table marks (54, 58, 61) and no evaluator names the alerts strip as the dullest section. Mechanical, on a dev render: the hero's first viewport at 1440 contains an interactive element that responds to hover with a tooltip carrying two counts with a source line; every figure in the fold has an adjacent as-of date; at 375 the alerts email input's bounding box top is under 812px on /cities/bend/awbrey-butte; the door numeral has a non-empty text-decoration or a sibling mark at rest; the property-type toggle changes the rendered count. Receipts per TASTE.md; the neighborhood receipt must rise above whatever mark the SITE-07 pass leaves.",
    dependsOn: ['SITE-03'],
  },
  {
    versionGap: 'SITE-44',
    domain: 'public-ux',
    title: 'The map is a Google default map: search and zip get Atlas-grade cartography, clustered markers, padded bounds, and a claim above the results',
    objective:
      "Taste table 2026-09-08: /search scored 32 and /zip/97702 33, and the evaluators named the same object TASTE.md names by example as banned for a data surface: 'Not a Google default map'. On /search the basemap is stock Google Maps (terrain greens and tans, Google's road weights and label type, the Map/Satellite toggle, the +/- stack, the wordmark), occupying about 55% of the desktop viewport and 70% of the phone, the single largest area on the page carrying none of the brand; price and count pins stack on top of each other in the SW Bend cluster with no collapse; badges at the frame edge are sliced on load; the layout is the unmodified portal split (card list left, map right, uniform filter pills) with no claim tying list and map into one object; the cards carry no comparative signal; Price weighs the same as Save this search. On /zip the same stock embed with Google's chrome is the visual centerpiece of the first viewport. No Mapbox (Matt, memory feedback-no-mapbox): the fix is a custom navy-on-cream style array on the Google instance, default chrome removed to the extent the terms allow, cartography matched to V3Atlas (cream field, navy marks), applied through components/search/HideAwareSearchMap.tsx and app/central-oregon/_v3/PlaceFieldMap.client.tsx so every V3Field mapSlot inherits it. Then: a zoom-aware cluster badge that merges overlapping markers and expands on hover or zoom; initial fit-bounds padded so no badge sits within its own width of the edge; a thin editorial header above the results rail stating the claim for the current view (count, price range, place) with its source; one comparative mark per card (a thin price-per-square-foot position against the visible set); and a weight hierarchy in the filter row, Price and Beds/Baths heavier than the rest. Fix the shared map primitive first; the composition second.",
    output:
      'A styled map primitive shared by search and every V3Field mapSlot; clustering and padded bounds; the search claim header, card mark and filter weights; shots and receipts for search and zip',
    accept:
      "On the table instrument, search and zip each score above their table marks (32, 33) and no evaluator names a Google default map. Mechanical, on a dev render: the map's computed background and road colors sample within the navy-on-cream token set (read the style array and assert no default Google tile style); the default zoom control and map-type control are not rendered; at the default /search view no two markers overlap by more than half their width and no marker's badge intersects the viewport edge; the results header contains a count, a price range and a place name with a source line; each result card renders the comparative mark; the Price filter's computed font-weight exceeds the Save-search control's. Receipts per TASTE.md.",
  },
  {
    versionGap: 'SITE-45',
    domain: 'public-ux',
    title: 'The listing page opens with something to interrogate: the gallery as the first interactive object, the price cut as a two-point mark, a plain read beside the status pills, Tour inside the fold',
    objective:
      "Taste table 2026-09-08: listing-detail scored 55 on the site's highest-value page class, and the evaluator's verdict was 'the conventional real-estate-portal template': a main photo with a 2x2 thumbnail grid and corner pills, indistinguishable from Zillow, Redfin and Realtor.com at a glance (components/site/listing-detail/ListingHero.tsx); at 375 the five pills (35 photos, 3D, Floor, Street view, Map) wrap to two rows on the sky of the photo with no scrim; a real data point, a 3.4% price cut, rendered as one sentence of plain text with nothing to hover (PriceCtaStrip.tsx); three bordered figures (Active, 103 days on market, $697/sqft) with no sentence saying whether that is fast or slow, above or below comparable (PropertySpecs.tsx); the Tour button, the card's one conversion action, cropped off the bottom of a 1440x900 fold (ListingBrokerCTA.client.tsx); and nothing in the most-seen viewport of the class rewards a hover or toggle although the page carries the instruments further down (ListingDetailShell.tsx). Change the form: a single full-bleed frame with a thin navy filmstrip index that expands on hover or tap, the gallery itself becoming the opening interactive object; one 'view all' control plus overflow, or the pill row on a bottom navy scrim, at 375; the price cut as a small two-point slope mark (old price to new) hoverable for the date and percent, per the dataviz house order; a one-line plain-language read beside the pills sourced from the market comparison the page already computes; spacing tightened so Tour, Call and Text clear the fold at 900px; and one below-fold data object (the price-cut close instrument or a compressed Atlas glance) pulled into the first viewport. SITE-20 and SITE-21 own the price publisher and the off-market state on the same files; this item waits for both and builds on them.",
    output:
      'ListingHero with the full-bleed frame and filmstrip; PriceCtaStrip with the slope mark; PropertySpecs with the plain read; ListingBrokerCTA inside the fold; one data object in the first viewport; shots and receipt for listing-detail',
    accept:
      "On the table instrument, listing-detail scores above 55 and no evaluator names the gallery as a portal convention. Mechanical, on a dev render of an Active listing resolved at run time: the hero renders one primary frame and a filmstrip element that changes the frame on interaction; at 375 the photo controls render on one row or behind one control; the price-cut element responds to hover with the date and the percent; the status pill row has a sibling sentence sourced from the page's market comparison; the Tour control's bounding box bottom is under 900px at 1440; the first viewport contains at least one element that responds to hover with more data. Receipt per TASTE.md, rising above the receipt SITE-20 and SITE-21 leave.",
    dependsOn: ['SITE-21'],
  },
  {
    versionGap: 'SITE-46',
    domain: 'public-ux',
    title: "V3Stage on a page with live inventory carries the inventory: /buy opens with a count and a price, the Field breaks the fold, the CTA has the brand's weight",
    objective:
      "Taste table 2026-09-08: /buy scored 42 and the evaluator called it 'competent, on-brand and inert': the entire visible page is a full-bleed photo, an eyebrow, a serif headline and one button, zero data, zero listings, zero map, on a page whose job is helping someone buy a house; the route already fetches buyTiles and buyCities server-side and mounts a map-bearing Field (app/_v3/HomeHomesField.tsx) directly under the hero, but the Stage's height cuts it off after about 60px of unlabeled photo strip on desktop; the 'Search homes' button is a cream rectangle with a thin border on a photo, a generic box against the rest of the page's craft. The homepage (56) opens on the same primitive with the same verdict, 'the stock search-hero every portal ships, redressed in navy'; SITE-12 owns the homepage hero and is on a measurement window, so the homepage takes this change as a quality pass recorded on SITE-12, not here. Change the primitive, components/site/v3/V3Stage.tsx: on a page with live inventory the Stage carries a data strip inside the hero (a live count, a median list price, days to pending, each with its as-of date and source), the vertical footprint shrinks so the Field's map or first listing row breaks the fold at 900px, and the CTA takes the brand's primary action treatment (navy fill, cream type). A Stage with no inventory behind it keeps the quiet photo form; the variant is a prop, not a fork.",
    output:
      'V3Stage with an inventory data strip, a shorter footprint on inventory pages, and the primary CTA treatment; /buy through it; the homepage pass recorded on SITE-12; shots and receipt for buy',
    accept:
      "On the table instrument, buy scores above 42 and the evaluator can name a win against Zillow's or Redfin's Bend page on at least one metric visible in the fold. Mechanical, on a dev render of /buy at 1440x900: the hero contains at least two figures with source lines; an element from HomeHomesField (a map or a listing row) has its bounding box top under 900px; the CTA's computed background is the navy token. Receipt per TASTE.md.",
  },
  {
    versionGap: 'SITE-47',
    domain: 'public-ux',
    title: 'The subdivision opening: an authored caption instead of a filled-in frame, the Atlas with its claim and legend in view, and one next action in the fold',
    objective:
      "Taste table 2026-09-08: subdivision scored 59, the highest of the place classes, and its Atlas is the right object; the defects are in the opening. 'Eagle Crest, the resort Ridge at Eagle Crest sits inside.' is a template-interpolated sentence (app/subdivisions/[slug]/page.tsx posterCaption, near line 556), grammatically contorted and directly under the headline; the Atlas section heading is a bare label with no claim sentence and the map is captured before any legend, dot key or count is visible, so the first read requires a hover to discover the encoding (V3Atlas, called near line 802); no next action (view listings, talk to a broker, the market report) is visible in either captured viewport on a page whose job is lead generation. The source line at hero weight is SITE-42's. Change the class: one authored claim sentence per plat setting (what is true about this plat inside its resort or city), composed for the class from the registry and the boundary facts, never a slot-filled grammar pattern; the Atlas claim sentence above the map and a visible legend and count so the first read lands; and one single-tap next action in the hero or the section beneath it. SITE-24 (plat closed-sale attribution) and SITE-30 (atlas anchors) touch this route family; same lane, in sequence.",
    output:
      'The plat caption composer; the Atlas claim and legend in the fold; the next action; shots and receipt for subdivision',
    accept:
      "On the table instrument, subdivision scores above 59 and no evaluator names the caption as a template. Mechanical, on a dev render of three plats resolved at run time (one in a resort, one in a city neighborhood, one standalone): each caption is a grammatical sentence that differs by more than the place name; the Atlas section renders a claim sentence and a legend element inside the first viewport at 1440; a link or button to listings or a broker has its bounding box inside the first 900px. Receipt per TASTE.md.",
    dependsOn: ['SITE-42'],
  },
  {
    versionGap: 'SITE-48',
    domain: 'public-ux',
    title: 'The people pages open with proof: faces and the 5.0 from 25 before any contact row, one reach control instead of a phone book',
    objective:
      "Taste table 2026-09-08: about 31, team 39, reviews 48, contact 49. The evaluators' verdicts: /about's first screen 'is a phone book, not a proof point', a license line and seven identical link rows with the Proof, Firm closings, broker Faces and Atlas all below the fold (app/about/_v3/AboutFaces.tsx never reaches the first screen); /team is three identical contact cards with 'zero reason for a buyer or seller' to stay; /reviews meets four identical arrow rows and a 160px blank band before a single star or quote, then a bare figure row, three stacked blocks handing off to each other; /contact's Reach a broker is four equal bordered cells with an arrow each, the silhouette of the banned card grid, restating one phone number twice, with nothing live behind any of them (components/site/v3/V3Doors.tsx). SITE-40 changes V3Quiet's row form; this item is the composition of the four pages on top of it. Change the class: the reviews page opens on the rating, the count and one quote, with the reach strip folded into the V3Proof band as a slim action row under the claim; /about opens on a face or a figure (the brokers' faces, the firm's closings) with the channels grouped into one reach control; /team gives each broker one differentiator beyond contact plumbing (their closings in the last twelve months, their places, from the MLS-sourced record SITE-11 built) so the cards are not identical; /contact's doors get a hierarchy (one large primary door, three lighter links) and one live state (a response-time or on-duty indicator from the CRM's response clock, SITE-09) so the row is not four static links. Every figure carries its §0 trace; copy per VOICE.md; brand-first, never broker-first (memory feedback_brand_first_not_broker_first).",
    output:
      'Composed openings for reviews, about, team and contact; V3Doors with hierarchy and a live state; AboutFaces in the fold; shots and receipts for the four classes',
    accept:
      "On the table instrument, about, team, reviews and contact each score above their table marks (31, 39, 48, 49) and no evaluator names a contact list as the first content of any of them. Mechanical, on a dev render at 1440 and 375: /reviews' first viewport contains the rating figure, the review count and a quote element before any tel: or sms: anchor; /about's first viewport contains an img of a broker or a figure with a source line; /team's three cards differ in at least one rendered figure each; /contact's #reach renders one door with a larger bounding box than the others and one element whose text updates from the response clock. Receipts per TASTE.md.",
    dependsOn: ['SITE-40'],
  },
  {
    versionGap: 'SITE-49',
    domain: 'public-ux',
    title: '/price-drops: the alerts sheet stops covering a listing card, and the sixty cuts get a drawing above the grid',
    objective:
      "Taste table 2026-09-08: price-drops scored 30, the third lowest, and one of its defects is a plain bug: the email-capture card (id=alerts, app/price-drops/_v3/PriceDropAlertsSheet.client.tsx) renders on top of the second listing card instead of in normal flow, its heading, input and Get alerts button sitting over the listing's photo, price, address and disclaimer at both 1440 and 375. Fix that first, today: the card takes its own row in the grid's document flow or a full-width band between grid rows. Then the taste defect: the only data display in the first viewport is a photo, price, badge, address card identical in form to a portal's price-reduced results, with no distribution of the sixty cuts, no sparkline of a price history, nothing a portal feed does not show. Put a claim-first drawing above the grid: a dot strip of the cuts by size, hover revealing the address and the percent, from the same rows the grid renders, with its source line; and give the card list one house move (a cut-size mark per row). The clipped source line is SITE-42's primitive change; this item waits for it so the page is captured once.",
    output:
      'The alerts sheet in flow; the dot strip of cuts; the per-row cut mark; shots and receipt for price-drops',
    accept:
      "Mechanical, on a dev render at 1440 and 375: the alerts sheet's bounding box does not intersect any listing card's bounding box; a drawing element with at least as many marks as the grid has rows renders above the grid and responds to hover with an address and a percent; every figure has a source line. On the table instrument, price-drops scores above 30 and the evaluator's craft criterion is at least 10 of 15. Receipt per TASTE.md.",
    dependsOn: ['SITE-42'],
  },
  {
    versionGap: 'SITE-50',
    domain: 'public-ux',
    title: '/invest and /compare open with the product, not a memo: the live count and a claim in the first screen, an empty state that shows the four-slot object',
    objective:
      "Taste table 2026-09-08: invest 25 and compare 29 are the two lowest classes on the site. /invest's first viewport at both breakpoints is two prose blocks headed 'What this page is' and 'How to underwrite here', documentation headers describing the page to itself, with an empty column beside each and no number anywhere although the page's stated job is 'here is the inventory, here is the math' and the count exists in the Instrument below; the evaluator's verdict: 'a cover memo, not a landing page'. /compare's landing state is a heading, one two-sentence paragraph and a text link, 'indistinguishable from any SaaS empty-cart screen', with no illustration of what a finished four-home comparison looks like and no visible slot the visitor can watch fill. SITE-40 gives V3Quiet the single measure and the figure slot; this item is the two pages' composition on top of it. /invest: replace the meta-labels with the finding a person came for as the headline (the actual verdict on whether Central Oregon cash-flows at today's rate, from the same reads the page makes, with its trace, memory project_bend_dscr_screen), the live income-property count in the first Quiet item's figure slot, and one interactive element in the fold ahead of the Instrument. /compare: an empty state composed as a first-class object, four outlined comparison slots the visitor can watch fill, and the two or three most recently viewed listings offered as one-tap adds; a clearly labeled sample of the populated comparison so the tool's job is visible to a visitor who arrives with nothing queued.",
    output:
      "/invest's opening with the verdict headline, the live count and an interactive element; /compare's four-slot empty state with recent-view adds and a labeled sample; shots and receipts for both",
    accept:
      "On the table instrument, invest scores above 25 and compare above 29, and no evaluator names 'walls of text' on either. Mechanical, on a dev render at 1440 and 375: /invest's first viewport contains a digit with a source line and an element that responds to hover or toggle with more data, and its H2s contain neither 'What this page is' nor 'How to underwrite here'; /compare's first viewport with an empty queue renders four slot elements and at least one recently-viewed listing as an add control, and a sample comparison labeled as a sample. Receipts per TASTE.md.",
    dependsOn: ['SITE-40'],
  },
  {
    versionGap: 'SITE-51',
    domain: 'public-ux',
    title: 'The taste table is a standing instrument: one command captures every public class and scores it, the results land on the queue doc, and the next round is seeded from the bottom',
    objective:
      "Matt 2026-09-09: 'how do we actually get a better looking site through this process.' The answer built today was a one-off: 24 captures through scripts/take-route-shots.mjs into a scratch directory, three ad-hoc workflows of separate evaluators, and a hand-assembled table. Make it a tool so it runs on demand and on a cadence. scripts/taste-table.mjs: for every public ui_kits class with a parity.json route, capture the first viewport at 1440 and 375 from a given base URL into a scratch directory (never ui_kits/, so no receipt is disturbed), run one separate evaluator per class on the instrument the receipts use (claude-sonnet-5, rubric v1-2026-09-08, three scorings, median, defects with the owning primitive), and write design_system/public/taste-table.json (class, median, three scores, criteria, tells, defects, evaluatedAt, shotSpec, baseUrl) plus a markdown table into SITE_PAGES_E2E.md under 'Taste table'. Keep the evaluator prompt in the repo as the instrument's text, versioned with the rubric. The evaluator must be a different model from whatever built the pages; the run records both. A `--diff` mode prints each class's change against the previous table. This is the measurement half of Matt's question; the seed of round four comes from its bottom rows, by primitive, the way round three did.",
    output:
      'scripts/taste-table.mjs with capture, evaluate, write and diff; the evaluator prompt file; design_system/public/taste-table.json; the E2E section written by the tool',
    accept:
      "`node scripts/taste-table.mjs http://localhost:3000` on a dev server produces a taste-table.json with one row per public class, each row carrying three integer scores, a median equal to the middle value, five criteria that sum to the median, and at least one defect with a primitive path that exists in the tree; the E2E section is regenerated from it; `--diff` against the 2026-09-08 table prints a signed change per class; a second run on the same shots yields medians within the instrument's recorded variance (state it). No receipt in ui_kits/ changes when the tool runs.",
  },
  {
    versionGap: 'SITE-52',
    domain: 'public-ux',
    title: "V3Ledger: a row past six carries a visible mark, hover reveals more than the row says, media is all-or-none, and a slot never repeats a fact the page already made",
    objective:
      "Taste table 2026-09-08: /cities scored 30 and the evaluator named the primitive, not the page: 'components/site/v3/V3Ledger.tsx, used for the whole visible section, so the fix raises every page that calls V3Ledger this way.' What a person sees below the hero is a hairline-divided list of rows (thumbnail, name, one-line description, right-aligned count), TASTE.md's tell verbatim: 'A Ledger past six rows with no visual encoding (no mark, no bar, no map, no image) is a table wearing hairlines.' The row carries an `encode='bar'` prop in code and nothing resembling a bar, a fill or a proportional mark is visible in either shot, so a reader cannot see that Bend (661 for sale) dwarfs Camp Sherman (5) without reading every number; nothing in the fold rewards a hover or tap with more data, every row is only a link away; thumbnails appear for Bend, Crooked River Ranch, Culver and Madras and are absent for Black Butte Ranch, Camp Sherman and La Pine, a ragged left edge that reads as an unfinished data pull; 'OREGON' repeats as the `when` slot on all seven rows and takes its own line on the phone; and the region's months-of-supply claim ('Balanced market at 4.9 months') ships as a sentence in the note slot rather than the two-bar form the spec names. Change the primitive: `encode='bar'` draws a bar or dot sized to the shared scale behind or beside the row, visibly, at both viewports; a row rewards hover on desktop and tap-and-hold on the phone with something the row's text does not carry (the months-of-supply verdict, a twelve-month sparkline), from data the caller passes; the media slot is all-or-none per list, with a consistent navy glyph where a photo is absent; and the note slot accepts the MOS two-bar drawing. Then audit every caller: grep V3Ledger across app/** and drop any `when` slot that repeats a fact the page has already made. Every figure keeps its §0 trace.",
    output:
      'V3Ledger with a visible encode, a hover reveal, all-or-none media and a drawing-capable note; every caller audited; shots and receipt for the cities index and one other Ledger-led class',
    accept:
      "Mechanical, on a dev render of /cities at 1440 and 375: each row with encode='bar' renders a bar or dot element whose width or size is proportional to the row's count against the list's maximum (assert two rows with different counts render different mark sizes); hovering a row exposes an element with a verdict or a sparkline not present at rest; either every row has an img or every row has the glyph, never a mix; no row text equals 'Oregon'; the note slot renders a two-bar element with a source line. On the table instrument, cities scores above 30 and no evaluator names 'scrolling lists as the design' on it. Receipt per TASTE.md.",
  },
  {
    versionGap: 'SITE-53',
    domain: 'public-ux',
    title: 'The place-type pages: the Atlas is guaranteed, a claim sentence under the H1, the list and the map linked, and no duplicate headline',
    objective:
      "Taste table 2026-09-08: /cities/bend/types/single-family scored 69, the highest on the site, on the strength of V3Atlas; /communities/tetherow/types/single-family scored 44, and the difference is a bug. On the community variant the Atlas rendered in the 375 capture directly under the H1 and was ENTIRELY ABSENT from the 1440 capture of the identical URL: the section is gated on `atlasRegions.length > 0`, fed by getGeoBoundaryMapData / getResortBoundaryGeoJSON through withTimeoutFallback with a 4,500ms budget that silently falls back to a null polygon and drops the whole section with no placeholder (app/communities/[slug]/types/[type]/page.tsx). So the class's differentiator is a race outcome, TASTE.md's 'missing states' tell, and on the load Google or a person gets without it the desktop fold is eight identical V3ListingRow rows with a hairline between each, the banned scrolling list as the whole first impression. Both variants share the rest: the H1 is a label ('Single-family in Bend'), not a claim, and no plain sentence with a figure appears above the fold although the loader already computes the counts and price band (getPublicPlaceSegments, leftoverHudKpis, placeTypeHeadline in lib/place/place-type-page.ts); on the city variant two near-duplicate Amboqia headlines stack ('Single-family in Bend' then V3Atlas's own 'Single-family on the map'); the list and the Atlas show the same listings and are not connected, no row hover highlights a pin and no pin highlights a row, and no sort or filter sits above the list; the Atlas zoom control is about 32px at 375, under the 44px minimum; the Atlas dots carry no price. Fix the bug first: the Atlas never silently drops, a skeleton streams while the boundary resolves or the call gets the budget it needs, and the fallback is a placeholder, not absence. Then the class: one §0-sourced claim sentence under the H1 ('14 single-family homes for sale in Tetherow, $1.35M to $4.25M'); V3Atlas takes a compact eyebrow when it opens directly under a page H1 instead of a second display headline (a variant on the primitive, for every caller); row hover or tap highlights the matching pin and the reverse; a light price or beds sort above the list; the zoom control at 44px from the system's tokens.",
    output:
      'The Atlas guaranteed on the place-type routes with a streamed placeholder; the claim sentence; the V3Atlas eyebrow variant; row-to-pin linking; the sort; the 44px control; shots and receipts for place-type and place-type-community',
    accept:
      "Mechanical, on a dev render: ten consecutive loads of /communities/tetherow/types/single-family at 1440 each contain the Atlas section or its placeholder, never neither; the first viewport at 1440 and 375 contains a sentence with a count and a price range with a source line; the page renders exactly one display-scale headline; hovering a listing row changes the state of the corresponding Atlas mark; the zoom control's bounding box is at least 44px on each side at 375. On the table instrument, place-type-community scores above 44 and place-type above 69. Receipts per TASTE.md.",
  },
  {
    versionGap: 'SITE-54',
    domain: 'public-ux',
    title:
      '/sitemaps/geo.xml answers under the 300s ceiling on a cold request: two consecutive 504s on 2026-09-09 mean Google cannot read the place tree at all',
    objective:
      "Verified on production 2026-09-09 (Vercel runtime log, deploy dpl_9QqeGLbq9DugvMjmnk1M6G8AunRA, cache MISS): GET /sitemaps/geo.xml returned 504 'Task timed out after 300 seconds' at 05:18:53Z and again ~05:24Z, 108 bytes, on two consecutive browser-UA requests; core.xml, content.xml, listings.xml and matrix.xml were not measured in that pass. The route (app/sitemaps/[cls]/route.ts, maxDuration 300, dynamicParams true, revalidate 3600 via getClassRows in lib/sitemap-class-rows.ts) builds the whole ~10.7K-URL universe per class through the shared memo and then filters to the class; the repo records the cold cost at 106s (2026-08) and 235s with a 280s http=000 failure (handoff 'The sitemap P0 fix did not work'), so a cold request has drifted past the ceiling rather than crossed it today. The SITE-24 lane could not materialise geo.xml locally either: two attempts of 15 and 25 minutes, with [getSearchMatrixInventory] read failed: canceling statement due to statement timeout repeating in the log, so the matrix leg of the universe is the suspected cost, on a class that does not need it. The hourly warmer /api/cron/warm-sitemaps (vercel.json, 0 * * * *) fills all five classes from one in-process build; read its runtime log for the 06:00Z and 07:00Z runs on the current deploy first: if the warmer itself exceeds its budget every class is cold on every request and the 1h cache never fills. Fix the class, not the request: a geo class build must not depend on the matrix leg (build per class from its own DAL reads, the plat set now costs 644ms via getIndexableSubdivisions), or the universe memo must persist across invocations (a table or blob, not module scope), or the matrix inventory read must stop timing out. State the cost as crawl coverage: the place tree (cities, communities, neighborhoods, 2,486 indexable plats) has no sitemap while this 504s, and SITE-24's plats cannot be discovered through it. No rank claim.",
    output:
      'geo.xml (and each sibling class) answers 200 under the ceiling on a cold request; the warmer completes inside its budget and its log says so; a gate or smoke that fetches every class with a browser UA after deploy and fails on a non-200',
    accept:
      'curl with a browser UA, cold (immediately after a deploy READY, before the warmer): /sitemaps/geo.xml returns 200 in under 300s and contains /subdivisions/golf-homes-at-tetherow; each of core.xml, content.xml, listings.xml and matrix.xml returns 200; the Vercel runtime log for /api/cron/warm-sitemaps on the deployed SHA shows one completed run with per-class counts; a deploy smoke fails on any sitemap class that is not 200.',
    dependsOn: [],
  },
  {
    versionGap: 'SITE-55',
    domain: 'public-ux',
    title:
      'The subdivision page shows what sold and what did not sell in the plat, then the wider market it sits in; the CMA first message lands on it',
    objective:
      "Matt 2026-09-09, on the expired-listing first message that is the lead engine: 'show that we are true market experts by being able to dive into that subdivision they're in, not just the neighborhood. When we drive them back to that subdivision page, it has to be dialed so we can show them exactly what's going on there, including homes that sold and didn't sell. We need them to understand what's going on in that subdivision specifically, and then in the broader picture of the neighborhood or community within which that subdivision resides. That's the full loop.' Verified 2026-09-09 in app/subdivisions/[slug]/page.tsx: the page renders active listings (PlaceSplitView, id=homes), 'What sold in {name}' (V3Instrument id=market-report: 12-month active/pending/closed counts from market_metric via getSubdivisionCounts, days on market, the yearly closed chart) and no did-not-sell section at all; the neighborhood (app/cities/[slug]/[neighborhoodSlug]) and city pages have none either. The did-not-sell logic exists only inside the seller CMA (lib/cma/did-not-sell.ts, lib/pricing/local-outcomes.ts: StandardStatus in Expired, Canceled, Withdrawn; off_market_date inside the window; the price path, the days it ran, how it came off). The letter (lib/cma/first-contact.ts placeParagraph, fed by lib/cma/first-contact-place.ts) now links a plat page only when the plat renders (getSubdivisionBoundarySlugs) and prints the same closed/active/pending counts the page prints, and says 'what is for sale there and what has sold' because that is all the page shows today. Build: (1) one DAL read for plat outcomes over twelve months, closed (already) plus did-not-sell, count and rows (address as a tracked link, list price path, days it ran, how it came off), attributed to the plat by the polygon path SITE-24 built for closes, behind the same publishable gate the counts use, one definition (scripts/stat-tables.cjs) if it becomes a metric; (2) a section on /subdivisions/[slug] under the market report, 'What did not sell in {name}', honest at zero ('every listing in {name} in the last twelve months sold') with its §0 source line; (3) a wider-market block that names the parent neighborhood, community or city with its own twelve-month figures and a REAL anchor in server HTML (the atlas-link finding on SITE-30 applies); (4) point the letter at the same read so its count equals the page's, then change its sentence to 'what is for sale there, what has sold, and what did not' (lib/cma/first-contact.ts placeParagraph; scripts/cma-first-message.ts <slug> prints the letter with a live link check). Do not print a median close at plat grain below the sample rule in app/subdivisions/[slug]/_v3/subdivision-figures.ts. SITE-47 is in progress on this route's opening; same lane, in sequence.",
    output:
      'The plat-outcomes DAL read; the did-not-sell section and the wider-market block on subdivision pages; the letter reading the same numbers with its sentence updated; shots and receipt for subdivision',
    accept:
      "Mechanical, on a dev render of three plats resolved at run time (one with at least one failed listing in the last twelve months, one with zero, one that is a registry community alias): the page renders a did-not-sell section whose count equals the DAL read, every failed row's address links to a listing page that returns 200, the zero case states it in words, and the section carries a source line naming table, filter and window; the wider-market block contains a real <a href> to the parent page in the served HTML (curl with a browser UA, not the RSC payload); `npx tsx scripts/cma-first-message.ts <slug>` for the first plat prints the same closed and did-not-sell counts the page shows and every LINK line reads 200 ok; no plat page prints a median close below the sample floor. On the taste table the subdivision class does not fall below its last mark.",
    dependsOn: ['SITE-47'],
  },

  {
    versionGap: 'SITE-56',
    domain: 'public-ux',
    title:
      'A plat page without a recorded polygon still opens with a photograph and a map: Diamond Bar Ranch opens on cream over an empty atlas frame and a blank split-view map',
    objective:
      "Matt 2026-09-09, reading the page the CMA first message now sends expired sellers to: 'There's no map on the diamond bar sub page and no photo.' Verified the same day in a headless Chromium render of /subdivisions/diamond-bar-ranch at 1440x2600 after 7s, and again in the in-app pane: the opening is the breadcrumb, the H1 and a source line on cream with no photograph; the 'Diamond Bar Ranch right now' atlas (id=atlas) is an empty grey frame with + and - controls and a legend reading '1 for sale · House · Just listed in Diamond Bar Ranch, $460,000', no basemap visible, no dot, no plat outline (the DOM holds 2 svgs with 23 paths and 0 dot circles); and the 'Every home on the market around Diamond Bar Ranch' split view (id=homes, MapSearchView on Google Maps, window.google present) lists the one home with its photo beside a blank map area with no tiles. Cause, in app/subdivisions/[slug]/page.tsx: Diamond Bar Ranch has no polygon in `boundaries` and no registry alias, so it renders through the MLS-name path (loadSubdivisionCore, name tiles); seedRing is false, atlasRegions is empty, and the atlas is framed with basemapForRegions([], {dots, fit: 'dots'}) (:948-952) around a single dot, so the frame has no span; the poster is platOwnPoster = cityStagePoster(communityImage(slug), platLibraryHeroUrl) (:606), null for a plain plat with no dedicated still and no geo-strict library hero, and the SITE-08 pass-2 comment above it refuses a city or listing photo standing in for the place, so the page opens on cream by design. Scale, measured 2026-09-09 through the DAL (scripts/_plats-without-polygons.ts: getListingTiles active SFR, 1,000-tile sample, against getSubdivisionBoundarySlugs and the registry): at least 265 plain plats with live SFR homes and no recorded polygon, 511 homes, a lower bound because of the sample cap; The Reserve In The Pines Phase 2 (17 homes), Dry Canyon (15), Acadia Pointe Phase 5 and 6 (10), Willowbrook (10), Collier (9) lead it. This is the page the expired letter links (lib/cma/first-contact-place.ts links a plat only when it renders, and this one renders), so a seller who clicks lands on cream and two blank maps. Fix, in the primitives: (1) the atlas frame for a plat with no polygon is built from its homes' coordinates with a minimum span (a quarter mile or the nearest-roads tier), the basemap the CMA map already draws for any coordinate (lib/cma/map-ground.ts: TIGER roads, water, labels, fractional zoom) or basemapForFrame with a floor on the bbox, the plat's homes as dots, and lots where the county has them; a single home is still a map. (2) Find why MapSearchView paints no tiles on this route in a headless render (bounds from BEND_DEFAULT_BOUNDS or the plat's tiles, the key's referrer rules, or the pane not receiving a size) and fix it in the component, not the page. (3) The opening carries an image on every plat: the plat's own listing exterior captioned as that listing ('2623 6th Drive, for sale in Diamond Bar Ranch'), the geo-strict library hero where one exists (data/asset-library, vision-graded), or the plat's own drawn ground as the opening image; a caption always names what the frame is; never a city photo, never another plat's, never cream. §0 applies to a picture exactly as to a number. SITE-47 is in progress on this route's opening; same lane, in sequence, and SITE-55 (did-not-sell on the same page) follows.",
    output:
      'The no-polygon atlas frame; the split-view map painting on plat routes; an opening image on every plat with its caption; scripts/_plats-without-polygons.ts kept as the class list; shots and receipt for subdivision',
    accept:
      "Mechanical, in a headless Chromium render at 1440x2600 after 7s, on /subdivisions/diamond-bar-ranch and two more plats taken from scripts/_plats-without-polygons.ts at run time: the opening region above the first H2 contains an <img> or an inline SVG ground at least 600px wide with a visible caption naming its source; #atlas contains at least one v3-atlas__dot and at least twenty basemap paths inside a frame whose bounding box is at least 300px tall, and the frame is not a single flat color when sampled at nine points; #homes contains Google map tiles (img elements under the map container) within 5s; none of the three opens on cream. On production after ship, the same three URLs pass the same checks. On the taste table the subdivision class does not fall below its last mark.",
    dependsOn: ['SITE-47'],
  },
  {
    versionGap: 'SITE-57',
    domain: 'public-ux',
    title:
      'The MLS public remarks come back to the listing page, as written, and a gate keeps them there',
    objective:
      "MATT RULED 2026-09-09, asked and answered: 'mls descriptions must come back'. Verified live the same day at 4064f4d7 on /homes-for-sale/bend/southeast-bend/1925-townhomes/20339-jack-benny-220225832 with a headless browser: the remarks are read, serialised into the page payload and never rendered — document.body.innerText does not contain the listing's own opening phrase, one text node holds it and that node is inside a script tag, and the page's section ids are specs, location, parks-nearby, trails-nearby, ask, similar, close with no description among them. The data is there: lib/data/listings/getListingDetail.ts selects public_remarks at :71 and maps it to publicRemarks at :393, and 7,358 active listings carry remarks (847 and 882 characters on the two Bend listings sampled). The renderer is what went: components/site/listing-detail/DescriptionBlock.tsx rendered them and the 12-section rebuild 7c40065e dropped its import, listing-remainder-contract.test.ts then asserted its absence, and the orphan cleanup 545e4e50 deleted the component and, as a cascade, lib/listing/publish-listing-remarks.ts — the paragraph joiner whose whole job is that Spark inserts a blank line mid-sentence and a naive split leaves a truncated first paragraph. Both are in git at 545e4e50^. CLAUDE.md §2 binds: MLS remarks are shown as written. This is not a taste item and does not wait on one. Restore the remarks to the rendered page as their own row in the page inventory (the contract comment at app/listing/[listingKey]/page.tsx:110 says 12 rows and the contract test enumerates them; both change together), in the v3 register the rebuilt page uses rather than the deleted component's legacy classes, with the joiner restored and its behaviour tested. Words are never invented, never rewritten, never summarised; a clamp with a control that reveals the rest is fine, a truncation that ends the sentence for the reader is not. ODS: remarks are listing data displayed under the existing ListingAttribution, which already names the listing firm — do not re-attribute, do not add a second attribution. Then gate it (memory feedback_gates_not_prose): a recurring regression gets a mechanical check, not a comment. The gate asserts that the listing route renders the remarks it reads, so the next rebuild cannot drop the renderer and leave the read in place.",
    output:
      'publishListingRemarks restored with tests; a v3 remarks section rendered on the listing route; the page inventory comment and the remainder contract updated together; scripts/check-listing-remarks-rendered.mjs wired into ci:gates',
    accept:
      "With a browser UA on production, for three Active listings resolved at run time whose public_remarks is non-empty: the rendered page's visible text (document.body.innerText, not the payload) contains the first eight words of that listing's public_remarks, and the page carries exactly one ListingAttribution. A listing with null remarks renders no empty section and no heading. The new gate is in ci:gates and fails when the listing route reads publicRemarks without rendering it.",
    dependsOn: [],
  },
  {
    versionGap: 'SITE-58',
    domain: 'public-ux',
    title:
      'Every plat polygon we hold is Deschutes County: source the Crook and Jefferson subdivision layers, or say on the page that we cannot draw the plat',
    objective:
      "Measured 2026-09-09 against live Supabase while answering Matt's question 'there has to be a way to find those missing plats'. All 3,223 subdivision polygons in public.boundaries carry source 'Deschutes County GIS Subdivisions'; Crook County holds exactly one row (the Brasada Ranch neighborhood, added by SITE-23) and Jefferson, Klamath and Josephine hold none. Of 1,087 distinct SubdivisionName values on 3,573 active SFR listings, 626 resolve to no recorded plat by name or by polygon even after SITE-56's phase-prefix and boundary_subdivision resolver, and the list is dominated by places outside Deschutes: Brasada Ranch 39 homes, Running Y Resort 26, Crooked River Ranch 13, Ochoco Pointe 10, Willowbrook 10, the Klamath Falls Hot Springs and Buena Vista additions 12 and 11, Ridgewater Phase 1 9, Haystack Butte 7. Probed the same day: Deschutes publishes layer 4 Subdivisions at maps.deschutes.org/arcgis/rest/services/OpenData/BoundaryFD/MapServer, which is what we already hold in full; the Klamath County org we already pull taxlots from (services.arcgis.com/H6Mh1bySxR4oHx6x, 201 services) publishes no subdivisions layer, only SPR_Submissions; the Josephine org (services3.arcgis.com/qwqIu50nUr6wRrbz) returned no services at that path; two guessed Crook endpoints 404'd. So the endpoints have to be found, not guessed: start from each county's open-data portal and its assessor/surveyor pages, and treat a recorded-plat layer as the only acceptable source (memory feedback_gis_authoritative_only) — a hull drawn around listing points is not a plat boundary and must never be published as one. We already ingest taxlots from four counties (scripts/gis/import-taxlots.mjs, 246,873 rows across deschutes, klamath, josephine and a City of Medford slice), so the ingest pattern, the provenance columns and the ci:boundary-provenance floor all exist and this is a matter of finding the layer and running it. Scope note: Crook is the one that pays, because Brasada Ranch, Ochoco Pointe and Crooked River Ranch are the plats with real inventory and real pages. Where a county genuinely publishes nothing, the honest end state is the page saying the plat is not recorded rather than a frame that looks broken — SITE-56 owns that fallback, so this node either fills the gap or proves it cannot be filled.",
    output:
      'The Crook and Jefferson recorded-plat layers ingested into boundaries with source and source_url per row, the provenance floor raised, and scripts/_plats-without-polygons.ts re-run to record the new unresolved count; or, per county, a written finding that no recorded-plat layer is published',
    accept:
      "public.boundaries holds subdivision rows whose source names Crook County for at least the plats with live inventory (Brasada Ranch, Ochoco Pointe, Crooked River Ranch resolve by name or by point-in-polygon), each row carrying source and source_url, each polygon valid and plat-shaped (sub-square-mile unless the recorded plat genuinely is not). ci:boundary-provenance passes with the new publisher declared and its floor raised. scripts/_plats-without-polygons.ts, re-run, reports a lower unresolved count than the 626 measured on 2026-09-09, and the report names which counties still publish nothing.",
    dependsOn: ['SITE-56'],
  },
  {
    versionGap: 'SITE-59',
    domain: 'public-ux',
    title:
      'Nothing on the public site renders an empty frame: the dead Google pane comes out, and the out-of-area listing rows get their photographs',
    objective:
      "Two surfaces paint a box with nothing in it, and both were found by evaluators reading real renders on 2026-09-09. (1) THE DEAD MAP PANE. Matt turned the Google Field and the place Split canvas off on 2026-09-03 in c75222a9 — 'the atlas is the map' — but the pane it drew in stayed, so the section under 'every home for sale in <place>' on place and plat pages is an empty frame beside the list. Measured on /subdivisions/diamond-bar-ranch: zero requests to maps.googleapis.com from the route and no .gm-style node in #homes. SITE-56 fixed the section's copy (it had claimed 'Search the map' and 'counts follow the map view' for something that is neither) and left the frame, correctly, because removing a canvas across the whole place class is not a lane's call. MATT RULED 2026-09-09, asked and answered: remove the empty frame. Google stays off; the section becomes the list of homes with no map pane at all, and nothing renders blank. The Atlas above it is still the map. (2) THE GREY PLACEHOLDER PHOTOGRAPHS. On /oregon/[city] the listing rows render a flat grey square where a photo belongs — 10 of 12 on Medford and most of Salem's five — which an evaluator read as broken rather than as a designed empty state. This is NOT a licensing or opt-out problem and must not be filed as one: sampled 2026-09-09 through the DAL, 40 of 40 active Medford listings carry a non-empty PhotoURL, zero are internet opt-out (permit_internet_yn=false) and zero are non-IDX, and Bend sampled identically at 40 of 40. The photographs exist and the row does not show them, so the fault is in the render path for that template. Find it and fix it; if a row genuinely has no photo, it gets a designed empty state that does not read as a broken image. ODS §3-13 still binds on listing media — display, never copy.",
    output:
      'The Google map pane removed from the place and plat split sections with the list intact; the oregon-city listing rows rendering their photographs, with a designed empty state for a row that truly has none; shots and receipts for the affected classes',
    accept:
      "In a headless Chromium render at 1440x2600 after 7s: on /subdivisions/diamond-bar-ranch and one /communities page, the section under the 'every home for sale' heading contains no empty map container — no .gm-style node, and no element over 300px tall with no child content — while the list of homes still renders. On /oregon/medford and /oregon/salem, every listing row whose listing carries a PhotoURL renders an img with a non-empty src, verified against the DAL for the same keys; a row without one renders the designed empty state and not a bare grey box. No class score falls below its last mark on the table instrument.",
    dependsOn: [],
  },
  {
    versionGap: 'SITE-60',
    domain: 'public-ux',
    title:
      'A page that links to listings prefetches about 25 MB of MLS photographs nobody sees',
    objective:
      "Measured by the SITE-59 lane on 2026-09-09 against a production build of /oregon/[city]: with link prefetch allowed the route makes 78 requests to sparkplatform and pulls 25,386,060 bytes; with prefetch blocked it makes 11 requests and pulls 333,689 bytes, which is exactly the row thumbnails it actually shows. The extra ~25 MB is 1600x1200 hero preloads carried inside the prefetched RSC payloads of the LINKED listing pages, so it is not a defect of the city page at all — it belongs to app/listing/** and it very likely applies to every route on the site that links to a listing, which is most of them. It does not show in dev because Next disables prefetch there, which is why nobody has seen it. Nothing on the visible page changes if this is fixed; what changes is the bytes a phone on a Bend cell signal pays to look at a list. The fix is in the listing route's own preload declaration (the hero image should not be preloaded at 1600x1200 in a payload fetched speculatively for a page the visitor has not opened), or in how those links are prefetched. Measure before and after with the same method the finding used: a headless run with prefetch allowed and one with it blocked, request count and byte total for both. Do not fix it by turning link prefetch off site-wide — that trades a real navigation speed win for a bandwidth one without measuring either.",
    output:
      'The listing route stops shipping a full-size hero preload in a speculatively prefetched payload; before and after request counts and byte totals recorded on this node for at least two route families that link to listings',
    accept:
      "In a headless Chromium render of /oregon/medford and one /cities page against a production build, with link prefetch allowed: total bytes from the listing-photo CDN fall by at least 80 percent against the 25,386,060 measured on 2026-09-09, and the visible page still renders every row thumbnail it renders today (11 of 11 on Medford, verified against the DAL for the same keys). ci:page-payload does not regress on any route.",
    dependsOn: [],
  },
  {
    versionGap: 'SITE-61',
    domain: 'public-ux',
    title:
      'The listing-shaped ledgers that still draw a photograph in a 44px tap mark pick up the photo treatment',
    objective:
      "SITE-59 gave V3Ledger an opt-in media=\"photo\" treatment — 4:3 at 88x66, 72x54 under 480px, a navy tile behind it, row cells centred, and an ::after that covers the browser's broken-image icon — because drawing a photograph into the 44px tap-target mark on --v3-wash made a decoded photo, a photo still fetching, and a row with no photo into three states with one appearance: a grey square that reads as broken. Only the oregon-city route opted in, because that is where the defect was found and the lane's files ended there. The same listing-shaped ledgers are still on the old treatment and were named by the lane: app/sell, app/activity, app/subdivisions/_v3/subdivision-rows.ts and lib/kb/place-open-houses.ts. Check each against a live render before changing it — a ledger that carries no photograph at all is correct as it is and must not be given one — then opt the ones that do carry photographs into the same treatment, so the site has one answer for a picture in a row instead of two. The Spark URL size rewrite the lane added lives at app/oregon/[city]/_v3/listing-row-photo.ts and was left local on purpose; if more than one route needs it, promote it to lib/listing/ rather than copying it.",
    output:
      'Every listing-shaped ledger that renders a photograph on the same V3Ledger photo treatment; the Spark size helper promoted to lib/listing/ if more than one route uses it; shots and receipts for each class touched',
    accept:
      "In a headless Chromium render at 1440 and 375 of each route that opted in, every row that carries a photo renders it at the photo treatment's box, not the 44px mark, and a row without one renders the designed glyph tile rather than a bare grey box. No class score falls below its last mark on the table instrument. If a named ledger is left on the old treatment, this node records which and why in one line.",
    dependsOn: [],
  },

  {
    versionGap: 'SITE-63',
    domain: 'public-ux',
    title: 'The loop can say a page is dull but cannot say what good looks like: references per class, variants before a winner, and an evaluator that names the replacement form',
    objective:
      "Matt 2026-09-09: \"i need to improve the ui and that whole process in the loop.\" Rounds one to three fixed real defects and the site still tops out at 69 on the table, because the loop is built to REMOVE tells, not to produce a good page. A builder is handed adjectives — quiet, editorial, expensive, Stripe restraint — and TASTE.md's own diagnosis says what happens next: 'absent a specific instruction, the model reaches for the statistically safest layout,' which here is the stacked-section page. Three changes, in payoff order. (1) REFERENCES PER CLASS, not adjectives. TASTE.md's 'Reference-driven, not adjective-driven' section already says the method — 'write down three to five references and what specifically works in each', 'point the builder at REAL component code to adapt', 'feed a machine-readable token sheet' — and it has never been done for a single one of the 27 classes. Create design_system/public/references/<class>.md for the classes under 70, each naming two or three real pages (the portal's version, the subject's own site, a piece of editorial data journalism) with ONE sentence per reference saying what specifically works, plus at least one shipped component's actual markup and CSS to adapt rather than generate from a description. A class's node then cites its reference file, and the evaluator is given it so 'beats' is judged against something named instead of invented. (2) VARIANTS BEFORE A WINNER. TASTE.md's 'variants rule' says a NEW data-display section ships as two or three named variants behind one prop, rendered side by side on a decision sheet for Matt to pick, losers DELETED in the commit that records the pick. It has never once been used, and it is the only step where Matt's taste enters the loop instead of a model's. Make it real: a `--variants` mode on scripts/take-route-shots.mjs that captures each variant at both viewports into one sheet, a published decision sheet, and the pick written on the node. (3) THE EVALUATOR NAMES THE REPLACEMENT FORM. Today it says 'static figure row, banned KPI grid' — a diagnosis with no prescription, so the builder invents. It must name which house form replaces it from the dataviz preference order in TASTE.md (hero figure, stat tile with sparkline, emphasis line with a scrubber, horizontal bar, dot strip, slope, small multiples, beeswarm, map with data-encoded cells), so a builder chooses among known-good shapes. Add that to design_system/public/taste-evaluator.v1-2026-09-08.md and bump the rubric version, which rebaselines by design. This node changes the PROCESS; it does not itself rebuild a page. Its own accept is that the next class to run through the changed process rises further than the last three rounds averaged.",
    output:
      'design_system/public/references/<class>.md for every class under 70; the variants mode and a published decision sheet; the evaluator prompt naming the replacement form, at a new rubric version; TASTE.md pointing at all three',
    accept:
      "Mechanical: a reference file exists for every class under 70 on the current table, each naming at least two real pages with a specific sentence each and citing at least one shipped component path that exists in the tree; `scripts/take-route-shots.mjs --variants a,b,c <class> <url>` writes one sheet with every variant at 1440 and 375; the evaluator prompt file contains the house form list and its rubricVersion differs from v1-2026-09-08. Then the proof: run ONE class under 70 through the changed process end to end (reference file in the brief, two or three variants, Matt's pick recorded on the node, the losers deleted in that commit) and its rise on the table instrument exceeds the median rise of the rounds that came before it. If it does not, say so on the node and name what the process still does not give a builder — a negative result recorded is the point, not a number talked up.",
  },
  {
    versionGap: 'SITE-64',
    domain: 'public-ux',
    title:
      '/about first viewport: faces open the page, not a three-tile KPI grid of 5.0 / 25 / 3',
    objective:
      "Re-measured live on production 2026-09-10 at 1440 and 375 (first viewport, ryan-realty.com/about). SITE-48 already put AboutFaces in the opening, but AboutFaces is passed figures=[{5.0 Google rating},{25 client reviews},{3 licensed Oregon brokers}] and that KPI grid is the first data object a visitor sees — TASTE.md bans KPI grids (a number, a percentage, and jargon with no sentence). Compass About and The Agency About open on faces at display scale; the 5.0-from-25 already lives on the face cards. Cut the figure-row from the fold. Do not touch app/contact (SITE-63 proof class) or AboutFaces callers on other routes unless they paint the same grid on /about. Reference: design_system/public/references/about.md on the SITE-63 branch (faces open; doors as secondary reach).",
    output:
      'app/about/page.tsx no longer feeds a three-tile figure row into AboutFaces; first-viewport shots at 1440 and 375; taste receipt for about on grok-4.6',
    accept:
      'Headless Chromium at 1440x900 and 375x812 of /about: the first viewport contains the three broker photographs and does not contain a three-cell figure row whose labels are Google rating / client reviews / licensed Oregon brokers. The 5.0 from 25 may appear on a face card. Then the about class tasteReview on grok-4.6, rubric current, rises above its prior mark from the same instrument or rebaselines on the grok-4.6 switch.',
    dependsOn: [],
  },
  {
    versionGap: 'SITE-65',
    domain: 'public-ux',
    title:
      '/compare first viewport: the four slots open filled with the live sample, not four dashed empty boxes above it',
    objective:
      "Re-measured live on production 2026-09-10 at 1440 (ryan-realty.com/compare). SITE-50 shipped V3Slots plus a SAMPLE comparison of four live homes, but the first screen is still four dashed 'Add a home' boxes; the actual comparison sits below the fold-ish hairline. The empty state should BE the comparison. Pre-fill the four slots with the same live sample columns the page already reads (labelled as a sample, every figure sourced) so a visitor sees four homes side by side without scrolling past empty boxes. Adding from a listing still uses the same tray. Do not touch app/listing (SITE-60) or app/contact (SITE-63).",
    output:
      'CompareEmpty / V3Slots opening on a filled sample; first-viewport shots at 1440 and 375; taste receipt for compare on grok-4.6',
    accept:
      "Headless Chromium at 1440x900 of /compare with an empty personal tray: the first viewport contains four listing photographs and their prices, and does not lead with four dashed empty 'Add a home' slots. Every displayed price traces to the live sample read. Then the compare class tasteReview on grok-4.6 rises above its prior mark from the same instrument or rebaselines on the grok-4.6 switch.",
    dependsOn: [],
  },
  {
    versionGap: 'SITE-66',
    domain: 'public-ux',
    title:
      'Every public park, ZIP, school, and taxlot surface has an authoritative polygon — most is not done',
    objective:
      "Matt 2026-09-10: 'we have most but need all.' The 18 park rows, 37 school attendance polygons, six ODE districts, and four-county taxlot fabric are most, not all. Same live census as seeded (docs/DATABASE_FOR_AI_AGENTS.md §2a, two query shapes): zip 0 of 10 public CANONICAL_ZIPS; 18 of 55 CO_SCHOOLS slugs have no school polygon and those pages draw a city stand-in; 12 of 18 parks are OpenStreetMap (NON_OFFICIAL debt — BPRD / Redmond / Prineville publish official layers); Crook and Jefferson taxlots 0 after two publisher checks. Partial re-source is a miss. Official GIS only. Do not invent geometry. Trails stay in trail_lines (W2.7). A new geo_type needs the CHECK migration AND a DECLARED_GEO_TYPES row.",
    output:
      'Authoritative polygons for every CO_PARKS slug, every CANONICAL_ZIPS member, and every CO_SCHOOLS slug (or a two-shape publisher absence AND the page no longer draws a city as if it were that school); OSM park rows 0; geo_type zip declared; taxlot counties that publish a layer ingested in full; Crook/Jefferson taxlots stay 0 only if the publisher check still finds no layer; ci:boundary-provenance floors updated; DATABASE_FOR_AI_AGENTS.md §2a refreshed',
    accept:
      "Matt: most is not done. Live, two query shapes: (1) CO_PARKS 18/18 park rows, OpenStreetMap contributors park count = 0, every source in AUTHORITATIVE_PUBLISHERS; (2) every CANONICAL_ZIPS slug has a zip polygon (TIGER ZCTA or named Census layer) and zip is declared in ci:boundary-provenance; (3) every CO_SCHOOLS slug has a school polygon — a city fallback on /schools/[slug] is a fail — unless evidence names the agency layer queried twice and the page draws no stand-in; (4) taxlots: every county that publishes a lot layer is ingested; crook and jefferson remain 0 only after a fresh two-shape publisher miss, never invented lots. No trail rows in boundaries. Headless /zip/97701, one re-sourced city park, and one previously city-fallback school each draw THAT place's polygon. Park/zip/school class scores do not fall. Do not invent geometry.",
    dependsOn: [],
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
