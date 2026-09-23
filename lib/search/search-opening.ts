/**
 * How /homes-for-sale opens (Matt 2026-09-23).
 *
 * The bare, indexable /homes-for-sale opens as the SPLIT view (map + list)
 * framed on all of Central Oregon, newest first. Phones open on the LIST with
 * the map one tap away. It replaces UXLIVE-4 (2026-09-22), which made the bare
 * URL the regional list because the split camera was Bend-bounded and the page
 * read "471 homes in view" under a "Central Oregon homes for sale" title. The
 * camera is now CENTRAL_OREGON_BOUNDS and the population is the regional set,
 * so the split view says what the title says.
 *
 * Pure rules only (no server or DOM reads), so the page, the split view and
 * the gate share one definition and the unit tests pin it.
 */
import { CENTRAL_OREGON_BOUNDS } from '@/lib/map-constants'
import { bboxFromSearchParam, type MapBbox } from '@/lib/search/publish-map-bbox'

export type SearchView = 'split' | 'map' | 'list'

/** The view a /homes-for-sale URL without `?view=` renders. */
export const DEFAULT_SEARCH_VIEW: SearchView = 'split'

/**
 * Split-view cards per page, and the SSR seed of the regional frame. The server
 * renders this many list cards (real <a href> links, the ItemList source); the
 * rest of the frame's pins are read after hydration (see MapSearchView), so the
 * served HTML never carries the whole pin set.
 */
export const SPLIT_CARD_PAGE = 48

/** The place the regional frame names. Matches the page's H1 and title. */
export const REGIONAL_FRAME_LABEL = 'Central Oregon'

export function resolveSearchView(raw: string | null | undefined): {
  view: SearchView
  /** True when the URL asked for this view. */
  explicit: boolean
} {
  if (raw === 'split' || raw === 'map' || raw === 'list') return { view: raw, explicit: true }
  return { view: DEFAULT_SEARCH_VIEW, explicit: false }
}

/**
 * The pane a phone opens on. The server cannot see the viewport, so the split
 * view ships one markup and CSS decides by width: at lg and up both panes show;
 * below lg this pane fills the frame. The default URL opens phones on the list
 * (Matt 2026-09-23). A URL that asked for split or map keeps the map first, as
 * it always has.
 */
export function phoneOpeningPane(resolved: { view: SearchView; explicit: boolean }): 'list' | 'map' {
  if (!resolved.explicit) return 'list'
  return resolved.view === 'list' ? 'list' : 'map'
}

/**
 * Every URL param that names a geography. Any of them makes the search a place
 * search, which keeps its own camera (the place's boundary) and its own
 * population; the regional frame applies only when none is present. Superset of
 * components/search/geo-scope.ts GEO_SCOPE_KEYS, plus county, which stands the
 * DAL's service-area guard down (lib/data/listings/searchListingsAll.ts).
 */
export const PLACE_PARAM_KEYS = [
  'city',
  'subdivision',
  'neighborhood',
  'schoolDistrict',
  'postalCode',
  'county',
] as const

function present(value: string | null | undefined): boolean {
  return value != null && value.trim() !== ''
}

/**
 * True when this split render is the regional frame: no place, no camera from
 * the URL, no drawn area, and an on-market status. Its population is the
 * service-area set the list view counts (no bbox), its camera is
 * CENTRAL_OREGON_BOUNDS, and its first map settle writes no camera URL, so the
 * indexable URL stays bare and the count cannot drift to whatever the pixel
 * viewport happens to reach (at desktop widths a fit on this box opens near
 * zoom 8, which spans the coast to John Day).
 */
export function isRegionalSearchFrame(input: {
  view: SearchView
  params: Record<string, string | undefined>
}): boolean {
  const { view, params } = input
  if (view !== 'split') return false
  if (PLACE_PARAM_KEYS.some((key) => present(params[key]))) return false
  if (bboxFromSearchParam(params.bbox)) return false
  if (present(params.shapes) || present(params.poly)) return false
  if (params.status?.trim() === 'Sold') return false
  return true
}

/**
 * The opening camera, in order: the URL's own bbox (a reload or share of a
 * moved map), the place's recorded boundary, then all of Central Oregon. A
 * place search whose boundary read missed falls back to the region, never to
 * one city.
 */
export function resolveSearchCamera(input: {
  bboxParam: string | null | undefined
  placeBoundaryBbox: MapBbox | null
}): { bounds: MapBbox; source: 'url-bbox' | 'place-boundary' | 'central-oregon' } {
  const fromUrl = bboxFromSearchParam(input.bboxParam)
  if (fromUrl) return { bounds: fromUrl, source: 'url-bbox' }
  if (input.placeBoundaryBbox) return { bounds: input.placeBoundaryBbox, source: 'place-boundary' }
  return { bounds: { ...CENTRAL_OREGON_BOUNDS }, source: 'central-oregon' }
}
