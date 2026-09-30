/**
 * The client name, including a trust name, never reaches a letter or email
 * surface. The name check stays as the backstop. Names here are made up.
 */
import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact, cmaFirstContactFactsFromRow } from '@/lib/cma/first-contact'
import { letterOwnerNameCheck, preparedClosingLine, preparedCoverLine } from '@/lib/cma/letter-privacy'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { factsFromCmaSurface } from '@/lib/cma/fsbo-cma-render'
import type { CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const TRUST = 'Jan North & Bea North Rev Liv Trust'
const TOKENS = ['Jan', 'Bea', 'North', 'Rev', 'Liv', 'Trust']
const STREET = '10 Cedar Lane'

const broker = {
  id: null,
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201212071',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: null,
} as CmaBroker

const subject = {
  listingKey: null,
  mlsNumber: '1',
  streetAddress: STREET,
  city: 'Bend',
  state: 'OR',
  postalCode: '97701',
  subdivision: 'Cedar Plat',
  latitude: null,
  longitude: null,
  beds: 3,
  baths: 2,
  sqft: 1800,
  lotAcres: 0.15,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/cedar.jpg',
  publicRemarks: `Owner ${TRUST} will consider offers.`,
  viewDescription: 'Trust the view from the green.',
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 700000,
  lastListDate: '2026-01-07',
  listingHistoryLine: 'Listed Jan 7, 2026 at $700,000, came off expired.',
} as CmaSubject

const pricing = {
  method1Low: 600000,
  method1Mid: 640000,
  method1High: 680000,
  method2: 630000,
  method3: 640000,
  convergenceSpreadPct: 2,
  converged: true,
  conservative: 610000,
  recommended: 640000,
  highEnd: 670000,
  valueLow: 610000,
  valueHigh: 670000,
  confidence: 'Moderate',
  confidenceReason: 'Three sales.',
  needsReview: false,
  reviewReason: null,
  compPpsfCv: 0.04,
  priceOverride: null,
  improvementsValueAdd: null,
  notes: [],
} as unknown as CmaPricing

function args(): RenderCmaArgs & { broker: CmaBroker } {
  return {
    subject,
    comps: [
      {
        listingKey: 'C1',
        mlsNumber: '2',
        address: '12 Cedar Lane',
        city: 'Bend',
        subdivision: 'Cedar Plat',
        latitude: null,
        longitude: null,
        beds: 3,
        baths: 2,
        sqft: 1760,
        lotAcres: 0.14,
        propertySubType: 'Single Family Residence',
        yearBuilt: 1999,
        photoUrl: null,
        publicRemarks: `Contact ${TRUST} about the sale.`,
        viewDescription: null,
        taxAnnual: null,
        listPrice: 650000,
        closePrice: 640000,
        closeDate: '2026-06-01',
        daysToOffer: 10,
        domTotal: 20,
        selectionTier: 'subdivision-6mo',
        monthsSinceClose: 3,
        timeAdjustment: 0,
        timeAdjustedPrice: 640000,
        ppsfTimeAdjusted: 364,
        sizeAdjustment: 0,
        adjustedPrice: 640000,
        weight: 1,
        listingHistoryLine: 'Listed Jan 2, 2026 at $660,000.',
      },
    ],
    market: null,
    pricing,
    broker,
    client: { name: TRUST, email: 'ada@example.com', phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-09-28T12:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    extras: {
      seasonality: null,
      band: null,
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      marketArea: {
        grain: 'subdivision',
        label: 'Cedar Plat',
        source: 'test',
        priceLo: 600000,
        priceHi: 700000,
        selected: { label: 'Expired', count: 1, rows: [] },
        active: null,
        pending: null,
        expired: null,
        closed: null,
        sold90: null,
        listingTrend: null,
        expiredPeers: [
          {
            listingKey: 'P1',
            address: '14 Cedar Lane',
            listPrice: 690000,
            originalListPrice: 710000,
            status: 'Expired',
            daysOnMarket: 40,
            onMarketDate: '2026-01-07',
            photoUrl: null,
            listingHistoryLine: 'Listed Jan 7, 2026 at $710,000, came off expired.',
            beds: 3,
            baths: 2,
            sqft: 1700,
            yearBuilt: 2001,
            lotAcres: 0.12,
            propertySubType: 'Single Family Residence',
            latitude: null,
            longitude: null,
          },
        ],
      },
    },
  } as unknown as RenderCmaArgs & { broker: CmaBroker }
}

function assertNoTokens(text: string) {
  for (const token of TOKENS) {
    expect(text, token).not.toMatch(new RegExp(`\\b${token}\\b`, 'i'))
  }
}

describe('client name stays off every letter and email surface', () => {
  it('prepares the letter for the owners of the street', () => {
    const cover = preparedCoverLine({
      brokerName: 'Matt Ryan',
      generatedAt: 'September 28, 2026',
      streetAddress: STREET,
    })
    const close = preparedClosingLine({
      generatedAt: 'September 28, 2026',
      streetAddress: STREET,
    })
    expect(cover).toBe('Prepared for the owners of 10 Cedar Lane by Matt Ryan, Ryan Realty · September 28, 2026')
    expect(close).toContain('Prepared September 28, 2026 for the owners of 10 Cedar Lane')
    expect(cover).not.toContain('Jan North')
    expect(close).not.toContain('Jan North')
  })

  it('keeps a made-up trust name out of the letter, the cover alt text, and the fallback history line', () => {
    const { html } = renderCmaHtml(args())
    const immersive = renderImmersiveCmaHtml(args(), 'https://ryan-realty.com')
    expect(html).toContain('Prepared for the owners of 10 Cedar Lane')
    expect(immersive).toContain('Prepared for the owners of 10 Cedar Lane')
    expect(html).toContain('January 7, 2026')
    expect(html).not.toMatch(/\bJan\b/)
    assertNoTokens(html)
    assertNoTokens(immersive)
    const check = letterOwnerNameCheck(html, { clientName: TRUST })
    expect(check.pass).toBe(true)
    expect(check.id).toBe('letter-no-owner-names')
    expect(html).toContain(`alt="${STREET}"`)
  })

  it('does not put the trust name in the email subject, greeting, or body', () => {
    const facts = cmaFirstContactFactsFromRow(
      {
        subject_address: `${STREET}, Bend, OR 97701`,
        subject_city: 'Bend',
        client_name: TRUST,
        value_low: 610000,
        value_high: 670000,
        recommended_list: 640000,
      },
      { brokerName: 'Matt Ryan' },
    )
    expect(facts.firstName).toBeNull()
    const letter = composeCmaFirstContact('expired', facts)
    expect(letter.subject).not.toMatch(/\b(Jan|Bea|North|Rev|Liv|Trust)\b/)
    expect(letter.bodyText.startsWith('Hi there,')).toBe(true)
    assertNoTokens(letter.subject)
    assertNoTokens(letter.bodyText)

    const surface = factsFromCmaSurface({
      subject,
      pricing,
      clientName: TRUST,
    })
    expect(surface.ownerFirstName).toBeNull()
    expect(surface.ownerFullName).toBeNull()
  })
})
