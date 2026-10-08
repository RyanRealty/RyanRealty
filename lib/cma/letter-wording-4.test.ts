/**
 * LETTER WORDING, ROUND FOUR (reader reviews of the rebuilt home-value
 * letters, 2026-10-08).
 *
 *  1. The did-not-sell count says the price window as the search, prints the
 *     homes' own last asks, and names only the reason the fit refused them
 *     for (3062 NW Kelly Hill: "None were close to this home in bedrooms,
 *     bathrooms, size or age" over two 3 bed 2 bath homes refused for size).
 *     The heading over that count does not say none came off (1355
 *     Jacksonville).
 *  2. A held letter states the fact of the failed ask, never buyer intent.
 *  3. Chart money labels: $1,050,000 is "$1.05M", half up in integers, and
 *     two prices on one drawing never share a label.
 *  4. A count of sales says "sales", not "homes".
 *  5. The street-sale chips carry the month they closed.
 *  6. Under contract is a different home from the one for sale, its price is
 *     its list price, and the on-market heading covers what it heads.
 *  7. An on-market letter's closing eyebrow does not ask the owner to act.
 *  8. The subject's outcome reads in lower case like every other column.
 */
import { describe, expect, it } from 'vitest'
import { compactUsd, compactUsdLabels } from '@/lib/cma/compact-usd'
import { shortOrExactUsd, priceHistoryEndLabel, type PricePath } from '@/lib/cma/price-path'
import { listingTimelineSvg } from '@/lib/cma/market-charts'
import { buildExpiredPeerSet, unsoldAreaTotalSentence } from '@/lib/cma/market-status'
import { describeUnlikeHome, unlikeAsksPhrase, unlikeReasonSentence, type CmaUnlikeHome } from '@/lib/cma/unlike-reason'
import { didNotSellHeading } from '@/lib/cma/did-not-sell'
import {
  buildBandRivalSet,
  competitionHeading,
  storedCompetitionSentenceToday,
  underContractClause,
  type CmaBandRival,
  type CmaBandRivalSet,
} from '@/lib/cma/band-rivals'
import { activeEntries, subjectEntry } from '@/lib/cma/matrix-entry'
import {
  NEUTRAL_CLOSE_EYEBROW,
  NEXT_STEP_EYEBROW,
  assembleOpinionPages,
  didNotSellHeadingFor,
  streetSaleMonth,
  subdivisionSalesCountSentence,
  type OpinionPageArgs,
} from '@/lib/cma/opinion-pages'
import { renderCmaHtml, type RenderCmaArgs } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import type { CompArea } from '@/lib/pricing/comp-area'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

const EM_DASH = '—'

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

// ── 1. The homes that came off unsold and are not like this one ───────────

const KELLY_AREA: CompArea = {
  kind: 'subdivisions',
  names: ['Westside Meadows', 'Skyline West'],
  radiusMiles: null,
  centre: { lat: 44.073973, lng: -121.362518 },
  source: 'test',
  sentence: 'Westside Meadows, your own subdivision, with Skyline West within 0.35 miles of your home.',
}

/** 3062 NW Kelly Hill as the peer read sees it: 3 bed, 2 bath, 1,702 sqft, built 2004. */
const KELLY_SUBJECT = {
  streetAddress: '3062 NW Kelly Hill',
  city: 'Bend',
  subdivision: 'Westside Meadows',
  latitude: 44.073973,
  longitude: -121.362518,
  beds: 3,
  baths: 2,
  sqft: 1702,
  yearBuilt: 2004,
  propertySubType: 'Single Family Residence',
  listingKey: 'SUBJ',
  mlsNumber: '220220555',
}

function unsoldRow(o: Partial<CmaMarketAreaRow>): CmaMarketAreaRow {
  return {
    ListingKey: 'K',
    StreetNumber: '1',
    StreetName: 'Test',
    City: 'Bend',
    StandardStatus: 'Canceled',
    ListPrice: 500000,
    OriginalListPrice: null,
    ClosePrice: null,
    CloseDate: null,
    BedroomsTotal: 3,
    BathroomsTotal: 2,
    TotalLivingAreaSqFt: 1700,
    year_built: 2004,
    property_sub_type: 'Single Family Residence',
    SubdivisionName: 'Westside Meadows',
    status_change_timestamp: '2026-01-28',
    OnMarketDate: '2025-10-01',
    Latitude: 44.0735,
    Longitude: -121.3627,
    ...o,
  } as unknown as CmaMarketAreaRow
}

