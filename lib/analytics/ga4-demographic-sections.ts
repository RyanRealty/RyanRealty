/**
 * GA4 Data API report sections for /admin/analytics/demographics, and the
 * rule for when Google has withheld them.
 *
 * Age and gender come from Google Signals (ON, data/analytics/decisions.json
 * `google-signals-on`). GA4 applies data thresholds to them: a group with too
 * few users is removed from the response, and `metadata.subjectToThresholding`
 * is set. At this site's traffic level Google often removes every group. Read
 * live 2026-10-14 for the last 30 days: the age, gender, age x page and seller
 * LP age reports each came back with 0 rows and `subjectToThresholding: true`,
 * while the same window had city rows and a nonzero total. An empty withheld
 * report is not a zero; the page must say Google withheld it.
 *
 * States:
 *   ok        rows came back. `partial` when Google flagged thresholding, so
 *             small groups may be missing and shares are of what it reported.
 *   withheld  no usable rows and Google flagged thresholding.
 *   empty     no usable rows and no thresholding: nothing to report.
 *   error     Google rejected or failed this one report. The other reports
 *             still render (2026-10-14: one incompatible report used to take
 *             the whole page down).
 *
 * "Usable" excludes GA4's `unknown` bucket for age and gender: a report that
 * only holds `unknown` says nothing about who the visitors are.
 *
 * Pure; tested in ga4-demographic-sections.test.ts.
 */

export type Ga4Section<T> =
  | { state: 'ok'; rows: T[]; partial: boolean }
  | { state: 'withheld' }
  | { state: 'empty' }
  | { state: 'error'; error: string }

/** The slice of a GA4 runReport response this module reads. */
export type Ga4ReportLike = {
  rows?: ReadonlyArray<{
    dimensionValues?: ReadonlyArray<{ value?: string | null }> | null
    metricValues?: ReadonlyArray<{ value?: string | null }> | null
  }> | null
  metadata?: { subjectToThresholding?: boolean | null } | null
}

/** GA4's placeholder buckets that carry no demographic answer. */
const UNKNOWN_BUCKETS = new Set(['', 'unknown', '(not set)', '(other)'])

export function isKnownBucket(value: string): boolean {
  return !UNKNOWN_BUCKETS.has(value.trim().toLowerCase())
}

function num(v: string | null | undefined): number {
  if (!v) return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Classifies mapped rows with Google's thresholding flag. */
export function toSection<T>(
  rows: T[],
  subjectToThresholding: boolean | null | undefined,
  isUsable: (row: T) => boolean = () => true,
): Ga4Section<T> {
  const thresholded = subjectToThresholding === true
  if (!rows.some(isUsable)) return thresholded ? { state: 'withheld' } : { state: 'empty' }
  return { state: 'ok', rows, partial: thresholded }
}

/** The error text Google sent (gRPC `details` first, it is the readable part). */
export function ga4ErrorMessage(reason: unknown): string {
  const details = (reason as { details?: unknown } | null)?.details
  if (typeof details === 'string' && details.trim()) return details.trim()
  if (reason instanceof Error) return reason.message
  return String(reason)
}

/**
 * One report's section from its settled runReport call. `mapRow` receives the
 * dimension values (strings) and metric values (numbers) in request order.
 */
export function sectionFromSettled<T>(
  settled: PromiseSettledResult<readonly [Ga4ReportLike, ...unknown[]]>,
  mapRow: (dims: string[], metrics: number[]) => T,
  isUsable?: (row: T) => boolean,
): Ga4Section<T> {
  if (settled.status === 'rejected') return { state: 'error', error: ga4ErrorMessage(settled.reason) }
  const res = settled.value[0]
  const rows = (res.rows ?? []).map((r) =>
    mapRow(
      (r.dimensionValues ?? []).map((d) => d.value ?? ''),
      (r.metricValues ?? []).map((m) => num(m.value)),
    ),
  )
  return toSection(rows, res.metadata?.subjectToThresholding, isUsable)
}

/**
 * The one figure of an undimensioned count report. No rows without
 * thresholding means none were counted (0); withheld or failed means unknown
 * (null), never 0.
 */
export function singleCount(section: Ga4Section<number>): number | null {
  if (section.state === 'ok') return section.rows[0] ?? 0
  return section.state === 'empty' ? 0 : null
}

/** The Bend metro, as GA4 names the cities (region Oregon). */
export const BEND_METRO_CITIES: ReadonlySet<string> = new Set([
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'Tumalo',
  'La Pine',
  'Madras',
  'Prineville',
])

/** Rows to render: the reported rows when ok, otherwise none. */
export function sectionRows<T>(section: Ga4Section<T>): T[] {
  return section.state === 'ok' ? section.rows : []
}

/** Canonical age order. GA4 returns brackets in arbitrary order. */
export const AGE_ORDER = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'unknown'] as const

export function sortAgeBuckets<T extends { ageBracket: string }>(rows: readonly T[]): T[] {
  const rank = (b: string) => {
    const i = (AGE_ORDER as readonly string[]).indexOf(b)
    return i === -1 ? 99 : i
  }
  return [...rows].sort((a, b) => rank(a.ageBracket) - rank(b.ageBracket))
}

/** An age section with its rows in canonical bracket order. */
export function sortAgeSection<T extends { ageBracket: string }>(section: Ga4Section<T>): Ga4Section<T> {
  return section.state === 'ok' ? { ...section, rows: sortAgeBuckets(section.rows) } : section
}

/**
 * Users in the matching brackets as a share of users in KNOWN brackets
 * (GA4's `unknown` is left out of the base). Null when the base is zero, so a
 * caller can never print 0% for "Google did not say".
 */
export function knownShare<T extends { users: number }>(
  rows: readonly T[],
  bucketOf: (row: T) => string,
  match: (bucket: string) => boolean,
): { share: number | null; matched: number; base: number } {
  let base = 0
  let matched = 0
  for (const r of rows) {
    const bucket = bucketOf(r)
    if (!isKnownBucket(bucket)) continue
    base += r.users
    if (match(bucket)) matched += r.users
  }
  return { share: base > 0 ? matched / base : null, matched, base }
}
