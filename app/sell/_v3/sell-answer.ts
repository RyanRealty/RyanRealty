/**
 * The /sell answer — its DATA SHAPE and the pure shaping the body renders.
 *
 * SITE-02 (Matt 2026-09-07): a visitor who types their address on /sell used to
 * advance straight to "where should we send it?" having been shown NOTHING. The
 * address step now answers first: the place's verdict, how fast homes here go
 * under contract, and how many comparable closes the CMA engine already found
 * for that address. No dollar figure — Matt's standing ruling for a typed
 * address on a public page. The figure lives in the written CMA the email step
 * delivers.
 *
 * WHY THIS FILE IS SEPARATE FROM THE COMPONENT. The node splits in two: this
 * lane wires the answer, and a following session (02b) replaces the BODY with a
 * drawing primitive. So the contract between them is a data type, not markup —
 * `SellAnswerData` is the DAL's answer plus its §0 trace and nothing else, and
 * `SellAnswer.tsx` is the only file that renders it. Swapping the drawing means
 * rewriting one component against an unchanged type.
 *
 * G68 (ci:market-formula): no surface rounds or reclassifies months of supply.
 * `monthsOfSupply` arrives here ALREADY FORMATTED by formatMonthsOfSupply and
 * `verdictLabel` already classified by marketVerdict, both on the server, from
 * the same raw value. Nothing in this file does arithmetic on that figure.
 */

/**
 * One comparable close, as the answer is allowed to show it.
 *
 * NO PRICE. Matt's ruling stands: a typed address on a public page gets no
 * dollar figure, and a comp's close price is a dollar figure. What the visitor
 * gets is the thing a bare count could not give them — WHICH homes the ladder
 * matched to theirs, how alike they are, and when they sold — so the count is
 * checkable instead of asserted. The prices are in the written valuation.
 */
export type SellComp = {
  id: string
  /** Street line only. "2515 NW Crossing Dr". */
  street: string
  /** "NorthWest Crossing" or the city when the plat is not published. */
  where: string
  /** "4 bed · 3 bath · 2,410 sq ft · built 2006" — whichever of those exist. */
  facts: string
  /** "Closed July 2026". */
  when: string
  /** "0.4 miles NW" when the ladder reported it. */
  proximity: string | null
}

/** One reading in the answer: a plain sentence with its figure inside it. */
export type SellAnswerReading = {
  /** Stable key for React and for the tests. */
  key: 'pace' | 'cash' | 'comps'
  /** The short label a person scans. Never jargon. */
  label: string
  /** The figure, formatted upstream. */
  value: string
  /** The sentence a broker would say on the phone. */
  sentence: string
  /** The §0 detail a hover / tap reveals: window, population, definition. */
  detail: string
}

/**
 * Everything the answer body draws. Produced by the server action from
 * `getPlaceValueAnswer` + `countCompsForAddress`, so every field is either a
 * value one of those returned or a string formatted from one.
 */
export type SellAnswerData = {
  /** The address as the visitor typed (or picked from Places). */
  address: string
  /** Just the street line — "2732 NW Ordway Ave". */
  street: string
  /** The place the figures are about, as a person says it: "Bend". */
  placeLabel: string
  /** Which grain answered: the Bend neighborhood when the address fell in one. */
  grain: 'city' | 'neighborhood'
  /** Door to the full market report for this place, when one exists. */
  placeHref: string | null
  /** From marketVerdict(): "seller's market". Null when MOS cannot publish here. */
  verdictLabel: string | null
  /** From formatMonthsOfSupply(): "3.9". Never computed on this side. */
  monthsOfSupply: string | null
  /** Homes for sale right now, detached, in this place. */
  activeCount: number | null
  /** Homes that go off the market in a typical month — the MOS denominator. */
  salesPerMonth: number | null
  /** Median days from listed to under contract, trailing 90 days. */
  daysToPending: number | null
  /** Share of closes paid in cash over the trailing year, already ×100. */
  cashSharePct: number | null
  /** Comparable closes the CMA comp ladder kept for this address. */
  compCount: number | null
  /** False when neither MLS history nor the assessor could place the address. */
  subjectFound: boolean
  /** "4 bed, 3 bath, 2,410 sq ft, built 2006" when the subject carries facts. */
  subjectSummary: string | null
  /** The comparable closes themselves, so the count is checkable. Never priced. */
  comps: SellComp[]
  /** The day the market figures were computed, formatted. */
  asOfLabel: string | null
  /** One line per figure: what it is, where it came from, when (§0). */
  trace: string[]
}

