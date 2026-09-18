/**
 * Place-homes Atlas hierarchy (SITE-128 rematch, 2026-09-18).
 *
 * One subject outline fills the frame. Child plats are selectable — they are
 * not drawn as twenty simultaneous outlines. Selecting a child zooms that
 * recorded ring until it fills the frame. Homes stay on the current-place map.
 *
 * Do not replace V3Atlas with a Google tile. Thick navy outline + pins +
 * photo cards is the first look that has to stand next to Zillow / Compass.
 */
import { bboxOfRings, outerRings } from '@/lib/geo/project-svg'

export type HierarchyRegion = {
  id: string
  kind: 'town' | 'community' | 'neighborhood'
  kindLabel?: string
  name: string
  href: string
  geometry: GeoJSON.Geometry
}

/** Visible pad around a subject / selected-child ring. 0.6 left the plat a speck. */
export const SUBJECT_FRAME_PAD = 0.12

export const FIRST_LOOK_PHOTO_CAP = 6

export type HierarchyPhotoCard = {
  href: string
  photo: string
  price: string | null
  street: string
}

export type OpeningListingLike = {
  href?: string | null
  photoSrc?: string | null
  title?: string | null
  price?: string | null
}

export type OpeningBucketLike = {
  key?: string
  listings?: readonly OpeningListingLike[]
}

export function foldSubjectRegions<T extends HierarchyRegion>(regions: readonly T[]): T[] {
  return regions.filter((r) => r.kind === 'town')
}

export function foldChildRegions<T extends HierarchyRegion>(regions: readonly T[]): T[] {
  return regions.filter((r) => r.kind !== 'town')
}

export function subjectAsTown<T extends HierarchyRegion>(region: T): T {
  return region.kind === 'town' ? region : { ...region, kind: 'town' }
}

export function hierarchyPaint<T extends HierarchyRegion>(input: {
  subject: readonly T[]
  children?: readonly T[]
  selectedChildId?: string | null
}): { regions: T[]; frame: GeoJSON.Geometry | null; framePad: number } {
  const children = input.children ?? []
  const selected =
    input.selectedChildId != null
      ? children.find((r) => r.id === input.selectedChildId) ?? null
      : null
  if (selected) {
    return {
      regions: [subjectAsTown(selected)],
      frame: selected.geometry,
      framePad: SUBJECT_FRAME_PAD,
    }
  }
  const subject = foldSubjectRegions(input.subject)
  const one = subject[0] ?? null
  return {
    regions: subject,
    frame: one?.geometry ?? null,
    framePad: SUBJECT_FRAME_PAD,
  }
}

export function photoCardsFromOpening(
  buckets: readonly OpeningBucketLike[] | null | undefined,
  cap = FIRST_LOOK_PHOTO_CAP,
): HierarchyPhotoCard[] {
  if (!buckets || buckets.length === 0) return []
  const houses = buckets.find((b) => b.key === 'houses')?.listings ?? []
  const rest = buckets.flatMap((b) => (b.key === 'houses' ? [] : (b.listings ?? [])))
  const out: HierarchyPhotoCard[] = []
  const seen = new Set<string>()
  for (const row of [...houses, ...rest]) {
    const href = row.href?.trim()
    const photo = row.photoSrc?.trim()
    const street = row.title?.trim()
    if (!href || !photo || !street || seen.has(href)) continue
    seen.add(href)
    out.push({
      href,
      photo,
      street,
      price: row.price?.trim() || null,
    })
    if (out.length >= cap) break
  }
  return out
}

/** Recorded ring large enough to draw as the one place outline. */
export function hasDrawableRing(geometry: GeoJSON.Geometry | null | undefined): boolean {
  const rings = outerRings(geometry)
  return bboxOfRings(rings) != null && rings.length > 0
}
