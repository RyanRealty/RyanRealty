/**
 * A HOME ON THE MARKET GETS AN OPINION OF VALUE, AND IS NEVER ITS OWN
 * COMPETITION (reader review of cma-3062-nw-kelly-hill, 2026-10-08).
 *
 * 3062 NW Kelly Hill is Active with another brokerage at $699,999, cut from
 * $775,000, on the market since May 1, 2026. Its letter opened on "Our
 * Recommended List Price for your home", said "List in that range", quoted
 * our 3% fee on a net page, called itself help "in evaluating a potential
 * listing price", counted the home's own listing as "1 home like yours is for
 * sale" with a pin at 0.00 miles and the owner's own $75,001 cut as someone
 * else's, printed its own original list as $699,999 and its days as the
 * stale MLS 156, and said the range rests on 5 sales beside a chapter that
 * priced on 3. The fixture below is that letter's shape.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderCmaHtml, type RenderCmaArgs } from './render'
import { renderImmersiveCmaHtml } from './immersive'
import { statusIsOnMarket, subjectOnMarket } from './subject-on-market'
import {
  COVER_LIST_PRICE_HEADLINE,
  COVER_ON_MARKET_HEADLINE,
  HELD_PRICE_HEADLINE,
  coverPriceHeadline,
} from './cover-value'
import { onMarketAskSentence, whatItsWorthLead } from './render-pricing-page'
import {
  NON_SOLICITATION_LISTED_SENTENCE,
  NON_SOLICITATION_SENTENCE,
  assembleOpinionPages,
  closingComplianceSentence,
  cmaDisclosureProseHtml,
  matrixEntriesFor,
  mapArgs,
  sellerNetPage,
  type OpinionPageArgs,
} from './opinion-pages'
import { activeRivalsFor, competitionSetWithoutSubject, matrixSetsFromArgs } from './matrix-sets'
import { peerMatchesSubject, sameHouseAddressKey } from './market-status'
import { computeBandPosition } from './extras'
import { subjectDomDays } from './comp-matrix'
import { liveListingDays } from './listing-history-line'
import { rowToSubject } from './subject'
import type { CmaBandRival, CmaBandRivalSet } from './band-rivals'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from './types'
import type { CmaListingRow } from '@/lib/data/cma/builderReads'

const SUBJECT_KEY = '20260430162234807780000000'
const LETTER_DATE = '2026-10-08T03:55:23.264Z' // Oct 7, 2026 in Pacific time

const subject: CmaSubject = {
  listingKey: SUBJECT_KEY,
  mlsNumber: '220220555',
  streetAddress: '3062 NW Kelly Hill',
  city: 'Bend',
  state: 'OR',
  postalCode: '97703',
  subdivision: 'Westside Meadows',
  latitude: 44.073973,
  longitude: -121.362518,
  beds: 3,
  baths: 2,
  sqft: 1702,
  lotAcres: 0.15,
  propertySubType: 'Single Family Residence',
  yearBuilt: 2004,
  garageSpaces: 2,
  photoUrl: null,
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Active',
  lastListPrice: 699999,
  originalListPrice: 775000,
  lastListDate: '2026-05-01T22:24:26+00:00',
  // What the build stored: the MLS DaysOnMarket field, stale at 156.
  listingHistoryLine: 'Listed May 1, 2026 at $775,000, now $699,999 · 156 days on market.',
}

function sale(i: number, address: string, adjustedPrice: number, closeDate: string): CmaAdjustedComp {
  return {
    listingKey: `C${i}`,
    mlsNumber: `22000000${i}`,
    address,
    city: 'Bend',
    subdivision: 'Westside Meadows',
    latitude: 44.073 + i / 1000,
    longitude: -121.362,
    beds: 3,
    baths: 2,
    sqft: 1750,
    lotAcres: 0.15,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2004,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: adjustedPrice + 60000,
    closePrice: adjustedPrice + 50000,
    closeDate,
    daysToOffer: 13,
    domTotal: 13,
    selectionTier: 'subdivision',
    monthsSinceClose: 5,
    timeAdjustment: -40000,
    timeAdjustedPrice: adjustedPrice + 10000,
    ppsfTimeAdjusted: 400,
    sizeAdjustment: -10000,
    adjustedPrice,
    weight: 1,
  }
}

const comps: CmaAdjustedComp[] = [
  sale(1, '2955 Bordeaux', 733116, '2026-05-29'),
  sale(2, '2500 Summerhill', 593729, '2026-05-13'),
  sale(3, '62667 McClain', 818217, '2026-02-06'),
  sale(4, '2974 Chardonnay', 674070, '2025-11-26'),
  sale(5, '3080 Kelly Hill', 727451, '2025-01-03'),
]

const pricing = {
  method1Low: 634000,
  method1Mid: 676000,
  method1High: 723000,
  method2: 727000,
  method3: 710000,
  conservative: 703000,
  recommended: 713000,
  highEnd: 733116,
  valueLow: 674070,
  valueHigh: 733116,
  predictedClose: 686000,
  currentAsk: 699999,
  confidence: 'Moderate',
  confidenceReason: 'test',
  needsReview: false,
  reviewReason: null,
  notes: [],
  setAside: [
    { end: 'low', listingKey: 'C2', address: '2500 Summerhill', reason: 'lowest of the adjusted sales, set aside so one sale cannot set the range', adjustedPrice: 593729 },
    { end: 'high', listingKey: 'C3', address: '62667 McClain', reason: 'highest of the adjusted sales, set aside so one sale cannot set the range', adjustedPrice: 818217 },
  ],
  rangeRule: {
    n: 5,
    kept: 3,
    rule: 'trimmed-one-each-end',
    adjustedLow: 674070,
    adjustedHigh: 733116,
    saleToAskRatio: 0.95815,
    saleToAskSource: 'city-index',
  },
  sellerNet: {
    list: 713000,
    net: 672115,
    basis: 'list',
    lines: [
      { label: 'Our fee', amount: 21390, source: '3% of $713,000' },
      { label: "Buyer's agent", amount: 17825, source: '2.5% of $713,000, if you offer it' },
      { label: 'Title insurance', amount: 1670, source: "Oregon owner's policy rate at $713,000" },
    ],
    sentence: '',
    unknowns: [],
  },
} as unknown as CmaPricing

function rival(over: Partial<CmaBandRival>): CmaBandRival {
  return {
    listingKey: 'R1',
    address: '2967 Chardonnay',
    listPrice: 675000,
    status: 'Pending',
    daysOnMarket: 20,
    photoUrl: null,
    latitude: 44.072607,
    longitude: -121.362541,
    beds: 3,
    baths: 2,
    sqft: 1616,
    yearBuilt: 2002,
    lotAcres: 0.16,
    propertySubType: 'Single Family Residence',
    subdivision: 'Westside Meadows',
    originalListPrice: 675000,
    onMarketDate: '2026-09-17T18:24:41+00:00',
    roomDifference: [],
    ...over,
  }
}

/** The home's own listing, as the band read returned it: no directional. */
const ownListing = rival({
  listingKey: SUBJECT_KEY,
  address: '3062 Kelly Hill',
  listPrice: 699999,
  status: 'Active',
  daysOnMarket: 159,
  latitude: 44.073973,
  longitude: -121.362518,
  sqft: 1702,
  yearBuilt: 2004,
  lotAcres: 0.15,
  originalListPrice: 775000,
  onMarketDate: '2026-05-01T22:24:26+00:00',
})

