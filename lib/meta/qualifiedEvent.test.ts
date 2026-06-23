import { describe, it, expect, vi } from 'vitest'
import { isQualifyingStage, fireQualifiedLeadEvent } from './qualifiedEvent'

describe('isQualifyingStage', () => {
  it('is true for the qualifying stages only', () => {
    expect(isQualifyingStage('A - Hot 1-3 Months')).toBe(true)
    expect(isQualifyingStage('Active Client')).toBe(true)
    expect(isQualifyingStage('Past Client')).toBe(true)
    expect(isQualifyingStage('  Active Client  ')).toBe(true) // trimmed
  })
  it('is false for non-qualifying stages and junk', () => {
    expect(isQualifyingStage('Lead')).toBe(false)
    expect(isQualifyingStage('Seller Prospect')).toBe(false)
    expect(isQualifyingStage('Real Estate Agent')).toBe(false)
    expect(isQualifyingStage('C - Cold 6+ Months')).toBe(false)
    expect(isQualifyingStage(null)).toBe(false)
    expect(isQualifyingStage(undefined)).toBe(false)
    expect(isQualifyingStage('')).toBe(false)
  })
})

describe('fireQualifiedLeadEvent — dry-run safety', () => {
  const contact = { email: 'a@b.com', phone: '5551234567', firstName: 'A', lastName: 'B' }

  it('stays dry and NEVER calls Meta when the flag is off (default)', async () => {
    const send = vi.fn()
    const out = await fireQualifiedLeadEvent({
      personId: 1,
      stage: 'Active Client',
      readContact: async () => contact,
      readSuppressions: async () => [],
      send: send as never,
    })
    expect(send).not.toHaveBeenCalled()
    expect(out.fired).toBe(false)
    expect(out.dryRun).toBe(true)
    expect(out.reason).toBe('flag-disabled')
  })

  it('skips (no Meta call) when the person has no email or phone', async () => {
    const send = vi.fn()
    const out = await fireQualifiedLeadEvent({
      personId: 2,
      stage: 'Active Client',
      readContact: async () => ({ email: null, phone: null, firstName: 'A', lastName: 'B' }),
      readSuppressions: async () => [],
      send: send as never,
    })
    expect(send).not.toHaveBeenCalled()
    expect(out.fired).toBe(false)
    expect(out.reason).toBe('no-contact-key')
  })

  it('never throws even if the contact reader fails', async () => {
    const out = await fireQualifiedLeadEvent({
      personId: 3,
      stage: 'Active Client',
      readContact: async () => {
        throw new Error('db down')
      },
      readSuppressions: async () => [],
      send: vi.fn() as never,
    })
    expect(out.fired).toBe(false)
  })
})
