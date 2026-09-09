/**
 * The map of the sales that set the price, and its pins.
 *
 * tasteReview 2026-09-07, item 2: the map shipped as a single base64 `<img>`
 * with no pins, no image map, no canvas and no iframe, so "tap a sale row, its
 * pin pulses", "tap a pin, the row highlights and scrolls into view" and a
 * tappable pin at all were absent. A bitmap cannot answer a tap.
 *
 * So the TILE is the bitmap and the PINS are DOM, positioned from the centre
 * and zoom the tile was actually drawn at (`lib/cma/static-map-projection.ts`,
 * a pure tested function). Row and pin light each other through the same
 * `data-comp` / `data-pin` attributes the rest of chapter 3 already carries,
 * every pin is a real button with a 44px target, and the print letter renders
 * the same overlay still.
 *
 * The SVG fallback below is what a document with no map key gets: the same
 * pins, the same attributes, on a cream field with no basemap under them.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'
import { projectToImagePercent, type StaticMapView } from '@/lib/cma/static-map-projection'
import type { CmaMapPin } from '@/lib/cma/map'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

const W = 640
const H = 480
const PAD = 40

type Pt = { lat: number; lng: number }

function finitePoint(lat: number | null | undefined, lng: number | null | undefined): Pt | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function project(points: Pt[]): (p: Pt) => { x: number; y: number } {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const dLat = Math.max(maxLat - minLat, 0.002)
  const dLng = Math.max(maxLng - minLng, 0.002)
  return (p) => ({
    x: PAD + ((p.lng - minLng) / dLng) * (W - PAD * 2),
    y: PAD + ((maxLat - p.lat) / dLat) * (H - PAD * 2),
  })
}

/** What the map needs to draw its own pins over the tile it fetched. */
export type CompPinMapOverlay = {
  view: StaticMapView
  pins: readonly CmaMapPin[]
  /**
   * Whether the place outline was drawn on this tile.
   *
   * Undefined means the tile was built before the check existed (a stored
   * `mapDataUri` on an older row), and the caption keeps its hedge. False
   * means the outline was suppressed because it held neither the subject nor
   * any sale, and the caption says nothing about a boundary at all
   * (round-four class F, 19968).
   */
  boundaryShown?: boolean
}

/**
 * One pin. A BUTTON, because it does something; 44px of target around a 28px
 * mark, because a phone finger is not a mouse pointer (TASTE.md, 375px).
 */
function pinButton(input: {
  label: string
  key: string
  xPct: number
  yPct: number
  subject: boolean
}): string {
  return `<button type="button" class="pin-hit${input.subject ? ' is-subject' : ''}" data-comp="${esc(
    input.key,
  )}" data-pin="${esc(input.key)}" style="left:${input.xPct.toFixed(2)}%;top:${input.yPct.toFixed(
    2,
  )}%" aria-label="${esc(input.label)}"><span class="pin-dot" aria-hidden="true">${esc(
    input.subject ? '★' : input.key,
  )}</span></button>`
}

/**
 * Spread every knot of pins onto its own ring.
 *
 * Deterministic: a cluster's members are laid out at fixed angles around the
 * point they share, so the same document draws the same map every time. It
 * moves the MARK, never the underlying coordinate — the label still names the
 * address the row carries, and a reader can see that two sales sit together.
 */
