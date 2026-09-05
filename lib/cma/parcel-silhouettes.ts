/**
 * The subject's lot and its comps' lots, drawn as silhouettes at ONE shared
 * scale.
 *
 * The shared scale is the whole point. Every parcel viewer on the internet
 * draws one lot fit to one frame, which makes a tenth of an acre and ten acres
 * the same size on screen and tells a reader nothing. Here the biggest lot sets
 * the scale and the rest are drawn against it, so a comp on twice the land
 * looks like twice the land.
 *
 * When the spread is too wide for that to work — a five-acre comp beside four
 * quarter-acre lots leaves the quarter acres four pixels across — the strip
 * says so in words and draws each lot to its own scale instead. It never
 * silently switches: a reader who thinks they are comparing sizes and is not
 * has been misled, which §0 does not allow.
 *
 * Pure SVG, no dependency, no network. Print and web share it, like the pin
 * map beside it.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'
import type { CmaParcel, CmaParcelSet } from '@/lib/cma/parcel-shapes'
import { acreageDisagrees } from '@/lib/cma/parcel-shapes'

const esc = escapeHtml

const TILE = 148
const PAD = 10
const INNER = TILE - PAD * 2

/**
 * Beyond this ratio a shared scale hides the small lots instead of comparing
 * them. Four, not ten: the biggest lot fills the tile, so at ten-to-one the
 * smallest draws about thirteen pixels across, which is a dot, not a shape.
 * At four-to-one it still reads as a lot.
 */
const MAX_SPREAD = 4

const M_PER_DEG_LAT = 111_320
const FT_PER_M = 3.280839895

type XY = { x: number; y: number }

/** Every ring in a polygon or multipolygon, outers and holes alike. */
function ringsOf(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): number[][][] {
  return g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()
}

/**
 * Degrees to metres about the shape's own centre. Equirectangular is exact
 * enough at parcel size — a 300ft lot spans about 0.001°, where the error is
 * under a centimetre.
 */
