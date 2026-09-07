# CMA funnel mission (2026-09-07)

Matt, 2026-09-07: "our cmas still look dumb and need to better convey the information …
i want expired and fsbos automated ASAP … getting these things looking good and approved
and then sent out and tracked so that we can get leads is the goal, every aspect of this
must be optimized … expireds/fsbo/seller valuation/and BPOs all using the same engine but
with their own nuances, easily managed and tracked."

This file is the goal the final review pass is measured against. It supersedes nothing;
`CMA_STATE_OF_THE_WORLD.md` (2026-08-27) is the engine reconciliation and still wins on
engine defects. Code wins over both.

## Where it stood at start (verified live 2026-09-07 11:30)

- `cmas`: 442 rows. Unified queue (`listCmaQueue`): 429 rows — ready 162 (133 with an
  email), build-failed 136, flagged 116, audit-failed 10, sent 4.
- Lanes as recorded: expired 378, unknown 28, seller-valuation 13, lead-form 8, fsbo 2.
  `fsbo_listings.cma_id` links 32 CMAs, so 30 FSBO documents sit in the queue mislabeled.
  212 rows carry a NULL `request_source`.
- `expired_listings`: 420 detected, 377 with a phone or email, 341 with a CMA,
  **0 first-touch sent**. `fsbo_listings`: 61, 32 reachable, 32 with a CMA, **0 sent**.
- Pipeline (traced in code): detection → skip-trace → CRM lead → CMA request → build →
  audit is automatic. Exactly one manual step remains: open `/admin/cmas/[slug]`, Approve,
  then Send now or Schedule. The weekday 8am / 5-minute drip drains the queue after
  Schedule. No auto-send switch exists anywhere.
- Audit verdicts: pass 271, did-not-run 138, fail 10, review 10. Local test run logged
  `[cma/audit] adversarial audit failed: 400 … usage limits` from the xAI path.
- Document: two render paths. Letter (print/PDF) re-renders from `render_args`; the browser
  `?print=1` link serves the frozen build-time blob (stale after any renderer fix). The
  immersive `/view` re-renders live. "How recent sellers sold" and the disclosure page exist
  only in print.
- Tracking plumbing exists (`email_events` keyed `cma:<slug>`, `visitor_events`
  `client-document`, `attributeOutbound` on the send path, `getCmaPerformance`), but the
  queue shows none of it and no reply routes back to the row.

## Done means

A real broker can, on a phone or desktop:

1. Open `/admin/cmas`, see every document from all four lanes (expired, FSBO, seller
   valuation, BPO) with lane, state, their price vs ours, and outcome (sent, delivered,
   opened, clicked, visited, replied) on the row.
2. Open a ready document, read it in under a minute because it answers the seller's
   questions in order (what happened / what it is worth and why / what it competes with /
   what to do), and approve it with one tap that advances to the next ready row.
3. Flip a per-lane **Auto-send** switch (default OFF) so that a ready, audit-passed document
   in that lane goes out without the tap: cold lanes through the weekday drip, asked lanes
   immediately. Audit-failed, unvetted, flagged and build-failed rows never auto-send.
4. See, per lane, the funnel: built → ready → sent → opened → clicked → replied, and get
   the existing broker SMS alert when a recipient replies or opens the document.
5. Trust the numbers: the document the client receives is the same one the broker
   reviewed (`?print=1` and the PDF render from the same source).

Every send still runs the existing gates: suppression, relist/off-market re-verify,
merge-token fail-closed, brand voice, adversarial audit. §1 holds: the auto-send switch is
Matt's control and ships OFF; nothing in this mission flips it.

## Workstreams (exclusive file sets)

| Stream | Owns | Deliverable |
|---|---|---|
| A. Document | `lib/cma/**` renderers, `scripts/cma-lookpass.ts` | A look-pass tool that screenshots every chapter (letter 816, immersive 1280, both at 375) for any slug from `render_args` read-only; then the punch list fixed and re-passed. |
| B. Lanes + auto-send | `lib/cma/origin.ts`, `lib/data/cma/unified-queue.ts`, `lib/cma/worker.ts`, `app/actions/cma-queue.ts`, `app/admin/(protected)/cmas/**`, one migration | `request_source` backfill from the FSBO/expired link tables; BPO in the vocabulary and the queue; `cma_lane_settings` with Auto-send per lane (OFF); worker auto-enqueue when ON; lane filter + counts; Approve-and-next. |
| C. Tracking → leads | `lib/data/cma/getCmaPerformance.ts`, `lib/data/prospecting/engagement.ts`, new `lib/data/cma/outcomes.ts`, new admin component, reply hook | Outcome per row, per-lane funnel, reply/open alert to the broker, verified with a real send to a test inbox. |
| D. Engine health | `lib/cma/audit.ts`, `lib/grok/**`, `lib/pricing/**`, `lib/cma/comps.ts`, `lib/cma/build.ts` | Why 138 audits did not run, fixed; the 136 build failures classed into correct §0 refusals vs selector bugs, bugs fixed, refusals surfaced with a reason the broker can act on. |