const area = {
  kind: 'subdivisions',
  names: ['Westside Meadows', 'Skyline West'],
  centre: { lat: 44.073973, lng: -121.362518 },
  platSlugs: [],
  radiusMiles: null,
  sentence: 'Westside Meadows, your own subdivision, with Skyline West within 0.35 miles of your home.',
} as unknown as CmaBandRivalSet['area']

const bandRivals: CmaBandRivalSet = {
  area,
  lo: 662000,
  hi: 809000,
  activeCount: 1,
  pendingCount: 1,
  rivals: [ownListing, rival({})],
  sentence:
    '1 home like yours is for sale in Westside Meadows and Skyline West between $662,000 and $809,000. 1 is under contract. Nothing from outside Westside Meadows and Skyline West was added to make up the number.',
  source:
    'Homes for sale and under contract in Westside Meadows and Skyline West between $662,000 and $809,000, from the Oregon Data Share MLS as of Oct 7, 2026.',
  widenedFrom: null,
  ringsTried: [],
  unlikeCount: 0,
  shortOfFive: true,
  bandBasis: { center: 735000, halfWidth: 0.1, baseHalfWidth: 0.1 },
} as CmaBandRivalSet

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: null,
}

const listedElsewhere = {
  standardStatus: 'Active',
  isActiveWithOtherBrokerage: true,
  isWithdrawnNotExpired: false,
  listingAgentIsUs: false,
  note: 'This home is on the market with another brokerage. This report is an opinion of value and not an offer to represent the owner.',
}

