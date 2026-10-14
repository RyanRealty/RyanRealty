/**
 * How many listing cards a public page may serialize into the served HTML.
 *
 * The homepage rails, the split-view seed, community homes, and the listing
 * gallery each used to dump the whole population (or 48 cards, or every
 * photograph) into the RSC flight. That is what pushed `/` to 493 KB,
 * `/communities/tetherow` to 710 KB, and `/homes-for-sale/bend` to 415 KB.
 * One page of 24 real cards stays in the document; the rest load after paint.
 */
export const SSR_GRID_PAGE = 24

/**
 * Community fold grid. Tetherow's 22 on-market homes already sat under
 * SSR_GRID_PAGE, so #527 never attached homesSrc and the same rows shipped
 * twice (grid HTML + PlaceSubdivisionMap RSC). Twelve photographed cards
 * is one fold; the map dials load the rest from GET /api/place/homes.
 */
export const COMMUNITY_SSR_GRID_PAGE = 12

/** Stable empty seed so the map client does not reserialize the fold grid. */
export const SSR_MAP_SEED_HOMES = [] as const

export function seedPage<T>(rows: readonly T[], cap: number = SSR_GRID_PAGE): T[] {
  return rows.slice(0, Math.max(0, cap))
}
