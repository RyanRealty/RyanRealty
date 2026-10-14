import { describe, expect, it } from 'vitest'
import {
  GA4_OFFLINE_SCOPE,
  ga4EventForBuyerStage,
  ga4OfflineIdempotencyKey,
  offlineGa4EventParams,
} from './offline-ga4'

describe('ga4EventForBuyerStage', () => {
  it('maps Buyer Contract and Pending to qualify_lead', () => {
    expect(ga4EventForBuyerStage('Buyer Contract')).toEqual({
      eventName: 'qualify_lead',
      leadType: 'buyer_contract',
      stageKey: 'buyer-contract',
    })
    expect(ga4EventForBuyerStage('Pending')).toEqual({
      eventName: 'qualify_lead',
      leadType: 'pending',
      stageKey: 'pending',
    })
  })

  it('maps Closed to close_convert_lead', () => {
    expect(ga4EventForBuyerStage('Closed')).toEqual({
      eventName: 'close_convert_lead',
      leadType: 'closed',
      stageKey: 'closed',
    })
  })

  it('is case and whitespace insensitive', () => {
    expect(ga4EventForBuyerStage('  buyer contract ')).toMatchObject({ eventName: 'qualify_lead' })
    expect(ga4EventForBuyerStage('CLOSED')).toMatchObject({ eventName: 'close_convert_lead' })
  })

  it('does not send seller Listed, Offer, or non-outcomes', () => {
    expect(ga4EventForBuyerStage('Listed')).toBeNull()
    expect(ga4EventForBuyerStage('Offer')).toBeNull()
    expect(ga4EventForBuyerStage('Pre-Listing')).toBeNull()
    expect(ga4EventForBuyerStage('Lost')).toBeNull()
    expect(ga4EventForBuyerStage(null)).toBeNull()
    expect(ga4EventForBuyerStage('')).toBeNull()
  })
})

describe('offlineGa4EventParams — lead_type only, no dollars', () => {
  it('sends lead_type and never value or currency', () => {
    const p = offlineGa4EventParams('buyer_contract')
    expect(p).toEqual({ lead_type: 'buyer_contract' })
    expect(p).not.toHaveProperty('value')
    expect(p).not.toHaveProperty('currency')
  })
})

describe('ga4OfflineIdempotencyKey — same stage + same contact is one send', () => {
  it('is person + stage, not deal, so a second deal at Closed does not resend', () => {
    expect(ga4OfflineIdempotencyKey(64115, 'closed')).toBe('person:64115:closed')
    expect(ga4OfflineIdempotencyKey(64115, 'buyer-contract')).toBe('person:64115:buyer-contract')
    expect(ga4OfflineIdempotencyKey(64115, 'closed')).not.toBe(ga4OfflineIdempotencyKey(64116, 'closed'))
  })

  it('uses the ga4_offline_conversion ledger scope, not the Meta one', () => {
    expect(GA4_OFFLINE_SCOPE).toBe('ga4_offline_conversion')
    expect(GA4_OFFLINE_SCOPE).not.toBe('meta_offline_conversion')
  })
})