function toMetres(g: GeoJSON.Polygon | GeoJSON.MultiPolygon): { rings: XY[][]; span: number } | null {
  const rings = ringsOf(g).filter((r) => Array.isArray(r) && r.length >= 4)
  if (rings.length === 0) return null

  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const r of rings) {
    for (const p of r) {
      const [lng, lat] = p
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  if (!Number.isFinite(minLng) || !Number.isFinite(minLat)) return null

  const midLat = (minLat + maxLat) / 2
  const midLng = (minLng + maxLng) / 2
  const mPerLng = M_PER_DEG_LAT * Math.cos((midLat * Math.PI) / 180)

  const out = rings.map((r) =>
    r
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map((p) => ({
        x: (p[0]! - midLng) * mPerLng,
        // North up: latitude grows upward, SVG y grows downward.
        y: -(p[1]! - midLat) * M_PER_DEG_LAT,
      })),
  )
  const w = (maxLng - minLng) * mPerLng
  const h = (maxLat - minLat) * M_PER_DEG_LAT
  const span = Math.max(w, h)
  if (!(span > 0)) return null
  return { rings: out, span }
}

function pathFor(rings: XY[][], pxPerM: number): string {
  const c = TILE / 2
  return rings
    .map(
      (r) =>
        r
          .map((p, i) => `${i === 0 ? 'M' : 'L'}${(c + p.x * pxPerM).toFixed(1)},${(c + p.y * pxPerM).toFixed(1)}`)
          .join(' ') + ' Z',
    )
    .join(' ')
}

function acresText(p: CmaParcel): string {
  if (p.acres == null) return 'acreage not recorded'
  return `${p.acres.toFixed(2)} acres`
}

/**
 * Close price over the RECORDED acreage. Never over the MLS figure.
 *
 * Shown only on an acreage comp set. On a street of eighth-acre lots the
 * arithmetic is still right and still useless: "$2.0M an acre" for a $900K
 * house is a fact about the house, not the land, and printing it next to a lot
 * outline invites a reader to price land with it. The set has to be about land
 * before the figure earns its place.
 */
const ACREAGE_SET_MEDIAN = 1

function perAcre(p: CmaParcel): string | null {
  if (p.closePrice == null || p.acres == null || p.acres <= 0) return null
  const v = p.closePrice / p.acres
  if (!Number.isFinite(v)) return null
  const rounded = v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : `$${Math.round(v / 1000)}K`
  return `${rounded} an acre`
}

/** True when this is an acreage comp set rather than a street of house lots. */
function isAcreageSet(parcels: readonly CmaParcel[]): boolean {
  const acres = parcels.map((p) => p.acres).filter((a): a is number => a != null && a > 0).sort((a, b) => a - b)
  if (acres.length === 0) return false
  return acres[Math.floor(acres.length / 2)]! >= ACREAGE_SET_MEDIAN
}

/** A round bar length in feet that lands near two fifths of a tile. */
function scaleBar(pxPerM: number): { px: number; label: string } | null {
  const targetFt = ((INNER * 0.4) / pxPerM) * FT_PER_M
  if (!Number.isFinite(targetFt) || targetFt <= 0) return null
  const steps = [10, 20, 25, 50, 100, 150, 200, 250, 400, 500, 800, 1000, 1500, 2000, 3000, 5000]
  const ft = steps.reduce((best, s) => (Math.abs(s - targetFt) < Math.abs(best - targetFt) ? s : best), steps[0]!)
  const px = (ft / FT_PER_M) * pxPerM
  if (!(px > 8)) return null
  return { px, label: `${ft} ft` }
}

function tile(
  p: CmaParcel,
  shape: { rings: XY[][]; span: number },
  pxPerM: number,
  isSubject: boolean,
  showPerAcre: boolean,
): string {
  const cls = isSubject ? 'lot-tile is-subject' : 'lot-tile'
  // Set in type, not in a capsule. "Sale 3" rather than a bare "3", because
  // without the pill behind it a lone digit runs into the street number.
  const badge = isSubject ? 'Subject' : p.n != null ? `Sale ${p.n}` : 'Sale'
  const money = showPerAcre ? perAcre(p) : null
  const disagrees = acreageDisagrees(p)
  return `<figure class="${cls}" data-comp="${isSubject ? 'subject' : String(p.n ?? '')}">
    <svg viewBox="0 0 ${TILE} ${TILE}" role="img" aria-label="${esc(`${p.label}, ${acresText(p)}`)}">
      <rect width="${TILE}" height="${TILE}" fill="#faf8f4"/>
      <path d="${pathFor(shape.rings, pxPerM)}" fill="${isSubject ? 'rgba(16,39,66,0.16)' : 'rgba(16,39,66,0.05)'}" stroke="#102742" stroke-width="${isSubject ? 2 : 1.1}" stroke-linejoin="round" fill-rule="evenodd"/>
    </svg>
    <figcaption>
      <span class="lot-badge">${esc(badge)}</span>
      <span class="lot-addr">${esc(p.label)}</span>
      <span class="lot-acres">${esc(acresText(p))}${disagrees ? ' <abbr title="The MLS listing and the county record disagree on this lot size.">·&nbsp;MLS says ' + (p.mlsAcres ?? 0).toFixed(2) + '</abbr>' : ''}</span>
      ${money ? `<span class="lot-ppa">${esc(money)}</span>` : ''}
    </figcaption>
  </figure>`
}

/**
 * The strip. Returns '' when there is nothing honest to draw — one lot on its
 * own compares against nothing, so the section does not appear.
 */
export function renderParcelSilhouettesHtml(set: CmaParcelSet | null): string {
  if (!set) return ''
  const entries = [
    { p: set.subject, isSubject: true },
    ...set.comps.map((p) => ({ p, isSubject: false })),
  ]
  const shaped = entries.flatMap((e) => {
    const shape = toMetres(e.p.geometry)
    return shape ? [{ ...e, shape }] : []
  })
  if (shaped.length < 2) return ''

  const spans = shaped.map((s) => s.shape.span).sort((a, b) => a - b)
  const largest = spans[spans.length - 1]!
  const median = spans[Math.floor(spans.length / 2)]!
  const shared = largest / median <= MAX_SPREAD

  const sharedPxPerM = INNER / largest
  const bar = shared ? scaleBar(sharedPxPerM) : null

  const showPerAcre = isAcreageSet(shaped.map((s) => s.p))
  const tiles = shaped
    .map((s) => tile(s.p, s.shape, shared ? sharedPxPerM : INNER / s.shape.span, s.isSubject, showPerAcre))
    .join('')

  const note = shared
    ? 'Every lot below is drawn at the same scale.'
    : 'Each lot is drawn to fit its own frame.'

  const barSvg = bar
    ? `<svg class="lot-scale" viewBox="0 0 ${TILE} 18" role="img" aria-label="${esc(`Scale bar: ${bar.label}`)}">
        <line x1="4" y1="9" x2="${(4 + bar.px).toFixed(1)}" y2="9" stroke="#102742" stroke-width="2"/>
        <line x1="4" y1="4" x2="4" y2="14" stroke="#102742" stroke-width="2"/>
        <line x1="${(4 + bar.px).toFixed(1)}" y1="4" x2="${(4 + bar.px).toFixed(1)}" y2="14" stroke="#102742" stroke-width="2"/>
        <text x="${(8 + bar.px).toFixed(1)}" y="13" font-size="10" fill="#102742">${esc(bar.label)}</text>
      </svg>`
    : ''

  return `<p>${esc(note)}</p>
  <div class="lot-strip">${tiles}</div>
  ${barSvg}`
}