/**
 * The two homes the reader checked (MLS rows read 2026-10-08): 2424
 * Summerhill, Westside Meadows, 3 bed 2 bath, 3,070 sqft, canceled at
 * $895,000; 62685 McClain, Skyline West, 2,142 sqft, canceled at $999,000.
 */
const KELLY_ROWS = [
  unsoldRow({
    ListingKey: 'SUMMERHILL',
    StreetNumber: '2424',
    StreetName: 'Summerhill',
    ListPrice: 895000,
    TotalLivingAreaSqFt: 3070,
    year_built: 2002,
    status_change_timestamp: '2026-01-28T22:18:16+00:00',
  }),
  unsoldRow({
    ListingKey: 'MCCLAIN',
    StreetNumber: '62685',
    StreetName: 'McClain',
    SubdivisionName: 'Skyline West',
    ListPrice: 999000,
    TotalLivingAreaSqFt: 2142,
    year_built: 2023,
    status_change_timestamp: '2025-05-30T20:26:00+00:00',
  }),
]

describe('1. the homes that came off unsold and are not like this one', () => {
  it('3062 NW Kelly Hill: the search window, their own asks, and the one true reason', () => {
    const set = buildExpiredPeerSet({
      rows: KELLY_ROWS,
      subject: KELLY_SUBJECT,
      area: KELLY_AREA,
      asOf: new Date('2026-10-08T12:00:00.000Z'),
      // The closed-sales lookback the build caps the window at (18 months here).
      maxWindowMonths: 18,
      priceBand: { lo: 405_000, hi: 1_362_000 },
    })
    expect(set.count).toBe(0)
    expect(set.areaTotal).toBe(2)
    expect(set.sentence).toBe(
      'We searched listings in Westside Meadows and Skyline West between $405,000 and $1,362,000. Two homes came off the market without selling in the last 18 months, last listed at $895,000 and $999,000. Both are more than 25 percent larger than this home, so they are not compared here.',
    )
    // Both are 3 bed like the subject: no room is named, and no four-way list.
    expect(set.sentence).not.toMatch(/bedroom|bathroom|age\b/)
    expect(set.sentence).not.toContain(EM_DASH)
    expect(set.unlike).toEqual([
      { lastAsk: 895000, reason: 'size', direction: 'larger', limit: 25 },
      { lastAsk: 999000, reason: 'size', direction: 'larger', limit: 25 },
    ])
  })

  it('1355 Jacksonville: one other home, said as "other" under the seller\'s own listing', () => {
    const set = buildExpiredPeerSet({
      rows: [KELLY_ROWS[0]!],
      subject: KELLY_SUBJECT,
      area: KELLY_AREA,
      asOf: new Date('2026-10-08T12:00:00.000Z'),
      maxWindowMonths: 18,
      priceBand: { lo: 405_000, hi: 1_362_000 },
      subjectCameOff: true,
    })
    expect(set.sentence).toBe(
      'We searched listings in Westside Meadows and Skyline West between $405,000 and $1,362,000. One other home came off the market without selling in the last 18 months, last listed at $895,000. It is more than 25 percent larger than this home, so it is not compared here.',
    )
  })

  it('names the room that differs, the years, or the kind of home, and never a reason that is not true', () => {
    const subject = { ...KELLY_SUBJECT, bathsFull: null, bathsHalf: null }
    // Two baths apart is refused anywhere (rule 4): the bathroom is named, the bedroom is not.
    const rooms = describeUnlikeHome(KELLY_AREA, subject, {
      address: '62685 McClain',
      subdivision: 'Skyline West',
      latitude: 44.0739,
      longitude: -121.3625,
      beds: 3,
      baths: 4,
      sqft: 1800,
      yearBuilt: 2004,
      propertySubType: 'Single Family Residence',
    }, 720000)
    expect(rooms).toEqual({ lastAsk: 720000, reason: 'rooms', rooms: ['baths'] })
    expect(unlikeReasonSentence([rooms!])).toBe(
      'It has a different number of bathrooms, so it is not compared here.',
    )
    const age = describeUnlikeHome(KELLY_AREA, subject, {
      address: '19201 Mt. Shasta',
      subdivision: 'Skyline West',
      latitude: 44.0739,
      longitude: -121.3625,
      beds: 3,
      baths: 2,
      sqft: 1800,
      yearBuilt: 1970,
      propertySubType: 'Single Family Residence',
    }, 650000)
    expect(age).toEqual({ lastAsk: 650000, reason: 'age', direction: 'older', limit: 25 })
    expect(unlikeReasonSentence([age!, age!])).toBe(
      'Both were built more than 25 years before this home, so they are not compared here.',
    )
    // Mixed reasons are counted, each with its own verb.
    const size: CmaUnlikeHome = { lastAsk: 895000, reason: 'size', direction: 'larger', limit: 25 }
    expect(unlikeReasonSentence([size, rooms!, size])).toBe(
      'Two are more than 25 percent larger than this home and one has a different number of bathrooms, so they are not compared here.',
    )
    expect(unlikeReasonSentence([{ lastAsk: 1, reason: 'size', direction: 'smaller', limit: 25 }])).toBe(
      'It is more than 25 percent smaller than this home, so it is not compared here.',
    )
    expect(unlikeReasonSentence([{ lastAsk: 1, reason: 'adu' }])).toBe(
      'It has a second living unit, such as an ADU, and this home does not, so it is not compared here.',
    )
  })

  it('says no reason it cannot back when the homes were counted but not described', () => {
    expect(unlikeReasonSentence(null, 1)).toBe('It is not enough like this home to compare here.')
    expect(unlikeReasonSentence(null, 2)).toBe('Neither is enough like this home to compare here.')
    expect(unlikeReasonSentence(null, 7)).toBe('None is enough like this home to compare here.')
    expect(unlikeReasonSentence([], 0)).toBe('')
    // A stored row with no description keeps its count and its window.
    expect(
      unsoldAreaTotalSentence({
        area: KELLY_AREA,
        areaTotal: 2,
        windowMonths: 18,
        priceBand: { lo: 405_000, hi: 1_362_000 },
      }),
    ).toBe(
      'We searched listings in Westside Meadows and Skyline West between $405,000 and $1,362,000. Two homes came off the market without selling in the last 18 months. Neither is enough like this home to compare here.',
    )
  })

  it('prints the homes\' own asks, never the search window as their prices', () => {
    const at = (lastAsk: number): CmaUnlikeHome => ({ lastAsk, reason: 'size' })
    expect(unlikeAsksPhrase([at(895000)])).toBe('at $895,000')
    expect(unlikeAsksPhrase([at(999000), at(895000)])).toBe('at $895,000 and $999,000')
    expect(unlikeAsksPhrase([at(895000), at(895000)])).toBe('at $895,000 each')
    expect(unlikeAsksPhrase([at(1), at(2), at(3), at(900000)])).toBe('between $1 and $900,000')
    // One home with no ask would make the phrase someone else's prices.
    expect(unlikeAsksPhrase([at(895000), { lastAsk: null, reason: 'size' }])).toBe('')
  })

  it('the heading over a count of unlike homes does not say none came off (1355 Jacksonville)', () => {
    expect(didNotSellHeading({ shown: 0, ownFailed: true, unlikeCount: 1 })).toBe(
      'The other listing near you that did not sell is not like yours.',
    )
    expect(didNotSellHeading({ shown: 0, ownFailed: false, unlikeCount: 2 })).toBe(
      'The listings near you that did not sell are not like yours.',
    )
    expect(didNotSellHeading({ shown: 0, ownFailed: true, unlikeCount: 0 })).toBe(
      'No other listing like yours near you came off unsold.',
    )
    expect(didNotSellHeading({ shown: 2, ownFailed: true, unlikeCount: 3 })).toBe(
      'The listings near you that did not sell.',
    )
  })
})

