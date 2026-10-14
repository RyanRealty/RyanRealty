import { describe, expect, it } from 'vitest'
import { mapExpiredSkeleton, mapFsboSkeleton } from './get'
import type { ProspectComplianceState } from './types'

const compliance = {
  hardStop: false,
  flags: [],
  relisted: false,
  offMarket: false,
  suppressedSms: false,
  noPhone: false,
  noEmail: false,
  reasons: [],
  channels: {
    sms: { blocked: false, reason: null },
    email: { blocked: false, reason: null },
    call: { blocked: false, reason: null },
  },
  allChannelsBlocked: false,
} satisfies ProspectComplianceState

const NOTES = 'Legal owner (entity): PAHLISCH HOMES AT PETROSA LP.'

describe('prospect row keeps the county notes the send reads', () => {
  it('copies enrichment_notes onto an expired row', () => {
    const row = mapExpiredSkeleton({ listing_key: 'K', enrichment_notes: NOTES }, { state: 'none' }, compliance, null)
    expect(row.enrichmentNotes).toBe(NOTES)
  })

  it('copies enrichment_notes onto an FSBO row', () => {
    const row = mapFsboSkeleton(
      { fsbo_url: 'https://fsbo.example/1', enrichment_notes: NOTES },
      { state: 'none' },
      compliance,
    )
    expect(row.enrichmentNotes).toBe(NOTES)
  })

  it('is null when the lookup wrote no notes', () => {
    expect(mapExpiredSkeleton({ listing_key: 'K' }, { state: 'none' }, compliance, null).enrichmentNotes).toBeNull()
    expect(mapFsboSkeleton({ fsbo_url: 'https://fsbo.example/1' }, { state: 'none' }, compliance).enrichmentNotes).toBeNull()
  })
})
