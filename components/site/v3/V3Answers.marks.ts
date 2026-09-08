/**
 * The two drawings a V3Answers row can carry, as pure geometry.
 *
 * WHY A DRAWING BELONGS IN A QUESTION SET AT ALL. TASTE.md bans "a section whose
 * primary content is more than two paragraphs of prose with no figure, image,
 * map, or interactive element. FAQ blocks count." V3Answers answered the first
 * half of that (the disclosure) and left the second: every row still opened onto
 * prose. A place page's questions are all about ONE number each — how long a
 * home takes to go under contract, what share of the asking price it closes at,
 * how many buyers pay cash, whether there are enough homes for sale — and a
 * number a reader cannot place on a scale is a number they cannot use. So the
 * row carries its figure closed, and opens onto the figure DRAWN.
 *
 * TWO FORMS, DELIBERATELY, and they cover the whole place class (city,
 * neighborhood, master-plan, plat):
 *
 *   scale — one value's position on a labeled rule. Bands turn the rule into
 *           the verdict itself: months of supply lands inside "seller's",
 *           "balanced" or "buyer's" and the reader reads the answer off the
 *           position rather than off the word. A context mark puts a second,
 *           named value on the same rule (the parent city's median, the asking
 *           price at 100%) so the subject figure has something to be measured
 *           against — the comparison is the point, not decoration.
 *   tally — one mark per home. "49 for sale" and "120 closed last year" are
 *           counts, and a count's honest picture is the count.
 *
 * Everything here is pure and total: an input that cannot be drawn honestly
 * returns null and the row renders its sentence alone, which is the same rule
 * §0 applies to every other figure on the site. Nothing is clamped into range —
 * a value outside its domain would draw a dot sitting on the end of a rule as
 * if it were the end of the rule, which is a lie about the number.
 */

/** One value on a labeled rule, optionally banded and optionally compared. */
export type V3AnswerScale = {
  kind: 'scale'
  /** Domain, in the figure's own units. */
  min: number
  max: number
  /** The subject value. Outside [min, max] the drawing is refused. */
  at: number
  /** What the reader sees at each end. Plain words, never a raw unit. */
  minLabel: string
  maxLabel: string
  /**
   * Ordered bands, each named by the segment that ENDS at `to`. The last `to`
   * must be the domain max, so the bands tile the rule with no gap.
   */
  bands?: readonly { to: number; label: string }[]
  /** A second named value on the same rule: the parent city, the asking price. */
  context?: { at: number; label: string }
  /**
   * True only when the value IS the exception the answer is about — a decline,
   * a drawdown, a breached threshold (CLAUDE.md §3). Never decoration.
   */
  exception?: boolean
}

/** One mark per counted thing. */
export type V3AnswerTally = {
  kind: 'tally'
  count: number
  /** What ONE mark is, in the reader's words: "home for sale", "closed sale". */
  unitLabel: string
}

export type V3AnswerMark = V3AnswerScale | V3AnswerTally

/**
 * Past this many marks a tally stops being a count anyone can read and becomes
 * a texture. The sentence carries the number either way, so the drawing is
 * dropped rather than crushed.
 */
export const TALLY_MAX = 240

export type ScaleBandGeometry = {
  /** Left edge, as a percentage of the rule. */
  fromPct: number
  widthPct: number
  label: string
  /** The band the subject value falls in — the drawn verdict. */
  active: boolean
}

export type ScaleGeometry = {
  atPct: number
  contextPct: number | null
  bands: ScaleBandGeometry[]
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pct(value: number, min: number, span: number): number {
  return ((value - min) / span) * 100
}

/**
 * The rule's geometry, or null when it cannot be drawn honestly.
 *
 * Refused: a non-finite end or value, an empty or inverted domain, a subject
 * outside the domain, a context outside the domain, and a band list that does
 * not ascend and finish at the domain max. Every one of those would render a
 * mark whose POSITION says something the number does not.
 */
export function answerScaleGeometry(scale: V3AnswerScale): ScaleGeometry | null {
  const { min, max, at } = scale
  if (!finite(min) || !finite(max) || !finite(at)) return null
  const span = max - min
  if (span <= 0) return null
  if (at < min || at > max) return null

  let contextPct: number | null = null
  if (scale.context) {
    const cAt = scale.context.at
    if (!finite(cAt) || cAt < min || cAt > max) return null
    contextPct = pct(cAt, min, span)
  }

  const bands: ScaleBandGeometry[] = []
  if (scale.bands && scale.bands.length > 0) {
    let cursor = min
    for (let i = 0; i < scale.bands.length; i += 1) {
      const band = scale.bands[i]
      if (!band || !finite(band.to) || !band.label.trim()) return null
      if (band.to <= cursor) return null
      if (band.to > max) return null
      if (i === scale.bands.length - 1 && band.to !== max) return null
      const fromPct = pct(cursor, min, span)
      bands.push({
        fromPct,
        widthPct: pct(band.to, min, span) - fromPct,
        label: band.label.trim(),
        // The band that CONTAINS the value. Upper bound inclusive, so a value
        // sitting exactly on a boundary lands in the lower band — the same
        // direction lib/market/classify.ts sends months of supply at 4.0.
        active: at > cursor - Number.EPSILON && at <= band.to,
      })
      cursor = band.to
    }
    // A value exactly at the domain floor sits on no band's open lower edge.
    if (!bands.some((b) => b.active) && bands[0]) bands[0].active = true
  }

  return { atPct: pct(at, min, span), contextPct, bands }
}

/** How many marks a tally draws, or null when the count is not drawable. */
export function answerTallyCount(tally: V3AnswerTally): number | null {
  if (!finite(tally.count)) return null
  const count = Math.round(tally.count)
  if (count < 1 || count > TALLY_MAX) return null
  return count
}
