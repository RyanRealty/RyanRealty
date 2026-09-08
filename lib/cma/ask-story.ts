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

export type AskGapClass = 'far-above' | 'near-above' | 'inside' | 'below'

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
  return `${atThatPrice(cls)}, ${Math.round(days).toLocaleString(
    'en-US',
  )} days without an offer points at something other than the number. We would walk the house before saying what.`
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
 * The whole reading under chapter 1's timeline, for whichever story the gap
 * put the document in.
 */
export function askStoryReading(input: {
  ask: number | null
  rangeLow: number
  rangeHigh: number
  days: number | null
  city: string
  marketMedianDom: number | null
}): string {
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
  if (cls == null || cls === 'far-above' || !place) return PRICED_RIGHT_HEADING_OVERPRICED
  return `What price and time look like in ${place}.`
}
