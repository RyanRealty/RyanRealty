/**
 * The DESIGNATED Bend neighborhood rows for the city node's first place ledger (D83).
 *
 * WHY IT IS HERE AND NOT IN THE ROUTE FILE. ci:file-size-budget refuses any file under
 * app/ or lib/ at 600 lines and its instruction is to split rather than re-baseline
 * (migration-recipe.md section 5.1). The resort wiring stays in page.tsx on purpose:
 * ci:resort-definitions reads that one file for `resortActiveSfrCounts(slug,
 * resortTiles)`, `fetchAllCityActiveSfr`, `cityResorts(slug)` and `RESORT_IMG[`, and a
 * gate that stops finding its tokens stops protecting without saying so. Nothing below
 * fetches.
 *
 * ABSENT IS NOT ZERO, AND THE TEST IS WHETHER THE LEDGER READ ANSWERED (this route's
 * invariant 4). getBendNeighborhoodLedger omits a district with no active single-family
 * inventory by design, so while it returns rows an omitted district IS a measured zero.
 * But it is resilient-cached with a `[]` fallback and also returns `[]` when there is no
 * client, and on that render a `?? 0` printed "0 active" for all thirteen districts
 * under a live-MLS source line. An empty ledger is therefore unmeasured, and the ledger
 * drops the value for those rows instead of publishing a zero it cannot vouch for.
 */

import bendNeighborhoodPolygons from '@/data/bend/bend-neighborhood-polygons.json'
import { assignNeighborhoodPhotos } from '@/lib/kb/neighborhood-photos'
import type { CityPlaceItem } from './city-sections'

type BendPolygon = { slug: string; name?: string; geometry: { type: string; coordinates: unknown } }

/** One row of getBendNeighborhoodLedger, structurally. */
type LedgerRow = { label: string; activeCount: number; medianListPrice: number | null; href: string }

/** One tile as assignNeighborhoodPhotos reads it. */
type PhotoTile = {
  lat: number | null | undefined
  lng: number | null | undefined
  listPrice: number | null | undefined
  photoUrl: string | null | undefined
}

/**
 * @param isBend Bend is the only city with designated neighborhood polygons, so every
 *   other city gets an empty list and the ledger does not render.
 * @param communityImageByName a curated community banner keyed by lowercased name. A
 *   district with no match and no in-boundary listing photo renders with no photo at
 *   all, never a wrong-place one (D89).
 */
export function bendNeighborhoodPlaces(input: {
  isBend: boolean
  ledgerRows: readonly LedgerRow[]
  mapTiles: readonly PhotoTile[]
  communityImageByName: ReadonlyMap<string, string | null | undefined>
}): CityPlaceItem[] {
  const { isBend, ledgerRows, mapTiles, communityImageByName } = input
  const designated = (bendNeighborhoodPolygons.communities as BendPolygon[]).filter(
    (c) => isBend && c.slug.startsWith('bend-'),
  )
  const answered = ledgerRows.length > 0
  const photos = assignNeighborhoodPhotos(designated, [...mapTiles])
  const byHref = new Map(ledgerRows.map((r) => [r.href, r]))

  return designated.map((c) => {
    const nslug = c.slug.replace(/^bend-/, '')
    const href = `/cities/bend/${nslug}`
    const live = byHref.get(href)
    const title = nslug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    const name = live?.label ?? c.name ?? title
    return {
      name,
      href,
      activeCount: live?.activeCount ?? (answered ? 0 : null),
      medianPrice: live?.medianListPrice ?? null,
      img: communityImageByName.get(name.toLowerCase()) ?? photos.get(c.slug) ?? '',
    }
  })
}
