/**
 * The one map, and its pins.
 *
 * tasteReview 2026-09-07, item 2: the map shipped as a single base64 `<img>`
 * with no pins, no image map, no canvas and no iframe, so "tap a sale row, its
 * pin pulses", "tap a pin, the row highlights and scrolls into view" and a
 * tappable pin at all were absent. A bitmap cannot answer a tap.
 *
 * So the TILE is the bitmap and the PINS are DOM, positioned from the centre
 * and zoom the tile was actually drawn at (`lib/cma/static-map-projection.ts`,
 * a pure tested function). Row and pin light each other through the same
 * `data-comp` / `data-pin` attributes the matrices carry, every pin is a real
 * button with a 44px target, and the print letter renders the same overlay.
 *
 * DELTA 3, 2026-09-08 — THREE FAMILIES, ONE MAP. Matt: "these are the ones
 * that closed, this is where we're getting our number from; these are the ones
 * that are active in this market right now; these are the ones that expired or
 * canceled. We always have to be able to tell the tale of how long they've
 * been on the market and how many price changes they've had."
 *
 * So a pin is filled and numbered when the sale closed, hollow and lettered
 * when the home is for sale or under contract, barred and roman when the
 * listing came off unsold; the subject is a star; and every pin reveals the
 * same three facts on tap and on hover — days on market, how many times the
 * price changed, and the outcome line. The legend names the three families in
 * the words the three matrices use.
 *
 * The SVG fallback below is what a document with no map key gets: the same
 * pins, the same attributes, on a cream field with no basemap under them.
 */

import { escapeHtml, int } from '@/lib/cma/render-blocks'
import { projectToImagePercent, type StaticMapView } from '@/lib/cma/static-map-projection'
import { FAMILY_LABEL, type CmaMapFamily } from '@/lib/cma/map-families'
import type { CmaMapPin } from '@/lib/cma/map'

const esc = escapeHtml

const W = 640
const H = 480
const PAD = 40

type Pt = { lat: number; lng: number }

/**
 * Everything a pin says when a reader taps it, for one home.
 *
 * Composed by `lib/cma/comp-matrix.ts` off the same entry the matrix row is
 * drawn from, so the pin and the row cannot state a different number of days
 * or a different outcome.
 */
export type CmaPinFact = {
  key: string
  family: CmaMapFamily
  address: string
  /** "sold $457K · offer in 25 days" / "asking $417K · 13 days" */
  outcome: string
  domDays: number | null
  priceChanges: number | null
  latitude?: number | null
  longitude?: number | null
}

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
   * Whether the comp-area outline was drawn on this tile.
   *
   * Undefined means the tile was built before the check existed (a stored
   * `mapDataUri` on an older row), and the caption keeps its hedge. False
   * means the outline was suppressed because it held neither the subject nor
   * any mark, and the caption says nothing about a boundary at all
   * (round-four class F, 19968).
   */
  boundaryShown?: boolean
  /** Whether the search radius was drawn as a ring. */
  radiusShown?: boolean
}

/**
 * The days-and-cuts line every pin reveals. Never a bare number of days: the
 * document prints days-to-offer and days-on-market for the same home, so the
 * measure travels inside the outcome line the fact carries.
 */
export function pinRevealLine(fact: CmaPinFact): string {
  const bits: string[] = []
  if (fact.domDays != null && fact.domDays >= 0) {
    bits.push(`${int(fact.domDays)} ${fact.domDays === 1 ? 'day' : 'days'} on market`)
  }
  if (fact.priceChanges != null && fact.priceChanges >= 0) {
    bits.push(
      fact.priceChanges === 0
        ? 'no price changes'
        : `${int(fact.priceChanges)} price change${fact.priceChanges === 1 ? '' : 's'}`,
    )
  }
  return bits.join(' · ')
}

/** The whole pin, in words, for a screen reader and for the button's label. */
export function pinReading(fact: CmaPinFact): string {
  const line = pinRevealLine(fact)
  return [`${fact.key}. ${fact.address}`, fact.outcome, line].filter(Boolean).join(' — ')
}

/**
 * One pin. A BUTTON, because it does something; 44px of target around the
 * mark, because a phone finger is not a mouse pointer (TASTE.md, 375px).
 *
 * The reveal ships as DOM rather than a `title` attribute: a title is not
 * reachable by touch, and the whole point of Delta 3's pin is that a tap tells
 * the tale.
 */
function pinButton(input: {
  key: string
  glyph: string
  family: CmaMapFamily | 'subject'
  label: string
  reveal: string
  xPct: number
  yPct: number
}): string {
  return `<button type="button" class="pin-hit is-${esc(input.family)}" data-comp="${esc(input.key)}" data-pin="${esc(input.key)}" style="left:${input.xPct.toFixed(
    2,
  )}%;top:${input.yPct.toFixed(2)}%" aria-label="${esc(input.label)}"><span class="pin-dot" aria-hidden="true">${esc(
    input.glyph,
  )}</span>${input.reveal ? `<span class="pin-note" aria-hidden="true">${input.reveal}</span>` : ''}</button>`
}

/** The reveal card's markup. Address, outcome, days and price changes. */
function revealHtml(fact: CmaPinFact): string {
  const line = pinRevealLine(fact)
  return `<span class="pn-a">${esc(fact.address)}</span>${
    fact.outcome ? `<span class="pn-o">${esc(fact.outcome)}</span>` : ''
  }${line ? `<span class="pn-d">${esc(line)}</span>` : ''}`
}

