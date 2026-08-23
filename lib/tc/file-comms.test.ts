import { describe, expect, it } from 'vitest'
import {
  addressTokens,
  pickDealForComms,
  matchChecklistItems,
  commsHaystack,
  scoreDealHaystack,
} from './file-comms'

describe('pickDealForComms', () => {
  const impala = { dealId: 'i', address: '5663 SW Impala Avenue, Redmond, OR 97756', stage: 'active_listing' }
  const beaumont = { dealId: 'b', address: '20702 Beaumont Drive, Bend, OR 97701', stage: 'pending' }
  const closed = { dealId: 'c', address: '712 SW 1st St, Madras, OR 97741', stage: 'closed' }
  const dead = { dealId: 'd', address: 'Dead House', stage: 'dead' }

  it('prefers live stages over closed', () => {
    expect(pickDealForComms([closed, impala], 'hello')?.dealId).toBe('i')
  })

  it('picks the deal whose street tokens appear in the mail', () => {
    expect(pickDealForComms([impala, beaumont], 'Prelim title for 20702 Beaumont')?.dealId).toBe('b')
    expect(pickDealForComms([impala, beaumont], 'listing photos Impala')?.dealId).toBe('i')
  })

  it('ignores dead unless that is the only deal', () => {
    expect(pickDealForComms([dead, closed], 'hi')?.dealId).toBe('c')
    expect(pickDealForComms([dead], 'hi')?.dealId).toBe('d')
  })

  it('returns null on empty', () => {
    expect(pickDealForComms([], 'x')).toBeNull()
  })

  it('needs house number plus street before an address-only fallback should fire (score >= 2)', () => {
    expect(scoreDealHaystack(beaumont.address, '20702 Beaumont title report')).toBeGreaterThanOrEqual(2)
    expect(scoreDealHaystack(beaumont.address, 'hello there')).toBe(0)
  })
})

describe('matchChecklistItems', () => {
  const items = [
    { id: '1', name: "Seller's Property Disclosure Statement (buyer 5-business-day revocation)", type_name: 'OREF 020' },
    { id: '2', name: 'Earnest Money Receipt', type_name: 'earnest-money' },
    { id: '3', name: 'Exclusive Listing Agreement', type_name: 'OREF 015' },
  ]

  it('files a disclosure PDF onto the SPDS row', () => {
    const hits = matchChecklistItems(items, 'Sellers_Property_Disclosure_Statement.pdf OREF 020')
    expect(hits.map((h) => h.id)).toEqual(['1'])
  })

  it('files earnest money language onto the EM row', () => {
    expect(matchChecklistItems(items, 'Please find the earnest money receipt attached').map((h) => h.id)).toEqual(['2'])
  })

  it('returns nothing when the haystack has no form tokens', () => {
    expect(matchChecklistItems(items, 'How was your weekend?')).toEqual([])
  })
})

describe('addressTokens / haystack', () => {
  it('keeps house number and street name', () => {
    const t = addressTokens('5663 SW Impala Avenue, Redmond, OR 97756')
    expect(t).toContain('5663')
    expect(t).toContain('impala')
    expect(t).not.toContain('bend')
  })
  it('scores a subject that names the street', () => {
    expect(scoreDealHaystack('5663 SW Impala Avenue', 'docs for 5663 Impala')).toBeGreaterThan(0)
  })
  it('joins title body filenames', () => {
    expect(commsHaystack({ title: 'A', body: 'B', filenames: ['c.pdf'] })).toContain('c.pdf')
  })
})
