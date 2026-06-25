import { describe, it, expect } from 'vitest'
import {
  mapReportSubscriptionRow,
  normalizeReportFrequency,
  buildMarketReportAreas,
  REPORT_FREQUENCIES,
} from './getContactReportSubscriptions'

describe('normalizeReportFrequency', () => {
  it('passes through the three valid cadences', () => {
    expect(normalizeReportFrequency('weekly')).toBe('weekly')
    expect(normalizeReportFrequency('monthly')).toBe('monthly')
    expect(normalizeReportFrequency('quarterly')).toBe('quarterly')
  })

  it('defaults anything else to monthly', () => {
    expect(normalizeReportFrequency('daily')).toBe('monthly')
    expect(normalizeReportFrequency('')).toBe('monthly')
    expect(normalizeReportFrequency(null)).toBe('monthly')
    expect(normalizeReportFrequency(undefined)).toBe('monthly')
    expect(normalizeReportFrequency(42)).toBe('monthly')
  })

  it('matches the exported frequency list', () => {
    for (const f of REPORT_FREQUENCIES) expect(normalizeReportFrequency(f)).toBe(f)
  })
})

describe('mapReportSubscriptionRow', () => {
  it('returns null for a missing row', () => {
    expect(mapReportSubscriptionRow(null)).toBeNull()
    expect(mapReportSubscriptionRow(undefined)).toBeNull()
  })

  it('maps a full active row', () => {
    expect(
      mapReportSubscriptionRow({ is_active: true, areas: ['bend', 'sisters'], frequency: 'weekly' }),
    ).toEqual({ isActive: true, areas: ['bend', 'sisters'], frequency: 'weekly' })
  })

  it('coerces is_active to a strict boolean', () => {
    expect(mapReportSubscriptionRow({ is_active: false, areas: [], frequency: 'monthly' })?.isActive).toBe(false)
    // a non-true truthy value still reads false (strict === true)
    expect(mapReportSubscriptionRow({ is_active: 1, areas: [], frequency: 'monthly' })?.isActive).toBe(false)
  })

  it('drops non-string area entries and a non-array areas value', () => {
    expect(mapReportSubscriptionRow({ is_active: true, areas: ['bend', 7, null], frequency: 'monthly' })?.areas).toEqual([
      'bend',
    ])
    expect(mapReportSubscriptionRow({ is_active: true, areas: 'bend', frequency: 'monthly' })?.areas).toEqual([])
  })

  it('normalizes a bad stored frequency to monthly', () => {
    expect(mapReportSubscriptionRow({ is_active: true, areas: [], frequency: 'yearly' })?.frequency).toBe('monthly')
  })
})

describe('buildMarketReportAreas', () => {
  const areas = buildMarketReportAreas()

  it('includes every Central Oregon city', () => {
    const slugs = new Set(areas.map((a) => a.slug))
    for (const s of ['bend', 'redmond', 'sisters', 'sunriver', 'tumalo', 'la-pine', 'terrebonne']) {
      expect(slugs.has(s)).toBe(true)
    }
  })

  it('includes resort communities from the registry (e.g. tetherow)', () => {
    expect(areas.some((a) => a.slug === 'tetherow')).toBe(true)
  })

  it('has no duplicate slugs', () => {
    const slugs = areas.map((a) => a.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('is sorted by label', () => {
    const labels = areas.map((a) => a.label)
    const sorted = [...labels].sort((a, b) => a.localeCompare(b))
    expect(labels).toEqual(sorted)
  })

  it('gives every option a non-empty slug and label', () => {
    for (const a of areas) {
      expect(a.slug.length).toBeGreaterThan(0)
      expect(a.label.length).toBeGreaterThan(0)
    }
  })
})
