/**
 * Source line for nearby-homes instruments on parks, trails, venues, golf,
 * events, and schools.
 *
 * Fleet: the timeout fallback sentence printed next to live counts (Summit High
 * 342 homes, Tetherow 60, Smith Rock 11). Name the MLS pull. Mention a timeout
 * only when the nearby pull timed out. A genuine zero is not a timeout.
 */

export type NearbyListingsGrain = 'park' | 'trail' | 'venue' | 'course' | 'event' | 'school'

export function publishNearbyListingsSource(input: {
  grain: NearbyListingsGrain
  scope: string
  listingCount: number
  /** True only when the nearby pull timed out. A genuine zero is not a timeout. */
  timedOut?: boolean
}): string {
  const base = `active single-family listings (PropertyType A) ${input.scope}, from the MLS.`
  if (input.listingCount > 0) return base
  if (input.timedOut) {
    return `${base} A listings timeout renders this ${input.grain} with a zero count and lets ISR retry.`
  }
  return base
}
