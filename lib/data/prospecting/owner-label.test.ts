/**
 * FSBO Desk friction: assessor owner_name on the prospect row can disagree with
 * the CRM person linked by email/phone. Card, people page, and CMA must show
 * the linked person when personId is set.
 */
import { describe, expect, it } from 'vitest'
import { applyCrmOwnerNames, resolveOwnerLabel } from './get'

describe('resolveOwnerLabel', () => {
  it('prefers CRM name when personId is linked', () => {
    expect(
      resolveOwnerLabel({
        ownerName: 'Clayton Mclain',
        crmName: 'Gabriella Helleck',
        personId: 10942,
      }),
    ).toBe('Gabriella Helleck')
  })

  it('falls back to assessor owner_name when no CRM name', () => {
    expect(
      resolveOwnerLabel({
        ownerName: 'Clayton Mclain',
        crmName: null,
        personId: 10942,
      }),
    ).toBe('Clayton Mclain')
  })

  it('uses owner_name when no person is linked', () => {
    expect(
      resolveOwnerLabel({
        ownerName: 'Clayton Mclain',
        crmName: 'Gabriella Helleck',
        personId: null,
      }),
    ).toBe('Clayton Mclain')
  })

  it('returns null when nothing usable', () => {
    expect(resolveOwnerLabel({ ownerName: '  ', crmName: null, personId: null })).toBeNull()
  })
})

describe('applyCrmOwnerNames', () => {
  it('rewrites ownerName from the CRM map for linked people', () => {
    const names = new Map<number, string>([[10942, 'Gabriella Helleck']])
    const out = applyCrmOwnerNames(
      [
        { personId: 10942, ownerName: 'Clayton Mclain' },
        { personId: null, ownerName: 'Someone Else' },
      ],
      names,
    )
    expect(out[0]!.ownerName).toBe('Gabriella Helleck')
    expect(out[1]!.ownerName).toBe('Someone Else')
  })
})