## Ledger

Appended by each stream as it lands: commit, what changed, how it was verified.

- **A · 96ea9616** (`wt/cma-doc-20260907`) — `scripts/cma-lookpass.ts`: read-only
  visual look-pass tool. Given `cmas.slug` values, renders the current letter
  (`resolveCmaPrintHtml` → `renderCmaHtml`) and immersive (`immersiveFromRow`
  → `renderImmersiveCmaHtml`) output from `render_args` — same functions the
  live PDF/`?print=1`/`/view` routes call — and screenshots every top-level
  chapter section at 816/375 (letter) and 1280/375 (immersive), plus a
  `contact-sheet.html` per slug. `lib/cma/lookpass-chapters.ts` (pure
  HTML→chapter mapper, unit-tested) backs the stdout summary.
  `immersiveFromRow` exported from `lib/cma/serve-document.ts` (no behavior
  change) so the tool reuses it instead of forking the render_args glue.
  `scripts/lib/server-only-shim.cjs` factors out the tsx module-resolution
  patch already duplicated in three other CMA CLI scripts.
  Ran on `cma-2465-7th-redmond-97756` (expired), `cma-19968` (FSBO),
  `cma-1617-nw-8th` (seller-lp) — all three produced full contact sheets;
  findings below. `npx tsc --noEmit` clean; `lib/cma/` vitest green except
  one pre-existing unrelated real-DB test.

  **What the renders showed (not fixed — Stream A step 1 is the tool):**
  - Immersive "How we got the price" comps table breaks on mobile (375px):
    the leftmost label column collapses to one character per line, running
    the whole comp-grid vertically unreadable, on all three slugs. The
    LETTER path handles the identical data as responsive cards at 375px with
    no breakage — this is isolated to the immersive table markup/CSS.
  - Immersive hero scene (`cma-2465-7th-redmond-97756`): the annotated aerial
    photo's landmark distance callouts ("Duffy's .5 miles", "Walmart 1.2
    miles") run past both the left and right frame edges at 1280px AND
    375px, and a "*Location is approximate…" disclaimer caption is clipped
    at the right edge at both widths.
  - Letter comp card #5 (735 Oak, `cma-2465-7th-redmond-97756`) renders a
    blank white photo box while comps 1–4 have photos — may be a legitimate
    no-photo state or a broken image; not confirmed either way.

