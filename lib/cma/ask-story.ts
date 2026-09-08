/**
 * WHICH STORY CHAPTER 1 IS ALLOWED TO TELL.
 *
 * The document's first act was written for one case: an ask far above what the
 * sales support, so "it asked too much and sat" is what the numbers say. Then
 * the pricing engine was corrected (tasteReview round three, §4.1) and 2465
 * 7th's ask moved from 15.3 percent above the top of the range to 3.8 percent
 * above it — while chapter 1 still argued overpricing and chapter 2b was still
 * titled "What overpricing costs". A price opinion that argues a case its own
 * numbers contradict is the one thing this document may not do (CLAUDE.md §0:
 * when data contradicts the story, the story changes).
 *
 * So the story is CHOSEN BY THE GAP, from data:
 *
 * - more than 10 percent above the top of the range → the overpricing story,
 *   unchanged. The gap is the finding and the chapter says so.
 * - inside 10 percent above → the ask was near what the market would pay, and
 *   187 days without an offer is then a fact about something else. The chapter
 *   states the facts and states the limit of what they support. It never names
 *   a cause: nothing on the row measures condition, access, photography or
 *   terms, and inventing one would be the §0 failure in the other direction.
 * - inside or below the range → the same, with the ask sentence saying so.
 *
 * The graphics do not move. The offer-timing curve, the three-bar outcome and
 * the realization strip are measurements of this city, true whatever this one
 * listing's price was; only the SENTENCE over them and chapter 2b's title
 * change, because a title is a claim.
 */

/**
 * `neutral` is not a measurement. It is the POLICY class: this document is not
 * allowed to argue about the price at all — the home is on the market with
 * another brokerage today, or the ask sat below the bottom of the range, so
 * "it asked too much" is a claim the numbers do not carry and, in the first
 * case, one a licensed broker may not make about somebody else's listing
 * (round-four class B and class D). `askGapClass` never returns it; the
 * chapter chooses it.
 */
export type AskGapClass = 'far-above' | 'near-above' | 'inside' | 'below' | 'neutral'

function pct1(ratio: number): string {
  return (Math.abs(ratio) * 100).toFixed(1)
}

/**
 * Where the seller's own ask sat against what homes like theirs sold for, in
 * one sentence.
 *
 * ONE sentence, in ONE place, because two chapters say it. Chapter 1 read
 * "the asking price was 15.3 percent above the top of the range"; chapter 2's
 * card for the same listing read "that is at the top of what they closed at"
 * on a dollars-a-foot measure. Both were true and, a minute apart, they
 * cancelled. Chapter 2 now leads with this sentence and puts its own
 * dollars-a-foot line after it.
 */
export function askAgainstRangeSentence(
  ask: number | null,
  rangeLow: number | null,
  rangeHigh: number | null,
): string {
  if (ask == null || !(ask > 0) || rangeLow == null || rangeHigh == null) return ''
  const low = Math.min(rangeLow, rangeHigh)
  const high = Math.max(rangeLow, rangeHigh)
  if (!(low > 0) || !(high > 0)) return ''
  if (ask > high) {
    return `The asking price was ${pct1((ask - high) / high)} percent above the top of the range homes like yours sold in.`
  }
  if (ask < low) {
    return `The asking price was ${pct1((low - ask) / low)} percent below the bottom of the range homes like yours sold in.`
  }
  return 'The asking price was inside the range homes like yours sold in.'
}

/**
 * Where "the ask was the problem" stops being the reading the numbers carry.
 *
 * Ten percent is the blueprint's own line — § Words gives the seller-facing
 * phrases "priced within 3 percent of what it sold for" and "priced 10 percent
 * or more above" — so the class boundary is a number this document already
 * publishes rather than one invented here.
 */
export const FAR_ABOVE_GAP = 0.1

export function askGapClass(
  ask: number | null | undefined,
  rangeLow: number | null | undefined,
  rangeHigh: number | null | undefined,
): AskGapClass | null {
  if (ask == null || !(ask > 0) || rangeLow == null || rangeHigh == null) return null
  const low = Math.min(rangeLow, rangeHigh)
  const high = Math.max(rangeLow, rangeHigh)
  if (!(low > 0) || !(high > 0)) return null
  if (ask > high) return (ask - high) / high > FAR_ABOVE_GAP ? 'far-above' : 'near-above'
  if (ask < low) return 'below'
  return 'inside'
}

