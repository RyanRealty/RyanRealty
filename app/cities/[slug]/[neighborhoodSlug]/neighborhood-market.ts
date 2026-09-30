/**
 * The neighborhood page's market figures that more than one surface prints,
 * read ONCE (AEO-1, visibility audit 2026-09-22).
 *
 * WHY THIS FILE EXISTS. The page reads two populations for "homes for sale":
 * the market-truth overlay (detached houses whose primary place membership is
 * this neighborhood — what the months-of-supply ratio divides) and the
 * boundary inventory (every single-family home in a publicly active MLS
 * status inside the recorded polygon — what the face, the Q&A and the
 * affordability calculator print). Both are honest. The defect was that the
 * Dataset and Place JSON-LD took "Median List Price" and "Active Listings"
 * from the overlay while the FAQPage and the visible page printed the
 * boundary figures under the same labels: Awbrey Butte 1,350,000 / 45 in the
 * markup against $1,312,500 / 54 on the page, River West 1,099,000 against
 * $1,569,000 (live 2026-09-23). An answer engine reading both sees the page
 * disagree with itself (§0 rule 5).
 *
 * `neighborhoodPublishedFigures` is the one read for the two labels. The page
 * hands its result to BOTH buildMarketFaq (Dataset + Place additionalProperty)
 * and buildPlaceAnswers (visible rows + FAQPage), so the two sinks cannot take
 * different numbers again. The overlay count keeps exactly one job: it is the
 * numerator the supply verdict names, and the inventory answer says so in
 * plain words (`neighborhoodCountNote`).
 */
import type { MarketFaqInput } from '@/lib/site/market-faq'

/** The slice of getNeighborhoodPublicInventory this module needs. */
export type NeighborhoodBoundaryInventory = {
  activeCount: number
  medianListPrice: number | null
}

/** The figures the page publishes under "Active Listings" and "Median List Price". */
export type NeighborhoodPublishedFigures = {
  activeCount: number | null
  medianListPrice: number | null
}

/**
 * The boundary read, or nothing. A missing read is null for both labels,
 * never a fallback to the overlay: printing the overlay's figure under the
 * boundary's label is the defect this file exists to stop.
 */
export function neighborhoodPublishedFigures(
  inventory: NeighborhoodBoundaryInventory | null | undefined,
): NeighborhoodPublishedFigures {
  if (!inventory) return { activeCount: null, medianListPrice: null }
  return {
    activeCount: Number.isFinite(inventory.activeCount) ? inventory.activeCount : null,
    medianListPrice:
      inventory.medianListPrice != null && Number.isFinite(inventory.medianListPrice)
        ? inventory.medianListPrice
        : null,
  }
}

/**
 * buildMarketFaq's input for a neighborhood. Months of supply is typed `null`
 * on purpose, and the page passes it out loud: the verdict is published by the
 * Q&A row with its own numerator named, and the Dataset has never carried a
 * neighborhood ratio.
 */
export function neighborhoodMarketFaqInput(input: {
  published: NeighborhoodPublishedFigures
  monthsOfSupply: null
  medianDaysToPending: number | null
  soldCount12mo: number | null
  refreshedAt: string | null
  /**
   * The Deschutes County attendance areas covering the neighborhood
   * (getPlaceSchools), in its order, and the city's district. The same list the
   * page's Schools section prints, so the answer and the section agree
   * (Matt 2026-09-24). Absent or empty: no schools question.
   */
  attendanceSchools?: readonly string[] | null
  schoolDistrict?: { district: string; districtSlug: string } | null
}): MarketFaqInput {
  return {
    grain: 'neighborhood',
    source: 'market-truth',
    activeCount: input.published.activeCount,
    pulseActiveCount: input.published.activeCount,
    medianListPrice: input.published.medianListPrice,
    monthsOfSupply: input.monthsOfSupply,
    medianDaysToPending: input.medianDaysToPending,
    soldCount12mo: input.soldCount12mo,
    refreshedAt: input.refreshedAt,
    attendanceSchools: input.attendanceSchools ?? null,
    schoolDistrictName: input.schoolDistrict?.district ?? null,
    schoolDistrictSlug: input.schoolDistrict?.districtSlug ?? null,
  }
}

/**
 * The line under the inventory answer when the supply ratio counted a
 * different number of homes. Plain words, both numbers, both populations
 * named, so a reader is told why the page shows two counts rather than left
 * to work it out (§0 rule 5). Null when the two agree or either is unknown.
 */
export function neighborhoodCountNote(input: {
  placeName: string
  supplyCount: number | null
  boundaryCount: number | null
}): string | null {
  const { placeName, supplyCount, boundaryCount } = input
  if (supplyCount == null || boundaryCount == null || supplyCount === boundaryCount) return null
  return `The months of supply above is worked out on ${supplyCount.toLocaleString('en-US')} homes, the detached houses our market data assigns to ${placeName}. This count is every single-family home for sale inside the ${placeName} boundary, which comes to ${boundaryCount.toLocaleString('en-US')}.`
}
