/**
 * PlaceTypeAtlasSection — the map on a place-type page, guaranteed.
 *
 * THE BUG THIS REPLACES. Both place-type routes used to read their boundary in
 * the page body, inside the same `Promise.all` as everything else, and then
 * render `atlasRegions.length > 0 ? <V3Atlas/> : null`. Two consequences, both
 * shipped:
 *
 *   1. The boundary read is guarded (`withTimeoutFallback`), so a read that did
 *      not come back in budget produced a null polygon, an empty region list,
 *      and NO SECTION — silently. The taste table's 1440 capture of
 *      /communities/tetherow/types/single-family had no map at all while the
 *      375 capture of the same URL did. The page's differentiator was a race
 *      outcome.
 *   2. Because the read sat in the shell's own await, every reader paid its
 *      latency before seeing anything.
 *
 * Both are fixed by moving the read here and rendering this inside a Suspense
 * boundary. The shell — breadcrumb, H1, the claim sentence, the list — ships
 * immediately with PlaceTypeAtlasStandin holding the map's footprint; the map
 * replaces it when the read lands. The budget can therefore be generous
 * (9s) instead of the 4.5s a blocking read had to accept, which is the other
 * half of "never a race outcome".
 *
 * And the third branch is a placeholder, never absence: a read that genuinely
 * misses renders the standin's `unavailable` state, which keeps the section,
 * says so in a sentence, and points at the place's own map. `noStore()` on that
 * branch stops ISR persisting a mapless render for the revalidate window
 * (memory: reference_isr_caches_empty_fallback — /price-drops shipped "0 price
 * drops" for 30 minutes at a time on exactly this shape).
 */
import Link from 'next/link'
import { unstable_noStore as noStore } from 'next/cache'
import {
  getBoundaryGeoJSON,
  getCityBoundaryGeoJSON,
  getResortBoundaryGeoJSON,
} from '@/lib/data'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS } from '@/lib/atlas/build-place-atlas'
import { basemapForRegions } from '@/lib/geo/basemap-source'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import {
  asPlaceBoundary,
  atlasViewForType,
  type PlaceTypePageSpec,
} from '@/lib/place/place-type-page'
import { v3Text, type AtlasRegion } from '@/components/site/v3'
import { PlaceTypeAtlas } from './PlaceTypeField.client'
import { PlaceTypeAtlasStandin } from './PlaceTypeAtlasStandin'

/**
 * How this page's polygon is found. A descriptor rather than a callback: a
 * server component may not take a function prop across the boundary, and the
 * two routes disagree only about which reads to try.
 */
export type PlaceTypeBoundarySource =
  | { kind: 'city'; geoSlug: string; cityName: string }
  | {
      kind: 'community'
      /** Registry slug — the resort's own recorded outline is tried first. */
      geoSlug: string
      /** The polygon the page already read for its pins, when it trusts it. */
      stored: GeoJSON.Geometry | null
    }

/** The budget a STREAMED read can afford. A blocking one could not. */
const BOUNDARY_MS = 9000
const ATLAS_MS = 9000

async function resolveBoundary(source: PlaceTypeBoundarySource): Promise<GeoJSON.Geometry | null> {
  if (source.kind === 'community') {
    const resort = await withTimeoutFallback(
      getResortBoundaryGeoJSON(source.geoSlug),
      null,
      BOUNDARY_MS,
      'place-type:resortBoundary',
    )
    return asPlaceBoundary(resort) ?? source.stored
  }
  const [recorded, fallback] = await Promise.all([
    withTimeoutFallback(
      getBoundaryGeoJSON({ geoType: 'city', geoSlug: source.geoSlug }),
      null,
      BOUNDARY_MS,
      'place-type:cityBoundary',
    ),
    withTimeoutFallback(
      getCityBoundaryGeoJSON(source.cityName),
      null,
      BOUNDARY_MS,
      'place-type:cityBoundaryFallback',
    ),
  ])
  return asPlaceBoundary(recorded) ?? asPlaceBoundary(fallback)
}

export type PlaceTypeAtlasSectionProps = {
  id: string
  /** The Atlas's label, set as an eyebrow because the page H1 is right above. */
  eyebrow: string
  placeName: string
  placeHref: string
  /** MLS city names the atlas population is read from. */
  cities: readonly string[]
  spec: PlaceTypePageSpec
  region: Pick<AtlasRegion, 'id' | 'kind' | 'kindLabel' | 'name' | 'href'>
  source: PlaceTypeBoundarySource
  /**
   * The measured count, for the rail's next action. Null omits the figure and
   * keeps the door — a miss is not a reason to strand the reader.
   */
  listingsCount: number | null
}

export async function PlaceTypeAtlasSection({
  id,
  eyebrow,
  placeName,
  placeHref,
  cities,
  spec,
  region,
  source,
  listingsCount,
}: PlaceTypeAtlasSectionProps) {
  const boundary = await resolveBoundary(source)
  if (!boundary) {
    // Unknown is not empty: do not let the full-route cache keep this render.
    noStore()
    return (
      <PlaceTypeAtlasStandin
        id={id}
        eyebrow={eyebrow}
        placeName={placeName}
        state="unavailable"
        placeHref={placeHref}
      />
    )
  }

  const atlas = await withTimeoutFallback(
    buildPlaceAtlas({ cities: [...cities], boundary, label: placeName }),
    null,
    ATLAS_MS,
    'place-type:atlas',
  )
  const atlasView = atlas ?? EMPTY_PLACE_ATLAS
  const typedAtlas = atlasViewForType(atlasView, spec.atlasDotType)
  const regions: AtlasRegion[] = [{ ...region, geometry: boundary }]

  return (
    <PlaceTypeAtlas
      id={id}
      className="place-type-atlas"
      headingLevel={2}
      headlineTone="eyebrow"
      headline={v3Text(eyebrow)}
      dots={typedAtlas.dots}
      regions={regions}
      basemap={basemapForRegions(regions)}
      types={typedAtlas.types}
      events={atlasView.events}
      source={atlasView.source}
      stamp={atlasView.stamp}
      incomplete={!atlasView.complete}
      noun={{ one: spec.nounOne, many: spec.nounMany }}
    >
      {/* THE WAY ON, in the rail's own column.
          The rail ran out of content while the map kept going, and the fold
          offered no next step at either width — "the filtered result set
          dead-ends without a next action" (evaluator round three,
          place-type-community, major). Two doors: the list this page is about,
          and a person. */}
      <p className="place-type-next">
        <Link href="#homes" className="place-type-next__door">
          {listingsCount != null && listingsCount > 0
            ? `See the ${listingsCount.toLocaleString('en-US')} ${listingsCount === 1 ? spec.nounOne : spec.nounMany}`
            : `See the ${spec.nounMany}`}
        </Link>
        <Link href="/contact" className="place-type-next__door">
          Talk to a broker about {placeName}
        </Link>
      </p>
    </PlaceTypeAtlas>
  )
}
