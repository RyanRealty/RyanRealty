import { describe, expect, it } from 'vitest'
import {
  applyModelStageDecision,
  buildModelStagePrompt,
  candidateDealsForModel,
  worthModelStage,
  type ModelStageDecision,
} from './mail-model-stage'
import type { DealFacts } from './mail-rules'

describe('worthModelStage', () => {
  it('never runs on filed or ambiguous mail — the rules already placed it', () => {
    expect(worthModelStage({ status: 'filed', category: 'offer', attachments: [], propertyHint: null })).toBe(false)
    expect(worthModelStage({ status: 'ambiguous', category: 'offer', attachments: [], propertyHint: null })).toBe(false)
    // Ambiguous mail the rules narrowed to two or more deals: the model picks among them.
    expect(worthModelStage({ status: 'ambiguous', category: 'general', attachments: [], propertyHint: null, candidateCount: 2 })).toBe(true)
    expect(worthModelStage({ status: 'ambiguous', category: 'general', attachments: [], propertyHint: null, candidateCount: 1 })).toBe(false)
  })

  it('skips ordinary general mail with nothing transactional about it', () => {
    expect(worthModelStage({ status: 'not_deal', category: 'general', attachments: [], propertyHint: null })).toBe(false)
  })

  it('runs when the rules already category the message as transactional', () => {
    expect(worthModelStage({ status: 'not_deal', category: 'escrow_title', attachments: [], propertyHint: null })).toBe(true)
  })

  it('runs when a transaction-form attachment showed up on otherwise general mail', () => {
    expect(
      worthModelStage({
        status: 'unfiled_transaction',
        category: 'general',
        attachments: [{ name: 'Sale Agreement Addendum.pdf' }],
        propertyHint: null,
      }),
    ).toBe(true)
  })

  it('runs when the subject named a property the rules could not place', () => {
    expect(worthModelStage({ status: 'not_deal', category: 'general', attachments: [], propertyHint: '909 delaware' })).toBe(true)
  })
})

describe('applyModelStageDecision', () => {
  const base: ModelStageDecision = { dealId: null, newTransactionAddress: null, notDeal: false, confidence: 0, reason: 'r' }

  it('files at or above the confidence threshold with a named deal', () => {
    expect(applyModelStageDecision({ ...base, dealId: 'd1', confidence: 0.9 })).toEqual({ action: 'file', dealId: 'd1' })
    expect(applyModelStageDecision({ ...base, dealId: 'd1', confidence: 0.95 })).toEqual({ action: 'file', dealId: 'd1' })
  })

  it('never files below the threshold — queues for a person instead', () => {
    expect(applyModelStageDecision({ ...base, dealId: 'd1', confidence: 0.89 })).toEqual({ action: 'queue', status: 'ambiguous', dealId: 'd1' })
  })

  it('queues a new-address guess as unfiled_transaction, never files it', () => {
    expect(applyModelStageDecision({ ...base, newTransactionAddress: '909 NW Delaware Ave', confidence: 0.99 })).toEqual({
      action: 'queue',
      status: 'unfiled_transaction',
      dealId: null,
    })
  })

  it('never dismisses on the model saying notDeal — it just leaves the rules status', () => {
    expect(applyModelStageDecision({ ...base, notDeal: true, confidence: 0.99 })).toEqual({ action: 'leave' })
  })

  it('leaves a message with nothing to go on', () => {
    expect(applyModelStageDecision(base)).toEqual({ action: 'leave' })
  })

  it('respects a caller-supplied threshold', () => {
    expect(applyModelStageDecision({ ...base, dealId: 'd1', confidence: 0.7 }, 0.6)).toEqual({ action: 'file', dealId: 'd1' })
  })
})

describe('candidateDealsForModel', () => {
  const deals: DealFacts[] = [
    { dealId: 'open', address: '1 Open St', city: 'Bend', stage: 'pending', cycles: [], partyEmails: [], contactEmails: [] },
    { dealId: 'closed-old', address: '2 Old St', city: 'Bend', stage: 'closed', cycles: [], partyEmails: [], contactEmails: [] },
  ]

  it('keeps only deals the openAt predicate says are open', () => {
    const got = candidateDealsForModel(deals, '2026-09-24T00:00:00Z', (d) => d.dealId === 'open')
    expect(got.map((c) => c.dealId)).toEqual(['open'])
  })

  it('carries address, MLS and escrow numbers for the prompt', () => {
    const withCycles: DealFacts[] = [
      {
        dealId: 'd1',
        address: '2680 NW Nordic Ave',
        city: 'Bend',
        stage: 'pending',
        cycles: [
          {
            id: 'c1',
            kind: 'sale',
            status: 'Pending',
            mlsNumber: '220123456',
            escrowNumber: '25-99999',
            listingDate: null,
            acceptanceDate: null,
            closeDate: null,
            deadDate: null,
            createdAt: null,
          },
        ],
        partyEmails: [],
        contactEmails: [],
      },
    ]
    const [c] = candidateDealsForModel(withCycles, '2026-09-24T00:00:00Z', () => true)
    expect(c).toMatchObject({ dealId: 'd1', address: '2680 NW Nordic Ave', mlsNumber: '220123456', escrowNumber: '25-99999' })
  })
})

describe('buildModelStagePrompt', () => {
  it('never invents a deal — every candidate on the list came from the caller', () => {
    const { user } = buildModelStagePrompt({
      facts: { subject: 'Re: inspection report', from: ['a@x.com'], to: ['matt@ryan-realty.com'], cc: [], body: 'see attached', attachments: [] },
      candidates: [{ dealId: 'd1', address: '909 NW Delaware Ave', city: 'Bend', mlsNumber: null, escrowNumber: null, parties: [] }],
    })
    expect(user).toContain('d1')
    expect(user).toContain('909 NW Delaware Ave')
    expect(user).toContain('Re: inspection report')
  })

  it('choose mode: only the tied deals, with their clients, and the instruction to pick one or none', () => {
    const { system, user } = buildModelStagePrompt({
      facts: { subject: 'Tuesday Updates', from: ['rebeccapeterson@ryan-realty.com'], to: ['client@live.com'], cc: [], body: 'painters start Friday', attachments: [] },
      candidates: [
        { dealId: 'nordic', address: '2680 NW Nordic Avenue', city: 'Bend', mlsNumber: null, escrowNumber: null, parties: ['client@live.com'] },
        { dealId: 'drouillard', address: '2354 NW Drouillard Ave', city: 'Bend', mlsNumber: null, escrowNumber: null, parties: ['client@live.com'] },
      ],
      mode: 'choose',
    })
    expect(system).toMatch(/sender or recipients are on every deal listed/)
    expect(user).toContain('Deals the sender or recipients are on')
    expect(user).toContain('clients client@live.com')
    expect(user).not.toContain('Open deals')
  })

  it('says "(none)" rather than fabricating an empty deal when there are no candidates', () => {
    const { user } = buildModelStagePrompt({
      facts: { subject: 's', from: [], to: [], cc: [], body: 'b', attachments: [] },
      candidates: [],
    })
    expect(user).toContain('(no open deals)')
  })
})
