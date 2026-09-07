# The CMA, reimagined (2026-09-07)

Matt, 2026-09-07, on the 2465 7th document after the funnel mission shipped: "no one says band.
fix the layout. the chart makes no sense. everything should be linking back to my website, so if
they want to learn more about a comp etc, this must be tracked. the chart means nothing, we need
to illustrate that if homes are priced too high they sit and expire, period. figure this out, you
need to use better graphs. all in all this is a horrible cma, it does not flow and looks awful.
reimagine it."

This file is the blueprint. It replaces the chapter order in `CMA_PRICE_OPINION_SPINE.md` for
the seller document; the spine's voice and no-pitch rules still bind, `lib/pricing/` still owns
every number, and `CMA_SUNSTONE_CONTRACT.md` chapters not named here are deliberately out.
`docs/plans/CMA_DOC_PUNCHLIST_2026-09-07.md` is closed by this file.

## What the reader is doing

A homeowner whose listing failed opens this on a phone, from an email, with no context. They
give it ninety seconds. In that time they must understand three things, in this order, without
being told they were wrong:

1. What happened to their listing, in one picture.
2. In this market, homes priced near their value sell in weeks. Homes priced above it sit and
   come off. Shown with local numbers, not a slogan.
3. What their home is worth today, what proves it, and what to do next.

Everything that does not serve one of those three is cut. Every address, place and next step
is a link into ryan-realty.com that carries who they are, so a tap becomes a tracked lead signal.

## The register

One register, cream throughout. Navy is the cover and the closing page only. Amboqia Boriango
for the chapter titles, Geist for everything else. Hairline rules, no cards with borders inside
cards, no capsules. One idea per screen. Nothing on a phone ever sits inside a scroll box: every
graphic has a phone drawing. Photos are large. The document reads as a letter with exhibits,
not a dashboard.

## Words

Never: band, comp, comps, subject, adjusted close, brought to today, brought to your size,
kept, set, tier, ladder, dispersion, supportable, the recommend (as a noun). Never "I" outside
the signed closing.

Say instead: "homes like yours", "the sales that set the price", "your home", "sale price
adjusted for date and size", "priced within 3 percent of what it sold for", "priced 10 percent
or more above", "your price range", "recommended list price".

Gate: `band` joins `scripts/brand-voice-vocabulary.cjs` as a banned word in seller-facing CMA
text (the CMA renderers and `lib/cma/first-contact.ts`), enforced by `ci:brand-voice`.

## The chapters (expired origin; asked origins drop chapter 1 and the ask overlay in chapter 3)

### 0. Cover

Full-bleed listing photo, cream title block over it. Address. One line: "Your home is worth
$380,000 to $398,000 today. We recommend listing at $389,000." Prepared for NAME by BROKER,
Ryan Realty. Date. No landmarks, no arrows: if the only photo is the annotated aerial, use the
next MLS photo and put the aerial nowhere.

### 1. What happened

Title: "It asked $460,000 and did not sell."

The graphic: **their listing as a timeline**. A horizontal time axis from list date to
off-market date. A shaded zone across the whole width at the value range ($380K to $398K),
labelled "where homes like yours sold". Their price drawn as a stepped line: $475,000 at
Feb 26, cut to $460,000 on the cut date, ending at the withdrawn date, 187 days. The line never
enters the zone. That is the whole chapter in one look. Phone drawing: same, 360 units wide.

Under it, one sentence from data: "The asking price was 15.6 percent above the top of the range
homes like yours sold in. It sat 187 days. The Redmond median is 21."

Then the relist facts, three figures in a row: 3,394 Central Oregon homes came off unsold and
then sold, 2023 to 2026. The median one sold for 94.2 percent of the ask that failed. 12.3
percent sold for more than that ask.

Data: `render_args.expiredAudit.finalCycle` {listDate, initialAsk, cuts:[{date, ask}],
offMarketDate, status, days}, `render_args.pricing` low/high, `FAILED_ASK_BACKTEST`. If the
cycle has no cut, one flat line. If the range is above the ask, the line sits below the zone and
the sentence says so.

### 2. Priced right sells. Priced high sits.

Two graphics from local data, each with one sentence.

