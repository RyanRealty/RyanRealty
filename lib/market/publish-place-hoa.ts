/**
 * One published annual HOA for a place page.
 *
 * Master assessment (rich content `hoa_master_assessment_annual`), registry
 * "annual estimate" (parent or a sub-neighborhood), and the MEASURED median
 * from member listings (getPlaceCharacter, live MLS dues) live in different
 * files. Printing more than one as the community's HOA on one page is two (or
 * three) figures for one cost.
 *
 * Founding case: /communities/tetherow glance Master HOA $1,464/yr next to FAQ
 * "start around $2,244" (Heath sub-neighborhood estimate). Fleet
 * eab91ac8dfa9b833ade88640c6cce7d4.
 *
 * D103 (2026-08-27): the same page also carried a MEASURED figure (the
 * character block's median of current listings that report dues) beside the
 * registry estimate, neither naming the other. A live measurement outranks a
 * static estimate, so `measuredAnnual` is checked first.
 *
 * Public pages print one annual. Prefer the measured median when the sample
 * clears its own floor (DUES_MIN_REPORTED in getPlaceCharacter), else master
 * when present (community-wide), else the floor of known estimates (honest
 * "start around"). Phase totals stay on phase / LP pages. Do not invent a
 * blended total under the same label.
 */

export type PlaceHoaKind = 'measured' | 'master' | 'estimate'

export type PublishedPlaceHoa = {
  annual: number
  kind: PlaceHoaKind
  /** Only set for kind 'measured': the sample basis, named in the same sentence as the figure. */
  basis?: string
}

function asPositiveAnnual(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishPlaceHoa(input: {
  /** Median annual dues measured from current member listings (getPlaceCharacter). Highest priority. */
  measuredAnnual?: number | null
  /** The sample basis for `measuredAnnual`, e.g. "median of the 6 current listings that report dues". */
  measuredBasis?: string | null
  masterAnnual?: number | null
  estimateAnnual?: number | null
  subEstimates?: ReadonlyArray<number | null | undefined> | null
}): PublishedPlaceHoa | null {
  const measured = asPositiveAnnual(input.measuredAnnual)
  if (measured != null) {
    return input.measuredBasis
      ? { annual: measured, kind: 'measured', basis: input.measuredBasis }
      : { annual: measured, kind: 'measured' }
  }

  const master = asPositiveAnnual(input.masterAnnual)
  if (master != null) return { annual: master, kind: 'master' }

  const estimates = [
    asPositiveAnnual(input.estimateAnnual),
    ...(input.subEstimates ?? []).map(asPositiveAnnual),
  ].filter((n): n is number => n != null)
  if (estimates.length === 0) return null
  return { annual: Math.min(...estimates), kind: 'estimate' }
}

export function placeHoaGlanceLabel(kind: PlaceHoaKind): string {
  if (kind === 'measured') return 'HOA (measured)'
  return kind === 'master' ? 'Master HOA' : 'HOA estimate'
}

export function formatPlaceHoaAnnual(annual: number): string {
  return `$${annual.toLocaleString('en-US')}/yr`
}