/**
 * The claim the section makes, in one sentence, before any figure — the
 * claim-first habit TASTE.md demands of every data section.
 *
 * The verdict is the claim when we have one. When we do not, the claim is what
 * we DO know about this address, and it is still a sentence and still true:
 * saying "no verdict" is not a claim, it is an apology.
 */
export function sellAnswerClaim(d: SellAnswerData): string {
  if (d.verdictLabel && d.monthsOfSupply) {
    return `${d.placeLabel} is a ${d.verdictLabel} right now.`
  }
  if (d.compCount != null && d.compCount > 0) {
    return `We found ${d.compCount} recent ${d.placeLabel} ${d.compCount === 1 ? 'sale' : 'sales'} to price ${d.street} against.`
  }
  return `Here is what the record already says about ${d.street}.`
}

/**
 * The sentence under the claim: what the verdict MEANS, in the words a person
 * uses. "3.9 months of supply" is the jargon; "the homes for sale would take
 * about four months to sell at the current pace" is the reading.
 */
export function sellSupplySentence(d: SellAnswerData): string | null {
  if (!d.monthsOfSupply || d.activeCount == null || d.salesPerMonth == null) return null
  const sold = Math.round(d.salesPerMonth)
  return `${d.activeCount.toLocaleString('en-US')} detached homes are for sale in ${d.placeLabel}, and about ${sold.toLocaleString('en-US')} of them go under contract in a typical month. That is ${d.monthsOfSupply} months of homes on the market.`
}

/**
 * The two bars: homes for sale against a month of sales. This IS months of
 * supply — DATA_GRAPHICS.md's standing objection to a tile that says "3.9" is
 * that a tile makes the reader do the division. The bars do it for them.
 *
 * Widths are a share of the LARGER bar, so the shorter one is read against the
 * taller one rather than against an invented ceiling. Null when either side is
 * missing: a one-bar version of this drawing says nothing.
 */
export function sellSupplyBars(
  d: SellAnswerData,
): { forSale: { count: number; pct: number }; sold: { count: number; pct: number } } | null {
  if (d.activeCount == null || d.salesPerMonth == null) return null
  const sold = Math.round(d.salesPerMonth)
  const max = Math.max(d.activeCount, sold)
  if (!Number.isFinite(max) || max <= 0) return null
  return {
    forSale: { count: d.activeCount, pct: (d.activeCount / max) * 100 },
    sold: { count: sold, pct: (sold / max) * 100 },
  }
}

/**
 * What a hover or a tap on one of the two bars reveals: the figure's own
 * window, population and definition.
 *
 * TASTE.md: every data section has to reward a hover, tap or toggle with MORE
 * DATA, and the dataviz rule is blunter still — "a chart the reader cannot
 * interrogate is a picture of a chart". The bars are the section's drawing, so
 * they answer when asked. Keyboard reaches the same reading, which is why the
 * bars are buttons and not divs with a title attribute.
 */
