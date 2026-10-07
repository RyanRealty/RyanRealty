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
 * when the home is for sale or under contract, a dashed ring and roman when the
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
import {
  intoCrop,
  phoneCrop,
  relaxPins,
  type MapCrop,
  type PinPoint,
  type PlacedPin,
} from '@/lib/cma/pin-layout'
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
  /** False when the record says only THAT the price moved, not how often. */
  priceChangesExact?: boolean
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
  /** The neighborhood or community line was drawn around plats that did not cover a pin. */
  parentShown?: boolean
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
        ? 'no price change'
        : fact.priceChangesExact
          ? `${int(fact.priceChanges)} price change${fact.priceChanges === 1 ? '' : 's'}`
          : 'came down at least once',
    )
  }
  return bits.join(' · ')
}

/** The whole pin, in words, for a screen reader and for the button's label. */
export function pinReading(fact: CmaPinFact): string {
  const line = pinRevealLine(fact)
  return [`${fact.key}. ${fact.address}`, fact.outcome, line].filter(Boolean).join('. ')
}

/**
 * One pin. A BUTTON, because it does something; 44px of target around the
 * mark, because a phone finger is not a mouse pointer (TASTE.md, 375px).
 *
 * The reveal ships as DOM rather than a `title` attribute: a title is not
 * reachable by touch, and the whole point of Delta 3's pin is that a tap tells
 * the tale.
 */
/** Drawn. The black star is not in the embedded print fonts, so the glyph vanishes. */
const SUBJECT_STAR_SVG =
  '<svg class="pin-star" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6 .7l1.45 3.15 3.45.4-2.55 2.35.7 3.4L6 8.4 2.95 10l.7-3.4L1.1 4.25l3.45-.4z"/></svg>'

function pinMark(glyph: string): string {
  return glyph === '★' ? SUBJECT_STAR_SVG : esc(glyph)
}

function pinButton(input: {
  key: string
  glyph: string
  family: CmaMapFamily | 'subject'
  label: string
  reveal: string
  xPct: number
  yPct: number
  /** Where the same pin sits on the phone's closer view of the map. */
  phone?: { xPct: number; yPct: number } | null
}): string {
  // The reveal card is 210px wide and opens under the pin. A pin near either
  // edge opens it toward the middle of the map instead of off the screen.
  const side = (x: number, edge: number) => (x < edge ? 'l' : x > 100 - edge ? 'r' : '')
  const desk = side(input.xPct, 14)
  const phone = input.phone ? side(input.phone.xPct, 32) : ''
  const notes = `${desk ? ` data-note="${desk}"` : ''}${phone ? ` data-pnote="${phone}"` : ''}`
  const phoneVars = input.phone
    ? `;--px:${input.phone.xPct.toFixed(2)}%;--py:${input.phone.yPct.toFixed(2)}%`
    : ''
  return `<button type="button" class="pin-hit is-${esc(input.family)}" data-comp="${esc(input.key)}" data-pin="${esc(input.key)}"${notes} style="left:${input.xPct.toFixed(
    2,
  )}%;top:${input.yPct.toFixed(2)}%${phoneVars}" aria-label="${esc(input.label)}"><span class="pin-dot" aria-hidden="true">${pinMark(
    input.glyph,
  )}</span>${input.reveal ? `<span class="pin-note" aria-hidden="true">${input.reveal}</span>` : ''}</button>`
}

/**
 * The line from a pin that had to step aside back to the house it names, and
 * a dot on the house. One drawing per layout: the wide map and the phone's
 * closer view place their pins differently. Inline sizing, so the print
 * letter, which has no rule for it, still lays it over the map and not under.
 */
