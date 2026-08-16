/**
 * One published annual HOA for a place page.
 *
 * Master assessment (rich content `hoa_master_assessment_annual`) and registry
 * "annual estimate" (parent or a sub-neighborhood) live in different files.
 * Printing both as the community's HOA on one page is two figures for one cost.
 *
 * Founding case: /communities/tetherow glance Master HOA $1,464/yr next to FAQ
 * "start around $2,244" (Heath sub-neighborhood estimate). Fleet
 * eab91ac8dfa9b833ade88640c6cce7d4.
 *
 * Public pages print one annual. Prefer master when present (community-wide).
 * Otherwise the floor of known estimates (honest "start around"). Phase totals
 * stay on phase / LP pages. Do not invent a blended total under the same label.
 */

export type PlaceHoaKind = 'master' | 'estimate'

export type PublishedPlaceHoa = {
  annual: number
  kind: PlaceHoaKind
}

function asPositiveAnnual(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return value
}

export function publishPlaceHoa(input: {
  masterAnnual?: number | null
  estimateAnnual?: number | null
  subEstimates?: ReadonlyArray<number | null | undefined> | null
}): PublishedPlaceHoa | null {
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
  return kind === 'master' ? 'Master HOA' : 'HOA estimate'
}

export function formatPlaceHoaAnnual(annual: number): string {
  return `$${annual.toLocaleString('en-US')}/yr`
}
