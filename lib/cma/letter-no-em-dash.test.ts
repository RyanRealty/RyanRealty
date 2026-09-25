/**
 * Zero U+2014 in any CMA letter. A real 15-page packet printed em dashes in
 * the map legend, the disclosure, matrix headings and the exclusive-pocket
 * note. This renders the existing letter-craft fixture and fails if any
 * remain.
 */
import { describe, expect, it } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'

const subject = {
  listingKey: 'S1',
  mlsNumber: '1',
  streetAddress: '15991 Falcon',
  city: 'La Pine',
  state: 'OR',
  postalCode: '97739',
  subdivision: 'Tall Pines',
  latitude: 43.7,
  longitude: -121.5,
  beds: 3,
  baths: 2,
  sqft: 1600,
  lotAcres: 0.25,
  propertySubType: 'Single Family Residence',
  yearBuilt: 1998,
  garageSpaces: 2,
  photoUrl: 'https://cdn.example/falcon.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 525000,
  lastListDate: '2026-03-01',
  listingHistoryLine: null,
} as CmaSubject

const pricing = {
  conservative: 485000,
  recommended: 497800,
  highEnd: 510000,
  valueLow: 485000,
  valueHigh: 510000,
  predictedClose: 490000,
  confidence: 'High',
  confidenceReason: 'Tight',
  notes: [
    'These sales are the exclusive pocket. Date adjustment does not walk the La Pine city index. That series includes tracts already excluded from this set. Each sale stays on its sold and last-ask price. Size and story class do not adjust.',
  ],
} as unknown as CmaPricing

const broker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
} as CmaBroker

const comp = {
  listingKey: 'C1',
  mlsNumber: '1',
  address: '12 Pine',
  city: 'La Pine',
  subdivision: 'Tall Pines',
  latitude: 43.71,
  longitude: -121.51,
  beds: 3,
  baths: 2,
  sqft: 1580,
  lotAcres: 0.22,
  propertySubType: null,
  yearBuilt: 1999,
  photoUrl: 'https://cdn.example/c1.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 510000,
  closePrice: 500000,
  closeDate: '2026-06-01',
  daysToOffer: 10,
  domTotal: 20,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 500000,
  ppsfTimeAdjusted: 316,
  sizeAdjustment: 0,
  adjustedPrice: 500000,
  weight: 1,
  listingHistoryLine:
    'Listed May 1, 2026 at $529,000, cut to $510,000, sold Jun 1, 2026 at $500,000 · 20 days on market',
} as unknown as CmaAdjustedComp

function args(): RenderCmaArgs {
  return {
    subject,
    comps: Array.from({ length: 5 }, (_, i) => ({
      ...comp,
      listingKey: `C${i + 1}`,
      address: `${10 + i} Pine`,
      adjustedPrice: 500000 + i * 1000,
    })),
    market: null,
    pricing,
    broker,
    client: { name: 'Owner', email: null, phone: null, notes: null },
    mapDataUri: 'data:image/png;base64,COMPSMAP',
    subjectMapDataUri: 'data:image/png;base64,SUBJECTMAP',
    mapOverlay: {
      view: { centerLat: 43.7, centerLng: -121.5, zoom: 14, width: 640, height: 400 },
      pins: [
        { key: null, family: 'subject', lat: 43.7, lng: -121.5 },
        { key: '1', family: 'closed', lat: 43.71, lng: -121.51 },
        { key: 'A', family: 'active', lat: 43.7, lng: -121.5 },
      ],
    },
    generatedAtIso: '2026-09-12T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    expiredAudit: {
      findings: [{ code: 'ask-above-range', fact: 'The final asking price was $525,000.' }],
      finalCycle: { initialAsk: 549000, cuts: [] },
    } as never,
    bandRivals: {
      lo: 480000,
      hi: 520000,
      activeCount: 1,
      pendingCount: 1,
      rivals: [
        {
          listingKey: 'A1',
          address: '20 Pine',
          listPrice: 515000,
          status: 'Active',
          daysOnMarket: 18,
          photoUrl: null,
          latitude: 43.7,
          longitude: -121.5,
          beds: 3,
          baths: 2,
          sqft: 1610,
          yearBuilt: 1998,
          lotAcres: 0.24,
          propertySubType: 'Single Family Residence',
          originalListPrice: 529000,
          onMarketDate: '2026-08-01',
          listingHistoryLine: null,
        },
        {
          listingKey: 'P1',
          address: '22 Pine',
          listPrice: 505000,
          status: 'Pending',
          daysOnMarket: 9,
          photoUrl: null,
          latitude: 43.701,
          longitude: -121.501,
          beds: 3,
          baths: 2,
          sqft: 1590,
          yearBuilt: 1997,
          lotAcres: 0.23,
          propertySubType: 'Single Family Residence',
          originalListPrice: 505000,
          onMarketDate: '2026-08-20',
          listingHistoryLine: null,
        },
      ],
      sentence: 'One home is for sale and one is under contract in this range.',
      source: 'fixture',
      area: {
        kind: 'radius',
        names: [],
        radiusMiles: 2,
        centre: { lat: 43.7, lng: -121.5 },
        source: 'fixture',
        sentence: 'within two miles of your home',
      },
      widenedFrom: null,
      ringsTried: [2],
    } as never,
  }
}

describe('CMA letter copy has no em dash', () => {
  it('renders the letter-craft fixture without U+2014', () => {
    const { html } = renderCmaHtml(args())
    expect(html).toContain('Closed sales: these set the price')
    expect(html).toContain('named in it: the recorded facts')
    expect(html).toContain('Active: asking in this range now')
    expect(html).toContain('Pending: under contract in this range')
    // Stylesheet comments are developer notes, not printed copy. The reader
    // sees the markup outside <style>.
    const body = html.replace(/<style\b[\s\S]*?<\/style>/gi, '')
    expect(body).not.toContain('\u2014')
  })

  it('rewrites a stored method sentence that still carries an em dash', () => {
    const stored =
      'These sales are the exclusive pocket. Date adjustment does not walk the city index, which includes tracts already excluded from this set. Each sale stays on its own sold and last-ask price — size and story class do not adjust.'
    const { html } = renderCmaHtml({
      ...args(),
      pricing: {
        ...args().pricing,
        timeAdjustment: { sentence: stored },
      } as never,
    })
    const body = html.replace(/<style\b[\s\S]*?<\/style>/gi, '')
    expect(body).toContain('price. Size and story class do not adjust.')
    expect(body).not.toContain('\u2014')
    expect(body).not.toContain(stored)
  })
})