function leaderSvg(placed: readonly (PlacedPin | null)[], variant: 'wide' | 'phone'): string {
  const lines = placed
    .filter((p): p is PlacedPin => p != null && p.moved)
    .map((p) => {
      const ax = p.anchorXPct.toFixed(2)
      const ay = p.anchorYPct.toFixed(2)
      return `<line x1="${ax}" y1="${ay}" x2="${p.xPct.toFixed(2)}" y2="${p.yPct.toFixed(
        2,
      )}" stroke="#102742" stroke-opacity="0.6" stroke-width="1.25" vector-effect="non-scaling-stroke"/><line class="pin-anchor" x1="${ax}" y1="${ay}" x2="${ax}" y2="${ay}" stroke="#102742" stroke-width="5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
    })
  if (lines.length === 0) return ''
  const hide = variant === 'phone' ? 'display:none;' : ''
  return `<svg class="pin-leaders is-${variant}" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" style="${hide}position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none">${lines.join(
    '',
  )}</svg>`
}

/**
 * The frame the pins are laid out in. WIDE is the desk map (about 1,120px in
 * the web document, about 700px on the letter's sheet), so the separation is
 * a share of the width that keeps 28px dots apart on the first and 22px dots
 * nearly apart on the second. PHONE is the 339px column a 375 screen leaves.
 */
const WIDE_LAYOUT = { width: 1000, separation: 34 }
const PHONE_LAYOUT = { width: 339, separation: 29 }

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
  return `<ul class="pin-legend"><li class="pl-i is-subject"><span class="pl-k" aria-hidden="true">${SUBJECT_STAR_SVG}</span>Your home</li>${items}</ul>`
}

/**
 * Where every pin is drawn, on the wide map and on the phone's closer view.
 *
 * It used to put every member of a chain of near pins on a ring around their
 * centroid, the reader's own home included, which took a block of pins off
 * their houses with nothing to say so, and still piled them into one blob at
 * 375 (Keats, 2026-10-07). Now each pin
 * moves only as far as it must, the reader's home never moves, and a pin that
 * had to step aside draws a line back to its house (`lib/cma/pin-layout.ts`).
 * The label still names the address the row carries.
 */
export type CompPinLayout = {
  wide: (PlacedPin | null)[]
  phone: (PlacedPin | null)[]
  crop: MapCrop
  /** The phone frame's width over its height. */
  phoneAspect: number
}

export function layoutCompPins(
  points: readonly (PinPoint | null)[],
  fixed: readonly boolean[],
  imageAspect: number,
): CompPinLayout {
  const aspect = imageAspect > 0 ? imageAspect : 16 / 9
  const wide = relaxPins(points, fixed, {
    width: WIDE_LAYOUT.width,
    height: WIDE_LAYOUT.width / aspect,
    separation: WIDE_LAYOUT.separation,
  })
  const crop = phoneCrop(
    points.filter((p): p is PinPoint => p != null),
    { imageAspect: aspect },
  )
  const phoneAspect = (crop.w * aspect) / crop.h
  const phone = relaxPins(
    points.map((p) => (p ? intoCrop(p, crop) : null)),
    fixed,
    {
      width: PHONE_LAYOUT.width,
      height: PHONE_LAYOUT.width / phoneAspect,
      separation: PHONE_LAYOUT.separation,
    },
  )
  return { wide, phone, crop, phoneAspect }
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
    // Only the pins that will be drawn take part in the layout: a home with no
    // address on the letter, or one projected off the tile, is not a pin and
    // must not push a real one aside.
    const isSubject = (pin: CmaMapPin) => pin.key == null || pin.family === 'subject'
    const points = overlay.pins.map((pin): PinPoint | null => {
      const at = projectToImagePercent({ lat: pin.lat, lng: pin.lng }, overlay.view, 2)
      if (!at) return null
      if (isSubject(pin)) return at
      if (!byKey.get(pin.key!)?.address?.trim()) return null
      if (at.xPct < 0 || at.xPct > 100 || at.yPct < 0 || at.yPct > 100) return null
      return at
    })
    const layout = layoutCompPins(
      points,
      overlay.pins.map(isSubject),
      overlay.view.width / overlay.view.height,
    )
    const marks = overlay.pins
      .map((pin, pi) => {
        const at = layout.wide[pi]
        if (!at) return ''
        const phone = layout.phone[pi] ?? null
        if (isSubject(pin)) {
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
            phone,
          })
        }
        const fact = byKey.get(pin.key!)!
        return pinButton({
          key: pin.key!,
          glyph: pin.key!,
          family: pin.family,
          label: pinReading(fact),
          reveal: revealHtml(fact),
          xPct: at.xPct,
          yPct: at.yPct,
          phone,
        })
      })
      .filter(Boolean)
      .join('\n      ')
    if (!marks) return img
    const c = layout.crop
    const cropped = c.w < 1 || c.h < 1
    // The phone's closer view of the SAME image, as four fractions and the
    // frame's shape. The immersive stylesheet reads them under 700px; the
    // letter has no rule for them and draws the whole map as before.
    const cropVars = `--cx:${c.x0.toFixed(4)};--cy:${c.y0.toFixed(4)};--cw:${c.w.toFixed(4)};--ch:${c.h.toFixed(
      4,
    )};--car:${layout.phoneAspect.toFixed(4)}`
    return `<div class="pin-map-frame"${cropped ? ' data-crop="phone"' : ''} style="${cropVars}">
      <div class="pin-map-clip">${img}</div>
      ${leaderSvg(layout.wide, 'wide')}
      ${leaderSvg(layout.phone, 'phone')}
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
      // Three glyphs, the same three the web map draws: filled for a sale
      // that closed, a solid ring for one on the market, a DASHED ring for
      // one that came off. The bar that used to cross the numeral struck
      // through the very thing a reader matches to the row (Matt 2026-10-07).
      const filled = fact.family === 'closed'
      const body = filled
        ? `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="#102742"/>`
        : `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="13" fill="#faf8f4" stroke="#102742" stroke-width="2"${
            fact.family === 'unsold' ? ' stroke-dasharray="4 3"' : ''
          }/>`
      return `<g class="pin-sale is-${fact.family}" data-pin="${esc(fact.key)}" data-comp="${esc(
        fact.key,
      )}" tabindex="0" role="button" aria-label="${esc(pinReading(fact))}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="24" fill="transparent"/>
        ${body}
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" fill="${
          filled ? '#faf8f4' : '#102742'
        }" font-size="12" font-weight="700">${esc(fact.key)}</text>
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