/** "At a price near the range" — the clause the honest reading opens on. */
function atThatPrice(cls: AskGapClass): string {
  if (cls === 'near-above') return 'At a price near the range'
  if (cls === 'below') return 'At a price below the range'
  return 'At a price inside the range'
}

/**
 * The stated limit.
 *
 * Facts, then what they do NOT settle. This is the whole difference between a
 * document that changed its story and one that swapped one unfounded claim for
 * another: the row carries the days and the city's median, and it carries
 * nothing at all about the house's condition or how it was shown.
 */
export function walkTheHouseSentence(cls: AskGapClass, days: number | null): string {
  if (days == null || !(days > 0)) return ''
  const d = Math.round(days).toLocaleString('en-US')
  // An ask above what the sales support that then sat is the overpricing story
  // the data carries (Matt 2026-09-07: "if you overprice you will sit or not
  // sell"). Only a price inside or below the range earns the sentence that
  // points away from the number.
  if (cls === 'near-above') {
    return `That ask was above what the sales support, and it went ${d} days without an offer. We would walk the house before saying more.`
  }
  return `${atThatPrice(cls)}, ${d} days without an offer points at something other than the number. We would walk the house before saying what.`
}

/** "It sat 187 days." — and, off the overpricing story, what it sat without. */
function satSentence(cls: AskGapClass, days: number | null): string {
  if (days == null || !(days > 0)) return ''
  const n = Math.round(days).toLocaleString('en-US')
  return cls === 'far-above' ? `It sat ${n} days.` : `It sat ${n} days without an offer.`
}

/**
 * The city's median days to an accepted offer, said the way each story needs
 * it: the overpricing story compares one listing to the median home, the
 * near-price story is asking the reader to weigh 187 days against how long a
 * sale normally waits.
 */
function medianSentence(cls: AskGapClass, city: string, medianDays: number | null): string {
  const place = city.trim()
  if (!place || medianDays == null || !(medianDays > 0)) return ''
  const n = Math.round(medianDays)
  return cls === 'far-above'
    ? `The median home in ${place} has an accepted offer in ${n} days.`
    : `Half of the homes that sold in ${place} had an offer inside ${n} days.`
}

/**
 * "It asked $475,000 for 152 days, then $460,000 for 35."
 *
 * ROUND-FOUR CLASS B. Chapter 1 opened on the ask the listing came OFF at —
 * the cut made five weeks before it expired — and measured the whole story
 * against that number. On the exemplar, 152 of 187 days were spent $15,000
 * higher. The heading named a price the market barely saw, the verdict
 * sentence measured its gap, and chapter 2b argued the cost of it.
 *
 * The sentence names every ask and how long each one ran, so the reader can
 * see which price actually held the clock. Days are printed once, on the
 * first: "for 152 days, then $460,000 for 35" reads as one measure.
 *
 * Returns '' when the row cannot say how long any ask ran — a duration is a
 * number, and a number without a basis does not ship (§0).
 */
