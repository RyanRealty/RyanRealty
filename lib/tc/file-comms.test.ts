import { describe, expect, it } from 'vitest'
import {
  addressTokens,
  pickDealForComms,
  matchChecklistItems,
  commsHaystack,
  scoreDealHaystack,
  pdfMmsParts,
  looksLikeReturnedSignedPacket,
  shouldCompleteFromOtherSideReturn,
  fromOtherSideContact,
  pickWaitingEnvelopesForReturn,
  pickWaitingEnvelopesForExecutedDocument,
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

describe('pdfMmsParts', () => {
  const pdf = {
    mediaSid: 'MEaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    contentType: 'application/pdf',
    url: 'https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages/MMxx/Media/MEaa',
  }
  const jpeg = {
    mediaSid: 'MEbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    contentType: 'image/jpeg',
    url: 'https://api.twilio.com/2010-04-01/Accounts/ACxx/Messages/MMxx/Media/MEbb',
  }

  it('keeps PDFs and drops photos', () => {
    expect(pdfMmsParts([jpeg, pdf]).map((p) => p.mediaSid)).toEqual([pdf.mediaSid])
  })

  it('caps at 3', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      ...pdf,
      mediaSid: `ME${String(i).padStart(32, '0')}`,
    }))
    expect(pdfMmsParts(many)).toHaveLength(3)
  })
})

describe('looksLikeReturnedSignedPacket', () => {
  it('matches other-side executed PDFs, not SkySlope completion mail', () => {
    expect(looksLikeReturnedSignedPacket('SW 45th - Signed SPD attached.pdf')).toBe(true)
    expect(looksLikeReturnedSignedPacket('Please see the attached executed repair addendum')).toBe(true)
    expect(
      looksLikeReturnedSignedPacket('Envelope completed: You have documents to sign from noreply@skyslope.com'),
    ).toBe(false)
    expect(
      shouldCompleteFromOtherSideReturn({
        haystack: 'Signed SPD.pdf',
        hasPdf: true,
        fromOtherSide: true,
        executionState: 'fully_executed',
      }),
    ).toBe(true)
    expect(
      shouldCompleteFromOtherSideReturn({
        haystack: 'OFFER attached.pdf',
        hasPdf: true,
        fromOtherSide: true,
        executionState: 'needs_our_signatures',
      }),
    ).toBe(false)
    expect(
      shouldCompleteFromOtherSideReturn({
        haystack: 'Signed SPD.pdf',
        hasPdf: true,
        fromOtherSide: false,
        executionState: 'fully_executed',
      }),
    ).toBe(false)
  })

  it('treats From the other agent as a return, not our outbound To them', () => {
    const other = new Set(['kayla@x.com'])
    expect(fromOtherSideContact(['kayla@x.com'], other)).toBe(true)
    expect(fromOtherSideContact(['matt@ryan-realty.com'], other)).toBe(false)
  })

  it('does not close every waiting envelope from one Signed SPD', () => {
    const waiting = [
      { id: 'spd', name: "Seller's Property Disclosure" },
      { id: 'rsa', name: 'Residential Real Estate Sale Agreement' },
    ]
    expect(pickWaitingEnvelopesForReturn(waiting, 'SW 45th - Signed SPD.pdf').map((e) => e.id)).toEqual(['spd'])
  })
})

describe('pickWaitingEnvelopesForExecutedDocument', () => {
  const waiting = [
    { id: 'env-sale', name: 'Residential Real Estate Sale Agreement - 001 OREF' },
    { id: 'env-spds', name: 'Sellers Property Disclosure Statement - 020 OREF' },
  ]

  it('a returned 043 advisory does not close the sale-agreement envelope', () => {
    expect(
      pickWaitingEnvelopesForExecutedDocument({
        waiting,
        haystack: 'signed docs attached',
        documentName: 'Advisory Regarding Electronic Funds - 043 OREF.pdf',
        formNumbers: ['043'],
      }),
    ).toEqual([])
  })

  it('a returned 001 closes the sale-agreement envelope and nothing else', () => {
    expect(
      pickWaitingEnvelopesForExecutedDocument({
        waiting,
        haystack: 'signed docs attached',
        documentName: 'Residential Real Estate Sale Agreement - 001 OREF.pdf',
        formNumbers: ['001'],
      }).map((e) => e.id),
    ).toEqual(['env-sale'])
  })

  it('a lone waiting envelope is still not closed by an unrelated form', () => {
    expect(
      pickWaitingEnvelopesForExecutedDocument({
        waiting: [waiting[0]],
        haystack: 'here you go',
        documentName: 'Advisory Regarding Electronic Funds - 043 OREF.pdf',
        formNumbers: ['043'],
      }),
    ).toEqual([])
  })

  it('falls back to subject matching only when the document names no form', () => {
    expect(
      pickWaitingEnvelopesForExecutedDocument({
        waiting: [waiting[0]],
        haystack: 'signed sale agreement back from the buyer',
        documentName: 'scan0012.pdf',
        formNumbers: [],
      }).map((e) => e.id),
    ).toEqual(['env-sale'])
  })
})
