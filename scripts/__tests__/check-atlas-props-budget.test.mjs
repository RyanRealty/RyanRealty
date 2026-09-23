/**
 * ci:atlas-props-budget break-tests (UXLIVE-3). The gate must fire on a
 * served page whose Atlas carries its dots inline or is over budget, pass a
 * deferred Atlas, resolve outlined `$<id>` rows when weighing, and treat a
 * page with no Atlas as a failed measurement.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ATLAS_PROPS_BUDGET_BYTES, runtimeFailures, staticFailures } from '../check-atlas-props-budget.mjs'
import { flightRows, weighAtlasProps } from '../lib/atlas-props-weight.mjs'

/** A served page whose flight rows are the given strings. */
function page(rows) {
  const flight = rows.join('\n') + '\n'
  // Split across two pushes, the way Next streams it.
  const mid = Math.floor(flight.length / 2)
  const push = (s) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`
  return `<!DOCTYPE html><html><body><main>x</main>${push(flight.slice(0, mid))}${push(flight.slice(mid))}</body></html>`
}

function atlasRow(id, props) {
  return `${id}:${JSON.stringify(['$', '$L9', null, { id: 'atlas', headline: 'Bend', headingLevel: 2, types: [{ key: 'house', label: 'House' }], ...props }])}`
}

const dot = (i) => ({ k: `k${i}`, lat: 44.05, lng: -121.3, p: 500000, t: 'house', s: 'active', age: 3, photo: 'https://cdn.example/x.jpg', street: '1 Test St' })

describe('ci:atlas-props-budget', () => {
  it('passes a deferred Atlas: empty dots, a summary, a URL', () => {
    const html = page([
      '9:I[1,["/_next/static/chunks/a.js"],"PlaceSubdivisionAtlas"]',
      atlasRow('a', { dots: [], dotsSrc: '/api/atlas/dots?c=Bend&b=geo:city:bend', dotsSummary: { n: 1664 }, regions: [{ id: 'town:bend' }] }),
    ])
    expect(runtimeFailures('/cities/bend', html)).toEqual([])
  })

  it('fires on inline dots even under the byte budget', () => {
    const html = page([atlasRow('a', { dots: [dot(1), dot(2)], regions: [] })])
    const f = runtimeFailures('/communities/tetherow', html)
    expect(f.join('\n')).toMatch(/inline dots/)
  })

  it('fires over the byte budget', () => {
    const big = Array.from({ length: 4000 }, (_, i) => ({ id: `p${i}`, geometry: { type: 'Polygon', coordinates: [[[-121.3 - i * 1e-6, 44.1234567891234]]] } }))
    const html = page([atlasRow('a', { dots: [], regions: big })])
    const f = runtimeFailures('/cities/bend/awbrey-butte', html)
    expect(f.join('\n')).toMatch(/over the 196,608 B budget/)
    expect(ATLAS_PROPS_BUDGET_BYTES).toBe(196_608)
  })

  it('weighs an outlined row the props point at, not the pointer', () => {
    const heavy = Array.from({ length: 3000 }, (_, i) => dot(i))
    const html = page([`2:${JSON.stringify(heavy)}`, atlasRow('a', { dots: '$2', regions: [] })])
    const [a] = weighAtlasProps(html)
    expect(a.byKey.dots).toBeGreaterThan(300_000)
    expect(runtimeFailures('/about', html).join('\n')).toMatch(/inline dots/)
  })

  it('parses length-prefixed text rows without losing the rows after them', () => {
    const text = 'line one\nline two, with a comma'
    const rows = flightRows(`1:T${Buffer.byteLength(text).toString(16)},${text}2:{"ok":true}\n`)
    expect(rows.get('1')).toBe(text)
    expect(rows.get('2')).toEqual({ ok: true })
  })

  it('a short read keeps its dots inline on purpose: warned, not failed', () => {
    const html = page([atlasRow('a', { dots: [dot(1), dot(2)], regions: [], incomplete: true })])
    const warnings = []
    expect(runtimeFailures('/cities/bend', html, ATLAS_PROPS_BUDGET_BYTES, warnings)).toEqual([])
    expect(warnings.join('\n')).toMatch(/came back short/)
    // The same Atlas from a complete read is held to the rule.
    const complete = page([atlasRow('a', { dots: [dot(1), dot(2)], regions: [], incomplete: false })])
    expect(runtimeFailures('/cities/bend', complete).join('\n')).toMatch(/inline dots/)
  })

  it('a page with no Atlas is a failed measurement, not a pass', () => {
    expect(runtimeFailures('/about', page(['1:"$Sreact.fragment"'])).join('\n')).toMatch(/no Atlas props found/)
  })

  it('the static layer fires when a route inlines its dots or basemap again', () => {
    const real = (f) => readFileSync(f, 'utf8')
    expect(staticFailures(real)).toEqual([])
    const regressed = (f) =>
      f === 'app/cities/[slug]/page.tsx'
        ? real(f).replace('dots={atlasProps.dots}', 'dots={atlasView.dots}').replace('basemapSrc={atlasProps.basemapSrc}', 'basemap={basemapForRegions(subjectRegions)}')
        : real(f)
    const f = staticFailures(regressed).join('\n')
    expect(f).toMatch(/pass dots=\{atlasProps\.dots\}/)
    expect(f).toMatch(/no inline basemap=/)
    expect(f).toMatch(/load after paint/)
  })
})