// ── 3. Chart money labels ──────────────────────────────────────────────────

describe('3. chart money labels read the price, round half up, and never repeat', () => {
  it('prints a stated price with the precision it needs (915 Saginaw: $1,050,000)', () => {
    expect(compactUsd(1_050_000)).toBe('$1.05M')
    expect(compactUsd(1_700_000)).toBe('$1.70M')
    expect(compactUsd(2_000_000)).toBe('$2M')
    expect(compactUsd(465_400)).toBe('$465K')
    expect(compactUsd(999_500)).toBe('$1M')
    expect(compactUsd(999_499)).toBe('$999K')
  })

  it('rounds half up in whole-dollar integers, never on the binary float', () => {
    // toFixed printed $1.78M for $1,785,000 and $1.63M for $1,625,000.
    expect(compactUsd(1_785_000)).toBe('$1.79M')
    expect(compactUsd(1_625_000)).toBe('$1.63M')
    expect(compactUsd(1_335_000)).toBe('$1.34M')
    expect(compactUsd(1_334_999)).toBe('$1.33M')
    expect(compactUsd(464_500)).toBe('$465K')
  })

  it('gives two different prices on one drawing two different labels (62475 Woodsman)', () => {
    const edge = compactUsdLabels([1_618_053, 1_554_207])
    expect(edge(1_618_053)).toBe('$1.62M')
    expect(edge(1_554_207)).toBe('$1.55M')
    const close = compactUsdLabels([1_618_053, 1_615_000])
    expect(close(1_618_053)).toBe('$1.618M')
    expect(close(1_615_000)).toBe('$1.615M')
    const closer = compactUsdLabels([1_618_053, 1_618_400])
    expect(closer(1_618_053)).toBe('$1,618,053')
    expect(closer(1_618_400)).toBe('$1,618,400')
    const thousands = compactUsdLabels([49_600, 50_400])
    expect(thousands(49_600)).toBe('$49,600')
    expect(thousands(50_400)).toBe('$50,400')
    // The same price is the same label.
    const same = compactUsdLabels([700_000, 700_000, 650_000])
    expect(same(700_000)).toBe('$700K')
  })

  it('a close prints short only when the short label is the price', () => {
    expect(shortOrExactUsd(1_050_000)).toBe('$1.05M')
    expect(shortOrExactUsd(1_785_000)).toBe('$1,785,000')
    expect(shortOrExactUsd(780_000)).toBe('$780K')
    expect(shortOrExactUsd(609_950)).toBe('$609,950')
  })

  it('the timeline names the ask and the zone edges in labels that differ', () => {
    const svg = listingTimelineSvg({
      listDate: '2026-05-13',
      offMarketDate: '2026-09-28',
      steps: [
        { date: '2026-05-13', ask: 1_050_000 },
        { date: '2026-07-01', ask: 925_000 },
      ],
      rangeLow: 1_554_207,
      rangeHigh: 1_618_053,
      rangeLabel: 'where homes like yours sold',
      status: 'canceled',
      days: 138,
      caption: 'Your asking price against what homes like yours sold for',
    })
    expect(svg).toContain('data-read="Asked $1.05M on May 13"')
    expect(svg).not.toContain('$1.1M')
    expect(svg).toContain('>$1.62M<')
    expect(svg).toContain('>$1.55M<')
    expect((svg.match(/>\$1\.6M</g) ?? []).length).toBe(0)
  })
})

