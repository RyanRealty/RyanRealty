import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact } from '@/lib/cma/first-contact'
import { composeCmaBottomWhyList, composeCmaCoverIntro, emptyFsboCmaMergeFacts } from '@/lib/cma/fsbo-cma-templates'
import { whyThisListPrice } from '@/lib/cma/client-facing'
import { renderCmaHtml } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import { renderConsentShell, renderRegisterShell } from '@/lib/cma/register-gate'
import { findSellerBannedWords } from '@/lib/cma/seller-text'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * Mannered CMA copy: a sentence whose job is to explain, praise, hedge, or
 * soften the sentence before it. Facts stay. Interpretation goes.
 */
const MANNERED =
  /full picture now|no pressure either way|room to negotiate|strategic list|matches what buyers|Lenders order appraisals|We spent time on why|wish you the best|boutique brokerage|the better path for this sale|all-time low|Under each one is our take|It is not a second list price|You have the full picture|left on the table|gets sharper in both directions|One quick sign-in confirms|narrows the pool|teaches buyers to wait|stale listings tend|inherits the history|gives buyers less reason|Questions on any line|and our take|Call anytime|It covers the sales|If you want to see|Sign in to confirm|We have not seen inside|each adjusted for when it sold|The close is the contract price|so buyers compare this home|rather than on price alone|while the listing is new|shifts the relist conversation|not unrecoverable|sends no new signal|to bracket the range|how your ask sits against|It comes to \w+'s phone|Size and price against this home|The sales we kept, against what is for sale|Worth a planning conversation/i

const subject: CmaSubject = {
  listingKey: null,
  mlsNumber: '220126412',
  streetAddress: '648 SE Douglas Street',
  city: 'Bend',
  state: 'OR',
  postalCode: '97702',
  subdivision: 'Clear Sky Estates',
  latitude: 44.05,
  longitude: -121.29,
  beds: 3,
  baths: 1,
  sqft: 1056,
  lotAcres: 0.14,
  propertySubType: null,
  yearBuilt: 1978,
  garageSpaces: 1,
  photoUrl: 'https://cdn.example/douglas.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  standardStatus: 'Expired',
  lastListPrice: 445000,
  lastListDate: '2021-07-01',
  listingHistoryLine: null,
}

const comp: CmaAdjustedComp = {
  listingKey: 'C1',
  mlsNumber: '220222218',
  address: '947 SE 6th Street',
  city: 'Bend',
  subdivision: 'Clear Sky Estates',
  latitude: 44.05,
  longitude: -121.29,
  beds: 3,
  baths: 1,
  sqft: 1036,
  lotAcres: 0.14,
  propertySubType: null,
  yearBuilt: 1978,
  photoUrl: 'https://cdn.example/6th.jpg',
  publicRemarks: null,
  viewDescription: null,
  taxAnnual: null,
  listPrice: 499000,
  closePrice: 495000,
  closeDate: '2026-06-10',
  daysToOffer: 6,
  domTotal: 10,
  selectionTier: 'subdivision',
  monthsSinceClose: 2,
  timeAdjustment: 0,
  timeAdjustedPrice: 495000,
  ppsfTimeAdjusted: 478,
  sizeAdjustment: 0,
  adjustedPrice: 465744,
  weight: 1,
}

const broker: CmaBroker = {
  id: 'id-matt',
  slug: 'matthew-ryan',
  displayName: 'Matt Ryan',
  title: 'Owner & Principal Broker',
  licenseNumber: '201206613',
  email: 'matt@ryan-realty.com',
  phone: '541.703.3095',
  photoUrl: '/images/brokers/ryan-matt.png',
}

const pricing = {
  method1Low: 440000,
  method1Mid: 450000,
  method1High: 460000,
  method2: 448000,
  method3: 452000,
  conservative: 464000,
  recommended: 472000,
  highEnd: 481000,
  valueLow: 448000,
  valueHigh: 480000,
  predictedClose: 452000,
  confidence: 'High',
  confidenceReason: 'Tight set.',
  needsReview: false,
  reviewReason: null,
  notes: [],
  priceOverride: 472000,
} as unknown as CmaPricing

function assertPlain(label: string, text: string) {
  expect(text, label).not.toMatch(MANNERED)
}

