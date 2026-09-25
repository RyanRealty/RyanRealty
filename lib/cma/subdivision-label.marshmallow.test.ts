import { describe, expect, it } from 'vitest'
import { daysToOfferSvg } from '@/lib/cma/market-charts'

describe('subdivision labels — Marshmallow', () => {
  it('does not truncate Lodges at Bachelor Village', () => {
    const svg = daysToOfferSvg(
      [
        { label: 'Lodges at Bachelor Village', days: 21, valueLabel: '21 days', subject: false },
        { label: 'Your home', days: 40, valueLabel: '40 days', subject: true },
        { label: 'Nearby sale', days: 18, valueLabel: '18 days', subject: false },
      ],
      'Days to offer',
    )
    expect(svg).toContain('Lodges at Bachelor Village')
    expect(svg).not.toMatch(/Lodges at Bachelor V…/)
    expect(svg).not.toContain('…')
  })
})
