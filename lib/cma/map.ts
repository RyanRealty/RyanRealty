/**
 * CMA comp-location map — Google Static Maps rendered at BUILD time and
 * embedded in the stored HTML as a data URI. Self-contained: no per-slug
 * proxy route, no API key in the client-facing document, and the PDF renderer
 * needs no network hop.
 *
 * Reuses the styled URL builder from lib/cma-map.ts (the legacy per-slug
 * registry stays for the file-based CMAs).
 */

import { getBoundaryGeoJSON } from '@/lib/data'
import { buildGoogleStaticMapUrl, type CmaMapPoint } from '@/lib/cma-map'
import { circlePath, pathParam, ringsFromGeometry } from '@/lib/cma/map-overlay'
import { describeCompSearch } from '@/lib/pricing/search-story'
import { slugify } from '@/lib/slug'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

export interface CmaMapResult {
  dataUri: string
  pointCount: number
}

async function subdivisionRings(subdivision: string | null | undefined) {
  const slug = subdivision?.trim() ? slugify(subdivision.trim()) : ''
  if (!slug) return []
  try {
    const geom = await getBoundaryGeoJSON({ geoType: 'subdivision', geoSlug: slug })
    return ringsFromGeometry(geom)
  } catch (e) {
    console.warn('[buildCmaMapDataUri] boundary', e instanceof Error ? e.message : String(e))
    return []
  }
}

/** Build the subject + comps map as a base64 PNG data URI. Null when the API
 *  key is missing or no coordinates are available. */
export async function buildCmaMapDataUri(
  subject: CmaSubject,
  comps: CmaComp[],
  opts: { tiersUsed?: string[] } = {},
): Promise<CmaMapResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return null
  const points: CmaMapPoint[] = []
  if (subject.latitude != null && subject.longitude != null) {
    points.push({ label: 'S', color: 'red', lat: subject.latitude, lng: subject.longitude })
  }
  comps.forEach((comp, i) => {
    if (comp.latitude != null && comp.longitude != null && i < 9) {
      points.push({ label: String(i + 1), color: '0x102742', lat: comp.latitude, lng: comp.longitude })
    }
  })
  if (points.length < 2) return null
  const story = describeCompSearch({ subdivision: subject.subdivision, tiersUsed: opts.tiersUsed ?? [] })
  const paths: string[] = []
  for (const ring of await subdivisionRings(subject.subdivision)) {
    const path = pathParam('0x102742CC', '0x10274222', ring)
    if (path) paths.push(path)
  }
  if (
    story.radiusMiles != null &&
    subject.latitude != null &&
    subject.longitude != null
  ) {
    const circle = pathParam(
      '0x10274299',
      '0x10274211',
      circlePath({ lat: subject.latitude, lng: subject.longitude }, story.radiusMiles),
    )
    if (circle) paths.push(circle)
  }
  try {
    const url = buildGoogleStaticMapUrl(points, apiKey, paths)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return { dataUri: `data:image/png;base64,${buf.toString('base64')}`, pointCount: points.length }
  } catch (e) {
    console.warn('[buildCmaMapDataUri]', e instanceof Error ? e.message : String(e))
    return null
  }
}