describe('CMA seller copy has no mannered prose', () => {
  it('strips the cover lecture, the next-step pitch, and the email syrup', () => {
    const cover = composeCmaCoverIntro({
      ...emptyFsboCmaMergeFacts(),
      propertyAddress: '2465 7th',
      propertyCity: 'Redmond',
      ownerFullName: 'Blair Auld',
      suggestedListPrice: '$392,000',
      priceRangeLow: '$378,000',
      priceRangeHigh: '$407,000',
    })
    assertPlain('cover', cover.fullText)

    const whyList = composeCmaBottomWhyList({
      ...emptyFsboCmaMergeFacts(),
      propertyAddress: '2465 7th',
      agentName: 'Matt Ryan',
    })
    assertPlain('why-list', whyList.bodyText)

    const letter = composeCmaFirstContact('expired', {
      address: '2465 7th',
      firstName: 'Blair',
      valueLow: 378000,
      valueHigh: 407000,
      recommendedList: 392000,
      lastListPrice: 460000,
      brokerName: 'Matt Ryan',
      city: 'Redmond',
      subdivision: 'Diamond Bar Ranch',
    })
    assertPlain('first-contact', letter.bodyText)

    const why = whyThisListPrice({
      subject,
      comps: [comp],
      market: null,
      pricing,
    })
    assertPlain('why-strategy', `${why.heading} ${why.coverSentence} ${why.strategy ?? ''} ${why.bullets.map((b) => b.text).join(' ')}`)

    const { html } = renderCmaHtml({
      subject,
      comps: [comp],
      market: null,
      pricing,
      broker,
      client: { name: 'Pat', email: null, phone: null, notes: null },
      mapDataUri: null,
      generatedAtIso: '2026-09-05T00:00:00.000Z',
      subjectTrace: 't',
      compTrace: [],
      excludedOutliers: [],
      tiersUsed: ['subdivision-3mo'],
      expiredAudit: {
        findings: [{ lens: 'pricing', fact: 'Listed at $800,000.', meaning: 'The ask sat above the closed sales.' }],
        services: [],
        netSheet: {
          salePrice: 472000,
          lines: [],
          totalCosts: 0,
          estimatedNet: 472000,
          netConservative: 464000,
          netHighEnd: 481000,
          assumptions: [],
        },
        feeLine: '',
      },
    })
    assertPlain('print-html', html)

    const immersive = renderImmersiveCmaHtml(
      {
        subject,
        comps: [comp],
        market: null,
        pricing,
        broker,
        client: { name: 'Pat', email: null, phone: null, notes: null },
        mapDataUri: null,
        generatedAtIso: '2026-09-05T00:00:00.000Z',
        subjectTrace: 't',
        compTrace: [],
        excludedOutliers: [],
        tiersUsed: ['subdivision-3mo'],
      },
      'https://ryan-realty.com',
    )
    assertPlain('immersive-html', immersive)

    assertPlain(
      'register-shell',
      renderRegisterShell({ slug: 'cma-x', address: '2465 7th', clientName: 'Blair Auld' }),
    )
    assertPlain(
      'consent-shell',
      renderConsentShell({
        slug: 'cma-x',
        address: '2465 7th',
        viewerEmail: 'blair@example.com',
        smsConsentText: 'I agree to receive text messages from Ryan Realty',
        claiming: false,
      }),
    )
  })
})

/**
 * The banned WORDS (blueprint § Words, Matt 2026-09-07: "no one says band").
 *
 * The list itself and the visible-text extractor live in
 * `lib/cma/seller-text.ts`, which explains why this is not a
 * `scripts/brand-voice-vocabulary.cjs` entry: that file has no per-surface
 * scope and is mirrored into every live send path, and "band" is legitimate
 * elsewhere in the shop. Same list runs in `scripts/cma-lookpass.ts --check`
 * against the four real documents.
 *
 * FOUR rendered documents, because the two origins print different chapters:
 * an expired subject carries What happened, an asked one does not.
 */
