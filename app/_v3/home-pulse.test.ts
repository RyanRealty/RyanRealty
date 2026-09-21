import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { composeHomePulse, pulseClaim, pulseTrace, HOME_PULSE_ID } from './home-pulse'

/** A cloud with enough span to project, so the field is real in these tests. */
function cloud(n: number, s: string, lat = 44.0, lng = -121.3, soldAgo?: number) {
  return Array.from({ length: n }, (_, i) => ({
    lat: lat + (i % 20) * 0.005,
    lng: lng - Math.floor(i / 20) * 0.005,
    s,
    ...(soldAgo == null ? {} : { soldAgo }),
  }))
}

/** The live shape on 2026-09-08, as getAtlasTiles returned it that morning. */
const LIVE = {
  counts: { forSale: 3284, pending: 912, sold: 462 },
  dots: [
    ...cloud(3284, 'active'),
    ...cloud(912, 'pending', 44.25, -121.18),
    ...cloud(462, 'sold', 43.8, -121.5, 12),
    // Closes older than the pulse window are read for the trace and never counted.
    ...cloud(1093, 'sold', 43.9, -121.4, 71),
  ],
  stamp: 'Sep 8, 2026, 7:03 AM',
  closedInWindow: 1555,
}

describe('pulseClaim', () => {
  it('stays plain: no fraction lecture', () => {
    expect(pulseClaim(3284, 912)).toBe('Central Oregon right now.')
    expect(pulseClaim(4300, 1000)).toBe('Central Oregon right now.')
    expect(pulseClaim(3000, 1000)).toBe('Central Oregon right now.')
    expect(pulseClaim(3284, 0)).toBe('Central Oregon right now.')
    expect(pulseClaim(0, 0)).toBe('Central Oregon right now.')
  })

  it('keeps the Central Oregon right now pulse free of em dashes (Matt lock 2026-09-20)', () => {
    const pulse = composeHomePulse(LIVE)!
    const blobs = [
      pulseClaim(3284, 912),
      String(pulse.claim),
      pulse.note,
      pulse.source,
      pulse.fieldAlt ?? '',
      pulse.plotCaption ?? '',
      ...pulse.readings.flatMap((reading) => [reading.definition, reading.label, reading.hrefLabel ?? '']),
    ]
    for (const text of blobs) {
      expect(text, text).not.toContain('\u2014')
      expect(text, text).not.toMatch(/ -- /)
    }
    const src = readFileSync(resolve('app/_v3/home-pulse.ts'), 'utf8')
    expect(src).not.toContain('\u2014')
    expect(src).not.toMatch(/ -- /)
  })
})

describe('pulseTrace', () => {
  it('names every table, filter and window, and shows the division', () => {
    const trace = pulseTrace(LIVE)
    expect(trace).toContain('listing_tile_mv')
    expect(trace).toContain('Active Under Contract')
    expect(trace).toContain('ClosePrice at or above $1,000')
    expect(trace).toContain('3,284')
    expect(trace).toContain('912')
    expect(trace).toContain('4,196')
    expect(trace).toContain('1,555')
    expect(trace).toContain('912 ÷ 4,196 = 21.7%')
    // The rules' own denominator, printed with its arithmetic.
    expect(trace).toContain('3,284 + 912 + 462 = 4,658')
    expect(trace).toContain('Coming Soon is never counted')
    expect(trace).not.toContain('\u2014')
    expect(trace).not.toMatch(/ -- /)
  })
})