/**
 * The legend, keyed to the three matrices.
 *
 * Only the families this document actually drew: a legend naming a set with
 * no pin on the map is the same defect as an outline containing nothing.
 */
export function pinLegendHtml(facts: readonly CmaPinFact[]): string {
  const present: CmaMapFamily[] = (['closed', 'active', 'unsold'] as const).filter((f) =>
    facts.some((x) => x.family === f),
  )
  if (present.length === 0) return ''
  const items = present
    .map(
      (f) =>
        `<li class="pl-i is-${f}"><span class="pl-k" aria-hidden="true">${esc(
          f === 'closed' ? '1' : f === 'active' ? 'A' : 'i',
        )}</span>${esc(FAMILY_LABEL[f])}</li>`,
    )
    .join('')
  return `<ul class="pin-legend"><li class="pl-i is-subject"><span class="pl-k" aria-hidden="true">★</span>Your home</li>${items}</ul>`
}

/**
 * Spread every knot of pins onto its own ring.
 *
 * Deterministic: a cluster's members are laid out at fixed angles around the
 * point they share, so the same document draws the same map every time. It
 * moves the MARK, never the underlying coordinate — the label still names the
 * address the row carries, and a reader can see that two homes sit together.
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

export type CompPinMapInput = {
  subject: { streetAddress: string; latitude?: number | null; longitude?: number | null }
  /** Every home on the map, in every family, keyed the way the matrices key it. */
  facts: readonly CmaPinFact[]
  mapDataUri?: string | null
  alt?: string
  overlay?: CompPinMapOverlay | null
}

export function renderCompPinMapHtml(input: CompPinMapInput): string {
  const { subject, facts, overlay } = input
  const alt = input.alt ?? 'Map of the sales, the competition and the listings that came off'
  const byKey = new Map(facts.map((f) => [f.key, f]))
  if (input.mapDataUri) {
    const img = `<img class="pin-map" src="${esc(input.mapDataUri)}" alt="${esc(alt)}" />`
    if (!overlay?.view) return img
    // The pins the tile was drawn FOR, so a nudged rooftop pin lands where the
    // tile expects it. `key` is null on the subject.
    //
    // Two homes at ONE address — two units of the same building, which the MLS
    // carries as two rows with identical coordinates — landed one pin exactly
    // on top of the other, so the second was not on the map at all. Coincident
    // pins are spread onto a small ring around the point they share.
    const spread = spreadClusters(
      overlay.pins.map((pin) => projectToImagePercent({ lat: pin.lat, lng: pin.lng }, overlay.view, 2)),
    )
    const marks = overlay.pins
      .map((pin, pi) => {
        const at = spread[pi]
        if (!at) return ''
        if (pin.key == null || pin.family === 'subject') {
          return pinButton({
            key: 'subject',
            glyph: '★',
            family: 'subject',
            label: `Your home, ${subject.streetAddress}`,
            reveal: `<span class="pn-a">Your home</span><span class="pn-o">${esc(
              subject.streetAddress,
            )}</span>`,
            xPct: at.xPct,
            yPct: at.yPct,
          })
        }
        const fact = byKey.get(pin.key)
        return pinButton({
          key: pin.key,
          glyph: pin.key,
          family: pin.family,
          label: fact ? pinReading(fact) : `${pin.key}. this home`,
          reveal: fact ? revealHtml(fact) : '',
          xPct: at.xPct,
          yPct: at.yPct,
        })
      })
      .filter(Boolean)
      .join('\n      ')
    if (!marks) return img
    return `<div class="pin-map-frame">
      ${img}
      ${marks}
    </div>
    ${pinLegendHtml(facts)}`
  }
  const subjectPt = finitePoint(subject.latitude, subject.longitude)
  const pins = facts
    .map((f) => {
      const pt = finitePoint(f.latitude, f.longitude)
      return pt ? { fact: f, pt } : null
    })
    .filter((p): p is { fact: CmaPinFact; pt: Pt } => p != null)
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
    .map(({ fact, pt }) => {
      const p = xy(pt)
      // Three glyphs, the same three the tile draws: filled for a sale that
      // closed, hollow for one on the market, a bar across one that came off.
      const filled = fact.family === 'closed'
      const body = filled
        ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="#102742"/>`
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="13" fill="#faf8f4" stroke="#102742" stroke-width="2"/>`
      const bar =
        fact.family === 'unsold'
          ? `<line x1="${(p.x - 16).toFixed(1)}" y1="${p.y.toFixed(1)}" x2="${(p.x + 16).toFixed(
              1,
            )}" y2="${p.y.toFixed(1)}" stroke="#102742" stroke-width="2"/>`
          : ''
      return `<g class="pin-sale is-${fact.family}" data-pin="${esc(fact.key)}" data-comp="${esc(
        fact.key,
      )}" tabindex="0" role="button" aria-label="${esc(pinReading(fact))}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="transparent"/>
        ${body}
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" fill="${
          filled ? '#faf8f4' : '#102742'
        }" font-size="12" font-weight="700">${esc(fact.key)}</text>
        ${bar}
      </g>`
    })
    .join('')
  return `<svg class="pin-map" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(alt)}">
    <rect width="${W}" height="${H}" fill="#faf8f4"/>
    ${subjectMark}
    ${saleMarks}
  </svg>
  ${pinLegendHtml(facts)}`
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
