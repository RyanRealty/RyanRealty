/**
 * Tap a sale, see the pin. Web and print share the same SVG. Print is static.
 * The web view wires data-comp / data-pin in the immersive script.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'
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

export function renderCompPinMapHtml(
  subject: Pick<CmaSubject, 'streetAddress' | 'latitude' | 'longitude'>,
  comps: readonly Pick<CmaAdjustedComp, 'address' | 'latitude' | 'longitude'>[],
  mapDataUri?: string | null,
  alt = 'Comparable sales map',
): string {
  if (mapDataUri) {
    return `<img class="pin-map" src="${esc(mapDataUri)}" alt="${esc(alt)}" />`
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
        return `<g class="pin-subject" data-pin="subject">
          <rect x="${(p.x - 9).toFixed(1)}" y="${(p.y - 9).toFixed(1)}" width="18" height="18" fill="#102742"/>
          <title>${esc(subject.streetAddress)}</title>
        </g>`
      })()
    : ''
  const saleMarks = pins
    .map((pin) => {
      const p = xy(pin.pt)
      return `<g class="pin-sale" data-pin="${pin.n}">
        <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="14" fill="#102742"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y + 4).toFixed(1)}" text-anchor="middle" fill="#faf8f4" font-size="12" font-weight="700">${pin.n}</text>
        <title>${esc(pin.address)}</title>
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
