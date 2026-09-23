/**
 * The comparison half of a year-over-year sentence, with a subject and a
 * direction (VOICE-6, visibility audit 2026-09-22).
 *
 * Five insight boards (the city and region market reports, /cities, the ZIP
 * report and the region FAQ) all wrote the same template:
 *
 *   "In August 2026 the middle house in Bend sold for $750K. A year earlier,
 *    in August 2025, it was $795K, −5.7%, less than the same month last year."
 *
 * The subject of "less than" is last year's price, so the sentence says the
 * opposite of what it means, and the delta sits between two commas with no
 * verb. A person says it once: "$750K, down 5.7% from $795K in August 2025".
 *
 * The percent is the page's OWN formatted delta (each board keeps its own
 * precision, so the lede prints the same figure the tooltip does); this
 * function only takes the sign off it and lets the two values decide the
 * direction, so a sign and a word can never disagree.
 */
export type YearAgoClauseInput = {
  /** This month's median. */
  now: number
  /** The same month a year earlier. */
  then: number
  /** `then`, already formatted the way the page prints money ("$795K"). */
  thenMoney: string
  /** "August 2025" */
  thenLabel: string
  /** The page's own delta string ("−5.7%", "+4%", "level"), or null. */
  delta: string | null
}

const LEVEL = /^(level|[+\-−]?0(\.0+)?%)$/

/**
 * "down 5.7% from $795K in August 2025", "up 4% from $612K in August 2025",
 * or "level with $795K in August 2025". Null when either value is unusable.
 */
export function yearAgoClause(input: YearAgoClauseInput): string | null {
  const { now, then, thenMoney, thenLabel, delta } = input
  if (!Number.isFinite(now) || !Number.isFinite(then) || !(then > 0) || !(now > 0)) return null
  const size = delta?.trim().replace(/^[+\-−]/, '') ?? ''
  const level = now === then || size === '' || LEVEL.test(delta?.trim() ?? '')
  if (level) return `level with ${thenMoney} in ${thenLabel}`
  return `${now > then ? 'up' : 'down'} ${size} from ${thenMoney} in ${thenLabel}`
}
