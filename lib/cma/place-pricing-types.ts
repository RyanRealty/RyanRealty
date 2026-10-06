/**
 * Twelve-month pricing story for the parent neighborhood or community.
 *
 * Every count is distinct homes, keyed by a normalized street address.
 * Null means the MLS did not record the figure. Zero means it recorded none.
 * A renderer must not invent a concession, a price cut, or a speed claim
 * from a null, and must not print a median from fewer than five homes.
 */

export type PlacePricingStory = {
  placeName: string
  placeKind: 'neighborhood' | 'community'
  windowMonths: 12
  /** ISO date (YYYY-MM-DD) the window was measured through. */
  asOf: string
  /** Homes listed in the window, any later status. */
  listedHomes: number
  /** Of those, homes that came off Expired, Canceled, or Withdrawn and did not close. */
  didNotSell: number
  /** Of listedHomes, homes whose list price ended under the original ask. */
  droppedPrice: number
  /**
   * Median (originalList - listPrice) / originalList among homes that dropped.
   * A share from 0 to 1. Null when droppedPrice is under 5.
   */
  typicalCutShare: number | null
  /** Of listedHomes, homes with a stored concession above zero. Null is not zero. */
  gaveConcessions: number
  /**
   * Median concession / list price among those homes.
   * Null when gaveConcessions is under 5.
   */
  typicalConcessionShare: number | null
  /** Closed sales that held the original ask, with a recorded days_to_pending. */
  heldAskCount: number
  /** Median days to an offer. Null when heldAskCount is under 5. */
  heldAskMedianDays: number | null
  /** Closed sales that cut the price, with a recorded days_to_pending. */
  cutPriceCount: number
  /** Median days to an offer. Null when cutPriceCount is under 5. */
  cutPriceMedianDays: number | null
  /**
   * One sentence a reader can audit: place, product, date window, and row
   * count. No owner names. No em dash.
   */
  sourceNote: string
}