function letterArgs(over: Partial<RenderCmaArgs> = {}): RenderCmaArgs {
  return {
    subject,
    comps,
    market: null,
    pricing,
    broker,
    client: null,
    mapDataUri: null,
    generatedAtIso: LETTER_DATE,
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    rental: null,
    bandRivals,
    compArea: area,
    subjectStatus: listedElsewhere,
    documentStatus: 'draft',
    ...over,
  } as RenderCmaArgs
}

function textOf(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
}

const offMarket: CmaSubject = {
  ...subject,
  standardStatus: 'Expired',
  listingHistoryLine: 'Listed May 1, 2026 at $775,000, now $699,999 · 156 days on market.',
}

describe('the one on-market decision', () => {
  it('is the status test the neutral price line used: active, pending, coming soon', () => {
    for (const s of ['Active', 'Active Under Contract', 'Pending', 'Coming Soon']) {
      expect(statusIsOnMarket(s)).toBe(true)
      expect(subjectOnMarket({ subject: { standardStatus: s } })).toBe(true)
    }
    for (const s of ['Expired', 'Withdrawn', 'Canceled', 'Closed', null]) {
      expect(subjectOnMarket({ subject: { standardStatus: s } })).toBe(false)
    }
  })

  it('also reads the stored subject status, so a row whose subject lost its status word still counts', () => {
    expect(subjectOnMarket({ subject: { standardStatus: null }, subjectStatus: listedElsewhere } as never)).toBe(true)
  })
})

