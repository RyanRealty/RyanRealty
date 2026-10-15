import { describe, expect, it } from 'vitest'
import { decideSarahStage } from '@/lib/sarah/intent-flow'

describe('Sarah stage writes', () => {
  it('only uses existing CRM stages and will not downgrade a client', () => {
    expect(decideSarahStage('Lead', 'Seller Prospect')).toBe('Seller Prospect')
    expect(decideSarahStage('Past Client', 'Seller Prospect')).toBeNull()
    expect(decideSarahStage('Pending', 'Lead')).toBeNull()
    expect(decideSarahStage('Closed', 'Lead')).toBeNull()
  })
})
