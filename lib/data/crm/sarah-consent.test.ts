import { describe, expect, it } from 'vitest'
import { RECORD_RETENTION_YEARS } from '@/lib/sarah/outbound'
import { retainUntilIso } from './sarah-consent'

describe('Sarah consent retain', () => {
  it('stamps retain_until five years out', () => {
    expect(RECORD_RETENTION_YEARS).toBe(5)
    expect(retainUntilIso(new Date('2026-10-16T00:00:00.000Z'))).toBe('2031-10-16T00:00:00.000Z')
  })
})
