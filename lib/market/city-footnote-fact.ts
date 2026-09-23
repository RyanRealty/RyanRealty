/**
 * Why a town has no row in a market table, said the way a person would say it
 * (VOICE-6, visibility audit 2026-09-22).
 *
 * Four builders (the hub, the city report, the region report and the annual
 * review) each wrote their own copy of the same machine sentences:
 * "Tumalo has no published active single-family count", "Sisters returned no
 * market row in the latest sync", "La Pine shows 12 active with no published
 * median". Those describe our pipeline, not the town. The facts are unchanged
 * here, one sentence each, and every number is the snapshot's own count.
 *
 * No reason is invented: when the data does not say WHY a figure is missing,
 * the sentence says only that we do not publish it.
 */
export type CityFootnoteSnapshot = {
  active_count: number | null
  median_list_price?: number | null
} | null | undefined

/** The term the footnote row sits under, shared so the four tables match. */
export const CITY_FOOTNOTE_TERM = 'Other towns we cover'

export function cityFootnoteFact(label: string, snapshot: CityFootnoteSnapshot): string {
  if (!snapshot) return `We don't have current market numbers for ${label}`
  if (snapshot.active_count == null) return `We don't publish a ${label} homes-for-sale count right now`
  if (snapshot.active_count === 0) return `${label} has no single-family homes for sale right now`
  const n = snapshot.active_count.toLocaleString('en-US')
  const homes = snapshot.active_count === 1 ? 'single-family home' : 'single-family homes'
  return `${label} has ${n} ${homes} for sale, and no median asking price we can publish`
}