export function sellBarReading(d: SellAnswerData, bar: 'forSale' | 'sold'): string | null {
  if (bar === 'forSale') {
    if (d.activeCount == null) return null
    return `${d.activeCount.toLocaleString('en-US')} detached homes are listed and unsold in ${d.placeLabel} right now${d.asOfLabel ? `, counted ${d.asOfLabel}` : ''}. Attached homes, land and new-construction spec inventory are counted separately and are not in this figure.`
  }
  if (d.salesPerMonth == null) return null
  return `About ${Math.round(d.salesPerMonth).toLocaleString('en-US')} homes a month, which is the six-month close pace the months-of-supply formula divides by: homes for sale ÷ months of supply recovers it exactly. Not a forecast — it is what the last six months did.`
}

/**
 * The readings beside the drawing. Each is a sentence with its figure inside,
 * and each carries the detail a hover reveals — never a bare number with a
 * jargon label, which is the "KPI grid" TASTE.md bans by name.
 *
 * Order is deliberate: pace, then who is buying, then the comps we already hold
 * for THIS address. The last one is the reason to keep going.
 */
export function sellAnswerReadings(d: SellAnswerData): SellAnswerReading[] {
  const out: SellAnswerReading[] = []

  if (d.daysToPending != null) {
    const days = Math.round(d.daysToPending)
    out.push({
      key: 'pace',
      label: 'How fast they sell',
      value: `${days} days`,
      sentence: `Half the homes that sold in ${d.placeLabel} were under contract inside ${days} days of being listed.`,
      detail:
        'Median days from the listing date to a signed contract, detached homes, trailing 90 days. Not days on market, which keeps counting until closing.',
    })
  }

  if (d.cashSharePct != null) {
    const cash = Math.round(d.cashSharePct)
    out.push({
      key: 'cash',
      label: 'Who is buying',
      value: `${cash}%`,
      sentence: `${cash}% of ${d.placeLabel} buyers paid cash over the last year.`,
      detail: 'Share of closed detached sales recorded as a cash purchase, trailing 12 months.',
    })
  }

  if (d.subjectFound && d.compCount != null && d.compCount > 0) {
    out.push({
      key: 'comps',
      label: 'Comparable sales we already found',
      value: String(d.compCount),
      sentence: `Close enough to ${d.street} to price it${d.subjectSummary ? `, which the record reads as ${d.subjectSummary}` : ''}.`,
      detail:
        'The same comparable-sales ladder the written valuation runs: MLS history for the address first, county assessor facts second, then closed sales matched on size, age, and distance.',
    })
  } else {
    out.push({
      key: 'comps',
      label: 'Comparable sales',
      // Not an em dash: a lone rule beside a sentence reads as a rendering
      // fault, and "not yet" is what is actually true — a broker matches it by
      // hand for the written valuation.
      value: 'Not yet',
      sentence: `We could not match ${d.street} to a sales record on the first pass. A broker does that part by hand for the written valuation.`,
      detail:
        'The automatic pass looks for the address in MLS history and in county assessor records. New construction, a recent split, and an address the county spells differently all miss it.',
    })
  }

  return out
}

/**
 * True when the answer has enough to be worth showing as an ANSWER rather than
 * as a holding line. One reading is enough; zero is not.
 */
export function sellAnswerHasSubstance(d: SellAnswerData): boolean {
  return (
    (d.verdictLabel != null && d.monthsOfSupply != null) ||
    d.daysToPending != null ||
    (d.subjectFound && (d.compCount ?? 0) > 0)
  )
}

/**
 * Split a Places-formatted address into the parts the comp ladder wants.
 * "2732 NW Ordway Ave, Bend, OR 97703, USA" → street / city / postal code.
 * Deliberately forgiving: a visitor who types the address by hand and stops at
 * the city still resolves, and a miss on the city only costs the finer grain.
 */
export function splitSellAddress(address: string): {
  street: string
  city: string | null
  postalCode: string | null
} {
  const parts = address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && p.toUpperCase() !== 'USA')
  const street = parts[0] ?? address
  const city = parts[1] ?? null
  const stateZip = parts[2] ?? ''
  const postalCode = stateZip.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null
  return { street, city, postalCode }
}
