/**
 * Subdivision face copy. Traces, captions, and the closed-sales heading live
 * here so banned labels and buyer/seller H2s stay off the public HTML.
 * Face says subdivision / this neighborhood.
 */

const FEED = 'live MLS through Oregon Data Share'

export function subdivisionFaceHeadline(displayName: string): string {
  return `Homes for sale in ${displayName}`
}

export function subdivisionFaceFieldCaption(input: {
  placeName: string
  count: number
}): string | null {
  if (input.count <= 0) return null
  return `${input.count.toLocaleString('en-US')} ${
    input.count === 1 ? 'home' : 'homes'
  } for sale in ${input.placeName}`
}

export function subdivisionFaceSchoolAssignment(input: {
  schoolName: string
  modalCount: number
  totalCount: number
  sinceYear?: number | null
}): string {
  const window =
    input.sinceYear != null
      ? `historical listings here since ${input.sinceYear}`
      : 'historical listings here'
  return (
    `${input.schoolName}, the assignment on ${input.modalCount} of the ${input.totalCount} ${window} ` +
    `that carry one, a historical set, not the homes for sale now and not the closed sales.`
  )
}

export function subdivisionFaceClosedTotalsSentence(input: {
  closedCount: number
  placeName: string
  sinceYear?: number | null
}): string {
  const sinceBit = input.sinceYear != null ? ` since ${input.sinceYear}` : ''
  const homesBit =
    input.closedCount === 1
      ? '1 sold single-family home has closed'
      : `${input.closedCount.toLocaleString('en-US')} sold single-family homes have closed`
  return `${homesBit} in ${input.placeName}${sinceBit}, not the homes for sale now.`
}

export function subdivisionFaceFieldTrace(
  placeName: string,
  cityName: string | null,
  hasBoundary: boolean,
): string {
  const where = cityName
    ? `recorded under the ${placeName} subdivision name in ${cityName}`
    : hasBoundary
      ? `inside the recorded ${placeName} subdivision`
      : `recorded under the ${placeName} subdivision name`
  return `${FEED}, active single-family listings ${where}. Map and list are the same set.`
}

export function subdivisionFaceClosedSalesCaption(displayName: string): string {
  return `Closed single-family sales, ${displayName}.`
}

export function subdivisionFaceClosedSalesTrace(
  displayName: string,
  priceMayPublish = false,
): string {
  const base =
    `${FEED}, closed single-family sales recorded under the MLS subdivision name ${displayName}, ` +
    `a single-family name join and not recorded-boundary membership, grouped by calendar year. ` +
    `Never an individual sale.`
  return priceMayPublish
    ? base
    : `${base} Counts only. A closed-price statistic at this grain is withheld, because most ` +
        `subdivisions never reach ten detached sales in 36 months and a median of that is not a fact.`
}

export function subdivisionFaceInventoryTrace(
  placeName: string,
  cityName: string | null,
  hasBoundary: boolean,
): string {
  const where = cityName
    ? `recorded under the ${placeName} subdivision name in ${cityName}`
    : hasBoundary
      ? `inside the recorded ${placeName} subdivision`
      : `recorded under the ${placeName} subdivision name`
  return `${FEED}, the list prices of the active single-family listings ${where}.`
}

export function subdivisionFaceCountsTrace(displayName: string): string {
  return (
    `regional MLS, detached homes in the recorded ${displayName} subdivision. ` +
    `Each figure names its own window. A figure the feed withheld is absent, not estimated.`
  )
}

export function subdivisionFaceStatsTrace(
  displayName: string,
  cityName: string,
  periodLabel: string,
): string {
  const where = cityName === 'Central Oregon' ? displayName : `${displayName}, ${cityName}`
  return (
    `${FEED} through the subdivision statistics cache, closed single-family sales in ${where}, ` +
    `${periodLabel.toLowerCase()}. Days on market only. A closed-price statistic at this grain is ` +
    `withheld.`
  )
}

export function subdivisionFaceHomesTrace(
  placeName: string,
  cityName: string | null,
  hasBoundary: boolean,
): string {
  if (cityName) {
    return `${FEED}, active single-family listings under the ${placeName} name in ${cityName}.`
  }
  const where = hasBoundary
    ? `inside the recorded ${placeName} subdivision`
    : `returned for ${placeName}`
  return `${FEED}, active single-family listings ${where}.`
}
