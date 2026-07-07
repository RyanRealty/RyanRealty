/**
 * CMA comp-location map — Google Static Maps rendered at BUILD time and
 * embedded in the stored HTML as a data URI. Self-contained: no per-slug
 * proxy route, no API key in the client-facing document, and the PDF renderer
 * needs no network hop.
 *
 * Reuses the styled URL builder from lib/cma-map.ts (the legacy per-slug
 * registry stays for the file-based CMAs).
 */

import { buildGoogleStaticMapUrl, type CmaMapPoint } from '@/lib/cma-map'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'

export interface CmaMapResult {
  dataUri: string
  pointCount: number
}

/** Build the subject + comps map as a base64 PNG data URI. Null when the API
 *  key is missing or no coordinates are available. */
export async function buildCmaMapDataUri(
  subject: CmaSubject,
  comps: CmaComp[],
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
  try {
    const url = buildGoogleStaticMapUrl(points, apiKey)
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return { dataUri: `data:image/png;base64,${buf.toString('base64')}`, pointCount: points.length }
  } catch (e) {
    console.warn('[buildCmaMapDataUri]', e instanceof Error ? e.message : String(e))
    return null
  }
}