// ── 4 and 5. The street line ──────────────────────────────────────────────

describe('4 and 5. the street line counts sales and dates every chip', () => {
  it('says sales where the number counts sales (1648 Pheasant)', () => {
    expect(subdivisionSalesCountSentence(17, 'Pheasant Hill', ' between 2017 and 2026')).toBe(
      '17 sales closed in Pheasant Hill between 2017 and 2026.',
    )
    expect(subdivisionSalesCountSentence(1, 'Pheasant Hill', '')).toBe('1 sale closed in Pheasant Hill.')
  })

  it('reads the month off the calendar day, so a UTC-midnight first of the month stays in its month', () => {
    expect(streetSaleMonth('2022-03-18T00:00:00+00:00')).toBe('Mar 2022')
    expect(streetSaleMonth('2026-07-01T00:00:00+00:00')).toBe('Jul 2026')
    expect(streetSaleMonth('2026-07-01')).toBe('Jul 2026')
    expect(streetSaleMonth(null)).toBe('')
    expect(streetSaleMonth('not a date')).toBe('')
  })
})

// ── 6. The competition chapter ─────────────────────────────────────────────

describe('6. under contract is a different home, at its list price, under a heading that covers it', () => {
  it('says "other" so the two counts read as different homes (1355 Jacksonville)', () => {
    expect(underContractClause(1, { afterForSale: true, like: ' like yours' })).toBe(
      '1 other home like yours is under contract.',
    )
    expect(underContractClause(3, { afterForSale: true })).toBe('3 other homes are under contract.')
    expect(underContractClause(2, { afterForSale: false })).toBe('2 are under contract.')
    expect(underContractClause(0, { afterForSale: true })).toBe('None are under contract right now.')
  })

  it('rewrites a stored sentence to the same counts with "other", and changes nothing else', () => {
    const stored =
      '1 home like yours is for sale in Northwest Townsite, Grandview, Highland and Bonne Home between $623,000 and $843,000. 1 is under contract. Nothing from outside Northwest Townsite, Grandview, Highland and Bonne Home was added to make up the number.'
    expect(storedCompetitionSentenceToday(stored)).toBe(
      '1 home like yours is for sale in Northwest Townsite, Grandview, Highland and Bonne Home between $623,000 and $843,000. 1 other home like yours is under contract. Nothing from outside Northwest Townsite, Grandview, Highland and Bonne Home was added to make up the number.',
    )
    // A sentence with nothing for sale has no "other" to say.
    const none = 'No home like yours in Old Bend is for sale between $360,000 and $440,000, but one is under contract.'
    expect(storedCompetitionSentenceToday(none)).toBe(none)
    // The old four-reason claim about an unlike home becomes the one thing true of it.
    expect(
      storedCompetitionSentenceToday(
        'No home like yours in Diamond Bar Ranch is for sale or under contract between $386,000 and $472,000. One other home is listed there in that range, but it is not close to this home in bedrooms, bathrooms, size or age, so it is not on this map.',
      ),
    ).toBe(
      'No home like yours in Diamond Bar Ranch is for sale or under contract between $386,000 and $472,000. One other home is listed there in that range. It is not enough like this home to compare here.',
    )
  })

  it('names the true reason for an unlike home listed in the band', () => {
    const set = buildBandRivalSet({
      area: KELLY_AREA,
      lo: 662_000,
      hi: 810_000,
      activeCount: 0,
      pendingCount: 0,
      unlikeCount: 1,
      unlike: [{ lastAsk: 749_000, reason: 'size', direction: 'larger', limit: 25 }],
      rivals: [],
    })
    expect(set.sentence).toBe(
      'No home like yours in Westside Meadows or Skyline West is for sale or under contract between $662,000 and $810,000. One other home is listed there in that range. It is more than 25 percent larger than this home, so it is not compared here.',
    )
    expect(set.unlike).toHaveLength(1)
  })

  it('a pending home prints its list price as the list price, never a contract price', () => {
    const [entry] = activeEntries([
      {
        listingKey: 'P',
        address: '1415 Jacksonville',
        listPrice: 799_000,
        status: 'Pending',
        daysOnMarket: 3,
        photoUrl: null,
        latitude: 44.06,
        longitude: -121.33,
      } as CmaBandRival,
    ])
    expect(entry!.outcome).toMatch(/^listed at \$799K, under contract/)
    expect(entry!.outcome).not.toContain('under contract at')
    const path = {
      label: '1415 Jacksonville',
      startPrice: 799_000,
      startDate: '2026-09-20',
      cuts: [],
      undatedCutTo: null,
      closePrice: null,
      endDate: '2026-09-23',
      outcome: 'under-contract',
      days: 3,
      daysMeasure: 'offer',
    } as unknown as PricePath
    expect(priceHistoryEndLabel(path)).toBe('listed $799K, under contract · offer in 3 days')
  })

  it('the on-market heading covers the homes it heads (3062 NW Kelly Hill)', () => {
    expect(competitionHeading(713_000, { onMarket: true, active: 0, pending: 1 })).toBe(
      'Other homes under contract near this value',
    )
    expect(competitionHeading(713_000, { onMarket: true, active: 2, pending: 1 })).toBe(
      'Other homes for sale or under contract near this value',
    )
    expect(competitionHeading(713_000, { onMarket: true, active: 2, pending: 0 })).toBe(
      'Other homes for sale near this value',
    )
    expect(competitionHeading(713_000, { onMarket: false, active: 0, pending: 1 })).toBe(
      'Who you would compete with at this price',
    )
  })
})

