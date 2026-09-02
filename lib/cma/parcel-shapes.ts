/**
 * The recorded lot under the subject, and the recorded lot under each
 * comparable, so a CMA can put them side by side.
 *
 * WHY THIS EXISTS. A comp grid compares living area to living area and calls
 * the land "0.34 acres" in a cell. That cell hides the thing a buyer reacts
 * to: shape. A quarter acre that is a usable square and a quarter acre that is
 * a flag lot behind two neighbours price differently, and no number in the
 * grid says which one you have. Drawing the recorded polygons at one shared
 * scale puts that difference in front of the reader.
 *
 * WHAT IT IS NOT. An assessor's tax map, not a survey — lib/data/geo/getTaxlots
 * exports the disclaimer every drawing surface must print, and this module
 * re-exports it so a caller cannot draw a line without it.
 *
 * ACREAGE IS REPORTED TWICE ON PURPOSE. The MLS figure is what the listing
 * agent typed; the parcel figure is measured off the recorded polygon on the
 * spheroid. When they disagree the document shows both and says so, because a
 * broker pricing on land needs to know the two records differ (CLAUDE.md §0).
 * Nothing here picks a winner.
 *
 * Every read fails open. A CMA has never waited on a lot line and does not
 * start now: no parcel simply means no parcel section.
 */
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

// getTaxlotsNear is imported DYNAMICALLY below, and nothing here re-exports
// from it: a static edge to the DAL would drag `server-only` and the Supabase
// client into every module that just wants the types or the drawing, which is
// what the pure renderer beside this file exists to avoid.

/** One drawn lot. `mlsAcres` is what the listing said; `acres` is measured. */
export type CmaParcel = {
  /** Null for the subject; otherwise the comp's 1-based number in the grid. */
  n: number | null
  label: string
  taxlot: string
  /** Measured off the recorded polygon at ingest, on the spheroid. */
  acres: number | null
  /** What the MLS row claimed, for the side-by-side. */
  mlsAcres: number | null
  /** Sale price, so the section can state price per recorded acre. */
  closePrice: number | null
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export type CmaParcelSet = {
  subject: CmaParcel
  comps: CmaParcel[]
  /** True when the subject's two acreage records differ by over a tenth. */
  disagrees: boolean
}

/**
 * A tight radius on purpose. The point came from the MLS row's own
 * coordinate, so the lot we want is the lot the point falls inside;
 * widening the search would start returning a neighbour to draw as if it
 * were the home.
 */
const RADIUS_M = 5

/** Beyond this the strip stops being readable, and the grid already has the rest. */
const MAX_COMPS = 8

type Located = { lat: number; lng: number }

function located(lat: number | null | undefined, lng: number | null | undefined): Located | null {
  if (lat == null || lng == null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  // 0,0 is the null island an empty coordinate column produces, not Oregon.
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

async function parcelAt(
  at: Located,
  meta: { n: number | null; label: string; mlsAcres: number | null; closePrice: number | null },
): Promise<CmaParcel | null> {
  const { getTaxlotsNear } = await import('@/lib/data/geo/getTaxlots')
  const lots = await getTaxlotsNear({ lat: at.lat, lng: at.lng, radiusMeters: RADIUS_M, maxLots: 1 })
  // isSubject means the point fell INSIDE this polygon. A lot that merely came
  // back within the radius is a neighbour, and drawing it under this address
  // would be a fabrication.
  const lot = lots.find((l) => l.isSubject)
  if (!lot) return null
  return {
    n: meta.n,
    label: meta.label,
    taxlot: lot.taxlot,
    acres: lot.acres,
    mlsAcres: meta.mlsAcres,
    closePrice: meta.closePrice,
    geometry: lot.geometry,
  }
}

/**
 * The subject's lot and its comps' lots. Returns null unless the SUBJECT has a
 * recorded lot: comps alone compare against nothing, and a strip that silently
 * omits the home it is about reads as if the home has no land.
 */
export async function resolveCmaParcels(input: {
  subject: Pick<CmaSubject, 'streetAddress' | 'latitude' | 'longitude' | 'lotAcres'>
  comps: readonly Pick<CmaAdjustedComp, 'address' | 'latitude' | 'longitude' | 'lotAcres' | 'closePrice'>[]
}): Promise<CmaParcelSet | null> {
  const at = located(input.subject.latitude, input.subject.longitude)
  if (!at) return null

  let subject: CmaParcel | null = null
  try {
    subject = await parcelAt(at, {
      n: null,
      label: input.subject.streetAddress,
      mlsAcres: input.subject.lotAcres ?? null,
      closePrice: null,
    })
  } catch {
    return null
  }
  if (!subject) return null

  // Comps in parallel, each failing on its own. One county read that times out
  // must not cost the whole strip.
  const wanted = input.comps.slice(0, MAX_COMPS)
  const settled = await Promise.allSettled(
    wanted.map((c, i) => {
      const cAt = located(c.latitude, c.longitude)
      if (!cAt) return Promise.resolve(null)
      return parcelAt(cAt, {
        n: i + 1,
        label: c.address,
        mlsAcres: c.lotAcres ?? null,
        closePrice: Number.isFinite(c.closePrice) ? c.closePrice : null,
      })
    }),
  )
  const comps = settled.flatMap((r) => (r.status === 'fulfilled' && r.value ? [r.value] : []))

  return { subject, comps, disagrees: acreageDisagrees(subject) }
}

/** The two records differ by more than a tenth of the smaller one. */
export function acreageDisagrees(p: Pick<CmaParcel, 'acres' | 'mlsAcres'>): boolean {
  const { acres, mlsAcres } = p
  if (acres == null || mlsAcres == null || acres <= 0 || mlsAcres <= 0) return false
  return Math.abs(acres - mlsAcres) / Math.min(acres, mlsAcres) > 0.1
}
