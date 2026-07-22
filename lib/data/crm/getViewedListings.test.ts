import { describe, it, expect } from 'vitest'
import { buildSessionOrFilter } from './getViewedListings'

describe('buildSessionOrFilter', () => {
  it('matches BOTH id columns for a native lead (no legacy fub id)', () => {
    expect(buildSessionOrFilter(4321, null)).toBe('crm_person_id.eq.4321,fub_person_id.eq.4321')
    expect(buildSessionOrFilter(4321, undefined)).toBe('crm_person_id.eq.4321,fub_person_id.eq.4321')
  })

  it('adds the distinct legacy fub id for an imported lead', () => {
    expect(buildSessionOrFilter(4321, 99)).toBe(
      'crm_person_id.eq.4321,fub_person_id.eq.4321,fub_person_id.eq.99',
    )
  })

  it('dedupes the lockstep case (legacy id equals the crm id)', () => {
    expect(buildSessionOrFilter(4321, 4321)).toBe('crm_person_id.eq.4321,fub_person_id.eq.4321')
  })
})