**2a. When homes like yours get their offer.** A cumulative curve: percent of Redmond
single-family sales in the last 12 months that had an accepted offer by day 7, 14, 30, 60, 90,
180. Their 187 days marked on the axis, far past the curve's shoulder. Sentence: "Half of the
homes that sold in Redmond had an offer inside 12 days. Nine in ten inside 60. Yours went 187
days without one."

**2b. The first price decides the days.** Three bars, median days to offer: sold without a
price cut · sold after a price cut (with the median cut) · came off unsold (median days on
market before it came off). Counts under each. Sentence: "Homes that launched at the right
price sold in a median of 9 days. Homes that had to cut took 58 and gave up a median 4.1
percent. Homes that never cut enough came off after a median 94 days." Their home sits in
the third group, marked.

Then, short: "Near you, these asked and did not sell." The unsold peers as small linked rows
(address, ask, days, came off), never a matrix.

Data contract (computed at BUILD in `lib/pricing` through the DAL, stored on `render_args`,
never derived in the renderer, each with a `source` citation block):

```
render_args.market.offerTiming = {
  city, windowMonths: 12, n,
  points: [{days: 7, pct}, {days: 14, pct}, {days: 30, pct}, {days: 60, pct}, {days: 90, pct}, {days: 180, pct}],
  medianDays,
  source: { table, filter, fetchedAt, query }
}
render_args.market.askOutcome = {
  city, windowMonths: 12,
  groups: [
    { key: 'sold-no-cut',    n, medianDays },
    { key: 'sold-after-cut', n, medianDays, medianCutPct },
    { key: 'did-not-sell',   n, medianDays }
  ],
  source: { table, filter, fetchedAt, query }
}
```
Definitions: sales = `StandardStatus='Closed'`, SFR, `City` = subject city, close in the last
12 months; days = `days_to_pending`; a cut = `OriginalListPrice > ListPrice` at close; did not
sell = Expired/Canceled/Withdrawn in the last 12 months, days = list date to off-market date
(the same definition as the subject's own DOM). Minimum n = 30 per group or the graphic is
omitted and the chapter says the count was too small. The stat is registered in
`scripts/stat-tables.cjs` (all stats, one process).

### 3. What your home is worth

Title: "$389,000." Under it: "List between $380,000 and $398,000."

"The sales that set the price": one table, thumbnails, every address a tracked link to its
listing page on ryan-realty.com. Rows, in this order and only these: photo · address (link) ·
sold price · sold date · size · beds/baths · year · days to offer · adjusted for date and size
→ sale price today. Rows identical across every column (property type) become one sentence
above the table. The subject column is first, headed "Your home", showing its list price and
size. Phone: one card per sale, same fields, photo on top. Legend, one line: "Sale price today
moves each sale for when it sold and how big it is."

Map of the sales with the subject pin, subdivision outline when on file. Under it the search
sentence: "There were not enough recent sales inside Diamond Bar Ranch, so we opened to one mile
and nine months."

For a currently listed subject, one line: "Listed at $X. The sales support $L to $H."

### 4. Who you would compete with at $389,000

Homes for sale now and under contract within the price range, nearest first, cards with photo,
address (tracked link), price, size, days on market, and one delta line against the subject
("$28,250 above, 60 sqft larger, 7 years newer"). Four and four. Sentence: "27 homes are for
sale between $350,000 and $428,000. 14 are under contract."

### 5. Redmond right now

The four figures in one row: months of supply with its verdict, sold price to original ask,
median days to an accepted offer, median sold. The median-close-by-month line. Subdivision
line: "145 homes have sold in Diamond Bar Ranch. The most recent four: …" each a tracked link.

### 6. Net at list

The existing three-up: net at low, recommended, high. One caption stating the concession basis
over the printed sales.

### 7. Next step (navy)

"Sorry this listing did not sell." Two tracked buttons: "Talk with Matt" → `/book`, "See homes
for sale near you" → the search page for the city, both carrying identity. Signature block,
license, disclosure sentence, date.

## Links and tracking

`lib/cma/doc-links.ts` exports `trackedDocLink(kind, target, ctx)` where kind ∈ listing |
place | market | search | book | site, target is the listing key / place slug / city, and ctx is
{brokerSlug, personId, cmaSlug}. It returns an absolute `https://ryan-realty.com/...` URL
carrying `?agent=<broker>&_pid=<person>&utm_source=cma&utm_medium=document&utm_campaign=<cmaSlug>`.
The listing URL comes from the site's canonical listing href builder (the one `ci:canonical-
listings` guards), never hand-built. Every address, place and CTA in the document goes through
it. The visitor tracker on the site stitches `_pid` to the session, so a tap on any comp shows
on the person's timeline and in the CMA's outcomes ("visited"). Verified end to end with one
tap in a browser before this ships.

## Done means

- The look-pass (`scripts/cma-lookpass.ts`) shows every chapter above at 816, 375, 1280, 375,
  read by the orchestrator, with no scroll box on a phone.
- `grep -i band` over the four rendered documents' seller text returns nothing.
- Every address in chapters 2 to 5 is an `<a>` through `trackedDocLink`.
- Chapter 2's figures carry `source` blocks and appear in `citations.json` beside the row.
- One send to matt@ryan-realty.com, one tap on a comp, the visit appears on the outcomes panel.

## Delta, 2026-09-07 afternoon (Matt)

"review how cmas are built by professionals, every aspect must be reconsidered. we need to
support our pricing with facts and not hype or hope. it must be clear what the price is and why.
we need to show their competition at the recommended price and failed listings that did not sell
that were overpriced. we need to clearly tell the story of those listings that did not sell. we
also need to show all pricing history for every listing and ensure that the reader understands
that if you overprice you will sit or not sell. we also need to explain the dangers of
overpricing clearly when we provide our numbers."

What this changes, chapter by chapter:

**Chapter 2 becomes two chapters.**

**2. The listings near you that did not sell.** One story per failed listing in the price range
(the unsold peers), not a matrix. Each: photo, address (tracked link), the full price path drawn
as a stepped line on a small time axis (every ask and every cut with its date, the off-market
date and status), days on market, and one sentence placing its final ask against what homes like
it sold for in the same months ("Asked $360,000 for 789 sqft, $456 a foot. Homes like it closed
at $274 to $320 a foot. Came off canceled after 36 days."). Their own listing is the first story.
Sentence over the chapter: how many in the range came off unsold in the last 12 months, and how
many of those have since sold and at what share of the failed ask (from the local pairs, not the
regional backtest, when n ≥ 10; else the regional figure, named as regional).

**2b. What overpricing costs.** The two local graphics (offer-timing curve, first-ask-vs-outcome
bars) plus one more figure per group: median sold price as a share of the ORIGINAL ask. The
chapter states the danger in plain sentences from those numbers, never as a slogan: the buyer
pool is largest in the first weeks (curve); a home that has to cut sells later and for less
(bars + the share); a home that never cuts enough comes off unsold (the third bar) and, when it
sells later, sells for the median share of the failed ask. Contract addition for R2:
`askOutcome.groups[].medianSoldToOriginalAskPct` (null for did-not-sell) and
`market.localFailedThenSold = { n, medianShareOfFailedAsk, windowMonths: 24, source }` for the
subject's city.

**Chapter 3, the price and why.** The method is stated in three sentences with the numbers in
them, above the table: which sales, how each was adjusted (date, size, style) to a sale price
today, and how the range and the recommended list follow (the range is the spread of those
adjusted prices; the recommended list is the ask that reaches the middle of them at the city's
current sold-to-ask share). Every sale row carries its full price history as the same small
stepped line (original ask → cuts → sold), not a sentence.

**Chapter 4, competition at the recommended price.** Every active and pending row carries its
price history line and days on market too, so the reader sees which competitors have already
cut. Sentence: how many have cut, median cut.

**Pricing history is a primitive.** One renderer, `priceHistoryLine(events, {wide|phone})`,
used for the subject, every sold sale, every unsold peer, and every competitor. Data:
`listing_history` on `render_args` for each listing (R2 confirms it is populated for comps,
peers and competition; where a listing has no recorded cuts the line is flat from original ask
to outcome).

**Facts, not hope.** No sentence in the document predicts. Every claim about time or money is
a measured local figure with its source block, or it is cut.

## Delta 2, 2026-09-07 (Matt): "it must be beautiful, interactive and engaging"

This is a bar, not a wish. `design_system/public/TASTE.md` applies to the web document exactly
as it applies to a public page: the page to beat, the banned tells, interaction on every data
section, and a SEPARATE evaluator pass recorded before Matt sees a URL. The print letter is the
same story paginated and stays still.

Interaction, per chapter, on the web document (the immersive path):

- **Cover.** The photo settles (one slow Ken Burns, 20s, respects reduced motion). The number
  is set, not counted up.
- **1. What happened.** The timeline draws left to right as it enters the viewport (one 400ms
  ease-out, once). Tap or hover a cut: the date and the ask. Tap the shaded zone: the sales that
  define it light up in chapter 3's table (scroll link).
- **2. Did not sell.** Each story is a card. Tap the price path to expand the full history as a
  dated list. Tap the address: the listing page on the site, tracked.
- **2b. What overpricing costs.** The curve reveals with the viewport; a slider or a tap on the
  axis moves a marker along the curve and reads "by day N, X percent had an offer"; the subject's
  own day is pinned. The three bars: tap a bar to see its n, median days, median cut, median
  share of ask.
- **3. What it is worth.** Tap a sale row: its pin pulses on the map and its price path expands.
  Tap a pin: the row highlights and scrolls into view. The map pans and zooms (existing map
  component). Toggle "adjusted for date and size" on and off on the sale prices to see what the
  adjustments do. Sort by distance, date, price.
- **4. Competition.** Filter: for sale · under contract · all. Tap a card: price path expands.
  Every address tracked.
- **5. Market.** Hover or tap the month line: the value and the month.
- **7. Next step.** The two buttons are the only CTAs. Tracked.

Rules: every interaction has a keyboard and touch path; nothing depends on hover to be
understood; motion is 200/300/400ms ease-out with `prefers-reduced-motion` honoured; no library
beyond what the site already loads; the print letter renders the same data still.

Evaluator: after the build, a separate agent runs the look-pass, opens the web document in a
browser at 1280 and 375, exercises every interaction above, scores against TASTE.md, and writes
`tasteReview` into `docs/plans/CMA_REIMAGINED_2026-09-07.md`. Fix what it finds; then Matt.

## Adopted from the professional-practice research (2026-09-07)

Brief: `docs/research/cma-professional-practice-2026-09-07.md`. All ten adopted; the pricing
side (R2b) and the document side (R3b) split as marked.

1. **Adjustment grid, line by line, per sale** (R3b, data already on `render_args`): sale price ·
   concessions · date adjustment · size adjustment · style adjustment · net adjustment $ and % ·
   gross adjustment % · sale price today. Form 1004 order. On the phone, one card per sale with
   the same lines.
2. **Reconciliation** (R2b exposes `pricing.reconciliation = { weights: [{listingKey, weight,
   reason}], mostWeighted: listingKey, sentence }` from the weight `estimate.ts` already
   computes; R3b prints the weight per sale and the sentence naming the most-weighted sale on
   similarity, recency and smallest gross adjustment).
3. **The range is the spread of the printed adjusted prices; the point is their weighted
   reconciliation** (R2b, closes D10). The renderer prints what pricing gives; pricing changes
   so that what it gives is derivable from the grid.
4. **Local realization table** (R2b: `market.originalAskRealization = { city, windowMonths: 12,
   buckets: [{weeks: '0-2', n, medianPctOfOriginalAsk}, '3-4', '5-8', '9-16', '17+'], source }`;
   R3b: the centrepiece of chapter 2b with the subject's own weeks marked). This replaces every
   unsourced industry table.
5. **Time-adjustment basis printed** (R2b: `pricing.timeAdjustment = { pctPerMonth, windowMonths,
   n, source }`; R3b: one line beside the first adjusted sale).
6. **Folklore banned** (R3b, in the mannered-prose pattern list and the look-pass `--check`):
   pyramid percentages, "first 30 days", "buyers assume something is wrong", showings-to-offer
   ratios, 15%/25% adjustment caps, "% of list by weeks" figures not from our own table.
7. **Price history line on every row** (already in Delta 1).
8. **Concessions per sale** (R2b confirms `listings.concessions_amount` population; R3b prints
   the line in the grid and derives the seller-net caption from the same rows).
9. **Basis and limits block** in the closing chapter (R3b): effective date, broker price opinion
   not an appraisal, what was and was not inspected, condition not adjusted where unrecorded.
10. **Considered and not used** (R2b: `pricing.rejected = [{listingKey, address, reason}]`
    from the selection's exclusion list, capped at eight; R3b: a short list under the grid) and
    the ±50 percent outlier rule on sale-to-list ratios feeding the list-price step (R2b).