function spreadClusters(
  points: readonly ({ xPct: number; yPct: number } | null)[],
): ({ xPct: number; yPct: number } | null)[] {
  // A pin dot is a fixed 28px (22px on a phone) on a map that renders between
  // about 340 and 1150 units wide, so "how far apart is far enough" cannot be
  // one percentage. NEAR is the width at which pins on the widest render still
  // touch; the ring is sized so the members of a cluster sit as far from each
  // other as that ring allows, and NOBODY is left at the centre — a member on
  // the point with the others around it is the pin that disappears.
  const NEAR = 3.6
  const out = points.map((p) => (p ? { xPct: p.xPct, yPct: p.yPct } : null))
  const clusters: number[][] = []
  points.forEach((p, i) => {
    if (!p) return
    const found = clusters.find((c) =>
      c.some((j) => {
        const q = points[j]!
        return Math.abs(q.xPct - p.xPct) < NEAR && Math.abs(q.yPct - p.yPct) < NEAR
      }),
    )
    if (found) found.push(i)
    else clusters.push([i])
  })
  for (const c of clusters) {
    if (c.length < 2) continue
    const cx = c.reduce((sum, i) => sum + points[i]!.xPct, 0) / c.length
    const cy = c.reduce((sum, i) => sum + points[i]!.yPct, 0) / c.length
    // Two pins sit either side of the point; more open the ring so adjacent
    // members stay a dot apart.
    const r = c.length === 2 ? 2.4 : (NEAR * 0.62) / Math.sin(Math.PI / c.length)
    c.forEach((i, k) => {
      const angle = (2 * Math.PI * k) / c.length - Math.PI / 2
      out[i] = {
        xPct: clamp(cx + Math.cos(angle) * r, 2, 98),
        yPct: clamp(cy + Math.sin(angle) * r, 3, 97),
      }
    })
  }
  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function renderCompPinMapHtml(
  subject: Pick<CmaSubject, 'streetAddress' | 'latitude' | 'longitude'>,
  comps: readonly Pick<CmaAdjustedComp, 'address' | 'latitude' | 'longitude'>[],
  mapDataUri?: string | null,
  alt = 'Comparable sales map',
  overlay?: CompPinMapOverlay | null,
): string {
  if (mapDataUri) {
    const img = `<img class="pin-map" src="${esc(mapDataUri)}" alt="${esc(alt)}" />`
    if (!overlay?.view) return img
    // The pins the tile was drawn FOR, so a nudged rooftop pin lands where the
    // tile expects it. `n` is null on the subject.
    //
    // Two sales at ONE address — two units of the same building, which the MLS
    // carries as two rows with identical coordinates — landed one pin exactly
    // on top of the other, so sale 2 was not on the map at all. Coincident pins
    // are spread onto a small ring around the point they share.
    const spread = spreadClusters(
      overlay.pins.map((pin) => projectToImagePercent({ lat: pin.lat, lng: pin.lng }, overlay.view, 2)),
    )
    const marks = overlay.pins
      .map((pin, pi) => {
        const at = spread[pi]
        if (!at) return ''
        if (pin.n == null) {
          return pinButton({
            label: `Your home, ${subject.streetAddress}`,
            key: 'subject',
            xPct: at.xPct,
            yPct: at.yPct,
            subject: true,
          })
        }
        const comp = comps[pin.n - 1]
        return pinButton({
          label: `${pin.n}. ${comp?.address ?? 'this sale'}`,
          key: String(pin.n),
          xPct: at.xPct,
          yPct: at.yPct,
          subject: false,
        })
      })
      .filter(Boolean)
      .join('\n      ')
    if (!marks) return img
    return `<div class="pin-map-frame">
      ${img}
      ${marks}
    </div>`
  }
  const subjectPt = finitePoint(subject.latitude, subject.longitude)
  const pins = comps
    .map((c, i) => {
      const pt = finitePoint(c.latitude, c.longitude)
      return pt ? { n: i + 1, address: c.address, pt } : null
    })
    .filter((p): p is { n: number; address: string; pt: Pt } => p != null)
  const points = [...(subjectPt ? [subjectPt] : []), ...pins.map((p) => p.pt)]
  if (points.length < 2) return ''
  const xy = project(points)
  const subjectMark = subjectPt
    ? (() => {
        const p = xy(subjectPt)
        return `<g class="pin-subject" data-pin="subject" data-comp="subject" tabindex="0" role="button" aria-label="${esc(
          `Your home, ${subject.streetAddress}`,
        )}">
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="transparent"/>
          <rect x="${(p.x - 9).toFixed(1)}" y="${(p.y - 9).toFixed(1)}" width="18" height="18" fill="#102742"/>
        </g>`
      })()
    : ''
  const saleMarks = pins
    .map((pin) => {
      const p = xy(pin.pt)
      return `<g class="pin-sale" data-pin="${pin.n}" data-comp="${pin.n}" tabindex="0" role="button" aria-label="${esc(
        `${pin.n}. ${pin.address}`,
      )}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="transparent"/>
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="#102742"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" fill="#faf8f4" font-size="12" font-weight="700">${pin.n}</text>
      </g>`
    })
    .join('')
  return `<svg class="pin-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="Comparable sales map">
    <rect width="${W}" height="${H}" fill="#faf8f4"/>
    ${subjectMark}
    ${saleMarks}
  </svg>`
}

export function renderCompPinMapScript(): string {
  return `(function(){
  function on(id){
    var nodes=document.querySelectorAll('[data-comp],[data-pin]')
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i]
      var key=el.getAttribute('data-comp')||el.getAttribute('data-pin')
      el.classList.toggle('is-on', key===id)
    }
  }
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-comp],[data-pin]'):null
    if(!t)return
    on(t.getAttribute('data-comp')||t.getAttribute('data-pin'))
  })
})();`
}
