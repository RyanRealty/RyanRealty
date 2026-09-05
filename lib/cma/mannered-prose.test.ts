import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact } from '@/lib/cma/first-contact'
import { composeCmaBottomWhyList, composeCmaCoverIntro, emptyFsboCmaMergeFacts } from '@/lib/cma/fsbo-cma-templates'
import { whyThisListPrice } from '@/lib/cma/client-facing'
import { renderCmaHtml } from '@/lib/cma/render'
import { renderImmersiveCmaHtml } from '@/lib/cma/immersive'
import type { CmaAdjustedComp, CmaBroker, CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * Mannered CMA copy: a sentence whose job is to explain, praise, hedge, or
 * soften the sentence before it. Facts stay. Interpretation goes.
 */
const MANNERED =
  /full picture now|no pressure either way|room to negotiate|strategic list|matches what buyers|Lenders order appraisals|We spent time on why|wish you the best|boutique brokerage|the better path for this sale|all-time low|Under each one is our take|It is not a second list price|You have the full picture|left on the table|gets sharper in both directions|One quick sign-in confirms/i

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
  })
})