// ── 7 and the letter as a whole: an on-market letter ──────────────────────

const subject: CmaSubject = {
  listingKey: 'SUBJ',
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
  listingHistoryLine: 'Listed May 1, 2026 at $775,000, now $699,999 · 160 days on market.',
} as CmaSubject

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
  } as CmaAdjustedComp
}

const comps: CmaAdjustedComp[] = [
  sale(1, '2955 Bordeaux', 733116, '2026-05-29'),
  sale(2, '2500 Summerhill', 693729, '2026-05-13'),
  sale(3, '62667 McClain', 718217, '2026-02-06'),
]

const pricing = {
  recommended: 713000,
  highEnd: 733116,
  valueLow: 693729,
  valueHigh: 733116,
  predictedClose: 686000,
  confidence: 'Moderate',
  confidenceReason: 'test',
  needsReview: false,
  reviewReason: null,
  notes: [],
} as unknown as CmaPricing

const pending: CmaBandRival = {
  listingKey: 'R1',
  address: '2967 Chardonnay',
  listPrice: 675000,
  status: 'Pending',
  daysOnMarket: 2,
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
}

const bandRivals = {
  area: KELLY_AREA,
  lo: 662000,
  hi: 810000,
  activeCount: 0,
  pendingCount: 1,
  rivals: [pending],
  sentence:
    'No home like yours in Westside Meadows or Skyline West is for sale between $662,000 and $810,000, but one is under contract.',
  source:
    'Homes for sale and under contract in Westside Meadows and Skyline West between $662,000 and $810,000, from the Oregon Data Share MLS as of Oct 8, 2026.',
  widenedFrom: null,
  ringsTried: [],
  unlikeCount: 0,
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

const subdivisionStory = {
  facts: {
    name: 'Westside Meadows',
    totalSales: 44,
    years: [
      { year: 2016, count: 4, medianClose: 500000, medianPpsf: 280 },
      { year: 2026, count: 3, medianClose: 800000, medianPpsf: 420 },
    ],
    recordHigh: null,
    recordLow: null,
    medianDomRecent: null,
    saleToListRecentPct: null,
    subjectSqftPercentile: null,
    vintageSpan: null,
    source: 'test',
  },
  sections: [],
  notableSales: [
    { listNumber: '1', address: '2382 Summerhill', closePrice: 800000, closeDate: '2026-07-01T00:00:00+00:00', sqft: 2091, photoUrl: null, line: '' },
    { listNumber: '2', address: '2757 Aldrich', closePrice: 550000, closeDate: '2022-03-18T00:00:00+00:00', sqft: 1500, photoUrl: null, line: '' },
  ],
  model: null,
  costUsd: null,
  photoSalesReviewed: 0,
}

const unsoldOld = {
  area: KELLY_AREA,
  windowMonths: 18,
  windowsTried: [3, 6, 9, 12, 18],
  widenedTo: null,
  count: 0,
  areaTotal: 2,
  found: 0,
  likeYours: false,
  shortfall: true,
  peers: [],
  priceBand: { lo: 405000, hi: 1362000 },
  sentence:
    'Two homes in Westside Meadows and Skyline West listed between $405,000 and $1,362,000 came off the market without selling in the last 18 months. None were close to this home in bedrooms, bathrooms, size or age, so they are not compared here.',
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
    generatedAtIso: '2026-10-08T03:55:23.264Z',
    subjectTrace: 'subject trace',
    compTrace: ['comp trace'],
    excludedOutliers: [],
    sellerImprovementsText: null,
    site: null,
    expiredAudit: null,
    development: null,
    rental: null,
    bandRivals,
    compArea: KELLY_AREA,
    subdivisionStory,
    expiredPeers: unsoldOld,
    subjectStatus: {
      standardStatus: 'Active',
      isActiveWithOtherBrokerage: true,
      isWithdrawnNotExpired: false,
      listingAgentIsUs: false,
      note: 'test',
    },
    documentStatus: 'draft',
    ...over,
  } as unknown as RenderCmaArgs
}

