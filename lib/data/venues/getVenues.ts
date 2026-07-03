/**
 * getVenues — the Central Oregon venues registry, grouped for the hub.
 *
 * Pure registry read (data/co-venues.ts) — no DB query. The hub shows live-music
 * venues and theater / performing-arts venues, each linking to its detail page
 * (which links out to the venue's own live calendar). All data is verified +
 * cited (CLAUDE.md §0).
 *
 * Lives behind the DAL boundary so pages import from @/lib/data only (Gate G8).
 */

import { CO_VENUES, type CoVenue } from '@/data/co-venues'

export type VenuesIndex = {
  /** Venues that primarily host live music (kind music or both). */
  music: CoVenue[]
  /** Venues that primarily host theater / performing arts (kind performing-arts or both). */
  performingArts: CoVenue[]
}

/**
 * Split the registry into the hub's two sections. A `both` venue appears in each
 * section (it genuinely hosts both). Within a section, venues sort by city then
 * name for a stable, scannable order.
 */
export function getVenuesForIndex(): VenuesIndex {
  const byCityName = (a: CoVenue, b: CoVenue) =>
    a.city.localeCompare(b.city) || a.name.localeCompare(b.name)

  return {
    music: CO_VENUES.filter((v) => v.kind === 'music' || v.kind === 'both').sort(byCityName),
    performingArts: CO_VENUES.filter(
      (v) => v.kind === 'performing-arts' || v.kind === 'both',
    ).sort(byCityName),
  }
}

/** Total count of venues in the registry (for the hub intro). */
export function getVenuesCount(): number {
  return CO_VENUES.length
}