function bannedWordArgs(over: Partial<Parameters<typeof renderCmaHtml>[0]> = {}) {
  return {
    subject,
    comps: [comp, { ...comp, listingKey: 'C2', address: '1120 SE 9th Street', adjustedPrice: 470000 }, { ...comp, listingKey: 'C3', address: '55 SE Roosevelt Avenue', adjustedPrice: 462000 }],
    pricing,
    broker,
    client: { name: 'Pat', email: null, phone: null, notes: null },
    mapDataUri: null,
    generatedAtIso: '2026-09-07T00:00:00.000Z',
    subjectTrace: 't',
    compTrace: [],
    excludedOutliers: [],
    tiersUsed: ['subdivision-3mo'],
    market: {
      geoSlug: 'bend',
      geoLabel: 'Bend',
      periodStart: '2025-09-07',
      periodEnd: '2026-09-07',
      soldCount365: 1880,
      medianSalePrice: 675000,
      medianDom: 21,
      medianPpsf: 380,
      saleToListRatio: 0.98,
      yoyMedianPriceDeltaPct: 1.2,
      activeCount: 400,
      pendingCount: 120,
      monthsOfSupply: 3.2,
      mosFormula: 'pulse',
      marketVerdict: 'seller',
      methodologyVersion: 'v3-2026-05-07',
      computedAt: '2026-09-07',
      pulseUpdatedAt: '2026-09-07',
      trend: [],
    },
    extras: {
      seasonality: null,
      subdivisionPulse: null,
      financing: null,
      photoBench: null,
      band: {
        lo: 430000,
        hi: 520000,
        activeCount: 27,
        pendingCount: 14,
        activeMedianAsk: 469000,
        activeMedianDom: 12,
        source: 'Oregon Data Share MLS. Bend, $430,000 to $520,000.',
        rivals: [
          {
            listingKey: 'A1',
            address: '55 NE Quimby Avenue',
            listPrice: 469000,
            status: 'Active' as const,
            daysOnMarket: 11,
            photoUrl: null,
            latitude: 44.05,
            longitude: -121.29,
            beds: 3,
            baths: 1,
            sqft: 1050,
            yearBuilt: 1979,
          },
        ],
      },
      marketArea: {
        grain: 'subdivision' as const,
        label: 'Clear Sky Estates',
        source: 'Oregon Data Share MLS. Clear Sky Estates, last 12 months.',
        priceLo: 430000,
        priceHi: 520000,
        selected: null,
        active: null,
        pending: null,
        expired: null,
        closed: null,
        sold90: null,
        listingTrend: [],
        outcomes: {
          lo: 430000,
          hi: 520000,
          list: 472000,
          sold: [450000, 462000, 470000, 480000, 495000],
          unsold: [510000, 520000],
          lastAsk: 445000,
          label: 'Clear Sky Estates',
          source: 'Oregon Data Share MLS. Clear Sky Estates, last 12 months.',
          soldShown: 5,
          soldTotal: 5,
          unsoldShown: 2,
          unsoldTotal: 2,
        },
        expiredPeers: [
          {
            listingKey: 'U1',
            address: '2527 SE 5th Street',
            listPrice: 510000,
            status: 'Canceled',
            daysOnMarket: 36,
            onMarketDate: '2025-12-15',
            photoUrl: null,
            latitude: 44.05,
            longitude: -121.29,
            beds: 3,
            baths: 1,
            sqft: 1040,
            lotAcres: 0.14,
            yearBuilt: 1978,
            propertySubType: 'Single Family Residence',
            originalListPrice: 510000,
            listingHistoryLine: null,
          },
        ],
      },
    },
    ...over,
  } as unknown as Parameters<typeof renderCmaHtml>[0]
}

const expiredArgs = bannedWordArgs({
  expiredAudit: {
    findings: [{ lens: 'pricing', fact: 'Listed at $460,000.', meaning: '' }],
    services: [],
    netSheet: {
      salePrice: 472000,
      lines: [],
      totalCosts: 0,
      estimatedNet: 472000,
      netConservative: 464000,
      netHighEnd: 481000,
      assumptions: [],
    },
    feeLine: '',
  },
})

const askedArgs = bannedWordArgs({
  subject: { ...subject, standardStatus: 'Active', lastListDate: '2026-08-01' },
})

describe('the seller document never says band, comp, subject, or tier', () => {
  const documents: Array<[string, string]> = [
    ['expired letter', renderCmaHtml(expiredArgs).html],
    ['expired immersive', renderImmersiveCmaHtml({ ...expiredArgs, broker }, 'https://ryan-realty.com')],
    ['asked letter', renderCmaHtml(askedArgs).html],
    ['asked immersive', renderImmersiveCmaHtml({ ...askedArgs, broker }, 'https://ryan-realty.com')],
  ]
  for (const [label, html] of documents) {
    it(`${label} carries no banned word`, () => {
      const hits = findSellerBannedWords(html)
      expect(
        hits.map((h) => `${h.label}: ...${h.excerpt}...`),
        `${label} must not say a banned word`,
      ).toEqual([])
    })
  }
})
