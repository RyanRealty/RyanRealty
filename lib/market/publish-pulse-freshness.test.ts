import { describe, expect, it } from 'vitest'
import {
  parsePulseInstant,
  publishPulseAsOfIso,
  publishPulseAsOfLabel,
  publishPulseFreshnessLabel,
  publishPulseFreshnessStamp,
} from './publish-pulse-freshness'

describe('publishPulseFreshness', () => {
  it('names the Pacific calendar day on a live pulse instant', () => {
    const iso = '2026-08-18T05:20:00.000Z'
    expect(publishPulseFreshnessLabel(iso)).toBe('Aug 17, 2026, 10:20 PM')
    expect(publishPulseFreshnessStamp(iso)).toBe('Updated Aug 17, 2026, 10:20 PM')
    expect(publishPulseAsOfLabel(iso)).toBe('August 17, 2026')
    expect(publishPulseAsOfIso(iso)).toBe('2026-08-17')
  })

  it('keeps a date-only stamp on that calendar day', () => {
    expect(publishPulseAsOfIso('2026-05-15')).toBe('2026-05-15')
    expect(publishPulseAsOfLabel('2026-05-15')).toBe('May 15, 2026')
    expect(publishPulseFreshnessStamp('2026-05-15')).toContain('May 15, 2026')
  })

  it('does not flip to the next UTC month near a Pacific evening', () => {
    const iso = '2026-09-01T06:30:00.000Z'
    expect(publishPulseAsOfIso(iso)).toBe('2026-08-31')
    expect(publishPulseAsOfLabel(iso)).toBe('August 31, 2026')
    expect(publishPulseFreshnessLabel(iso)).toBe('Aug 31, 2026, 11:30 PM')
  })

  it('returns null for missing or invalid input', () => {
    expect(parsePulseInstant(null)).toBeNull()
    expect(publishPulseFreshnessStamp('')).toBeNull()
    expect(publishPulseAsOfLabel('not-a-date')).toBeNull()
    expect(publishPulseAsOfIso(undefined)).toBeNull()
  })
})
