import { describe, expect, it } from 'vitest'
import { brokerRosterRecord, placesSentence, ROSTER_WINDOW_DAYS } from './broker-roster-record'
import type { BrokerSaleTile } from '@/lib/data/brokers/getBrokerSales'

const NOW = new Date('2026-09-09T18:00:00.000Z')

function sale(closeDate: string | null, city: string | null, price: number | null = 750_000): BrokerSaleTile {
  return {
    ListingKey: `k-${closeDate ?? 'none'}-${city ?? 'none'}-${price ?? 0}`,
    CloseDate: closeDate,
    ClosePrice: price,
    City: city,
    saleSide: 'listed',
  } as unknown as BrokerSaleTile
}

describe('brokerRosterRecord — the ladder', () => {
  it('leads with closings inside the trailing 12 months, and tallies their places', () => {
    const r = brokerRosterRecord({
      name: 'Matt Ryan',
      sales: [
        sale('2026-09-01T00:00:00+00:00', 'Bend'),
        sale('2026-05-02T00:00:00+00:00', 'Bend'),
        sale('2025-11-20T00:00:00+00:00', 'Redmond'),
        // Outside the window: counted in the trace's denominator, never in the figure.
        sale('2019-04-01T00:00:00+00:00', 'La Pine'),
      ],
      now: NOW,
    })
    expect(r).not.toBeNull()
    expect(r!.value).toBe('3')
    expect(r!.label).toBe('closings in the last 12 months')
    expect(r!.places).toEqual([
      { name: 'Bend', n: 2 },
      { name: 'Redmond', n: 1 },
    ])
    expect(r!.trace).toContain('3 of 4 on record')
  })

  it('falls back to the whole record, with its span, when nothing closed this year', () => {
    const r = brokerRosterRecord({
      name: 'A Broker',
      sales: [sale('2019-04-01T00:00:00+00:00', 'Sisters'), sale('2021-06-01T00:00:00+00:00', 'Sisters')],
      now: NOW,
    })
    expect(r!.value).toBe('2')
    expect(r!.label).toBe('closed sales on record, 2019 to 2021')
  })

  it('falls back to live listings when the broker has no closing on the feed', () => {
    const r = brokerRosterRecord({
      name: 'Paul Stevenson',
      sales: [],
      actives: [{ city: 'Redmond' }],
      now: NOW,
    })
    expect(r!.value).toBe('1')
    expect(r!.label).toBe('home for sale right now')
    expect(r!.trace).toContain('unknown is not zero')
  })

  it('returns null rather than printing a zero when there is no record at all', () => {
    expect(brokerRosterRecord({ name: 'Nobody', sales: [], actives: [], now: NOW })).toBeNull()
  })

  it('never counts a row without a price or a close date', () => {
    const r = brokerRosterRecord({
      name: 'A Broker',
      sales: [sale('2026-08-01T00:00:00+00:00', 'Bend', null), sale(null, 'Bend', 500_000)],
      actives: [],
      now: NOW,
    })
    expect(r).toBeNull()
  })

  it('measures the window from the day, not from a timestamp that drifts an hour', () => {
    const justInside = new Date(NOW.getTime() - (ROSTER_WINDOW_DAYS - 1) * 86_400_000).toISOString()
    const r = brokerRosterRecord({ name: 'A Broker', sales: [sale(justInside, 'Bend')], now: NOW })
    expect(r!.label).toBe('closing in the last 12 months')
  })
})

describe('placesSentence', () => {
  it('reads as a sentence, never as a comma list with a trailing name', () => {
    expect(placesSentence([{ name: 'Bend' }])).toBe('Bend')
    expect(placesSentence([{ name: 'Bend' }, { name: 'Redmond' }])).toBe('Bend and Redmond')
    expect(placesSentence([{ name: 'Bend' }, { name: 'Redmond' }, { name: 'Sisters' }])).toBe(
      'Bend, Redmond and Sisters',
    )
    expect(placesSentence([])).toBe('')
  })
})