describe('composeHomePulse', () => {
  it('publishes the three counts, formatted, with the read stamp', () => {
    const pulse = composeHomePulse(LIVE)!
    expect(pulse.id).toBe(HOME_PULSE_ID)
    expect(pulse.note).toBe('Read Sep 8, 2026, 7:03 AM')
    expect(pulse.readings.map((r) => `${r.figure} ${r.label}`)).toEqual([
      '3,284 listings for sale',
      '912 under contract',
      '462 sold in the last 30 days',
    ])
  })

  it('scales every rule against the whole read, so the three fills tile one track', () => {
    const pulse = composeHomePulse(LIVE)!
    const whole = 3284 + 912 + 462
    expect(pulse.readings[0]!.share).toBeCloseTo(3284 / whole, 6)
    expect(pulse.readings[1]!.share).toBeCloseTo(912 / whole, 6)
    expect(pulse.readings[2]!.share).toBeCloseTo(462 / whole, 6)
    // The defect this replaced: the biggest reading was 1 by construction, so
    // its rule was permanently full width and the row did no design work.
    expect(pulse.readings[0]!.share).toBeLessThan(1)
    expect(pulse.readings.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6)
  })

  it('plots each population as its own path in one shared frame', () => {
    const pulse = composeHomePulse(LIVE)!
    expect(pulse.field).toBeDefined()
    for (const reading of pulse.readings) {
      expect(reading.path && reading.path.length > 0).toBe(true)
    }
    expect(new Set(pulse.readings.map((r) => r.path)).size).toBe(3)
  })

  it('only plots closes inside the 30-day window, never the 90-day read', () => {
    const pulse = composeHomePulse(LIVE)!
    const sold = pulse.readings[2]!
    const marks = sold.path!.match(/M/g)?.length ?? 0
    expect(marks).toBe(462)
  })

  it('says every figure is a count and never a label a visitor cannot read', () => {
    const pulse = composeHomePulse(LIVE)!
    for (const reading of pulse.readings) {
      expect(reading.definition.length).toBeGreaterThan(40)
      expect(reading.definition).not.toContain('\u2014')
      expect(reading.definition).not.toMatch(/ -- /)
      expect(reading.label).not.toMatch(/_|standard_status|listing_tile_mv/)
      expect(reading.href).toBeTruthy()
      expect(reading.hrefLabel).toBeTruthy()
    }
  })

  it('rewrites the selected-rule blurbs in plain voice (SITE-147)', () => {
    const pulse = composeHomePulse(LIVE)!
    expect(pulse.readings.map((r) => r.definition)).toEqual([
      'Houses, condos, and land you can still buy in Bend, Redmond, Sisters, Sunriver, and nearby.',
      'These already have a buyer. An offer is accepted, and they have not closed yet.',
      'What closed in the last 30 days, at the price it sold for, not the asking price.',
    ])
    expect(pulse.readings[2]!.hrefLabel).toBe('See what sold')
    const joined = pulse.readings.map((r) => r.definition).join('\n')
    expect(joined).not.toMatch(/regional MLS carries/i)
    expect(joined).not.toMatch(/\beverything\b/i)
    expect(joined).not.toMatch(/same feed at the same moment/i)
    expect(joined).not.toMatch(/Active listings of every property type/i)
    expect(joined).not.toMatch(/finished deals/i)
    expect(joined).not.toMatch(/recorded a closing/i)
    expect(joined).not.toMatch(/pending and active under contract/i)
  })

  it('does not render a band for a read that produced nothing', () => {
    expect(composeHomePulse({ ...LIVE, counts: { forSale: 0, pending: 0, sold: 0 } })).toBeNull()
    expect(composeHomePulse({ ...LIVE, stamp: '  ' })).toBeNull()
  })

  it('still publishes the counts when the population cannot make a map', () => {
    const pulse = composeHomePulse({
      counts: { forSale: 2, pending: 1, sold: 0 },
      dots: [{ lat: 44, lng: -121, s: 'active' }],
      stamp: 'Sep 8, 2026, 7:03 AM',
      closedInWindow: 0,
    })!
    expect(pulse.field).toBeUndefined()
    expect(pulse.readings[0]!.figure).toBe('2')
  })
})

describe('the band is mounted on the homepage, under the hero search', () => {
  const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')
  const CHROME_LIVE = readFileSync(resolve('lib/site/chrome-live.ts'), 'utf8')

  it('renders V3Pulse after the first house rails so inventory opens the page', () => {
    expect(PAGE).toContain('<V3Pulse')
    expect(PAGE).toContain('id="right-now"')
    expect(HOME_PULSE_ID).toBe('right-now')
    const stageAt = PAGE.indexOf('<V3Stage')
    const searchAt = PAGE.indexOf('<HomeHeroSearch')
    const pulseAt = PAGE.indexOf('<V3Pulse')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    expect(railsAt).toBeGreaterThan(searchAt)
    expect(railsAt).toBeGreaterThan(stageAt)
    expect(pulseAt).toBeGreaterThan(railsAt)
  })

  it('leaves the band out rather than printing a zero it cannot vouch for', () => {
    expect(PAGE).toContain('{pulse ? <V3Pulse')
  })

  // The band carries an id and the chrome is sticky, so it is a scroll target
  // that must reserve the header. Without this the claim's ascenders are sliced
  // at 375 and "More" reads as "Wore" (2026-09-08 evaluator).
  it('reserves the sticky chrome when the band is the scroll target', () => {
    const css = readFileSync(resolve('components/site/v3/V3Pulse.css'), 'utf8')
    expect(css).toContain('scroll-margin-top: calc(var(--v3-chrome-h) + var(--v3-space-md))')
  })

  // The move, stated as a test: the count lives on the page now, not in a menu.
  it('the Homes dropdown no longer publishes the region strip', () => {
    expect(CHROME_LIVE).not.toContain("'Central Oregon right now'")
    expect(CHROME_LIVE).not.toContain('out.Buy')
    expect(CHROME_LIVE).not.toContain('fieldFromDots')
  })
})
