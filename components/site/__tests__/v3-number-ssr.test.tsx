/**
 * SITE-117: the count-up numeral SERVES its settled figure. The beui original
 * seeded its display state with 0, so every server-rendered alerts strip, MOS
 * bar, Instrument face and ZIP claim carried "0" until hydration swapped in the
 * real count — on /cities, "0 houses came on the market" under a source line
 * naming 256. These render the primitive and its heaviest consumer to a string
 * and pin what a crawler or a no-JS reader gets.
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3AlertsStrip, V3Number, type V3AlertsStripProps } from '@/components/site/v3'

function numberHtml(value: number, formatted: string, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(createElement(V3Number, { value, formatted, ...extra }))
}

describe('V3Number served HTML', () => {
  it('serves the formatted settled figure, never the wheel start', () => {
    const html = numberHtml(256, '256')
    expect(html).toContain('>256</span>')
    expect(html).not.toContain('>0</span>')
    expect(html).toContain('data-settled="256"')
  })

  it('serves the caller-formatted face for a grouped figure', () => {
    const html = numberHtml(3281, '3,281')
    expect(html).toContain('>3,281</span>')
    expect(html).toContain('data-settled="3281"')
  })

  it('serves the settled figure when the count-up starts on mount too', () => {
    const html = numberHtml(41, '41', { startOnView: false })
    expect(html).toContain('>41</span>')
  })

  it('serves an honest zero as zero', () => {
    const html = numberHtml(0, '0')
    expect(html).toContain('data-settled="0">0</span>')
  })
})

const STRIP: V3AlertsStripProps = {
  id: 'regional-alerts',
  eyebrow: 'New listings · Central Oregon',
  count: '256',
  claim: 'houses came on the market in Central Oregon in the last 30 days.',
  stickyClaim: { before: '256 new listings in ', place: 'Central Oregon', after: ' this month.' },
  promise: 'Every new listing across Central Oregon, by email. Unsubscribe any time.',
  submitLabel: 'Email me each one',
  sent: { heading: 'Set.', body: 'Pause or unsubscribe from any alert email.' },
  source: '256 houses: regional MLS through Oregon Data Share, Market Truth new listings in the last 30 days.',
  stickyLabel: 'Central Oregon listing alerts',
  onSubmit: async () => ({ ok: true }) as never,
}

describe('V3AlertsStrip served HTML', () => {
  it('serves the real count in the claim and the sticky line', () => {
    const html = renderToStaticMarkup(createElement(V3AlertsStrip, STRIP))
    const claim = html.match(/<span class="tabular-nums v3 v3-number v3-alerts__num-pop"[^>]*>([^<]*)<\/span>/)
    expect(claim?.[1]).toBe('256')
    // Not a single count-up numeral on the strip serves the wheel start.
    const faces = [...html.matchAll(/<span[^>]*\bdata-settled="(\d+)"[^>]*>([^<]*)<\/span>/g)]
    expect(faces.length).toBeGreaterThanOrEqual(1)
    for (const [, settled, face] of faces) {
      expect(face).toBe('256')
      expect(settled).toBe('256')
    }
    expect(html).toContain('houses came on the market in Central Oregon')
  })
})
