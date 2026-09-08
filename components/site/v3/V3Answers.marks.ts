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

/**
 * How a value read OFF the rule is written out, so a position under the
 * reader's pointer prints in the same units the figure printed in. Nothing
 * here invents a number: it formats a coordinate the reader chose.
 */
export type V3AnswerScaleFormat = {
  /** Appended verbatim: "%", " days", " months". */
  unit?: string
  /** Fixed decimals. Default 0. */
  decimals?: number
}

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
   * What the SUBJECT mark is called when the reader lands on it — the place
   * name, almost always. Without it the readout can only say the number.
   */
  subjectLabel?: string
  /** How a scrubbed position prints. */
  format?: V3AnswerScaleFormat
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
  /**
   * The same thing counted. English does not pluralise "home for sale" by
   * adding an s to the end, and the readout says the plural far more often
   * than the singular, so it is named rather than derived.
   */
  unitPlural?: string
  /**
   * What this run of marks is, when there is a second one under it. Omitted
   * for a lone count, where the question above already named the window.
   */
  runLabel?: string
  /**
   * A SECOND run of marks, the same thing counted over a different window, so
   * the reader compares two counts by looking at two lengths instead of
   * subtracting two numerals. It must come from the same query as the subject
   * — the plat grain's yearly closed counts are one RPC over two years — or it
   * is two populations pretending to be a comparison (§0).
   */
  context?: { count: number; label: string }
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

/* ───────────────────────────────────────────────────────────────────────────
   READING THE RULE (site queue SITE-08, second pass).

   The first cut drew one static mark and stopped. TASTE.md's chart-craft bar
   is explicit that this is the floor and not the ceiling: "a crosshair and
   tooltip on every line, a per-mark tooltip on every bar, dot, and cell, hit
   targets larger than the mark. A chart the reader cannot interrogate is a
   picture of a chart." The evaluator's second pass named the same thing on all
   three place grains.

   So the rule becomes an INSTRUMENT the reader runs along. Everything it can
   say is either a figure this page already published (the subject, the named
   context) or a coordinate the reader themselves chose — never a new claim
   about the market, which is why the readout below can only ever print a
   position and the name of the band it fell in. §0 is not weakened by letting
   someone point at a ruler.
   ─────────────────────────────────────────────────────────────────────────── */

/** What sits under the reader's pointer. */
export type ScaleReading = {
  /** The value at that position, after snapping to a named mark. */
  value: number
  /** Where the crosshair draws, 0..100. */
  atPct: number
  /**
   * The published figure the reader landed on, when they are close enough to
   * one for the pointer to mean it. Free positions read as `null` and are
   * written out as what they are: a place on the scale, not a statistic.
   */
  named: 'subject' | 'context' | null
  /** The name of that figure — the place, the parent city, "the asking price". */
  namedLabel: string | null
  /** The band the position falls in, when the rule is banded. */
  band: string | null
}

/**
 * How close (in percent of the rule) the pointer has to be before it means a
 * published mark rather than a free coordinate. Two marks are never closer
 * than this to each other in practice, and if they were, the subject wins.
 */
export const SNAP_PCT = 4

/** A position on the rule, written out in the figure's own units. */
export function formatScaleValue(value: number, format?: V3AnswerScaleFormat): string {
  if (!finite(value)) return ''
  const decimals = format?.decimals ?? 0
  const safe = decimals >= 0 && decimals <= 3 ? decimals : 0
  return `${value.toFixed(safe)}${format?.unit ?? ''}`
}

/**
 * What the rule says at `fraction` along it (0 at min, 1 at max), or null when
 * the scale cannot be drawn at all — the same refusal `answerScaleGeometry`
 * makes, so a rule that draws can always be read and one that cannot never
 * gets a readout to disagree with it.
 */
export function answerScaleReadAt(scale: V3AnswerScale, fraction: number): ScaleReading | null {
  const geometry = answerScaleGeometry(scale)
  if (!geometry) return null
  if (!finite(fraction)) return null
  const clamped = fraction < 0 ? 0 : fraction > 1 ? 1 : fraction
  const atPct = clamped * 100

  // Snap to a published mark before anything else: the reader pointing at the
  // dot means the dot, and a readout that said "94.8%" while the dot says
  // 95.0% would be the drawing arguing with the sentence beside it.
  if (Math.abs(atPct - geometry.atPct) <= SNAP_PCT) {
    return {
      value: scale.at,
      atPct: geometry.atPct,
      named: 'subject',
      namedLabel: scale.subjectLabel?.trim() || null,
      band: bandAt(geometry, geometry.atPct),
    }
  }
  if (geometry.contextPct != null && scale.context && Math.abs(atPct - geometry.contextPct) <= SNAP_PCT) {
    return {
      value: scale.context.at,
      atPct: geometry.contextPct,
      named: 'context',
      namedLabel: scale.context.label.trim() || null,
      band: bandAt(geometry, geometry.contextPct),
    }
  }

  const value = scale.min + (scale.max - scale.min) * clamped
  return { value, atPct, named: null, namedLabel: null, band: bandAt(geometry, atPct) }
}

function bandAt(geometry: ScaleGeometry, atPct: number): string | null {
  for (const band of geometry.bands) {
    if (atPct >= band.fromPct - Number.EPSILON && atPct <= band.fromPct + band.widthPct) return band.label
  }
  return geometry.bands[0]?.label ?? null
}

/**
 * The tally's grouping. Every fifth mark carries the gap that makes a run of
 * dots a COUNT rather than a dotted rule — the stylesheet has had the rule for
 * this since the first cut and nothing ever set the class, so 360 identical
 * marks shipped on /cities/bend/awbrey-butte (measured 2026-09-08).
 * A trailing group end is not drawn: a gap after the last mark is a gap to
 * nothing.
 */
export function isTallyGroupEnd(index: number, count: number): boolean {
  if (!Number.isInteger(index) || index < 0) return false
  return (index + 1) % 5 === 0 && index + 1 !== count
}
