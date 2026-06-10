/**
 * Shared Google Maps Static map builder for the CMA producer.
 *
 * Used by:
 *   - app/api/maps/cma-<slug>/route.ts   (serves the map as image/png to the browser)
 *   - app/api/cma/[slug]/pdf/route.ts    (inlines the map as a data URI so puppeteer
 *                                         renders it without needing to make an HTTP
 *                                         call back through the Vercel SSO wall)
 *
 * Per-CMA coordinates currently hardcoded by slug. Once the second CMA exists,
 * generalize to read coordinates from public.cma_comps.
 */

export interface CmaMapPoint {
  label: string // single character or short string (Google Maps Static label limit: 1 alpha-num char per pin)
  color: string // 0xRRGGBB or named ('red', 'blue', etc.)
  lat: number
  lng: number
}

const SUBJECT_COLOR = 'red'
const COMP_COLOR = '0x102742'

/**
 * Per-CMA map registry. Add a new entry per CMA until we generalize to
 * a table-driven lookup.
 */
const CMA_MAPS: Record<string, CmaMapPoint[]> = {
  'cma-21042-robin': [
    { label: 'S', color: SUBJECT_COLOR, lat: 44.162857, lng: -121.271963 }, // 21042 Robin
    { label: '1', color: COMP_COLOR, lat: 44.169454, lng: -121.291765 }, // 65258 Old Bend Redmond
    { label: '2', color: COMP_COLOR, lat: 44.170781, lng: -121.270682 }, // 65299 85th
    { label: '3', color: COMP_COLOR, lat: 44.166815, lng: -121.274346 }, // 65195 85th
    { label: '4', color: COMP_COLOR, lat: 44.180663, lng: -121.258233 }, // 21305 Gift
    { label: '5', color: COMP_COLOR, lat: 44.169249, lng: -121.26827 }, // 65318 85th
    { label: '6', color: COMP_COLOR, lat: 44.182567, lng: -121.272298 }, // 21037 Gift
    { label: '7', color: COMP_COLOR, lat: 44.16127, lng: -121.264747 }, // 65030 78th
    { label: '8', color: COMP_COLOR, lat: 44.160531, lng: -121.281245 }, // 65025 92nd
  ],
  'cma-19496-tumalo-reservoir': [
    { label: 'S', color: SUBJECT_COLOR, lat: 44.138729, lng: -121.349064 }, // 19496 Tumalo Reservoir
    { label: '1', color: COMP_COLOR, lat: 44.129022, lng: -121.341007 }, // 64141 Tumalo Rim
    { label: '2', color: COMP_COLOR, lat: 44.160855, lng: -121.339668 }, // 65010 Gerking Market
    { label: '3', color: COMP_COLOR, lat: 44.133412, lng: -121.315301 }, // 64265 Old Bend Redmond
    { label: '4', color: COMP_COLOR, lat: 44.105719, lng: -121.370582 }, // 63510 Gold Spur
    { label: '5', color: COMP_COLOR, lat: 44.097956, lng: -121.369776 }, // 19083 Saddleback
  ],
  'cma-3735-eagle-usa': [
    { label: 'S', color: SUBJECT_COLOR, lat: 44.0903379, lng: -121.2531089 }, // 3735 Eagle Rd, subject — Google ROOFTOP geocode (the two MLS rows carry conflicting coords ~150m apart)
    { label: '1', color: COMP_COLOR, lat: 44.089903, lng: -121.253773 }, // 3714 NE Petrosa Ave, end-unit resale anchor
    { label: '2', color: COMP_COLOR, lat: 44.090239, lng: -121.252378 }, // 3731 Eagle Rd, interior resale next door
    { label: '3', color: COMP_COLOR, lat: 44.090079, lng: -121.253512 }, // 3723 Eagle Rd, interior resale Apr 2025
    { label: '4', color: COMP_COLOR, lat: 44.092226, lng: -121.249512 }, // 3808 NE Suchy St, new end unit
    { label: '5', color: COMP_COLOR, lat: 44.092243, lng: -121.250503 }, // 3093 NE Nipper Rd, new end unit
    { label: '6', color: COMP_COLOR, lat: 44.092123, lng: -121.249984 }, // 3806 NE Suchy St, new interior
    { label: '7', color: COMP_COLOR, lat: 44.09211, lng: -121.250704 }, // 3820 Eagle Rd, new interior
    { label: '8', color: COMP_COLOR, lat: 44.091867, lng: -121.250461 }, // 3812 Eagle Rd, new interior
  ],
  'cma-18705-tumalo-reservoir': [
    { label: 'S', color: SUBJECT_COLOR, lat: 44.132914, lng: -121.391158 }, // 18705 Tumalo Reservoir Rd, subject
    { label: '1', color: '0x1a6b3c',    lat: 44.132947, lng: -121.386319 }, // 18715 Tumalo Reservoir Rd, twin/anchor (0.2 mi, green)
    { label: '2', color: COMP_COLOR,    lat: 44.154660, lng: -121.363658 }, // 19155 Pinehurst, dry EFUTRB entitled
    { label: '3', color: COMP_COLOR,    lat: 44.051621, lng: -121.237722 }, // 21700 Bear Creek, no-entitlement floor
    { label: '4', color: COMP_COLOR,    lat: 44.155179, lng: -121.406321 }, // 64859 Collins Rd, irrigated check
    { label: '5', color: COMP_COLOR,    lat: 44.191341, lng: -121.286265 }, // 65799 93rd St, irrigated check (repeat sale)
    { label: '6', color: COMP_COLOR,    lat: 44.066552, lng: -121.158124 }, // 23250 Walker, irrigated low for east location
  ],
}

export function getCmaMapPoints(slug: string): CmaMapPoint[] | null {
  return CMA_MAPS[slug] ?? null
}

const STYLE_PARAMS: string[] = [
  'feature:poi|visibility:off',
  'feature:transit|visibility:off',
  'feature:landscape.natural|element:geometry|color:0xeae3d6',
  'feature:landscape.man_made|element:geometry|color:0xf2ebdd',
  'feature:water|element:geometry|color:0xd6dde1',
  'feature:road|element:geometry.stroke|color:0xc9c2b3',
  'feature:road|element:labels.text.fill|color:0x5b5b5b',
  'feature:administrative|element:labels.text.fill|color:0x102742',
  'feature:administrative.land_parcel|visibility:off',
]

export function buildGoogleStaticMapUrl(points: CmaMapPoint[], apiKey: string): string {
  const params = new URLSearchParams()
  params.set('size', '640x360')
  params.set('scale', '2') // → 1280×720 effective
  params.set('maptype', 'roadmap')
  for (const p of points) {
    params.append('markers', `color:${p.color}|label:${p.label}|size:mid|${p.lat},${p.lng}`)
  }
  for (const s of STYLE_PARAMS) {
    params.append('style', s)
  }
  params.set('key', apiKey)
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

/**
 * Fetch the static map for a CMA slug, returning the raw PNG buffer.
 * Returns null if the slug isn't registered or the env var is missing.
 */
export async function fetchCmaMapPngBuffer(slug: string): Promise<Buffer | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
  if (!apiKey) return null
  const points = getCmaMapPoints(slug)
  if (!points) return null
  const url = buildGoogleStaticMapUrl(points, apiKey)
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const arr = await res.arrayBuffer()
  return Buffer.from(arr)
}