export function askExposureSentence(
  segments: ReadonlyArray<{ ask: number; days: number | null }>,
): string {
  const runs = segments.filter((s) => s.ask > 0)
  if (runs.length === 0) return ''
  const allDated = runs.every((s) => s.days != null && s.days > 0)
  if (!allDated) {
    const asks = runs.map((s) => usd(s.ask))
    return asks.length === 1
      ? `It asked ${asks[0]}.`
      : `It asked ${asks.slice(0, -1).join(', then ')}, then ${asks[asks.length - 1]}.`
  }
  const parts = runs.map((s, i) => {
    const n = Math.round(s.days!).toLocaleString('en-US')
    return i === 0 ? `${usd(s.ask)} for ${n} days` : `${usd(s.ask)} for ${n}`
  })
  return `It asked ${parts.join(', then ')}.`
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/**
 * The ask, the range, and the days. Nothing else.
 *
 * The chapter a document gets when it may not argue about the price: the home
 * is listed with another brokerage, or the ask was below the bottom of the
 * range and "it asked too much" is simply false. Three facts, no comparison,
 * no verdict, no handoff.
 */
export function neutralAskReading(input: {
  ask: number | null
  rangeLow: number
  rangeHigh: number
  days: number | null
}): string {
  const bits: string[] = []
  if (input.ask != null && input.ask > 0) bits.push(`It asked ${usd(input.ask)}.`)
  const low = Math.min(input.rangeLow, input.rangeHigh)
  const high = Math.max(input.rangeLow, input.rangeHigh)
  if (low > 0 && high > 0) {
    bits.push(
      low === high
        ? `Homes like yours sold for ${usd(low)}.`
        : `Homes like yours sold for ${usd(low)} to ${usd(high)}.`,
    )
  }
  if (input.days != null && input.days > 0) {
    bits.push(`It was on the market ${Math.round(input.days).toLocaleString('en-US')} days.`)
  }
  return bits.join(' ')
}

/**
 * The whole reading under chapter 1's timeline, for whichever story the gap
 * put the document in.
 *
 * THREE GATES, in order, and each one narrows what may be said:
 *
 *  1. `neutral` — the policy class above. Ask, range, days, stop.
 *  2. `exposureKnown: false` — nothing on the row says which ask ran the
 *     clock, so the days and the city's median print and NOTHING causal does.
 *     Naming a gap here would be measuring the wrong ask, which is the exact
 *     defect this parameter exists to stop.
 *  3. otherwise — the measured story, off the DOMINANT ask.
 */
export function askStoryReading(input: {
  /** The ask that ran the clock, not the one it came off at. */
  ask: number | null
  rangeLow: number
  rangeHigh: number
  days: number | null
  city: string
  marketMedianDom: number | null
  /** This document may not argue about the price. */
  neutral?: boolean
  /**
   * Whether the row says which ask held the market. Defaults true so the
   * existing caller in lib/cma/expired-audit.ts is unchanged; chapter 1 passes
   * it explicitly.
   */
  exposureKnown?: boolean
}): string {
  if (input.neutral) {
    return neutralAskReading({
      ask: input.ask,
      rangeLow: input.rangeLow,
      rangeHigh: input.rangeHigh,
      days: input.days,
    })
  }
  if (input.exposureKnown === false) {
    const days =
      input.days != null && input.days > 0
        ? `It sat ${Math.round(input.days).toLocaleString('en-US')} days.`
        : ''
    return [days, medianSentence('near-above', input.city, input.marketMedianDom)]
      .filter((s) => s.trim())
      .join(' ')
  }
  const cls = askGapClass(input.ask, input.rangeLow, input.rangeHigh)
  if (!cls) return ''
  const bits = [
    askAgainstRangeSentence(input.ask, input.rangeLow, input.rangeHigh),
    satSentence(cls, input.days),
    medianSentence(cls, input.city, input.marketMedianDom),
    cls === 'far-above' ? '' : walkTheHouseSentence(cls, input.days),
  ]
  return bits.filter((s) => s.trim()).join(' ')
}

/**
 * Chapter 2b's title, which is a CLAIM about this listing when it names
 * overpricing and a description of the city when it does not.
 *
 * The chapter's evidence is identical either way — the same curve, the same
 * three bars, the same realization strip with the seller's own weeks marked.
 * What changes is whether the document is entitled to call it the cost of
 * THEIR price.
 */
export const PRICED_RIGHT_HEADING_OVERPRICED = 'What overpricing costs.'

export function pricedRightHeadingFor(cls: AskGapClass | null, city: string): string {
  const place = city.trim()
  // A title is a claim, and with no place to name there is no descriptive
  // title to fall back to — so the overpricing title survives ONLY where the
  // gap carries it. `neutral` and `null` never carry it: null means the row
  // does not say which ask ran the clock (class B), and neutral means the
  // document is not entitled to argue price at all.
  if (cls === 'far-above' && place) return PRICED_RIGHT_HEADING_OVERPRICED
  if (!place) return 'What price and time cost.'
  return `What price and time look like in ${place}.`
}
