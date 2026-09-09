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

---

## tasteReview — 2026-09-07 (separate evaluator, did not build this)

Evaluated: worktree `wt/cma-doc-20260907` at `0d560378`. Evidence: the four look-pass
sets in `out/cma-look/` (letter 816/375, immersive 1280/375, interact 1280/375), read
chapter by chapter, plus the live document driven in a browser at 1280x900 and 375x812
from a dev server on this worktree (admin session, `/admin/cmas/cma-2465-7th-redmond-97756/view`),
where every interaction listed in Delta 2 was exercised and the DOM measured.

**Verdict: do not send this to an expired owner today.** Two defects are disqualifying on
their own — a control that mislabels for-sale homes as under contract, and a chapter that
states a fact the document's own table falsifies. The rest is a document with two or three
genuinely good ideas buried under a form that still reads as a report, not a letter.

### Scores

| Chapter | 0–7 | The one thing |
|---|---|---|
| 0. Cover | 2 | Uses the annotated aerial the blueprint banned, and puts unshadowed 13–14px cream on a sunlit lawn |
| 1. What happened | 4 | The best idea in the document. One shared price axis, the line never enters the zone |
| 2. Did not sell | 3 | Two stories, one of them 789 sqft against a 1,440 sqft home; every price path on its own y scale |
| 2b. What overpricing costs | 3 | Strongest data, weakest form; the fixed admin bar eats the top of the chart |
| 3. What it is worth | 3 | A Google map, as a flat bitmap, so three of the promised interactions do not exist |
| 4. Competition | 4 | The one chapter that looks like this shop — and its filter relabels the listings |
| 5. Redmond right now | 2 | The banned KPI grid, verbatim, with $532,311 sitting unexplained beside $395,000 |
| 6. Net at list | 1 | One paragraph that contradicts the grid three screens above it |
| 7. Basis and limits | 6 | Genuinely good. Plain, complete, honest |
| 8. Next step | 2 | Two 22px text links, neither carrying identity, on two-thirds of an empty navy screen |

Whole document on TASTE.md's weighting: **design quality 3, originality 3, interaction 3,
craft 2, honesty and function 3 — about 41 of 100.** The bar is a page a reader would
screenshot to show someone. Nobody screenshots this.

### 1. Does a seller understand it in ninety seconds on a phone?

No, and the flow breaks in four named places.

The phone document is **19,987px tall — about 25 screens**. Ninety seconds buys three or
four. What happened and what it is worth are 6,246px apart.

- **The cover answers the wrong question first.** `immersive-375/01-top.png`: the photo is
  the annotated aerial with six landmark arrows and a "*Location is approximate and for
  reference purposes only" watermark, squeezed to a 230px letterbox. The blueprint
  (chapter 0) says use the next MLS photo and put the aerial nowhere. The eyebrow reads
  `PRICE OPINION · 2465 7TH · 2026-09-08` and wraps with `08` orphaned on line two — a raw
  ISO date, and a different date from the `Sep 7, 2026` byline directly under it.
