/**
 * The Atlas's server half (UXLIVE-3 / SEO-10 / DATA-5 / COMP-4, visibility
 * audit 2026-09-22): what a page hands V3Atlas so the server HTML carries the
 * counts, boundaries and text, and the heavy layers load after paint.
 *
 * MEASURED BEFORE (production, 2026-09-23, decoded HTML / atlas props in the
 * RSC payload):
 *   /about                    4,670,269 B / dots 2.0 MB + regions 1.09 MB
 *   /cities/bend              3,775,773 B / dots 594 KB + amenities 326 KB + plats 228 KB
 *   /cities/bend/awbrey-butte 2,013,723 B / plats 583 KB + basemap 93 KB + dots 50 KB
 *   /communities/tetherow       924,288 B / basemap 44 KB + plats 35 KB + dots 19 KB
 * and the server SVG drew the sales heat from those dots (the Atlas SVG was
 * 902 KB on Bend, 983 KB on /about). After, served by `next dev` on the same
 * data: Bend's Atlas props 146 KB and its SVG 100 KB; the page 1.9 MB lighter.
 *
 * WHAT THIS DOES, in order:
 *   1. Frames the map from the FULL population (the same atlasFrameBox the
 *      component runs), so a fit-to-dots map frames identically.
 *   2. Compacts every boundary, plat, park and trail to the precision that
 *      frame can draw (lib/atlas/compact-geometry.ts).
 *   3. Summarises the population over the COMPACTED shapes
 *      (summarizeAtlasDots): the counts, each place's count and median, the
 *      scrubber range. These are the numbers the server HTML prints.
 *   4. Replaces the dots with a URL the browser fetches after paint
 *      (app/api/atlas/dots), which reads the same cached population, and the
 *      basemap with a URL for the same clipped subset (app/api/atlas/basemap).
 *
 * A population that did not read completely, that has no dots, or whose scope
 * cannot be addressed exactly by URL keeps its dots inline: nothing is
 * deferred that the route could not reproduce.
 *
 * Server only (it runs on the page's render); pure apart from that.
 */
import 'server-only'
import type {
  AtlasAmenityLayers,
  AtlasDot,
  AtlasRegion,
  AtlasType,
} from '@/components/site/v3'
import type { AtlasPopulation } from '@/lib/atlas/build-place-atlas'
import { hashAtlasBoundary } from '@/lib/atlas/build-place-atlas'
import {
  atlasFrameBox,
  atlasShapeRings,
  summarizeAtlasDots,
  type AtlasDotSummary,
} from '@/lib/atlas/atlas-derive'
import { atlasDotsHref, type AtlasBoundaryRef } from '@/lib/atlas/atlas-dots-scope'
import { atlasBasemapHref, type AtlasBasemapFrame } from '@/lib/atlas/atlas-basemap-href'
import { atlasGeometryTolerance, compactAtlasGeometries } from '@/lib/atlas/compact-geometry'

export type DeferredAtlasInput = {
  /** The population the page built (buildPlaceAtlas). */
  population: Pick<AtlasPopulation, 'dots' | 'types' | 'complete'>
  /**
   * How the page scoped that population, as the dots route can rebuild it:
   * the MLS cities read and where the boundary came from. `boundary` is the
   * geometry the page passed to buildPlaceAtlas (its hash rides the URL).
   */
  scope: {
    cities: readonly string[]
    boundaryRef: AtlasBoundaryRef | null
    boundary: GeoJSON.Geometry | null
  }
  /** Exactly the arrays the page hands the Atlas, in the same order. */
  regions: readonly AtlasRegion[]
  childRegions?: readonly AtlasRegion[]
  amenities?: AtlasAmenityLayers | null
  /** The type toggles the Atlas renders (defaults to the population's). */
  types?: readonly AtlasType[]
  fit?: 'regions' | 'dots'
  frame?: GeoJSON.Geometry | null
  subjectGrain?: boolean
  /** The frame the basemap clips to (basemapFrameForRegions), or null for none. */
  basemapFrame?: AtlasBasemapFrame | null
  /** The read day, for the dots URL (the CDN entry turns over with it). */
  nowMs?: number
}

export type DeferredAtlasProps = {
  dots: readonly AtlasDot[]
  dotsSrc?: string
  dotsSummary?: AtlasDotSummary
  regions: AtlasRegion[]
  childRegions: AtlasRegion[]
  amenities: AtlasAmenityLayers | null
  basemapSrc?: string
}

export function deferredAtlasProps(input: DeferredAtlasInput): DeferredAtlasProps {
  const {
    population,
    scope,
    regions,
    childRegions = [],
    amenities = null,
    fit,
    frame,
    subjectGrain,
    basemapFrame = null,
    nowMs = Date.now(),
  } = input
  const types = input.types ?? population.types

  // 1. The frame, from the full population and full-precision shapes.
  const preliminary = atlasFrameBox({
    frame,
    subjectGrain,
    fit,
    dots: population.dots,
    shapes: atlasShapeRings([...regions, ...childRegions]),
  })

  // 2. Every geometry at the precision that frame can draw.
  const tolerance = atlasGeometryTolerance(preliminary)
  const slimRegions = compactAtlasGeometries(regions, tolerance)
  const slimChildren = compactAtlasGeometries(childRegions, tolerance)
  const slimAmenities: AtlasAmenityLayers | null = amenities
    ? {
        ...(amenities.parks ? { parks: compactAtlasGeometries(amenities.parks, tolerance) } : {}),
        ...(amenities.trails ? { trails: compactAtlasGeometries(amenities.trails, tolerance) } : {}),
      }
    : null

  const basemapSrc = atlasBasemapHref(basemapFrame) ?? undefined
  const dotsSrc =
    population.complete && population.dots.length > 0
      ? atlasDotsHref(
          { cities: scope.cities, boundary: scope.boundaryRef },
          {
            boundaryHash: hashAtlasBoundary(scope.boundary),
            day: new Date(nowMs).toISOString().slice(0, 10),
          },
        )
      : null
  // A scope with a boundary must name where it came from, or the route
  // cannot rebuild it: keep the dots inline.
  const addressable = dotsSrc != null && (scope.boundary == null) === (scope.boundaryRef == null)

  if (!addressable) {
    return {
      dots: population.dots,
      regions: slimRegions,
      childRegions: slimChildren,
      amenities: slimAmenities,
      ...(basemapSrc ? { basemapSrc } : {}),
    }
  }

  // 3. The figures the server HTML prints, over the shapes the browser gets.
  const dotsSummary = summarizeAtlasDots({
    dots: population.dots,
    regions: slimRegions,
    childRegions: slimChildren,
    types,
    fit,
    frame,
    subjectGrain,
  })

  return {
    dots: [],
    dotsSrc: dotsSrc!,
    dotsSummary,
    regions: slimRegions,
    childRegions: slimChildren,
    amenities: slimAmenities,
    ...(basemapSrc ? { basemapSrc } : {}),
  }
}
