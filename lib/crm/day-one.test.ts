import { describe, expect, it } from 'vitest'
import { dayOneApplies, dayOneComplete, dayOneRemaining, evaluateDayOne } from './day-one'

const ready = {
  role: 'broker' as const,
  brokerSlug: 'paul',
  displayName: 'Paul Stevenson',
  phone: '541.555.0100',
  notifyConfigured: true,
  socialUrls: ['https://instagram.com/paul'],
  holdsMarketing: true,
}

describe('evaluateDayOne', () => {
  it('all green when a mapped broker has profile, socials, and marketing', () => {
    const items = evaluateDayOne(ready)
    expect(dayOneComplete(items)).toBe(true)
    expect(dayOneRemaining(items)).toEqual([])
  })

  it('unmapped broker fails mapped + book', () => {
    const items = evaluateDayOne({ ...ready, brokerSlug: null })
    expect(items.find((i) => i.id === 'mapped')?.done).toBe(false)
    expect(items.find((i) => i.id === 'book')?.done).toBe(false)
    expect(dayOneComplete(items)).toBe(false)
  })

  it('empty socials leave that item open', () => {
    const items = evaluateDayOne({ ...ready, socialUrls: [null, '  '] })
    expect(items.find((i) => i.id === 'socials')?.done).toBe(false)
  })

  it('locked marketing capability leaves that item open', () => {
    const items = evaluateDayOne({ ...ready, holdsMarketing: false })
    expect(items.find((i) => i.id === 'marketing')?.done).toBe(false)
  })

  it('applies only to the broker role', () => {
    expect(dayOneApplies('broker')).toBe(true)
    expect(dayOneApplies('superuser')).toBe(false)
    expect(dayOneApplies('report_viewer')).toBe(false)
  })
})