describe('3062 NW Kelly Hill, on the market with another brokerage', () => {
  const html = renderCmaHtml(letterArgs()).html
  const text = textOf(html)
  const web = textOf(renderImmersiveCmaHtml(letterArgs(), 'https://ryan-realty.com'))

  it('labels the cover figure as our opinion of value, with the figure unchanged', () => {
    for (const doc of [text, web]) {
      expect(doc).toContain(COVER_ON_MARKET_HEADLINE)
      expect(doc).not.toContain(COVER_LIST_PRICE_HEADLINE)
      expect(doc).toContain('$713,000')
    }
    expect(coverPriceHeadline(pricing, { onMarket: true })).toBe('Our opinion of value')
    expect(coverPriceHeadline(pricing)).toBe(COVER_LIST_PRICE_HEADLINE)
    expect(coverPriceHeadline({ hold: { kind: 'ask-in-band' } } as never, { onMarket: true })).toBe(HELD_PRICE_HEADLINE)
  })

  it('states where the ask sits against the range and gives no list instruction', () => {
    const lead = whatItsWorthLead(subject, pricing, { asOfIso: LETTER_DATE }, comps, null)
    expect(lead).toContain('run from $674,070 to $733,116')
    expect(lead).toContain('Your home is listed at $699,999, inside the range the sales support.')
    for (const doc of [lead, text, web]) {
      expect(doc).not.toMatch(/List in that range|List at |List between|We'd list|price it at|cut (?:it|the price|your)|raise (?:it|the price)/)
    }
    expect(onMarketAskSentence(650000, { low: 674070, high: 733116 })).toBe(
      'Your home is listed at $650,000, below the range the sales support.',
    )
    expect(onMarketAskSentence(750000, { low: 674070, high: 733116 })).toBe(
      'Your home is listed at $750,000, above the range the sales support.',
    )
  })

  it('prints no net page, no fee and no net at our price, and the page count drops it', () => {
    expect(sellerNetPage(letterArgs() as OpinionPageArgs)).toBeNull()
    for (const doc of [text, web]) {
      expect(doc).not.toContain('Our fee')
      expect(doc).not.toContain('Net at list')
      expect(doc).not.toContain('$672,115')
    }
    const pages = assembleOpinionPages(letterArgs() as OpinionPageArgs).map((p) => p.toc)
    expect(pages.some((t) => /^Net/.test(t ?? ''))).toBe(false)
    const offPages = assembleOpinionPages(letterArgs({ subject: offMarket, subjectStatus: null }) as OpinionPageArgs).map((p) => p.toc)
    expect(offPages.some((t) => /^Net/.test(t ?? ''))).toBe(true)
    // The cover plus the chapters, and the net is not one of them.
    expect(renderCmaHtml(letterArgs()).pageCount).toBe(1 + pages.length)
    expect((html.match(/<section class="page/g) ?? []).length).toBe(1 + pages.length)
  })

  it('states the purpose as an opinion of value, and the ask share without a list price', () => {
    const basis = textOf(cmaDisclosureProseHtml(letterArgs() as OpinionPageArgs))
    expect(basis).toContain(
      'to give the owner of 3062 NW Kelly Hill, Bend, Oregon an opinion of its value as of Oct 7, 2026.',
    )
    expect(basis).not.toContain('evaluating a potential listing price')
    expect(basis).toContain('It does not change the range.')
    expect(basis).not.toContain('That matters for the list price')
    const off = textOf(cmaDisclosureProseHtml(letterArgs({ subject: offMarket, subjectStatus: null }) as OpinionPageArgs))
    expect(off).toContain('in evaluating a potential listing price')
    expect(off).toContain('That matters for the list price, not for the range.')
  })

  it('counts the sales in Basis the way the price chapter does (rule 17)', () => {
    expect(text).toContain('The three closed sales below set this number')
    expect(text).toContain(
      'The value range rests on the three closed comparable sales that set the price, from the Oregon Data Share MLS',
    )
    expect(text).toContain('Two more are shown in the price chapter and set aside.')
    expect(text).not.toContain('rests on 5 closed comparable sales')
  })

  it('says plainly in the close that the home is listed with another brokerage, naming no one', () => {
    expect(closingComplianceSentence(letterArgs() as OpinionPageArgs)).toBe(NON_SOLICITATION_LISTED_SENTENCE)
    expect(NON_SOLICITATION_LISTED_SENTENCE).not.toMatch(/\bIf\b/)
    for (const doc of [text, web]) {
      expect(doc).toContain('Your home is listed with another brokerage.')
      expect(doc).not.toContain('If your home is listed with another broker')
      expect(doc).not.toContain('eXp')
    }
    // On the market, and the row does not say whose listing it is: the conditional.
    expect(closingComplianceSentence(letterArgs({ subjectStatus: null }) as OpinionPageArgs)).toBe(
      NON_SOLICITATION_SENTENCE,
    )
    expect(closingComplianceSentence(letterArgs({ subject: offMarket, subjectStatus: null }) as OpinionPageArgs)).toBe('')
  })

  it('never prints a directive or our fee anywhere in either document', () => {
    for (const doc of [text, web]) {
      expect(doc).not.toMatch(/recommended list price|list price we recommend|the list we started from/i)
      expect(doc).not.toContain('Who you would compete with at this price')
    }
  })
})

describe('the subject is never its own competition', () => {
  const html = renderCmaHtml(letterArgs()).html
  const text = textOf(html)
  const web = textOf(renderImmersiveCmaHtml(letterArgs(), 'https://ryan-realty.com'))

  it('matches the same house by listing key, or by address with the directional folded', () => {
    expect(sameHouseAddressKey('3062 NW Kelly Hill')).toBe(sameHouseAddressKey('3062 Kelly Hill'))
    expect(peerMatchesSubject({ listingKey: 'other', address: '3062 Kelly Hill' }, subject)).toBe(true)
    expect(peerMatchesSubject({ listingKey: SUBJECT_KEY, address: 'anything' }, subject)).toBe(true)
    expect(peerMatchesSubject({ listingKey: 'R1', address: '3080 Kelly Hill' }, subject)).toBe(false)
  })

  it('drops the home from the rivals, the counts and the stored sentence', () => {
    expect(activeRivalsFor(bandRivals.rivals, subject, area).map((r) => r.address)).toEqual(['2967 Chardonnay'])
    expect(matrixSetsFromArgs(letterArgs()).active.map((r) => r.address)).toEqual(['2967 Chardonnay'])
    const set = competitionSetWithoutSubject(bandRivals, subject)!
    expect(set.activeCount).toBe(0)
    expect(set.pendingCount).toBe(1)
    expect(set.rivals.map((r) => r.listingKey)).toEqual(['R1'])
    expect(set.sentence).not.toMatch(/^1 home like yours is for sale/)
    expect(set.sentence).toMatch(/is for sale between \$662,000 and \$809,000, but one is under contract\./)
  })

  it('prints no row, pin, count or cut for the home anywhere', () => {
    const sets = matrixEntriesFor(letterArgs() as OpinionPageArgs)
    expect(sets.active.map((e) => e.address)).toEqual(['2967 Chardonnay'])
    expect(mapArgs(letterArgs() as OpinionPageArgs).facts.map((f) => f.address)).not.toContain('3062 Kelly Hill')
    for (const doc of [text, web]) {
      expect(doc).not.toContain('3062 Kelly Hill ')
      expect(doc).not.toContain('0.00 miles')
      expect(doc).not.toContain('1 home like yours is for sale')
      expect(doc).not.toContain('$75,001')
      expect(doc).not.toContain('Every home here is 1,702 sqft')
      expect(doc).not.toMatch(/Active\s*1 home/)
    }
    expect(text).toContain('The six homes in this report, by status.')
  })

  it('applies to every letter type, an expired one included', () => {
    const expired = matrixEntriesFor(letterArgs({ subject: offMarket, subjectStatus: null }) as OpinionPageArgs)
    expect(expired.active.map((e) => e.address)).toEqual(['2967 Chardonnay'])
  })

  it('leaves the home out of the band read at build', () => {
    const row = (key: string, num: string, name: string, price: number) => ({
      ListingKey: key,
      StreetNumber: num,
      StreetName: name,
      ListPrice: price,
      OriginalListPrice: price,
      StandardStatus: 'Active',
      DaysOnMarket: 10,
      OnMarketDate: '2026-09-01T00:00:00Z',
      PhotoURL: null,
      Latitude: 44.07,
      Longitude: -121.36,
      property_sub_type: 'Single Family Residence',
    })
    const band = computeBandPosition(
      {
        activeAsks: [],
        activeDaysOnMarket: [],
        activeCount: 2,
        pendingCount: 0,
        truncated: false,
        activeRows: [row(SUBJECT_KEY, '3062', 'Kelly Hill', 699999), row('A2', '3001', 'Bordeaux', 720000)],
        pendingRows: [],
      },
      'Bend',
      662000,
      809000,
      subject,
    )!
    expect(band.activeCount).toBe(1)
    expect((band.rivals ?? []).map((r) => r.address)).toEqual(['3001 Bordeaux'])
    expect(band.source).toContain("this home's own listing left out")
  })
})

describe("the subject's own column reads its own listing", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts a live listing from its on-market day to the letter date, never the stale MLS field', () => {
    expect(liveListingDays('2026-05-01T22:24:26+00:00', LETTER_DATE)).toBe(159)
    expect(subjectDomDays(subject, LETTER_DATE)).toBe(159)
    // A came-off listing keeps its stated run.
    expect(subjectDomDays(offMarket, LETTER_DATE)).toBe(156)
  })

  it('prints OriginalListPrice as the original list, and one day count everywhere', () => {
    const entry = matrixEntriesFor(letterArgs() as OpinionPageArgs).subject
    expect(entry.firstAsk).toBe(775000)
    expect(entry.lastAsk).toBe(699999)
    expect(entry.domDays).toBe(159)
    const text = textOf(renderCmaHtml(letterArgs()).html)
    expect(text).toContain('Original list $775,000')
    expect(text).not.toContain('Original list $699,999')
    expect(text).toMatch(/Days on market 159 days/)
    expect(text).not.toContain('156 days')
  })

  it('stores the live count on a fresh build too', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(LETTER_DATE))
    const built = rowToSubject({
      ListingKey: SUBJECT_KEY,
      ListNumber: '220220555',
      StreetNumber: '3062',
      StreetName: 'Kelly Hill',
      City: 'Bend',
      StandardStatus: 'Active',
      ListPrice: 699999,
      OriginalListPrice: 775000,
      OnMarketDate: '2026-05-01T22:24:26+00:00',
      DaysOnMarket: 156,
    } as unknown as CmaListingRow)
    expect(built.listingHistoryLine).toContain('159 days on market')
    expect(built.listingHistoryLine).not.toContain('156')
  })
})
