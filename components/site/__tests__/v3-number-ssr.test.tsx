import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Number } from '@/components/site/v3/V3Number.client'
import {
  V3AlertsStrip,
  type V3AlertsStripProps,
} from '@/components/site/v3/V3AlertsStrip.client'

const NUMBER_SRC = readFileSync(resolve('components/site/v3/V3Number.client.tsx'), 'utf8')
const ALERTS_SRC = readFileSync(resolve('components/site/v3/V3AlertsStrip.client.tsx'), 'utf8')
const MOS_SRC = readFileSync(resolve('components/site/v3/V3MosBars.tsx'), 'utf8')

/**
 * SITE-117. The first HTML of a sourced figure is the sourced figure.
 * Counting up from 0 after hydration is decoration; shipping "0 houses
 * came on the market" until JS runs is a wrong number (CLAUDE.md §0).
 */
describe('V3Number first HTML is the sourced face', () => {
  it('defaults settle so the server publishes the live count, not 0', () => {
    expect(NUMBER_SRC).toMatch(/settle\s*=\s*true/)
    expect(NUMBER_SRC).not.toMatch(/settle\s*=\s*false/)
    expect(MOS_SRC).toMatch(/settle\s*=\s*true/)
    expect(MOS_SRC).not.toMatch(/settle\s*=\s*false/)
  })

  it('SSRs 148, not 0, when the caller hands 148', () => {
    const html = renderToStaticMarkup(
      createElement(V3Number, { value: 148, formatted: '148' }),
    )
    expect(html).toContain('148')
    expect(html).not.toMatch(/>0</)
    expect(html).not.toContain('>0<')
  })

  it('SSRs a grouped face the caller already formatted', () => {
    const html = renderToStaticMarkup(
      createElement(V3Number, { value: 3655, formatted: '3,655' }),
    )
    expect(html).toContain('3,655')
    expect(html).not.toMatch(/>0</)
  })

  it('omits a face when the value is not a finite count — never fakes 0', () => {
    const nanHtml = renderToStaticMarkup(
      createElement(V3Number, { value: Number.NaN, formatted: '148' }),
    )
    const infHtml = renderToStaticMarkup(
      createElement(V3Number, { value: Number.POSITIVE_INFINITY, formatted: '148' }),
    )
    expect(nanHtml).toBe('')
    expect(infHtml).toBe('')
  })

  it('still lets a caller opt into a decorative count-up', () => {
    const html = renderToStaticMarkup(
      createElement(V3Number, { value: 148, formatted: '148', settle: false }),
    )
    expect(html).toMatch(/>0</)
    expect(html).not.toContain('148')
  })
})

const STRIP_PROPS: V3AlertsStripProps = {
  eyebrow: 'New listings · Bend',
  count: '148',
  claim: 'houses came on the market in Bend in the last 30 days.',
  stickyClaim: {
    before: 'houses came on the market in',
    place: 'Bend',
    after: 'in the last 30 days.',
  },
  promise: "We'll email you every new listing in Bend as it comes on the market.",
  submitLabel: 'Send me new listings',
  sent: { heading: "You're set.", body: 'We will email you.' },
  stickyLabel: 'Bend listing alerts',
  source: '148 houses: Market Truth leftover HUD, Bend, last 30 days.',
  onSubmit: async () => ({ ok: true }),
}

describe('V3AlertsStrip first HTML never says 0 houses', () => {
  it('passes settle on both V3Number mounts so a default flip cannot regress', () => {
    const mounts = ALERTS_SRC.match(/<V3Number[\s\S]*?\/>/g) ?? []
    expect(mounts).toHaveLength(2)
    for (const mount of mounts) {
      expect(mount).toMatch(/\bsettle\b/)
    }
  })

  it('SSRs the sourced count in the claim, not a hydration 0', () => {
    const html = renderToStaticMarkup(createElement(V3AlertsStrip, STRIP_PROPS))
    expect(html).toContain('148')
    expect(html).toContain('houses came on the market in Bend')
    expect(html).not.toMatch(/0\s+houses came on the market/)
  })
})