- **A · 411eba70** (`wt/cma-doc-20260907`) — the punch list, P1–P10 + F1–F5.
  TDD: `lib/cma/doc-punchlist.test.ts` states each item against the RENDERED
  HTML (chapter order, the exact caption sentence, no duplicate labels in the
  band SVG, the CSS breakpoints), written failing, then fixed.

  **P1** — new `priceRulerSvg` in `lib/cma/market-charts.ts`: one price axis,
  closed sales as filled navy dots, unsold hollow, coincident dots dodged away
  from the axis, domain cropped to the plotted data, and exactly two labelled
  ticks (`Recommended $389K`, `Your last ask $460K`). An axis end label that
  would repeat a tick is dropped. `bandOutcomeReading` states the fact under it.
  The old `renderPrintOutcomeStripSvg` lollipop is no longer called from the CMA.
  **P2** — `your-last-listing` is now chapter 2 on both documents, carrying the
  ruler and the failed-then-sold backtest; `sold-and-unsold` keeps the unsold
  peers matrix only when the subject is expired.
  **P3** — `soldBandFitsRecommend` gates the 90-day band on both paths: it
  renders only when the recommend sits inside [low, high] and the band median is
  within 20%. `CmaSoldBand` carries no square footage, so there is no honest
  reconciling sentence to write from render_args — the block comes out instead.
  **P4** — `daysToOfferSvg` + `renderDaysToOfferHtml`: every kept sale at its
  days to offer against the subject's own days with no offer. The twelve-month
  new-listing ledger (`listingTrendSvg`, `renderListingTrendHtml`,
  `trendChartsPage`, both stylesheets' `.month-ledger` rules) is deleted.
  **P5** — the subject's listing history states once (dropped from the
  competition subject row); "What we searched" is one sentence, not a heading
  plus three bullets two of which restated the table under them.
  **P6** — `lotsDifferMaterially` / `uniformLotLine`: the drawn-lot chapter
  renders only when the spread is over 25% or a lot reaches half an acre.
  Otherwise Home location carries one sentence.
  **P7** — "I am here" is gone; We throughout.
  **P8** — a reading above the matrix (`The 5 closed sales below set this
  number. Brought to your size and date, they land at $372,324 to $398,788.
  Recommended list $389,000.`) and one legend line for the adjustment rows.
  **P9** — `?print=1` renders from `render_args` through `resolveCmaPrintHtml`,
  the same function the PDF calls, instead of the frozen build blob.
  **P10** — `OPINION_CHAPTER_ORDER` in `lib/cma/opinion-pages.ts` is the ONE
  order; `assembleOpinionPages` and `assembleOpinionScenes` both walk it under
  the same gates. Disclosure, Home location, Seller net and Permits gained
  immersive scenes; `render.ts` appends nothing after the cover. The FSBO
  services page ("MLS and portal distribution", "Showing and offer management")
  was dropped from the seller document — the Sunstone contract refuses "how we
  would market" there, and it had been printing on every CMA including expireds.
  **F1** — the immersive matrix falls back to the stacked cards below 700px.
  **F2** — the letter shows the matrix on screen at reading width, cards below
  700px; comp thumbnails load eagerly (the blank photo boxes were the look-pass
  never scrolling past a lazy image, not a broken src).
  **F3** — the hero photo is `object-fit: contain` over a blurred copy of
  itself, so an agent-annotated aerial keeps every landmark label and its
  disclaimer. On a phone it is a full-width band with the title block under it.
  **F4** — no `data-count` anywhere; the count-up IIFE is deleted from
  `immersive.ts`. `scripts/cma-lookpass.ts` emulates
  `prefers-reduced-motion: reduce`, forces every image eager, and waits on
  `document.fonts.ready`.
  **F5** — fixed by P3.

  Also: charts inside a navy scene invert (`.sc-navy svg`) — the median-close
  line had been drawing navy ink on navy and printing its caption over a blank
  field. The market's median sold is labelled with its grain
  ("median sold, every Redmond home"). The predicted close no longer prints on
  the seller page (Sunstone: expected sale / predicted close stay off it).

  **Numbers skipped rather than derived in the renderer (§0):**
  - P8 asked for the *median* of the adjusted closes. `render_args` carries no
    such figure — `pricing` exposes `method1Low/Mid/High` ($/sqft percentiles ×
    sqft) and `method3` (a weighted reconciliation), neither of which is the
    median of the printed Adjusted close row. The lead states the RANGE
    instead: both ends already print in the matrix, so no new number ships.
  - ~~P4 asked for the Redmond 21-day median as a tick. `market.medianDom` is a
    list-to-close figure (CLAUDE.md §7); days to offer is a different measure
    and two measures do not share an axis. It stays off the chart.~~
    **Wrong, corrected in step 4 (below).** `market.medianDom` is
    `market_stats_cache.median_dom`, which medians `listings.days_to_pending`,
    and a comp's `daysToOffer` reads that same column
    (`lib/cma/comps.ts:131`). They are ONE measure, so the tick was always
    commensurate with the bars. The tick is on the chart. The expired audit
    still states the figure in prose beside the subject's own DOM as well.

  **Handed to other streams (not this stream's files):**
  - The subject's days on market disagrees between paths on
    `cma-2465-7th-redmond-97756`: the comp matrix prints 192 (derived from
    `lastListDate`) and the expired audit prints 186 (derived from the listing
    cycle). One document, two numbers for one fact — Stream D.
  - Seller net prints "4 of 8 sales that set this price reported a concession"
    on a document whose comp set is 5 sales. `pricing.sellerNet.knownCount`
    counts a different set than the kept comps — Stream D.

  Verified: `npx vitest run lib/cma` 860 passing; `npx tsc --noEmit` clean;
  `ci:brand-voice`, `ci:voice-constructions`, `ci:cma-opinion-spine`,
  `ci:cma-exemplar`, `ci:market-chart-honesty`, `ci:design-tokens`,
  `ci:pdf-page-safety` all green. Look-pass re-run and every chapter shot read
  by eye at 816/375 (letter) and 1280/375 (immersive) on
  `cma-2465-7th-redmond-97756` (expired), `cma-65365-concorde` (6.38-acre land
  subject, P6 the other way), `cma-19968` (FSBO), `cma-1617-nw-8th` (seller LP).

- **A · d57854e1, 74a29de4** (`wt/cma-doc-20260907`) — what the shots caught
  that the tests did not. Four subjects, every chapter read by eye at 816/375
  and 1280/375.

  - **A price shipped with no sales.** The comps matrix floored at `MIN_COMPS`
    (5, the selector's target) while `lib/pricing` publishes a recommend from
    `PRICING_MIN_COMPS` (3). `cma-19968` and `cma-1617-nw-8th` each printed a
    recommended list whose price chapter held a map and nothing else. The
    matrix floor is now the pricing floor.
  - **A chapter headed "N/A."** `cma-65365-concorde` has no MLS subdivision and
    the subdivision story rendered anyway, on both documents. `cleanText` gates
    it now.
  - **"Days on market 7,969", and a chart captioned "Yours sat 7,969 days and
    never got one."** `cma-19968` last listed in 2004 and CLOSED; the elapsed
    days since that list date are the age of a sale, not time on market.
    `subjectDomDays` takes a stated DOM from the listing history first, and
    derives elapsed days only for a listing that is on market or came off
    unsold, under a three-year ceiling. The subject's bar on the days chart
    renders only when the listing actually failed.
  - **A chart invisible on its own scene.** `medianCloseLineSvg` drew navy ink
    on a navy scene and printed its caption over a blank field. Every chart
    inside `.sc-navy` inverts now, and the line's y-value labels moved into a
    left gutter (they shared ink with September's mark).
  - Chart labels: "192 days, no offer" ran off the frame; the days axis end
    ticks repeated a bar label; the ruler printed an end label that repeated a
    tick. All three fixed.
  - The mobile hero was a 250px photo strip over 900px of blur. Below 700px it
    is a full-width photo band with the title block under it.
  - A wide chart scaled its own type to six pixels at 375. It pans in its own
    box on screen at both documents. Never in print — a scroll box on paper is
    the clipper that once removed comps from a delivered PDF.

  Final contact sheets (regenerate with
  `npx tsx scripts/cma-lookpass.ts <slug>`):
  - `out/cma-look/cma-2465-7th-redmond-97756/contact-sheet.html` (expired)
  - `out/cma-look/cma-65365-concorde/contact-sheet.html` (6.48-acre land)
  - `out/cma-look/cma-19968/contact-sheet.html` (FSBO)
  - `out/cma-look/cma-1617-nw-8th/contact-sheet.html` (seller LP)

- **A · a8914ed5** (`wt/cma-doc-20260907`) — F6 and F7 off the orchestrator's read
  of the regenerated shots.

  - **F6. The ruler was cropped on a phone.** The 720-unit ruler was held at
    `min-width` inside a pan box below 700px, the fix a previous round applied
    to every wide chart. It is right for a twelve-row days strip and wrong for
    this one: the ruler's whole reading is where two ticks sit inside a band,
    so a cropped end deletes half of it. At 375 the seller saw the "$360K"
    unsold dot and the recommend tick — nine closed sales and their own failed
    ask were off the right edge of a box nobody scrolls. `priceRulerPhoneSvg`
    draws the same domain (`rulerDomain` is shared, so the two layouts cannot
    disagree about where a dot sits) into a 360-unit frame that scales with no
    crop: lane names in a left gutter, the recommend labelled above the plot
    and the last ask below, each label clamped to the frame by its own
    estimated width. Both documents emit both layouts and exactly one is ever
    visible — `.ruler-wide` on paper and above 700px, `.ruler-phone` below.
    The failing test measures the rendered SVG: every one of the eleven dots
    and every text box inside the viewBox, both tick labels present.
  - **F7. "This market" printed its KPIs as a stacked list.** The letter
    carried no rule for the immersive's `.stat3` grid, so four figures printed
    number-then-label down the page under a 42px months-of-supply hero. It is
    now the stat row the document already uses for the failed-then-sold
    statistics, `stat-strip is-4`, months of supply first with its verdict word
    under it, then the other three; two columns below 700px. The median-close
    line stays under it. Nothing recomputed, no figure changed.
  - **Two of those labels were not what the numbers are** (CLAUDE.md §0, §7).
    `medianDom` is `market_stats_cache.median_dom`, which medians
    `listings.days_to_pending` — on-market date to pending. It was labelled
    "median days on market". It now reads **median days to an accepted offer**,
    which is what the column measures. `saleToListRatio` carries
    `median_sale_to_original_list` from the pace read, not sale to the final
    ask; "sold to list" reads to a seller who cut twice as the last ask, a
    different and better-looking number. It now reads **sold price to original
    ask**.
  - **The 90-day band had no register on the letter either.** `.st-n` / `.st-l`
    existed only in the immersive stylesheet, so "8" and "closed in 90 days"
    printed at body size on one line each. Same missing-register defect, two
    rules.

  **For the orchestrator, not acted on:** the stated reason the Redmond median
  stays off the days-to-offer chart — "it is a list-to-close figure, and two
  measures do not share an axis" — does not hold. `market_stats_cache.median_dom`
  and the comps' `daysToOffer` (`lib/cma/comps.ts:131`) read the same column,
  `listings.days_to_pending`. They ARE the same measure, so the 21-day tick is
  commensurate with the bars. Whether to put it back is a document decision,
  not a data one. Separately, `cma-65365-concorde` prints "Closed 4 to 6
  bedroom sales in N/A in the last 90 days" — an MLS placeholder in a
  client-facing source line, the same class the subdivision chapter fixed.

  Verified: `npx vitest run lib/cma` 1,763 passing; `npx tsc --noEmit` clean;
  `ci:brand-voice`, `ci:voice-constructions`, `ci:cma-opinion-spine`,
  `ci:cma-exemplar`, `ci:market-chart-honesty`, `ci:design-tokens`,
  `ci:pdf-page-safety` green. Look-pass re-run and the affected shots read by
  eye on `cma-2465-7th-redmond-97756`, `cma-19968`, `cma-65365-concorde`:
  - F6 `out/cma-look/cma-2465-7th-redmond-97756/immersive-375/03-your-last-listing.png`
    and `letter-375/03-your-last-listing.png` — every sold dot, the unsold dot,
    and both ticks inside the frame; `letter-816` and `immersive-1280`
    unchanged.
  - F7 `out/cma-look/cma-2465-7th-redmond-97756/letter-816/06-this-market.png`
    and `letter-375/06-this-market.png`;
    `out/cma-look/cma-19968/letter-816/05-this-market.png` and
    `immersive-375/05-this-market.png`;
    `out/cma-look/cma-65365-concorde/letter-816/06-this-market.png` and
    `letter-375/06-this-market.png`.

- **A · step 4** (`wt/cma-doc-20260907`) — the two items the orchestrator handed
  back off the F6/F7 shots.

  - **The market median is a tick on the days chart again.** It was left off on
    a reason that does not survive reading the columns: `market.medianDom` is
    `market_stats_cache.median_dom`, the median of `listings.days_to_pending`,
    and a comp's `daysToOffer` reads the same column
    (`lib/cma/comps.ts:131`). One measure, one axis. `daysToOfferSvg` takes an
    optional `DaysMedianTick` and draws a 1px vertical hairline across the bar
    rows, labelled above the plot ("Redmond median 21 days", "Bend median 25
    days") with the city and the value taken from `render_args`
    (`market.geoLabel` falling back to the subject city, `market.medianDom`) —
    never a literal. The tick shares the bars' domain, so a median slower than
    every kept sale still lands inside the frame, and the label flips to the
    left of the tick rather than off the right edge. The caption reads it in
    the middle: "Each kept sale had an offer inside 51 days. Redmond's median
    is 21. Yours sat 192 days and never got one." No median on `render_args`,
    no tick and no sentence — the chart renders exactly as before. Tested
    against the rendered SVG on both documents, present and absent.
  - **An MLS placeholder in a client-facing source line.**
    `cma-65365-concorde` printed "Closed 4 to 6 bedroom sales in N/A in the
    last 90 days" to a seller. `cleanText` guards a heading and
    `realSubdivision` guards the comp ladder, but a source line is prose
    ASSEMBLED around the same value, so no per-field guard ever saw it. The
    rule now lives at the one chokepoint every source line already goes
    through, `clientSourceLine`: an unresolved place inside the line takes the
    city that actually scoped the read (`getCmaMarketAreaRows(city, …)`), and
    with no city to fall back to the whole line is dropped for the caller's
    own sentence. `clientAreaLabel` does the same for the label that heads the
    status chapter and reads inside the band fallback. The filter itself always
    stays on the page — a §0 source trace is the point of the line; only the
    place it wrongly claimed changes. Compute side, so no new row bakes it in:
    `computeMarketArea` and `computeSold90SameBedsBaths` now read the
    subdivision through `realSubdivision`, which is what kept the same string
    out of the comp ladder. Concorde's line now reads "Closed 4 to 6 bedroom
    sales in Bend in the last 90 days."

  Verified: `npx vitest run lib/cma` 1,783 passing; `npx tsc --noEmit` clean;
  `ci:brand-voice`, `ci:market-chart-honesty`, `ci:design-tokens` green.
  Look-pass re-run on `cma-2465-7th-redmond-97756` and `cma-65365-concorde`;
  all four rendered documents grep **zero** `N/A` in seller-facing text
  (`out/cma-look/*/letter.html`, `out/cma-look/*/immersive.html`). Shots read
  by eye:
  - `out/cma-look/cma-2465-7th-redmond-97756/letter-816/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-2465-7th-redmond-97756/letter-375/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-2465-7th-redmond-97756/immersive-375/05-how-fast.png`
  - `out/cma-look/cma-65365-concorde/letter-816/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-65365-concorde/letter-816/06-this-market.png`

  **For the orchestrator, not acted on:** on the days chart at 375 the
  subject's own value label ("192 days, no offer") sits outside the pan box's
  visible width on both documents. That is the panning behaviour F6
  deliberately kept for this twelve-row strip, and the caption under it states
  the same number in words, so nothing is lost — but it is the punchline of
  the chart and a seller on a phone does not scroll a chart box. Whether the
  strip gets a drawn-to-fit phone layout the way the price ruler did is a
  document decision.

- **A · step 5** (`wt/cma-doc-20260907`) — **F8. The days chart fits the phone.**
  The strip was the last wide chart still held at `min-width` in a pan box below
  700px, and the label it cropped was the one the chart exists to deliver: the
  subject's own bar ("192 days, no offer") and the market median's label both
  sat outside the visible width on letter-375 and immersive-375. A caption
  restating the number is not the chart. `daysToOfferPhoneSvg` draws the same
  rows and the same median into a 360-unit frame that scales with no crop: the
  address moves out of the left gutter to sit ABOVE its bar, which frees the
  whole frame for the bar and puts the value right-aligned at the frame edge
  where the eye already is; the subject's row is bold with a heavier navy bar.
  Two things the wide layout does could not come across — a continuous median
  hairline strikes through six addresses once the labels leave the gutter, so
  the median is a comb of one segment inside each bar's own band, and a zero
  axis would run under the first character of every address, so it is gone (six
  bars flush on one edge already state where zero is). The median label flips
  to the left of the comb rather than off the frame, and each address truncates
  by its own measured width against the value beside it, not a fixed count.
  Both documents emit both layouts and exactly one is ever visible —
  `.days-wide` on paper and above 700px, `.days-phone` below, the same
  mechanism and the same three rules as `.ruler-wide`/`.ruler-phone` (F6).
  Nothing recomputed: the phone layout takes the same `DaysRow[]` and
  `DaysMedianTick` the wide one does.

  TDD: the failing test measures the rendered phone SVG on both documents —
  every kept sale's address present, the subject's `days, no offer` label
  present, `Redmond median 21 days` present, six bars, and every line and every
  text box inside the viewBox — plus the two stylesheets' breakpoints and the
  wide strip still at 720 units for print.

  Verified: `npx vitest run lib/cma` 1,791 passing; `npx tsc --noEmit` clean;
  `ci:market-chart-honesty`, `ci:design-tokens`, `ci:pdf-page-safety` green.
  Look-pass re-run on `cma-2465-7th-redmond-97756` and `cma-65365-concorde`,
  shots read by eye at all four widths:
  - `out/cma-look/cma-2465-7th-redmond-97756/letter-375/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-2465-7th-redmond-97756/immersive-375/05-how-fast.png`
  - `out/cma-look/cma-2465-7th-redmond-97756/letter-816/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-65365-concorde/letter-375/05-how-fast-homes-like-yours-went.png`
  - `out/cma-look/cma-65365-concorde/immersive-375/05-how-fast.png`
  - `out/cma-look/cma-65365-concorde/immersive-1280/05-how-fast.png`