describe('7. an on-market letter, read end to end', () => {
  const html = renderCmaHtml(letterArgs()).html
  const text = textOf(html)
  const web = textOf(renderImmersiveCmaHtml(letterArgs() as never, 'https://ryan-realty.com'))

  it('closes under a neutral eyebrow that does not ask the owner to act', () => {
    const pages = assembleOpinionPages(letterArgs() as unknown as OpinionPageArgs)
    const close = pages.find((p) => p.closing)!
    expect(close.toc).toBe(NEUTRAL_CLOSE_EYEBROW)
    expect(close.meta).toContain(NEUTRAL_CLOSE_EYEBROW)
    expect(text).not.toContain(NEXT_STEP_EYEBROW)
    expect(web).not.toContain(NEXT_STEP_EYEBROW)
    expect(web).toContain(NEUTRAL_CLOSE_EYEBROW)
  })

  it('an off-market letter still closes on its next step', () => {
    const args = letterArgs({ subject: { ...subject, standardStatus: 'Expired' }, subjectStatus: null } as never)
    const close = assembleOpinionPages(args as unknown as OpinionPageArgs).find((p) => p.closing)!
    expect(close.toc).toBe(NEXT_STEP_EYEBROW)
  })

  it('heads one home under contract as under contract, not for sale', () => {
    expect(text).toContain('Other homes under contract near this value')
    expect(text).not.toContain('Other homes for sale near this value')
    expect(web).toContain('Other homes under contract near this value')
  })

  it('reads the stored did-not-sell count without the false reason, under a heading that agrees', () => {
    expect(didNotSellHeadingFor(letterArgs() as unknown as OpinionPageArgs)).toBe(
      'The listings near you that did not sell are not like yours.',
    )
    expect(text).toContain(
      'We searched listings in Westside Meadows and Skyline West between $405,000 and $1,362,000. Two homes came off the market without selling in the last 18 months. Neither is enough like this home to compare here.',
    )
    expect(text).not.toContain('bedrooms, bathrooms, size or age')
    expect(text).not.toContain('No listing like yours near you came off unsold')
  })

  it('counts sales as sales and dates every street chip', () => {
    expect(text).toContain('44 sales closed in Westside Meadows between 2016 and 2026.')
    expect(text).not.toContain('homes have sold')
    expect(html).toMatch(/2382 Summerhill <span class="n">\$800,000<\/span> <span class="d">Jul 2026<\/span>/)
    expect(html).toMatch(/2757 Aldrich <span class="n">\$550,000<\/span> <span class="d">Mar 2022<\/span>/)
  })

  it('prints the pending home at its list price, under contract', () => {
    expect(text).toContain('listed at $675K, under contract')
    expect(text).not.toContain('under contract at $675K')
  })
})

// ── 8. The subject's outcome ───────────────────────────────────────────────

describe('8. the subject outcome is a label in lower case, like its neighbours', () => {
  it('2745 Aldrich: "came off after 108 days" beside a peer\'s "came off after 96 days"', () => {
    const entry = subjectEntry({
      subject: {
        streetAddress: '2745 Aldrich',
        standardStatus: 'Expired',
        lastListPrice: 569000,
        lastListDate: '2025-12-02T03:13:18+00:00',
      } as unknown as CmaSubject,
      domDays: 108,
      printableAsk: 569000,
    })
    expect(entry.outcome).toBe('came off after 108 days')
    const live = subjectEntry({
      subject: { streetAddress: '2745 Aldrich', standardStatus: 'Active', lastListPrice: 569000 } as unknown as CmaSubject,
      domDays: 12,
      printableAsk: 569000,
    })
    expect(live.outcome).toBe('listed $569,000 · 12 days')
    const off = subjectEntry({
      subject: { streetAddress: '2745 Aldrich', standardStatus: null } as unknown as CmaSubject,
      domDays: null,
      printableAsk: null,
    })
    expect(off.outcome).toBe('not on the market')
  })
})
