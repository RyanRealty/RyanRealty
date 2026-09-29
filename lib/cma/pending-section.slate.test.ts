import { describe, expect, it } from 'vitest'
import { competitionBodyMatrixHtml } from '@/lib/cma/opinion-pages'
import type { OpinionPageArgs } from '@/lib/cma/opinion-pages'
import type { CmaPricing, CmaSubject } from '@/lib/cma/types'

const subject = {
  listingKey: 'S',
  mlsNumber: '1',
  streetAddress: '20594 Slate',
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'Slate Ridge',
  latitude: 44.05,
  longitude: -121.3,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.2,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2015,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 610_000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
} as CmaSubject

const pricing = {
  conservative: 594_000,
  recommended: 610_000,
  highEnd: 623_000,
  valueLow: 594_000,
  valueHigh: 623_000,
  notes: [],
} as unknown as CmaPricing

describe('pending section — Slate shape', () => {
  it('renders the pending section when the letter says 1 is under contract', () => {
    const html = competitionBodyMatrixHtml({
      subject,
      comps: [],
      pricing,
      generatedAtIso: '2026-09-01T00:00:00.000Z',
      bandRivals: {
        lo: 550_000,
        hi: 670_000,
        activeCount: 2,
        pendingCount: 1,
        rivals: [
          {
            listingKey: 'A1',
            address: '100 Same St',
            listPrice: 600_000,
            status: 'Active',
            daysOnMarket: 8,
            photoUrl: null,
            latitude: 44.05,
            longitude: -121.3,
          },
        ],
        sentence: '2 homes are for sale between $550,000 and $670,000. 1 is under contract.',
        source: 'test',
      },
    } as unknown as OpinionPageArgs)
    expect(html).toContain('1 is under contract')
    expect(html).toContain('Pending: under contract in this range')
  })
})