- **The number is stated three ways before the reader can breathe.** Cover: "worth $372,324
  to $398,788." Chapter 3 headline: "List between $380,000 and $407,000." Chapter 3 body:
  "they land at $372,324 to $398,788." The arithmetic is honest and derivable (each value
  carried to an ask at the city's 97.9 percent sold-to-ask share, stated in paragraph four),
  but the reader meets the second range before the sentence that reconciles it, and neither
  range is labelled as value or as list. Print both to the nearest thousand and say which
  is which on the cover.
- **On a phone their own home is not in the price chapter at all.** Live DOM at 375:
  `#what-its-worth` contains five cards — `1. 730 Quince … 5. 735 Oak` — and the string
  "Your home" appears nowhere. The desktop grid leads with a "Your home" column; the phone
  drawing drops it. The seller cannot compare their house to the sales on the device they
  are reading on.
- **Chapter 5 hands the reader their own objection.** `immersive-1280/07-this-market.png`
  prints "$532,311 · median sold, every Redmond home" in 56px beside a $395,000
  recommendation, with no sentence reconciling them. That is the first thing an expired
  owner will quote back.

Two claims about the same fact also disagree. Chapter 1: "The asking price was 15.3 percent
above the top of the range homes like yours sold in." Chapter 2, on the same listing: "$319
a foot. Homes like it closed at $274 to $320 a foot. That is at the top of what they closed
at." Both are true on different measures; read a minute apart they cancel.

### 2. Is every graphic readable in one glance without its caption?

No. Four are not.

- **The offer-timing curve** (`immersive-1280/04-priced-right.png`). Its x axis puts 7, 30,
  60, 90, 180 at even spacing, so 23 days occupies the same width as 90. The shoulder that
  carries the whole argument is an artifact of the axis. The 100% label is there in the DOM
  but the fixed `#bar` covers it in every shot.
- **The ask-outcome bars** (same shot). Two of the three bars are grey, not navy tints —
  off the two-colour system, and the two greys are barely separable. The right-aligned
  label block is three lines of grey per bar and is physically larger than the marks it
  labels; hierarchy inverted. At 375 the 8-day bar is a 25px stub with its "8 days" label
  300px away at the right edge, and the three value labels sit at three different x
  positions for one series.
- **"What the first asking price actually realized"** (same shot). Five rows, no mark, no
  bar — a table wearing hairlines, for the most persuasive fact in the document. It also
  hides that the series is not monotonic (100.0 → 97.0 → **97.2** → 95.3 → 92.1); the prose
  under it quotes the two ends and skips the reversal. Encode it.
- **The month line** (`immersive-1280/07-this-market.png`). The y axis carries exactly two
  labels, $461K and $530K, which are the series min and max, so a 13 percent spread on a
  roughly flat market is drawn as a full-height rollercoaster with a grey area fill. This
  is the same "the chart makes no sense" complaint in a new costume.

Borderline: the eight price-path lines in chapter 4 (`immersive-1280/06-competition.png`).
Each is a hairline with one dollar label at the left and no end value, so a cut renders as
an 8px unlabelled step. The prose says five of the eight have come down; the graphic will
not tell you which five. And in chapter 2 each card scales its own line, so 2527 5th's flat
$360K sits at nearly the same height as the subject's $475K.

What does read in one glance: the chapter 1 timeline at desktop width (one shared price
axis, the stepped ask above, the sold zone below, the gap measurable — this is the graphic
Matt asked for), and the chapter 4 delta line ("$22,250 above, 60 sqft larger, 7 years
newer, 0.7 mi away").

### 3. Is it beautiful by the TASTE.md bar?

No. Typography is the strongest part — Amboqia chapter titles at 46px over a Geist body is
a real editorial register, and `08-disclosure` is a well-set page. Rhythm and whitespace
are not: chapters 1, 2, 2b, 3 and 5 all run eyebrow → Amboqia heading → figure → sentence →
source, and chapter 2b repeats that shape three times inside itself. That is the
stacked-section page the file names as a tell.

Named tells actually present:

- **A Google default map** (`immersive-1280/05-what-its-worth.png`, bottom): Google logo,
  "Map data ©2026", tan/blue/green tiles, a red pin for the subject. TASTE names this
  exactly: "Not a Google default map," and `--rr-exception` is the only second hue.
- **A KPI grid with jargon** (chapter 5): "3.9 / months of supply", "97.8% / sold price to
  original ask" — a number, a percentage and methodology jargon, with no plain sentence
  saying what it means.
- **Instruction captions teaching the interaction** — "Tap a price change to read its
  date," "Drag along the curve, or use the arrow keys," "Tap a bar for the listings behind
  it," "Tap a month for its median close." Four of them. Same tell as the Atlas "pinch to
  zoom" sentence.
- **Off-palette grey** used as a data colour in three places: the chapter 1 sold zone, two
  of the three bars, the month-line area fill.
- **A wall of text**: chapter 3 opens with four stacked method paragraphs before any
  display.
- **Dashboard chrome on a seller document**: `#bar` is `position:fixed; top:0; z-index:50`,
  59px tall, carrying "2465 7th · Redmond, OR" and a **Print report** button, pinned over
  every screen including the phone. It is visibly clipping data in
  `immersive-1280/04-priced-right.png` (the 100% axis label and "95.6% by day 180"),
  `immersive-1280/05-what-its-worth.png` (it covers the "Days to offer" row of the
  adjustment grid outright), `06-competition.png` and `10-next-step.png`.

**Ugliest screen: `immersive-1280/10-next-step.png`.** An 812–1400px navy panel with about
300px of content floated right of centre, two 22px underlined text links where the
blueprint specifies buttons, a light-grey admin strip with "Print report" across the top of
it, and — in the look-pass evidence Matt would be shown — the broker portrait rendered as
the literal alt text "Matt Ryan". (The image itself is fine live: `ryan-matt.png` returns
200 and loads at 800×1200. The break is in the look-pass, but that is the evidence set.)
This is the last thing the seller sees and the only place the document asks for anything.

Runner-up: the chapter 1 timeline at 375 (`immersive-375/02-what-happened.png`), where the
plot is compressed to about 110px, the axis labels are 10.5px, and the whole claim reduces
to a grey bar with a thin line above it.

### 4. Are the interactions discoverable, do they work on touch, do they add understanding?

Mixed, and one is actively harmful. Exercised live, all of them:

Work, and reveal something:
- **Timeline cut** — clicking `$475K` swaps the caption to "Asked $475K on Feb 26"; the
  instruction line becomes the readout. Good pattern, wrong place: the answer appears
  200px below the mark you tapped, so your eye leaves the graphic. Annotate the mark.
- **Curve scrubber** — `role=slider`, arrow keys step it, readout updates.
- **Price-history expand** — `aria-expanded` flips, reveals the dated list ("Asked March 28,
  2026 $459,900 / Sold April 24, 2026"). This is the best interaction in the document.
- **Adjustments toggle** — `aria-pressed` flips and seven grid rows are removed. It shows
  what the adjustments do only by making the reader toggle and remember; a form that shows
  sale price and price today side by side would not need the toggle at all.
- **Sort** — reorders the columns. The sale numbers and the map pin numbers keep the
  original order, so after a sort the on-screen order is 3, 5, 1, 2, 4 and the pins still
  say 1–5.
- **Month line** — 12 dots, each with a real accessible name ("Sep: $530K median close").

Do not work, or do nothing:
- **The competition filter mislabels the listings.** Live at 1280: with "All" selected there
  are eight cards under two headings. Selecting **"Under contract"** hides the "For sale
  now" heading and leaves **all eight addresses visible under the "Under contract"
  heading** — so 825 Poplar, for sale, 13 days on market, is presented to the seller as
  under contract. Selecting "For sale" does the mirror image. The control publishes false
  status. This alone blocks a send.
- **Tapping a bar reveals nothing.** The readout it swaps in ("375 listings · sold at 100.0%
  of the first ask, 375 sales") is already printed permanently beside that bar. The caption
  promises "the listings behind it" and no listings appear. Decoration, which TASTE bans.
- **Three chapter 3 interactions do not exist.** The map is a single base64 `<img>` in
  `.pin-map-wrap` with no pins, no image map, no canvas and no iframe. So "tap a sale row,
  its pin pulses", "tap a pin, the row highlights and scrolls into view" and "the map pans
  and zooms" are all absent. `#what-its-worth` has zero clickable rows.

Touch:
- **65 interactive targets are under 44px at 375.** Named: every "Price history" button
  (74×33), every toggle, sort and filter pill (36px tall), every sale address link
  (309×**22**), the "Print report" button (101×34) — and the chapter 1 cut marker at
  **7×7px**. That is the flagship interaction of the flagship graphic, and it is unhittable
  on a phone.
- Good: **no horizontal overflow and no scroll box anywhere at 375**. The blueprint's
  "nothing on a phone ever sits inside a scroll box" is met, including the adjustment grid,
  which reflows to per-sale cards. Credit where it is due.

Keyboard and motion: every control is reachable and operable by keyboard, and
`prefers-reduced-motion: reduce` is honoured with a real block. Two ARIA gaps: the slider
ships with **no `aria-valuenow`** until the first key press and **no `aria-valuetext`**, so
it announces the day number and never the percentage that is the point of the control; the
bar and pill toggles set `aria-pressed` inconsistently (the bars leave it null).

### 5. Words

`band`, `comp`, `comps`, `subject`, `adjusted close`, `tier`, `ladder`, `dispersion`,
`supportable` return **zero hits across all eight rendered documents** (immersive and letter,
all four CMAs). That "Done means" line passes cleanly. The register is otherwise plain and
close to VOICE.md.

Three sentences explain the sentence before them:
- "By day 28, 52.0 percent of these sales had an accepted offer. **Between two measured
  days, read off the line.**" (curve readout, live)
- "Each sale below is moved by that path between the month it closed and today." (chapter 3,
  after the sentence that already stated the path)
- "Sale price today is the sale price plus every adjustment above it." (grid legend, under a
  grid whose rows are labelled in plain English already)

Jargon still reaching the reader: **"months of supply"** and **"sold price to original ask"**
as bare labels in chapter 5, and **"Weight in this price · 27.9%"** in the grid with nothing
saying what weight is. "What you keep" as the chapter 6 eyebrow is fine English but sits one
letter from the blueprint's banned "kept".

Numbers without a stated source or with a broken one:
- The chapter 1 figure row — **3,394 / 94.2% / 12.3%** — carries no source line anywhere on
  the screen. It is the regional backtest; say so.
- **"145 homes have sold in Diamond Bar Ranch"** (chapter 5) — no window, no source.
- **"34 homes are for sale between $356,000 and $435,000. 13 are under contract."** (chapter
  4) — no source line.
- **"By day 28, 52.0 percent"** is interpolated between the day-14 and day-30 measured
  points. The contract supplies six points; the scrubber prints a one-decimal figure at any
  of 187 positions as though it were measured. Either snap the readout to the measured days
  or label it as read off the line, not to a tenth of a percent.
- **"Came off unsold · your home · 118 days to an accepted offer"** (the bar's accessible
  name, live). Those listings never got an accepted offer. The bar about their own home is
  labelled with a fact that cannot be true of it.
- **"1 day to offer"** (730 Quince card) sits 40px above that same sale's price path reading
  **"asked $465K on Jun 11, sold $457K on Jul 6, 25 days."** Two day counts for one sale,
  neither labelled. This is the `days_to_pending` versus list-to-close trap CLAUDE.md §7
  warns about, printed side by side.
- **Contradiction, chapter 6 against chapter 3.** Chapter 6: "The sales that set this price
  reported no seller concessions, so what you net at list is the list price." The grid three
  screens above prints **Seller concessions … $4,000 … $10,000** for 2485 7th and 735 Oak.
  The net figure rests on a premise the document itself falsifies, in a broker price
  opinion. This is a §0 failure and it blocks a send.
- **"Considered and not used"** lists three addresses with a distance and no reason
  ("2748 6th · 0.18 miles NE from your home"). The blueprint asks for the reason. As shipped
  it reads as three sales dropped without explanation.

Precision that reads as machine, not broker: **"$372,324 to $398,788"** on the cover, and on
65365 Concorde **"$1,264,174 to $1,748,776"** — a $485,000 spread on a $1.47M home, printed
to the dollar. Round to the thousand and narrow the spread or say why it is that wide.

### 6. Would Matt send this today?

No. Ranked, the three that must change first:

**1. Stop the document contradicting itself and stop a control publishing false status.**
The competition filter must actually filter (right now "Under contract" relabels four
for-sale homes). Chapter 6 must read the concessions the grid prints, not assert there were
none. Fix the two day counts on every sale row to one labelled measure. Add the missing
source lines (3,394 / 94.2% / 12.3%, the 145 Diamond Bar Ranch sales, the 34/13 competition
counts) and either snap the curve readout to measured days or stop printing a tenth of a
percent for an interpolated one. Nothing else matters until a licensed broker's price
opinion stops arguing with itself.

**2. Give the answer a picture, and take the report chrome out of the letter.** Chapter 3
is the point of the document and it has no graphic of its own conclusion — it goes
headline, four paragraphs of method, then a twelve-row spreadsheet. Draw the five adjusted
prices as a dot strip with the range shaded and the recommended list marked, above the
grid, so one glance lands "here is where five real sales put your house, and here is where
we would list it." Then delete the fixed `#bar` and its "Print report" button from the
seller view — it is clipping the curve's axis and covering a row of the adjustment grid on
three of four documents — replace the Google map with V3Atlas (cream field, navy marks, the
pins that the row-tap and pin-tap interactions need, which today do not exist because the
map is a bitmap), and rebuild chapter 5 so it is not a KPI grid: give the four figures plain
sentences, put the months-of-supply idea in the two-bar form, fix the month line's axis so a
flat market looks flat, and reconcile $532,311 against $395,000 in one sentence or cut it.

**3. Make it survivable on a phone and finish the close.** 25 screens is not a
ninety-second document: put "Your home" back at the head of chapter 3 on mobile, stop
drawing every price path twice (once inside the sale card, once again under "How each of
these sales was priced"), and raise the 65 sub-44px targets — starting with the 7×7px cut
marker and the 22px address links. Then rebuild chapter 7: real buttons, not 22px text
links; `_pid`, `agent` and `utm_campaign` on both CTAs (today the comp links carry full
identity and **the two CTAs carry none**, so the one click that matters is unattributable to
the person or to this CMA); and content that fills the panel instead of 300px floated into
1,400px of navy.

Fourth, not blocking but it is the reason the cover reads as a portal graphic rather than a
letter: use the next MLS photo on the cover, per the blueprint, and give the eyebrow and
byline a scrim or a shadow — at a real 1280×900 viewport they are 13–14px cream at 70–90%
opacity sitting on a sunlit lawn with no legibility treatment at all.

**Beats:** nothing published in Central Oregon shows a failed seller their own listing on
the same price axis as the sales that set their value, with every address a live link — the
chapter 1 timeline and the tracked-link layer already win on depth and on how close a broker
is. It loses today on clarity and craft, which is the half a reader actually feels.

**Evaluator:** separate agent, did not build this. **Shots read:** `out/cma-look/cma-2465-7th-redmond-97756/`
(letter-816, letter-375, immersive-1280, immersive-375, interact-1280, interact-375), plus
`cma-65365-concorde/`, `cma-19968/`, `cma-1617-nw-8th/`. **Live:** dev server on this
worktree at 1280×900 and 375×812, every Delta 2 interaction exercised.

**Evidence hygiene:** `out/cma-look/` is not internally consistent. `cma-2465-7th-redmond-97756/letter-375/`
holds both `05-394000.png` and `05-395000.png` and both `09-basis-and-limits.png` and
`09-disclosure.png` — chapters from two different runs at two different recommended prices,
left side by side. Clear the directory before each look-pass, or the evidence Matt reviews
shows two answers.

---

## tasteReview — 2026-09-08 (round two)

Evaluated: worktree `wt/cma-doc-20260907` at `15910214`, tree frozen and clean. Evidence:
the four look-pass sets in `out/cma-look/` (written 00:40:13, one minute after the tip commit
at 00:39:16, so they are the current build), plus the live document driven on a dev server on
this worktree at 1280x900 and 375x812, admin session,
`/admin/cmas/cma-2465-7th-redmond-97756/view`. Every Delta 2 interaction was exercised in the
DOM, the competition filter's output was checked against `public.listings` directly, and the
price grid was checked against `cmas.render_args.pricing`. Separate evaluator; did not build
this. Round one's two measurement traps were held: the curve axis is measured, not assumed,
and no claim rests on a look-pass image where the live page disagrees.

**Verdict: better by a wide margin, and still do not send it to an expired owner today.** Both
of round one's disqualifying defects are fixed and verified at the source. In their place is a
single defect family that is worse than either, because it sits on the number the whole
document exists to deliver: the price is not derivable from the basis the document prints, and
three chapters print a "homes like yours" figure that contradicts the answer.

### Scores

| Chapter | R1 | R2 | The one thing |
|---|---|---|---|
| 0. Cover | 2 | 4 | Legible now, labelled now, rounded now — still the banned annotated aerial with six arrows and a reference-only watermark, on all four |
| 1. What happened | 4 | 5 | Sourced, annotated on the mark, 45px targets — and its zone label is the sentence three other chapters contradict |
| 2. Did not sell | 3 | 4 | Local pairs replace the regional figure; still two stories, one of them 789 sqft against a 1,440 sqft home |
| 2b. What overpricing costs | 3 | **6** | The biggest gain in the build. Linear axis, snapped scrubber, encoded realization strip, a bar tap that says something new |
| 3. What it is worth | 3 | 4 | The answer finally has a picture — sitting above a date column its own printed basis cannot produce |
| 4. Competition | 4 | **6** | The filter is correct, and I checked all eight against `StandardStatus` |
| 5. Redmond right now | 2 | 5 | KPI grid gone, MOS is two bars, the month axis lets a flat market look flat — and $532,311 is above every month drawn under it |
| 6. Net at list | 1 | **6** | Reads the concessions the grid prints. Median $7,000 across the 2 that reported one, 3 reported none. Derivable |
| 7. Basis and limits | 6 | 5 | The one chapter that went backwards: it claims a style adjustment the grid does not make, and its own next paragraph denies |
| 8. Next step | 2 | **6** | Real buttons, full identity on both, the panel filled, Print demoted |

Whole document on TASTE.md's weighting: **design quality 5, originality 5, interaction 6,
craft 4, honesty and function 3 — about 69 of 100**, against round one's 41 by the same
arithmetic (30/30/15/15/10, each criterion scored out of 7). Honesty is the only dimension that
did not move, and it is the one that decides whether this goes in an envelope.

### 1. Round one's ranked items

**Item 1 — stop the document contradicting itself and stop a control publishing false status.**

- Competition filter: **DONE**, and verified beyond the DOM. "Under contract" now yields
  exactly 592 Redwood, 1297 3rd, 2618 26th Loop North, 2712 26th LP North; "For sale" yields
  825 Poplar, 645 7th, 737 Elm, 2650 26th Loop North. Queried `listings` for all eight: the
  first four are `StandardStatus='Pending'` with a `pending_timestamp`, the second four are
  `Active` with none. The control tells the truth.
- Chapter 6 concessions: **DONE**. "Net at list is the list price minus $7,000 … the median
  across the 2 sales in the price chapter that reported one; the other 3 of the 5 that recorded
  the field reported none." The grid prints $4,000 and $10,000; the median is $7,000. It now
  reads its own evidence.
- Two day counts on a sale row: **DONE**. 730 Quince prints "1 day" in the grid and its path
  reads "sold $457K · offer in 1 day". One labelled measure. (Expanding the history still shows
  Mar 21 → Apr 24 on 840 Quince beside "4 days to offer" — coherent, unexplained, minor.)
- Missing source lines: **DONE** for all three named. The 3,394 / 94.2% / 12.3% row now carries
  "These three figures are regional, not this city alone: 3,394 matched pairs … Measured
  2026-08-05." Diamond Bar Ranch carries "between 2016 and 2026 … from the Oregon Data Share
  MLS." Competition carries "Homes for sale and under contract in Redmond between $356,000 and
  $435,000 … as of Sep 7, 2026."
- Curve readout precision: **DONE**. `aria-valuemin=7`, `aria-valuemax=180`, ArrowRight steps
  60 → 90. The slider snaps to the measured points; no interpolated tenth of a percent survives.

**Item 2 — give the answer a picture, take the report chrome out of the letter.**

- The dot strip: **DONE**, and it is the second-best idea in the document. "Sale price today, 5
  sales" — five marks, the $372K–$399K shading, the list line at $395K, and the failed ask
  drawn on the same axis at $460K. That last touch is the one that lands the whole argument in
  one look.
- The fixed `#bar`: **DONE**. Zero `position:fixed` elements in the live document. Nothing
  clips the 100% axis label or the grid rows any more.
- V3Atlas: **PARTIAL**. The map is still a base64 Google raster with the Google logo and "Map
  data ©2026" — TASTE names that tell by hand. But it now carries five real `button.pin-hit`
  targets at 44×44 plus a subject star, so pin → column and column → pin both work. Pan and
  zoom still do not exist.
- Chapter 5 rebuild: **DONE on form**. The KPI grid is gone. Months of supply is the two-bar
  form TASTE prescribes (223 for sale against 57 a month → 3.9 months). The month line's y axis
  runs $400K–$540K over a $461K–$530K series, so a flat market finally looks flat. $532,311
  gets a reconciling sentence. See §3 for what the sentence introduced.

**Item 3 — survivable on a phone, finish the close.**

- "Your home" at the head of chapter 3 on mobile: **DONE**. The first card at 375 is "Your home
  · 2465 7th · Listed $460,000 · 1,440 sqft · 3 bd / 2 ba · built 2004".
- Every price path drawn twice: **DONE**. Chapter 3 at 375 now holds six SVGs total — one dot
  strip and five price paths, one per sale. The duplicate block is deleted.
- 65 sub-44px targets: **PARTIAL, and most of the way**. Now 21 of 75 focusable elements at
  375. The chapter 1 cut marker went from 7×7 to 54×45 and 62×45. What remains: five dot-strip
  marks at 24px, twelve month-line dots at 26px, four chapter 5 address links at 21px tall.
- 25 screens: **NOT DONE — it went the wrong way.** `document.documentElement.scrollHeight` at
  375 is **20,768px, 25.6 screens**, against round one's 19,987. Every fix added (source lines,
  reconciliation sentences, the strip, the "Your home" card) and nothing was cut.
- Chapter 7 rebuild: **DONE.** Real bordered buttons, not 22px text links. The panel is filled
  — portrait left, heading, buttons, two paragraphs, license, disclosure. "Print this report"
  demoted to a text link at the very end. And identity: all **25** links in the server-rendered
  HTML carry `agent=matthew-ryan&_pid=538&utm_source=cma&utm_medium=document&utm_campaign=cma-2465-7th-redmond-97756`,
  both CTAs included. Round one's "the one click that matters is unattributable" is closed.

**Item 4 (non-blocking) — the cover.** Legibility **DONE**: the title block is a solid navy
panel, no more 13px cream on a sunlit lawn. The eyebrow's raw ISO date and the date mismatch
are gone. The photo is **NOT DONE**: all four documents still open on the annotated aerial with
six landmark arrows and "*Location is approximate and for reference purposes only", which the
blueprint's chapter 0 bans by name.

**The Words list: DONE, cleanly.** `band`, `comp`, `comps`, `subject`, `adjusted close`,
`tier`, `ladder`, `dispersion`, `supportable`, `brought to today` — zero hits in the live
document. Of round one's three explain-the-previous-sentence lines, two are gone; **"Each sale
below is moved by that path between the month it closed and today" survives verbatim**, and it
is now the sentence that carries a false claim (§3). The four instruction captions ("Tap a
price change…", "Drag along the curve…", "Tap a bar…", "Tap a month…") are all gone — the
Atlas "pinch to zoom" tell is cleared. Off-palette grey is cleared too: the chapter 1 zone
measures `rgba(16,39,66,0.13)` and the strip declares `rgba(16,39,66,0.16)` — navy tints, not
neutral grey, and I sampled the pixels to be sure rather than trusting the eye.

New in this round, and both are the banned form: **"The shading is what your home is worth"
appears as a caption and then again as the next sentence, verbatim**; and chapter 3 states its
value range three times inside ten lines — "$372,324 and $398,788", then "$372,000 to
$399,000", then "$372,324 to $398,788" again.

### 2. Regressions

1. **Chapter 7, Basis and limits — the only chapter that scored lower.** "Condition was not
   adjusted for. The grid in the price chapter moves each sale for when it sold, for size, **and
   for style**." There is no style row in the grid. Two paragraphs later the same chapter says
   the value rests on sales "adjusted for market conditions and size." A broker price opinion's
   limitations block contradicting itself about which adjustments were made is the worst place
   in the document for that error.
2. **The phone document got longer**, 19,987 → 20,768px.
3. **Chapter 3's controls take four rows on a phone.** Raising the pills to 44px pushed "With
   the adjustments" and "Sale prices only" onto separate lines, and the four sort pills onto two
   more — 208px of stacked controls, with "The sales:" and "Order:" orphaned beside wrapped
   groups, before the reader reaches a single sale.
4. **Chapter 5's four "most recent" addresses are dead links.** 730 Quince, 722 Redwood, 2475
   7th and 585 Redwood all resolve to `https://ryan-realty.com/homes-for-sale/redmond` — the
   city search — while 730 Quince has a real listing URL 2,000px above in chapter 3. Four
   addresses presented as links to specific homes, all landing on the same generic page.
5. **"Considered and not used" is gone.** `pricing.rejected` is `[]` on both documents I
   checked, so this may simply be unexercised rather than removed. Flagging so it is confirmed
   rather than assumed: round one asked for the missing reasons, and what shipped is no section.

### 3. Numbers that disagree, or lack a source

**A. The date adjustment is larger than the entire move its own source records. This is the
blocking defect.** Chapter 3 prints: "Prices a square foot in this city have moved down 0.4
percent a month over the last 12 months, across 864 sales. Each sale below is moved by that
path between the month it closed and today." The grid then prints, per sale:

| Sale | Closed | Months | −0.4%/mo implies | Printed |
|---|---|---|---|---|
| 730 Quince, $457,000 | Jul 6, 2026 | 2.0 | −$3,712 | **−$39,211 (−8.58%)** |
| 840 Quince, $410,000 | Apr 24, 2026 | 4.5 | −$7,380 | **−$47,068 (−11.48%)** |
| 1737 7th, $460,000 | Apr 24, 2026 | 4.5 | −$8,280 | **−$52,808 (−11.48%)** |
| 2485 7th, $410,500 | Feb 6, 2026 | 7.0 | −$11,494 | **−$38,176 (−9.30%)** |
| 735 Oak, $450,000 | Dec 15, 2025 | 8.7 | −$15,660 | **−$38,430 (−8.54%)** |

Three things are wrong at once. The printed column is 2.5× to 6.4× the printed basis. It is
non-monotone in time — a sale two months old is moved down 8.58 percent and one 8.7 months old
by 8.54 percent, while the two 4.5-month sales get 11.48 — so an older sale is adjusted *less*
than a newer one, and nothing on the page can explain that. And the source block behind that
sentence (`pricing.timeAdjustment.source`, `pricing_market_index`, `city_slug='redmond'`)
records the city's whole 12-month move as **median price a square foot 310.75 → 294.44, −5.25
percent**. Every one of the five sales closed inside that window, so no path drawn from that
series can move any of them more than 5.25 percent. The render args themselves name a different
basis from the sentence they ship with: `"basis": "city-monthly-index"` against a sentence
describing a smooth −0.4 percent monthly path. §0 requires that a printed number follow from
its named source. This one does not, and it is the entire bridge between what the sales sold
for and what the document says the house is worth.

**B. "Homes like yours" has two values, and the document uses the phrase for both.** Chapter 1
shades $372K–$399K and labels it "where homes like yours sold". Chapter 5 now says "Homes like
yours, 3 bed, 2 bath, around 1,450 sqft, closed at **$410,000 to $460,000**" — which is the raw
sold range of the same five sales. Chapter 2 says "Homes like it closed at $274 to $320 a foot",
which on 1,440 sqft is $394,560 to $460,800. Chapter 4 shows eight rivals of the same size and
type at $389,900 to $434,900, four of them under contract. Chapter 3 then recommends $395,000,
and its own last line reads "At $395,000 across 1,440 square feet, that is **$274 per square
foot**" — the exact bottom of the per-foot range chapter 2 printed. Four framings, one phrase,
and the only reconciliation offered is defect A. This is what an expired owner will quote back,
and the reconciliation sentence chapter 5 added — the right instinct — is what surfaced it.

**C. Chapter 1 still delivers two verdicts on the same fact, now in one paragraph.** "The
asking price was 15.3 percent above the top of the range homes like yours sold in. Asked
$460,000 for 1,440 sqft, $319 a foot. Homes like it closed at $274 to $320 a foot. A foot at a
time, that is at the top of what they closed at." Naming the two measures is an improvement.
Putting "15.3 percent above the top" and "at the top" four lines apart is not.

**D. $532,311 has no source and is above every month drawn beneath it.** Chapter 5 opens on a
bare figure — "$532,311 is every Redmond home, all sizes" — with no window, no table, no
fetch date. Three hundred pixels below, the "Median close" line it introduces reads Sep $530K,
Oct $511K, Nov $509K, Dec $510K, Jan $474K, Feb $500K, Mar $482K, Apr $461K, May $496K, Jun
$515K, Jul $525K, Aug $480K, captioned "Range $461K to $530K". A pooled median over the same
window cannot exceed all twelve monthly medians. One of the two labels is wrong.

**E. The cover of three of four documents opens on a quarter-of-the-price range with no
reason.** 2465 7th is $372,000–$399,000, a 7 percent spread — good. 19968 Terrace is
$312,000–$429,000 (29 percent), 1617 NW 8th $696,000–$926,000 (28 percent), 65365 Concorde
$1,260,000–$1,750,000 (33 percent). Round one asked to round these and narrow or explain them;
they are rounded and labelled now, which is real progress, but nothing says why a $1.47M
opinion carries a $490,000 spread.

**F. Cover and price chapter print different value ranges on the FSBO and land documents.**
19968's cover says "worth $312,000 to $429,000"; its chapter 3 opens "7 closed sales … land
between $295,926 and $441,070". Both are true — `rangeRule` is `trimmed-one-each-end` and
paragraph four says so — but the reader meets the untrimmed pair first and neither is labelled
where it appears. Round one's "the number is stated three ways" is fixed on the exemplar and
still live on two of the other three.

**G. Two dot strips fail outside the exemplar.** On 65365 Concorde the strip's width is set by
the two sales the prose says are "set aside" ($971K and $2.65M), drawn as identical navy dots
with the only two dollar labels on the graphic, while the $1.26M–$1.75M range they bracket goes
unlabelled — first read: "worth somewhere between $971K and $2.65M". On 19968 the "asked $140K"
marker sits at the far left with every dot clustered $296K–$441K, so 40 percent of the strip is
empty. The section that carries the answer is the section that breaks first on the class.

**H. Concessions are printed inside the adjustment grid and are not an adjustment.** 2485 7th:
sold $410,500, concessions $4,000, net adjustment −$38,176 (date only), sale price today
$372,324. The row sits between "Price history" and "Adjusted for date" with no note that it
does not enter the arithmetic — while chapter 6 uses the same figures to take $7,000 off the
seller's net.

### 4. Interaction, exercised live

Everything in Delta 2 now exists except map pan and zoom, and the ones round one called broken
are fixed at the mechanism, not the surface:

- **Curve.** X axis measured at 2.50–2.56 px/day across all four intervals — genuinely linear;
  round one's even-spacing artifact is gone. `aria-valuenow="60"` and `aria-valuetext="By day
  60, 70.2 percent of these sales had an accepted offer."` present before any input; both ARIA
  gaps closed.
- **Bars.** 538×105 hit areas, all three navy, `aria-pressed` consistent, accessible names
  corrected ("Came off unsold · yours is in this group · median 118 days **on market before it
  came off**" — round one's impossible "days to an accepted offer" is gone). A tap now adds
  "110 days longer than the homes that sold without a price cut", which is not printed anywhere
  else. No longer decoration.
- **Timeline cut.** Markers 54×45 and 62×45, keyboard-focusable, named "Asked $475K on Feb 26"
  / "Cut to $460K on Jul 28" — and the readout now renders **25px above the mark**, not 200px
  below it.
- **Sale ↔ pin.** Both directions work; the pin lights the column and the column lights the
  pin. The pin side is a real `<button>`; the column side is a bare `<th>` with no role, no
  `tabindex` and no cursor affordance, so one direction of the pair is neither discoverable nor
  keyboard-reachable.
- **Sort.** Sorts, and the badge travels with the sale — by price the columns run 3, 5, 1, 2, 4
  and the pin numbers follow. Round one's number-as-position bug is fixed by making the number
  an identity.
- **Adjustments toggle, price history, month line.** All work; `aria-expanded` flips and the
  dated list renders. Twelve month dots with real names.
- Tab order is monotonic top-to-bottom across all 75 focusables but one 107px back-jump between
  two map pins. No horizontal overflow at 375 or 1280 (`scrollWidth === clientWidth`).

### 5. Would Matt send this today?

No. Shortest ranked list to yes:

**1. Make the price derivable, and stop three chapters contradicting the answer.** Fix the date
column or fix the sentence that claims to explain it — as printed, the adjustment exceeds the
entire 12-month move its own source block records, and moves an older sale less than a newer
one. Then give "homes like yours" one meaning: chapter 1's zone is the *adjusted* range and
chapter 5's $410,000–$460,000 is the *raw* range, so label them as two things or print only
one. Give $532,311 a source and a window or cut it. Fix the disclosure's style-adjustment claim
against its own next paragraph. Nothing else matters while a broker price opinion cannot show
its work.

**2. Say the range once, and say why it is that wide.** One statement of the value range,
rounded, labelled value, with the list range beside it — not three statements in ten lines, two
of them to the dollar. On the cover of the three documents carrying a 28–33 percent spread, one
sentence giving that spread a cause.

**3. Fix the two strips that fail off the exemplar, and the four dead links.** Clamp the land
and FSBO strips to the kept sales and draw a set-aside sale differently from a counted one.
Point chapter 5's four addresses at those four homes.

**4. Then the phone.** 25.6 screens is longer than round one, not shorter — cut something. Then
the four-row pill block, the 24–26px chart marks, and the 21px address links.

Non-blocking, and it is the last cosmetic tell: the cover still opens on the annotated aerial
with six landmark arrows and a reference-only watermark on all four documents, which chapter 0
bans; and the letter path calls the document a "PRICING REPORT" where the web calls it a "PRICE
OPINION".

**Beats:** two wins now, not one. Nothing published in Central Oregon puts a failed seller's own
price path on the same axis as the sales that set their value, with every address a tracked
link carrying identity — and chapter 2b's linear offer-timing curve plus the realization strip
is a better-evidenced answer to "what does overpricing cost" than any portal or competitor
brokerage page publishes for this market. What it still loses on is the half a reader feels
first: whether the number adds up in front of them.

**Evaluator:** separate agent, did not build this. **Shots read:**
`out/cma-look/cma-2465-7th-redmond-97756/` (all six sets) plus the covers and price chapters of
`cma-65365-concorde/`, `cma-19968/`, `cma-1617-nw-8th/`. **Live:** dev server on this worktree,
1280×900 and 375×812, every Delta 2 interaction exercised in the DOM, the competition filter
cross-checked against `public.listings`, the price grid against `cmas.render_args.pricing`.

**Evidence hygiene:** clean this round. Each `letter-375/` and `letter-816/` holds one price
per document; round one's two-prices-side-by-side artifact is gone. The interact sets now carry
`01-timeline-cut` and `08-competition-pending`, so the two controls that failed last time are
in the evidence Matt sees.

---

## R3d ledger — round two, document side (2026-09-08)

Worktree `wt/cma-doc-20260907`, merged to `6a4aff75` first. Three commits, in the
order the evaluator ranked them. Every claim below was read off a look-pass run
whose slug directory was cleared first; `--check --interact` is green on all
four exemplars.

**Measured length, 2465 7th, `document.documentElement.scrollHeight` at 375:
20,768px → 15,832px (19.5 screens).** The look-pass prints this itself now, at
both widths, so a length claim in the next review comes off the same run as the
shots. Other exemplars: 19968 12,312 · 1617 NW 8th 14,283 · Concorde 17,638.

| Item | Status |
|---|---|
| §3.B "homes like yours" gets ONE meaning | DONE. Ch1's zone label reads "where homes like yours sold, adjusted for date and size" (and shrinks to fit the phone frame); ch5 states the raw close prices and says "before adjusting for date and size"; ch2's dollars-a-foot line says "unadjusted". |
| §3.D $532,311 | CUT. It sat above all twelve monthly medians drawn under it with no window, table or fetch stamp beside it that would make them different sets. §0: a figure that cannot be reconciled to what is drawn under it does not ship. |
| §2.1 basis and limits | DONE. Both paragraphs read `adjustmentsMade(comps)`, so neither can name an adjustment the grid did not print. "Basis for the value" moves up beside the three a reader uses. |
| §3.F the range stated once | DONE. Chapter 3 states it once, off `pricing.valueLow/valueHigh` — the pair the cover reads — rounded to the nearest thousand, with the list range beside it or "List in that range" when they are the same pair. The table lead and the strip reading no longer restate an untrimmed pair. |
| §3.E wide ranges | DONE. Over 15 percent, one sentence off `pricing.rangeRule` gives the cause, on the letter cover and the immersive hero. |
| §3.H concessions caption | DONE, under the grid. |
| §2.4 four dead links | DONE. `trackedDocLink('listing', …)` now gets `mlsNumber` off `notableSales[].listNumber`; the four resolve to their own listing pages. |
| §1 duplicated shading caption | DONE. The caption is on the drawing; the sentence under it says what a dot is. |
| §3.G the strips off the exemplar | DONE. The axis is the kept sales, the list line and the FAILED ask. A set-aside sale is hollow with its own label inside the axis, named in the caption outside it. 19968's "asked $140K" is gone — that ask did not fail, it was a 2004 list price. |
| §4 row → pin | DONE. The header cell carries a 44px overlay with role, tabindex, focus ring and Enter/Space. |
| item 3, phone length | DONE, 15,832px. Sale cards are a conclusion with the working one tap under; ch2's story cards fold their price path; the statutory disclosure block sits behind one control (TASTE.md's own remedy for prose with no figure); ch4's competitor card lies down on a phone (104px thumbnail beside the facts, same markup and same filter); ch3's controls are one block, a segmented pair and a select. |
| item 3, chart marks | DONE with a stated deviation. A dense series cannot give every mark a 44px-WIDE target without the neighbour swallowing it — the reason the strip's target was 26 units. The target is now a 44-unit-tall band as wide as the gap to the nearest neighbour. The dimension that was failing is the one that grew. Chapter 5's four sales are 44px chips. |
| item 4, "PRICING REPORT" | DONE. The letter's eyebrow reads "Price opinion". The `<title>` and the PDF filename keep "Pricing report": that is the file's name, not the masthead. |
| item 4, the cover photo | NOT A RENDERER CHOICE, and that is the finding. All four rows hold exactly ONE url in `extras.photos.current`, `historical` is empty, and `subject.photoUrl` IS that url — checked against the stored rows 2026-09-08. The annotated aerial is the only photograph the MLS carries for 2465 7th. A rule that skipped the first photo would degrade every listing whose first photo is its front elevation. The photo SET belongs to the build side; written into the comment on `heroForSubject` so it is not re-litigated. |

Not touched, by instruction: `pricing.timeAdjustment.sentence` and the grid's
date column render exactly as `lib/pricing` gives them (§3.A is R2d's).

---

## tasteReview — 2026-09-08 (round three)

Evaluated: worktree `wt/cma-ship-20260907` at `45cd13af`, the integration tree carrying both
round-two lanes. Evidence: a look-pass run in this tree over all four exemplars
(`--check --interact`, exit 0, slug directories written 01:47–01:52 against rows built
08:25–08:31Z, so the shots are the current engine), read chapter by chapter; plus the live
document driven on a dev server on this tree at 1280x900 and 375x812, admin session,
`/admin/cmas/cma-2465-7th-redmond-97756/view`. The date column was read against
`cmas.render_args.pricing.timeAdjustment` on all four rows and recomputed against
`pricing_market_index` directly. The recommended price was recomputed from
`pricing.reconciliation.weights` on all four. Separate evaluator; did not build this.

**Verdict: the blocking defect is fixed on the exemplar and is still live on the class.**
Round two's §3.A is genuinely closed for 2465 7th — I recomputed every printed adjustment from
the index and every one is exact. But the same recomputation on 65365 Concorde shows the
printed method produces $1,973,000 and the document prints $1,473,000, and on two of the four
documents the phrase "set aside" is true of the range and false of the price. A fix verified on
one row is not a fix; the exemplar is the one row where the trimming rule never fires.

### Scores

| Chapter | R1 | R2 | R3 | The one thing |
|---|---|---|---|---|
| 0. Cover | 2 | 4 | 4 | Unchanged; the aerial is the only photo the MLS carries for 2465 and that is now documented, not a renderer choice |
| 1. What happened | 4 | 5 | **4** | The axis is honest and I measured it — which is what exposes that the story is no longer true |
| 2. Did not sell | 3 | 4 | 4 | Still one peer story, still 789 sqft against a 1,440 sqft home, still sharing the subject's own $/foot range |
| 2b. What overpricing costs | 3 | 6 | 6 | Unchanged and still the best-evidenced chapter in the document |
| 3. What it is worth | 3 | 4 | **6** on 2465, **3** on the class | The price is derivable to the dollar here and off by $500,000 on Concorde |
| 4. Competition | 4 | 6 | 6 | Re-verified: the filter yields 4 and 4, disjoint, correct headings |
| 5. Redmond right now | 2 | 5 | 5 | $532,311 is cut — and all twelve months drawn beneath still sit above the recommendation |
| 6. Net at list | 1 | 6 | 6 | Holds |
| 7. Basis and limits | 6 | 5 | **6** | The style-adjustment claim is gone; it now reads "for when it sold and for size" |
| 8. Next step | 2 | 6 | 6 | Holds; both CTAs carry full identity |

Whole document on TASTE.md's weighting: **design quality 5, originality 5, interaction 6,
craft 5, honesty and function 4 — about 72 of 100**, against round two's 69 and round one's 41
by the same arithmetic (30/30/15/15/10, each criterion out of 7). Craft moved on length and
targets. Honesty moved one point, not two, because what was fixed was fixed on one document.

### 1. §3.A — the date column, all four rows

Read off the live grid and off `render_args`; identical, so the renderer is faithful. The
"implied" column is what the sentence's own headline rate would produce.

**2465 7th — sentence: "a path that rose 3.6 percent over the last 12 months across 854 sales."**

| Sale | Closed | Months | Sold | Printed | Printed % | Index check | Follows? |
|---|---|---|---|---|---|---|---|
| 730 Quince | Jul 6, 2026 | 2.1 | $457,000 | $0 | 0.00% | 322.085 → 322.085 = 0.00% | yes |
| 840 Quince | Apr 24, 2026 | 4.5 | $410,000 | −$6,888 | −1.68% | 327.59 → 322.085 = −1.68% | yes |
| 1737 7th | Apr 24, 2026 | 4.5 | $460,000 | −$7,728 | −1.68% | 327.59 → 322.085 = −1.68% | yes |
| 2485 7th | Feb 6, 2026 | 7.0 | $410,500 | +$2,135 | +0.52% | 320.405 → 322.085 = +0.52% | yes |
| 735 Oak | Dec 15, 2025 | 8.8 | $450,000 | +$1,980 | +0.44% | 320.66 → 322.085 = +0.44% | yes |

Every figure is exact against `pricing_market_index`, `city_slug='redmond'`, on the stated
trailing-three smoothing with the stated endpoint. Round two's defect — an adjustment 6.4× its
own basis — is gone. The window figure checks too: Sep 2025 smoothed 310.755 → 322.085 = +3.65%,
printed 3.6, and the source block's "Level 310.75 to 322.08" matches.

**It is not monotone in age, and no reversal is named.** The column runs 0.00 → −1.68 → +0.52
→ +0.44 as the sales get older. It reverses twice. The reversal is real — April's smoothed
index (327.59) sits above the endpoint (322.085) — but a reader is given one number, "rose 3.6
percent," and then shown an April sale moved *down*. Nothing on the page can explain that. One
clause would ("prices in this city peaked in the spring and have come back since").

**The sentence describes the mechanism exactly on 2465 and misdescribes it on both Bend
documents.** 19968 and 65365 Concorde both print "a path that fell 1.6 percent over the last 12
months across 2,477 sales", and then move **five of seven** and **four of six** sales *up*. One
Concorde sale is moved −4.33% — 2.7× the only number in the sentence. Both are exact against
the Bend index (Jun 2026 smoothed 411.85 → 393.995 = −4.33%; Apr 386.62 → 393.995 = +1.91%), so
the arithmetic is sound and the sentence is the thing that is wrong: it names an endpoint move
and the column applies a path.

**1617 NW 8th uses a different method, and nothing says so.** Its basis is `year-over-year`
with `n: 0`, spread evenly across the months — smooth, monotone (−0.17 → −0.36 → −0.59 → −1.49
→ −1.90) and honest. But it is a Bend document built four minutes after two other Bend
documents that used `city-monthly-index-trailing-3` with n=2,477. Three Bend price opinions,
two date-adjustment methods, no sentence distinguishing them. `buildTimeAdjustmentBasis` falls
back when `marketIndexTrend` returns null; on the evidence here that fallback fired for a city
whose index is populated.

### 2. Round two's ranked items

**Item 1 — make the price derivable, stop three chapters contradicting the answer. PARTIAL.**

- *Date column:* **DONE on 2465, sentence still wrong on both Bend rows.* See §1.
- *"Homes like yours" gets one meaning:* **DONE.** Ch1's zone reads "where homes like yours
  sold, adjusted for date and size"; ch5 reads "sold for $410,000 to $460,000 before adjusting
  for date and size"; ch2's per-foot line is marked "unadjusted". Three framings, three labels.
- *$532,311:* **DONE — cut.** It is nowhere in the live document.
- *Disclosure's style claim:* **DONE.** "moves each sale for when it sold and for size. It
  moves none of them for condition."
- **NOT DONE, and this is the round-three blocker: the price is derivable on 2465 and on
  19968, and not on Concorde.** Recomputed from `pricing.reconciliation.weights`:
  2465 weighted mean $426,571 ÷ 0.98 = **$435,276 → $435,000 printed** ✓;
  19968 $428,278 ÷ 0.967 = **$442,893 → $443,000 printed** ✓;
  Concorde $1,907,567 ÷ 0.967 = **$1,972,665 against $1,473,000 printed.** The printed number is
  the failed ask × 0.982 ($1,500,000 × 0.982 = $1,473,000 exactly, the p75 of the failed-ask
  backtest, named in `reviewReason` and printed nowhere). The document states a method in
  chapter 3 and then prints a price that method does not produce, $500,000 away, on a $1.5M
  opinion. This is round two's §3.A in a new place.
- **NOT DONE: "set aside" is true of the range and false of the price.** Concorde prints "2
  sales, at $1.07M and $2.95M were set aside" and "the highest and the lowest set aside". Those
  two sales carry **38.4 percent** of the weight in the recommended price (Swalley 22.9, Odem
  15.5) and are printed in the grid with full "Sale price today" values and weights and no mark.
  19968: **22.3 percent.** A reader told a sale was set aside will not expect it to be the
  second-heaviest sale in the answer. 2465 uses `min-max` and keeps all five, which is why the
  exemplar shows none of this.
- **NOT DONE, not raised before: two of the four documents carry `needsReview: true` and render
  clean.** 19968's own `reviewReason` reads "the recommendation ... makes the recommendation
  indefensible ... [critical] The $443,000 recommendation sits far above the machine-adjusted
  values of the three comps the analysis actually kept". Concorde's reads "a broker should
  confirm the comp selection before this goes to a client." Neither string, nor the word
  confidence, nor any caveat appears anywhere in either rendered document. `grep -iE 'needs
  review|confidence|Moderate|Supportable|indefensible|broker should confirm'` over both
  `immersive.html` files returns zero. A document whose own audit says it is indefensible is
  indistinguishable, to a reader and to Matt, from one that is clean.

**Item 2 — say the range once, say why it is that wide. DONE.**
Chapter 3 states it once: "The sales support $412,000 to $443,000. List between $420,000 and
$452,000." Both list figures are derivable from the printed 98.0 percent share
($412,000/0.98 = $420,408; $443,000/0.98 = $452,041) and the carrying sentence is printed. The
three-statements-in-ten-lines is gone. The wide-range cause sentence ships on all three: 19968
"because the five sales behind it still land $148,000 apart once each is moved to today, and
that is after setting aside the two furthest"; Concorde and 1617 the same form.

Two residuals. The cause sentence names a count the same chapter contradicts — 19968 says
"the five sales behind it" over a strip captioned "7 sales" and a table lead reading "The seven
closed sales below set this number"; Concorde says "the four sales behind it", strip "4 sales",
table "The six closed sales below". And the ranges got wider, not narrower: 19968 went 29% →
**45%** ($331,000–$479,000) and Concorde 33% → **39%** ($1,390,000–$1,930,000). A cause is now
given, which is what was asked; the spread itself is worse.

**Item 3 — the two strips off the exemplar, and the four dead links.**
- *Dead links:* **DONE.** Chapter 5's four addresses resolve to
  `/homes-for-sale/redmond/diamond-bar-ranch/730-quince-220222913?agent=…&_pid=538&…` and three
  siblings — their own listing pages, full identity.
- *Strips:* **PARTIAL.** 19968's set-aside sales are drawn hollow and the "asked $140K" ghost is
  gone, and Concorde's axis is now the kept sales — both real. But 19968's strip still labels its
  axis **$322K and $480K** while the range printed three lines above is **$331,000 to $479,000**,
  and 1617's strip labels **$675K/$898K** against a stated worth of **$696,000–$926,000**. On
  both, the two numbers a reader's eye lands on are not the two numbers the document says the
  home is worth. And on Concorde at 1280 the "list $1.47M" and "asked $1.50M" labels collide at
  the same x — 2 percent apart on a 39 percent axis — so the one mark that carries the
  recommendation is illegible.

**Item 4 — the phone. DONE, and it is the cleanest item in the round.**
Measured live, not from the ledger: `document.documentElement.scrollHeight` at 375x812 is
**15,832px, 19.5 screens**, against round two's 20,768 and round one's 19,987. First time the
number has moved down. Chapter 3's controls are **two rows, not four** — the segmented pair at
44px on one line and a 45px select under it. Sub-44px targets are **17 of 107 focusables**,
down from 21 of 75, and all seventeen are chart marks (five strip dots, twelve month dots) at
41px tall — three pixels short of the band R3d says it built, and nothing else. No horizontal
overflow at either width.

**Non-blocking item — the cover photo.** Accepted. `extras.photos.current` holds exactly one
url on all four rows and `subject.photoUrl` is that url; the annotated aerial is the only
photograph the MLS carries for 2465 7th. Correctly reclassified as a build-side limitation and
documented on `heroForSubject`. The "PRICING REPORT" masthead is gone from the letter eyebrow;
"Pricing report" survives only in `<title>` and the PDF filename, which is the file's name.

### 3. Numbers, sources, explaining sentences, banned words — all four documents

- **Concorde's recommended price does not follow from its printed method.** §2, item 1. Blocking.
- **"Set aside" sales carry 38.4% (Concorde) and 22.3% (19968) of the price.** Blocking.
- **Two documents render a `needsReview: true` verdict as a clean opinion.** Blocking.
- **Chapter 5's month line sits entirely above the recommendation.** Twelve monthly medians,
  $461K to $530K, drawn under a $435,000 recommendation. Cutting $532,311 removed the number
  and left the picture. The chapter's opening sentence — "The five sales behind your price sold
  for $410,000 to $460,000 before adjusting for date and size" — is the right instinct and does
  not say the line is every size of home in the city. An expired owner will read the twelve
  months, not the caveat.
- **Chapter 5's raw top equals the failed ask.** "Homes like yours sold for $410,000 to
  $460,000" — 1737 7th closed at exactly $460,000 on Apr 24 — sits four screens from chapter 1's
  "The asking price was 3.8 percent above the top of the range homes like yours sold in." Both
  true (adjusted versus raw, and both now labelled). Neither reconciles the other, and it is the
  single most quotable pair in the document.
- **19968 prints the same address twice** — "60924 Targee" at $455,000 (Jun 26) and "60924
  Targee" at $287,500 (Mar 17), rows two and four of the same grid, no unit number, no note. A
  reader sees one house selling twice at a $167,500 difference.
- **Two figures for one idea, 1,500px apart.** Ch1: "94.2% of the ask that failed is what the
  median one sold for", regional, sourced. Ch2: "153 Redmond listings that failed came back and
  sold, at a median 95.7 percent of the ask that failed", local, sourced. Both labelled; still
  two numbers for the reader to reconcile alone.
- **Explaining the previous sentence:** round two's surviving line, "Each sale below is moved by
  that path between the month it closed and today", is **gone**. Two remain, both in chapter 3:
  "A minus figure means that sale would sell for something yours does not. A plus means yours
  does" (under a grid whose rows are already in plain English), and "Every home here is a single
  family residence. Every home here is 3 bd / 2 ba" as two consecutive sentences of one shape.
- **Banned words: clean.** `band`, `comp`, `comps`, `subject`, `adjusted close`, `kept`, `set`,
  `tier`, `ladder`, `dispersion`, `supportable` return nothing in the seller text of any of the
  eight rendered documents. `band` appears five times in `letter.html` and once in
  `immersive.html` and every hit is inside a CSS comment. Worth knowing: `render_args.listingPlan`
  carries "51 homes like yours are for sale in this **band** now" and, on Concorde, "**N/A**
  median close $499,450 across 500 sales" and "We market against **N/A**'s own closed sales" —
  neither string reaches either seller document, so this is a loaded gun, not a wound.
- **Every figure I checked carries a source.** The three chapter 1 regional figures, Diamond Bar
  Ranch, the competition counts, the offer curve, the realization strip, the index. No unsourced
  number found on 2465.

### 4. Regressions from the round-two fixes

1. **Chapter 1's story no longer matches its own data.** The corrected engine moved the value
   range from $372,000–$399,000 to $412,000–$443,000, so a $460,000 ask that round two could call
   "15.3 percent above the top" is now **3.8 percent** above it. The chapter still opens "It
   asked $460,000 and did not sell", still draws the ask line above the zone, and still hands
   off to a chapter titled "What overpricing costs". I measured the SVG: the axis is exactly
   linear and shared (2.11 units per $1,000 on the ask line and on the zone, verified against the
   viewBox), so the drawing is honest — and honest is what makes it a regression. The gap it
   draws is small, the sentence beside it says 3.8 percent, and the document's whole first act
   is an overpricing argument the numbers no longer carry. This is a consequence of a correct
   fix, not a bug in it, and it is the reason the answer to §5 is still no.
2. **Round two's §3.A fix was verified on the row where the trimming rule never fires.** 2465 is
   `min-max`, keeps all five, and has no set-aside sales. Both defects in §2 item 1 live only on
   `trimmed-one-each-end` documents. The lesson generalises past this fix.
3. **1617 NW 8th's date basis diverged from its own city.** §1.
4. **The wide ranges got wider** (19968 29%→45%, Concorde 33%→39%) while gaining the cause
   sentence that was asked for.
5. Not a regression, closed: the competition filter still tells the truth. Re-driven live at
   1280 — "Under contract" yields 592 Redwood, 1641 3rd, 1297 3rd, 841 Negus and one heading;
   "For sale" yields 2623 6th, 825 Poplar, 1509 8th, 645 7th and one heading. Disjoint, four and
   four. The slider ships `aria-valuenow="60"` and `aria-valuetext="By day 60, 70.2 percent of
   these sales had an accepted offer."` before any input. Row→pin is a real focusable overlay
   now. Both CTAs carry `agent`, `_pid`, `utm_source`, `utm_medium`, `utm_campaign`.
6. Cosmetic, new, minor: the rank badge sits inside the address anchor, so
   `innerText` gives "31737 7th" and "42485 7th". The badge is `aria-hidden="true"` so screen
   readers announce correctly and the screen reads correctly; only copy-paste and text
   extraction see it.

### 5. Would Matt send the 2465 document to that expired owner today?

**No — and for the first time the reason is not arithmetic.** On 2465 alone the numbers now
hold: I recomputed the price from the weights and it lands on $435,000; I recomputed all five
date adjustments from the index and all five are exact; the words are clean; every one of the
25 links carries identity; the phone document is 19.5 screens.

What blocks it is that the corrected engine dissolved the document's argument. Blair Auld
opens a letter headed "It asked $460,000 and did not sell", reads that the ask was 3.8 percent
above the top of the range, scrolls past a chapter called "What overpricing costs", and four
screens later reads that homes like hers sold for up to $460,000 — the exact number she asked.
The honest conclusion available to her is "my price was about right and something else went
wrong," and the document never offers what that something else was. A price opinion that argues
a case its own numbers contradict is worse in front of a licensed broker's client than one that
is merely ugly.

Shortest ranked list to yes:

**1. Rewrite chapter 1 and 2b for a home that was priced near the range.** The blueprint's
chapter 1 assumed a large gap; the engine no longer produces one here. When the failed ask is
inside or within a few percent of the range, the chapter's claim has to change to what the data
supports — 187 days against a 26-day median at a price the market would have paid, which points
at exposure, condition, or terms, not at the number. Say that, from data, or cut the chapter for
this class of expired. The graphic is right either way; the sentence over it is not.

**2. Make Concorde's price derivable and make "set aside" mean one thing.** Print the
failed-ask clamp when it binds — the document currently states a method that yields $1,973,000
and prints $1,473,000 with nothing between them. Then either drop the set-aside sales from the
weights or stop calling them set aside; today they carry 38.4 percent of the answer while the
prose tells the reader they were removed.

**3. Surface `needsReview`.** Two of four documents carry an audit verdict, one of them the word
"indefensible", and both render as finished opinions. A row flagged for review should not be
able to produce a sendable document without a visible broker gate.

**4. Fix the Bend sentence, the strip labels, and the divergent basis.** The Bend documents say
a path fell 1.6 percent and then move most sales up; name the path, not the endpoint. Make each
strip's axis labels the same two numbers the chapter says the home is worth. Give 1617 NW 8th
the same index its city's other two documents use, or say why it cannot have it.

**5. Then the residue.** 19968's duplicated address, the 4-vs-6-vs-7 sale counts inside one
chapter, Concorde's colliding strip labels, chapter 5's month line sitting entirely above the
recommendation, the last two explaining sentences, and the 41px chart marks.

**Beats:** the two wins from round two hold and one is now stronger. Nothing published in
Central Oregon puts a failed seller's own price path on the same axis as the sales that set
their value — and I measured that axis this round and it is true to the dollar, which is more
than the portals' charts survive. Chapter 2b's linear offer-timing curve and realization strip
remain better evidence on what overpricing costs than any competitor page for this market. What
it loses on is no longer craft. It is that the document has one story and its numbers now have
another.

**Evaluator:** separate agent, did not build this. **Shots read:**
`out/cma-look/cma-2465-7th-redmond-97756/` (immersive-1280 and immersive-375 in full, letter and
interact sets), plus the price chapters of `cma-65365-concorde/`, `cma-19968/`,
`cma-1617-nw-8th/`. **Live:** dev server on this tree, 1280x900 and 375x812, the competition
filter re-driven and its output read with visibility checks, the chapter 1 SVG measured against
its viewBox, the price grid read against `render_args` and the price recomputed from
`reconciliation.weights` on all four rows, every date adjustment recomputed against
`pricing_market_index`.

**Evidence hygiene:** clean. Each slug directory holds one recommended price
(`05-435000.png`, `04-443000.png`, `05-1473000.png`, `04-811000.png`) and the look-pass exits 0
on `--check --interact` for all four. The run used here was written after the rows were built,
and the length figure quoted in §2 was measured in the live browser rather than taken from the
ledger.


## Round four audit — 2026-09-08 (24 lenses x 4 documents, adversarially refuted)

Method: six lenses (arithmetic, consistency, story, craft, words, phone) over all four rebuilt
exemplars, each finding put to independent refuters. 202 findings raised, 54 of them blocking.
The run exhausted the session before the judge stage, so there is no synthesised score; the
findings below are the ones that matter, verified against `render_args` and the MLS.

**NOT SENDABLE. The blocking classes, ranked by danger:**

**A. The net-proceeds figure is wrong on every row, and one is impossible.**
`pricing.sellerNet.predictedSellerNet` against the recommended list: Concorde $1,707,603 on a
$1,473,000 list (a net ABOVE the price), 1617 NW 8th $616,000 on $816,000 (a $200,000 gap with
`rate: 0`), 2465 $426,575 on $435,000, 19968 $436,008 on $461,000. The chapter is headed
"What you keep". A licensed broker telling a homeowner what they keep, wrongly, is the worst
defect in the document. Either itemise it (list, commission, concessions, closing costs, each
from data) or cut the chapter until it is right.

**B. The story is computed from an ask that did not run the clock.**
2465 held $475,000 for 152 of its 187 days and $460,000 for 35. The document quotes the 3.8
percent gap of the FINAL ask and concludes "points at something other than the number"; at the
price that ran 81 percent of the clock the gap is 7.2 percent, and $475,000 is never named in
prose. `failedAskForStory` deliberately takes the last cut. Same class elsewhere: 19968 runs
the overpricing story off a **November 2004** ask of $140,000, printed undated three times
beside a $461,000 recommendation; 1617 NW 8th runs the overpricing story at a seller asking
10 percent BELOW the bottom of the range; Concorde's 290 days covered a $1,799,000 opening cut
three times, none of it in the document.

**C. A row whose own audit says "not defensible" renders as a finished opinion.**
`pricing.review` and the admin banner cover the served admin route only. The letter and the PDF
a broker actually sends carry no trace. 19968 is `needsReview: true`, verdict `fail`, three
critical findings, and stamps confidence "High" in the same object.

**D. Compliance.** 1617 NW 8th is an ACTIVE listing with another brokerage and the closing
chapter solicits it. 2465 is Withdrawn, not expired, so the owner may still be under a listing
agreement. Neither document carries a carve-out.

**E. Numbers that contradict other numbers in the same document.** 2465: chapter 3 says there
were not enough recent Diamond Bar Ranch sales while three of five comps ARE Diamond Bar Ranch,
chapter 5 prints four DBR sales from the last ten weeks, and the MLS holds twelve in the window.
Concorde: three different list ceilings on two screens, the highest being the ask that failed.
19968: the market chapter says six sales support $370,000-$479,000 while the price chapter says
four and puts the other two outside it; $479,000, the top of the stated worth range, is the sale
the document says it set aside. 1617: $816,000 is the midpoint of the printed range, not the
weighted reconciliation the chapter says produced it, and three sales carrying 60.4 percent of
the printed weight move the number by $0.

**F. Craft.** The map is still a Google default and its polygon on 19968 contains neither the
subject nor any sale. The value strip plots sale-price dots inside a band labelled with list
prices, so the lowest sale renders outside the shading captioned "what your home is worth".

**Method note for the next round: cap the fan-out.** This run spawned 631 agents on an
uncapped findings-to-refuters expansion and exhausted the session. Cap findings per lens and
use two refuters, not three.

## Delta 3, 2026-09-08 (Matt): one map, three pin families, three matrices

"We can use one map for that, and we'll just have to make the map look cooler and put better
pins on it to show the comps and the expired or canceled as a different kind of subset. We want
to actually have the actives, the closed, and the expired or canceled as three different icon
sets: these are the ones that closed, this is where we're getting our number from; these are
the ones that are active in this market right now; these are the ones that expired or canceled.
We always have to be able to tell the tale of how long they've been on the market and how many
price changes they've had. That has to be clear on all of those: how long it took them to sell.
Look, once they dropped it down into this range, it sold, but these people never got down to
that range. One comprehensive map, and then we'll break out the matrices of comparables so that
we start with the closed comparables, the ones that set the price. We look at people that
expired in that same area, and we have ours right next to it. All of our subject properties in
that matrix, with all of the details: year built, notes on remodel, size, lot size, rooms,
bathrooms, bedrooms. We do the same thing for these homes that were listed in the same area but
were not able to sell. This is who your competition is right now in the same area at the
recommended price point: these people are here at this price, it doesn't mean they're going to
sell at this price."

**The map.** One map for the whole document, drawn on the comp area (`render_args.compArea`).
Three pin families, one glyph each, legend keyed to the three matrices: closed (filled navy,
numbered, "set the price"), active or pending (hollow navy, lettered, "for sale now"), expired,
withdrawn or canceled (navy with a strike or hollow with a bar, roman, "came off unsold"). The
subject is the star. Every pin's label and tap reveal the same two facts: days on market and
the count of price changes, plus the outcome (sold $X · offer in N days / asking $X · N days /
came off after N days). Not a Google default: monochrome basemap, our pins, no attribution tell
beyond what the license requires.

**The three matrices, in this order, one column set, the subject column first in each:**
1. Closed sales that set the price.
2. Expired, withdrawn or canceled in the same area (the peers from Delta 1, now from the
   comp area, widened until at least three).
3. Active and pending in the same area at the recommended price.

Columns: photo · address (tracked link) · outcome line · year built · remodel or update notes
(the MLS remark fragment, shown as written, only when the remarks say updated / remodeled /
new roof / new kitchen and the like; otherwise "none noted") · size · lot size · rooms · beds ·
baths · days on market · price changes (count and the path drawn) · first ask → last ask →
outcome. The price path row is the story Matt tells at the table: the range shaded on every
path so the reader sees who dropped into it and sold, and who never got down to it. Phone: one
card per row with the same fields, same order.

**Sentences.** Over matrix 2: "These asked and never came down to the range." Over matrix 3:
"These are asking in this range now. Asking is not selling." Both from data; counts and the
range from `render_args`.

### Delta 3 — what shipped, 2026-09-08 (R3h, the renderer half)

Built in `wt/cma-doc-20260907`. The data half (`render_args.compArea`,
`expiredPeers.{area, windowMonths, widenedTo, shortfall}`, `bandRivals.{area, sentence}`) is
R2h's; every renderer below reads those fields when the row carries them and degrades to what
the row already held when it does not, so the two lanes land independently.

**The one map.** `lib/cma/map.ts` fits one tile over the subject, the closed sales, the homes
for sale and the listings that came off, draws the comp area on it — `compArea.names` outlines
and `compArea.radiusMiles` ring when present, the subject's own subdivision and the search
story's radius otherwise, both still suppressed unless the shape holds a mark (class F) — and
returns a pin per home keyed by family. `lib/cma/map-families.ts` owns the three alphabets
(1.., A.., i..) and `lib/cma/matrix-sets.ts` decides membership and order ONCE, so a pin and a
row cannot mean different houses. `lib/cma/comp-pin-map.ts` draws the pins as DOM buttons —
filled numbered, hollow lettered, hollow-barred roman, a star for the subject — each revealing
days on market, price changes and the outcome line on tap and on hover, with a legend keyed to
the three matrices. The chapter is `the-map`, under the number; it is the only map in the
document.

**The three matrices.** `lib/cma/matrix-entry.ts` turns a closed sale, an unsold peer, a live
rival and the subject into ONE shape; `renderMatrixHtml` in `lib/cma/comp-matrix.ts` draws it
three times with the same twelve columns, subject column first. The adjustment grid stays
under matrix 1 as its own table, folded by the same rules. Every price path carries the worth
range shaded across it with a hairline at each edge.

**What §0 changed about the count of price changes.** Delta 3 asks for "how many price changes
they've had". The record answers that for exactly one listing — the seller's own dated cycle.
Every other row holds an opening ask and today's ask and nothing between, which says THAT the
price moved, not how often; a closed sale with no original ask on the row says neither. So the
cell prints an exact count only where the cuts are dated, "at least 1" where only the two ends
are known, "none" where the two ends are equal, and nothing at all where the record is silent.
The map's reveal says the same three things in the same three ways.

**The order.** `OPINION_CHAPTER_ORDER` is now what happened → the number → the map → matrix 1
→ matrix 2 → matrix 3 → what price and time look like here → the market → net → basis → next
step. `lib/cma/opinion-scenes.ts` walks the same list.

**Interactions.** One wiring runs over all three matrix chapters: the adjustments toggle where
there is working to put away, an order select built from the sort keys that matrix carries
(and suppressed on a matrix holding one home), and — on matrix 3 alone — a for sale / under
contract filter that hides columns by `data-status`. The sort realigns the adjustment grid to
the same result.

**Look-pass:** `--check --interact` exits 0 on all four exemplars, with a new `map-pin-reveal`
step that taps a pin and reads back what it revealed and what it lit.
